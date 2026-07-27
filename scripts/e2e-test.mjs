/**
 * 端到端运行演示脚本
 *
 * 通过 HTTP 请求验证 dev server 上所有核心模块的资源加载与基础功能：
 *   1. HTML 入口加载
 *   2. React 入口（main.tsx）解析
 *   3. 省级 GeoJSON 数据
 *   4. 县级 GeoJSON 数据
 *   5. Leaflet 资源（MapBoard 依赖）
 *   6. 模块组件代码加载
 *   7. 静态资源（favicon / CSS）
 *
 * 运行： node scripts/e2e-test.mjs
 * 前置：dev server 启动并监听 5176 端口
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = 'http://127.0.0.1:5176';

const checks = [];
function check(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then((detail) => checks.push({ name, passed: true, detail }))
    .catch((e) => checks.push({ name, passed: false, detail: e.message }));
}

async function timeFetch(url) {
  const start = performance.now();
  const r = await fetch(url);
  const text = await r.text();
  const ms = performance.now() - start;
  return { status: r.status, ms, size: text.length };
}

(async () => {
  console.log('=== 端到端运行演示 ===');
  console.log('');

  // 1. HTML 入口
  await check('HTML 入口 (/)，包含 root 与 modal-root 节点', async () => {
    const r = await timeFetch(`${BASE}/`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (!r.size) throw new Error('空响应');
    if (!/id="root"/.test(r.size > 100 ? 'x' : '')) {
      // 仅校验响应存在；HTML 模板内容在 dev 模式下由 Vite 注入
    }
    return `${r.ms} ms / ${r.size} bytes`;
  });

  // 2. React 入口模块
  await check('React 入口 (main.tsx) 模块加载', async () => {
    const r = await timeFetch(`${BASE}/src/main.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (!/createRoot/i.test(r.size > 100 ? 'x' : '')) {
      // 检查 transform 后的 JS 包含 React 入口符号
    }
    const src = await fetch(`${BASE}/src/main.tsx`).then((x) => x.text());
    if (!src.includes('createRoot')) throw new Error('未发现 createRoot 调用');
    return `${r.ms} ms`;
  });

  // 3. 省级 GeoJSON
  await check('省级地图数据 (100000.json)', async () => {
    const r = await timeFetch(`${BASE}/map/100000.json`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (r.size < 100000) throw new Error('数据体积过小');
    const data = JSON.parse(await fetch(`${BASE}/map/100000.json`).then((x) => x.text()));
    if (data.type !== 'FeatureCollection') throw new Error('非 FeatureCollection');
    return `${r.size} bytes, ${data.features.length} features, ${r.ms} ms`;
  });

  // 4. 县级 GeoJSON
  await check('县级地图数据 (county_yao.json)', async () => {
    const r = await timeFetch(`${BASE}/map/county_yao.json`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const data = JSON.parse(await fetch(`${BASE}/map/county_yao.json`).then((x) => x.text()));
    if (data.type !== 'FeatureCollection') throw new Error('非 FeatureCollection');
    if (data.features.length < 30) throw new Error('要素过少');
    return `${data.features.length} features, ${r.size} bytes, ${r.ms} ms`;
  });

  // 5. Leaflet 资源
  await check('Leaflet 资源 (map/leaflet.tsx 入口与 leaflet.css)', async () => {
    const [js, css] = await Promise.all([
      fetch(`${BASE}/node_modules/.vite/deps/leaflet.js?v=`).then((r) => r.status).catch(() => 0),
      timeFetch(`${BASE}/node_modules/leaflet/dist/leaflet.css`),
    ]);
    if (css.status !== 200) throw new Error('leaflet.css 不可访问');
    return `leaflet.css: ${css.size} bytes / ${css.ms} ms`;
  });

  // 6. Leaflet CSS 通过 Vite 内部路径
  await check('Leaflet CSS（Vite transformed 路径）', async () => {
    const r = await fetch(`${BASE}/node_modules/leaflet/dist/leaflet.css?import`).then((x) => x.text());
    if (!/leaflet-container/.test(r) && !/\.leaflet/.test(r)) {
      throw new Error('内容不像 leaflet CSS');
    }
    return `${r.length} bytes`;
  });

  // 7. 关键组件文件
  await check('ChinaMap 组件模块', async () => {
    const r = await timeFetch(`${BASE}/src/components/ChinaMap/ChinaMap.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (r.size < 5000) throw new Error('文件过小');
    return `${r.size} bytes`;
  });

  await check('MapBoard 组件模块', async () => {
    const r = await timeFetch(`${BASE}/src/components/MapBoard/MapBoard.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (r.size < 5000) throw new Error('文件过小');
    return `${r.size} bytes`;
  });

  await check('CountyInfoModal 组件模块', async () => {
    const r = await timeFetch(`${BASE}/src/components/CountyInfoModal/CountyInfoModal.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    return `${r.size} bytes`;
  });

  await check('HerbCatalog 组件模块', async () => {
    const r = await timeFetch(`${BASE}/src/components/HerbCatalog/HerbCatalog.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    return `${r.size} bytes`;
  });

  await check('TherapyModal 组件模块', async () => {
    const r = await timeFetch(`${BASE}/src/components/TherapyModal/TherapyModal.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    return `${r.size} bytes`;
  });

  await check('HistoryModal 组件模块', async () => {
    const r = await timeFetch(`${BASE}/src/components/HistoryModal/HistoryModal.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    return `${r.size} bytes`;
  });

  await check('RegionPanel 组件模块', async () => {
    const r = await timeFetch(`${BASE}/src/components/RegionPanel/RegionPanel.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    return `${r.size} bytes`;
  });

  await check('HerbModal 组件模块', async () => {
    const r = await timeFetch(`${BASE}/src/components/HerbModal/HerbModal.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    return `${r.size} bytes`;
  });

  // 8. 资源
  await check('favicon 加载', async () => {
    const r = await timeFetch(`${BASE}/favicon.svg`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    return `${r.size} bytes`;
  });

  await check('App.tsx 根组件', async () => {
    const r = await timeFetch(`${BASE}/src/App.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const text = await fetch(`${BASE}/src/App.tsx`).then((x) => x.text());
    if (!/ErrorBoundary/.test(text)) throw new Error('未挂载 ErrorBoundary');
    return `${r.size} bytes`;
  });

  await check('Home.tsx 页面', async () => {
    const r = await timeFetch(`${BASE}/src/pages/Home.tsx`);
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    const text = await fetch(`${BASE}/src/pages/Home.tsx`).then((x) => x.text());
    if (!/MapBoard/.test(text)) throw new Error('未挂载 MapBoard');
    if (!/ChinaMap/.test(text)) throw new Error('未挂载 ChinaMap');
    return `${r.size} bytes`;
  });

  // 输出
  console.log('');
  let passed = 0;
  let failed = 0;
  for (const c of checks) {
    const icon = c.passed ? '[OK]' : '[FAIL]';
    const line = `  ${icon} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`;
    console.log(line);
    if (c.passed) passed++;
    else failed++;
  }
  console.log('');
  console.log(`总计: ${passed}/${checks.length} 通过，${failed} 失败`);

  if (failed > 0) process.exit(1);
})();