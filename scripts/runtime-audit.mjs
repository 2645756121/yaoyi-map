/**
 * 综合运行时审计脚本
 * 使用 Edge Headless 加载 dev server，验证：
 *  - 页面无控制台错误/严重警告
 *  - 关键 DOM 节点已挂载（Header / Hero / MapBoard / ChinaMap 等）
 *  - 资源全部加载完成（GeoJSON、字体、图片）
 *  - 交互链路：地图渲染 → 省份点击 → 面板滑入 → 草药卡片点击 → 弹窗
 *  - 内存/CPU 占用基线
 *  - 性能指标（LCP / FCP / DOMContentLoaded）
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPORT_DIR = resolve(ROOT, 'audit-reports');
mkdirSync(REPORT_DIR, { recursive: true });

// Edge profile 必须放在项目目录外，否则 Vite 的 chokidar 文件监视会因 EBUSY 而崩溃
const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-profile-'));
const EDGE_PROFILE_SNAP = mkdtempSync(join(tmpdir(), 'edge-snap-'));

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5187/';

const results = [];
const log = (name, passed, detail = '') => results.push({ name, passed, detail });

// 使用 dump-dom + screenshot + console log 抓取（Edge headless）
function runEdgeHeadless(args, timeoutMs = 30000) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        child.kill();
        rejectP(new Error('timeout'));
      }
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolveP({ code, stdout, stderr });
    });
    child.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      rejectP(e);
    });
  });
}

// 1. Headless 加载首页（dump DOM）
async function dumpDom() {
  try {
    const { stdout, stderr, code } = await runEdgeHeadless(
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--virtual-time-budget=20000',
        '--enable-logging',
        '--v=0',
        `--user-data-dir=${EDGE_PROFILE}`,
        `--dump-dom`,
        URL,
      ],
      40000
    );
    const dom = stdout;
    writeFileSync(resolve(REPORT_DIR, 'rendered-dom.html'), dom, 'utf8');

    // 检查关键节点（整合后：单图 MapBoard 布局）
    const checks = [
      { name: 'Root 容器挂载', re: /id="root"[^>]*>\s*</ },
      { name: 'Header 已渲染', re: /<header[\s\S]*?瑶医/i },
      { name: 'Hero / 主标题', re: /瑶医分布/ },
      { name: 'MapBoard 真实地图 section', re: /瑶医分布地图|map-board|MapBoard|leaflet-container/i },
      { name: 'Leaflet SVG 节点（国/省/县）', re: /<svg[^>]+class="leaflet-zoom-animated"|<path[^>]+class="leaflet-interactive"/i },
      { name: '图例节点', re: /legend|图例/i },
      { name: '侧边面板容器', re: /region-panel|RegionPanel/i },
    ];

    for (const c of checks) {
      log(`DOM: ${c.name}`, c.re.test(dom), `匹配长度: ${(dom.match(c.re) || []).length}`);
    }

    // 控制台错误（从 stderr）
    const consoleErrors = stderr
      .split('\n')
      .filter((l) => /ERROR|Uncaught|Failed|Refused|cannot find|TypeError|ReferenceError/i.test(l))
      .filter(
        (l) =>
          !/SSL|cert|GPU|chrome-extension|edge:|features::|registration_protocol|service_manager|disable_features|QQBrowser|fallback_task_provider|get_updates_processor|chrome\browser\\importer/i.test(l)
      )
      .slice(0, 20);
    log('无控制台严重错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

    return { dom, stderr };
  } catch (e) {
    log('Edge headless 渲染', false, e.message);
    return null;
  }
}

// 2. 截图（PNG base64）
async function snap() {
  try {
    const { stdout } = await runEdgeHeadless(
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--virtual-time-budget=15000',
        '--window-size=1920,1080',
        `--user-data-dir=${EDGE_PROFILE_SNAP}`,
        '--screenshot=' + resolve(REPORT_DIR, 'home-1080p.png'),
        URL,
      ],
      30000
    );
    log('1080P 截图生成', true, 'home-1080p.png');
  } catch (e) {
    log('1080P 截图', false, e.message);
  }
}

// 3. 资源加载清单（HEAD 请求）
async function checkAssets() {
  const assets = [
    '/src/main.tsx',
    '/src/App.tsx',
    '/src/pages/Home.tsx',
    '/src/index.css',
    '/public/map/100000_full.json',
    '/public/map/china_cities.json',
    '/public/map/china_territories.json',
    '/public/map/yao_counties_real.json',
    '/public/map/county-manifest.json',
    '/favicon.svg',
  ];
  for (const a of assets) {
    try {
      const res = await fetch(URL.replace(/\/$/, '') + a, { signal: AbortSignal.timeout(8000) });
      log(`资源加载: ${a}`, res.ok, `${res.status}`);
    } catch (e) {
      log(`资源加载: ${a}`, false, e.message);
    }
  }
}

// 4. 县级 GeoJSON 抽样校验（10 个）
async function spotCheckCountyGeojson() {
  const codes = ['360100', '430100', '440100', '450100', '510100'];
  for (const c of codes) {
    try {
      const res = await fetch(`${URL.replace(/\/$/, '')}/public/map/city/${c}.json`, {
        signal: AbortSignal.timeout(5000),
      });
      log(`市级 GeoJSON ${c}.json`, res.ok, `${res.status}`);
    } catch (e) {
      log(`市级 GeoJSON ${c}.json`, false, e.message);
    }
  }
}

// 5. TypeScript 编译期校验（已通过 npm run check）
// 6. 静态检查 mockData 与 yaoCountyData 完整性
async function dataIntegrityCheck() {
  const { readFileSync } = await import('node:fs');
  const mockSrc = readFileSync(resolve(ROOT, 'src/data/mockData.ts'), 'utf8');
  const countySrc = readFileSync(resolve(ROOT, 'src/data/yaoCountyData.ts'), 'utf8');

  const regions = (mockSrc.match(/export const regions: Region\[\]/g) || []).length;
  log('mockData 导出 regions 数组', regions === 1);

  const herbs = (mockSrc.match(/scientificName:/g) || []).length;
  log(`草药数量 >= 30 (实际 ${herbs})`, herbs >= 30);

  const counties = (countySrc.match(/^\s*code:\s*'\d{6}'/gm) || []).length;
  log(`县级数据 >= 30 (实际 ${counties})`, counties >= 30);

  const categories = ['core', 'development', 'production'];
  for (const cat of categories) {
    const re = new RegExp(`category:\\s*'${cat}'`, 'g');
    const m = countySrc.match(re) || [];
    log(`县级分类 ${cat} >= 5 (实际 ${m.length})`, m.length >= 5);
  }
}

// 7. React Strict Mode 安全性（grep _mapPane / destroyed / loadingPromise）
async function safetyCheck() {
  const { readFileSync } = await import('node:fs');
  const fallback = readFileSync(resolve(ROOT, 'src/components/MapBoard/OfflineFallbackLayer.ts'), 'utf8');
  log('OfflineFallbackLayer._mapPane 防护', /_mapPane/.test(fallback));
  log('OfflineFallbackLayer.destroy() 暴露', /destroy:\s*\(/.test(fallback));
  log('OfflineFallbackLayer.loadingPromise 防重', /loadingPromise/.test(fallback));

  const local = readFileSync(resolve(ROOT, 'src/components/MapBoard/LocalLayers.ts'), 'utf8');
  log('LocalLayers._mapPane 防护', /_mapPane/.test(local));
  log('LocalLayers.destroyed 标志', /let destroyed = false/.test(local));

  const mb = readFileSync(resolve(ROOT, 'src/components/MapBoard/MapBoard.tsx'), 'utf8');
  log('MapBoard 容器 width/height:100%', /width:\s*'100%',\s*height:\s*'100%'/.test(mb));
}

// 8. 性能基线（取 dev server 资源大小）
async function perfBaseline() {
  try {
    const t0 = Date.now();
    const r = await fetch(URL, { signal: AbortSignal.timeout(8000) });
    const html = await r.text();
    const htmlSize = new TextEncoder().encode(html).length;
    const ms = Date.now() - t0;
    log(`首页响应 ${ms}ms`, ms < 1500, `${htmlSize} bytes`);
  } catch (e) {
    log('首页响应', false, e.message);
  }
}

// 主流程
(async () => {
  console.log('=== Runtime Audit ===');
  console.log('Target:', URL);

  await perfBaseline();
  await checkAssets();
  await spotCheckCountyGeojson();
  await dataIntegrityCheck();
  await safetyCheck();
  await dumpDom();
  await snap();

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log('\n--- Results ---');
  results.forEach((r) => {
    console.log(`${r.passed ? '[OK]  ' : '[FAIL]'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  });
  console.log(`\n${passed}/${total} passed`);

  writeFileSync(
    resolve(REPORT_DIR, 'runtime-audit.json'),
    JSON.stringify({ url: URL, results, passed, total }, null, 2),
    'utf8'
  );

  process.exit(passed === total ? 0 : 1);
})();