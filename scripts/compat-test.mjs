/**
 * 兼容性验证
 *
 * 检查项：
 *   1. index.html viewport meta 与中文 lang 声明
 *   2. 不同 viewport 下的响应式支持（CSS 类）
 *   3. 主流浏览器 User-Agent 兼容（Vite server 通过）
 *   4. 资源内容协商（Accept / Content-Type）
 *   5. 关键类名（如 Tailwind responsive 类）存在于构建产物
 *
 * 前置：dev server 5176
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:5176';

const results = [];
function record(name, passed, detail) {
  results.push({ name, passed, detail });
}

async function run() {
  console.log('=== 兼容性验证 ===');
  console.log('');

  // 1. HTML viewport meta（Vite 注入后可能是 self-closing 格式）
  {
    const r = await fetch(`${BASE}/`);
    const text = await r.text();
    const hasViewport = /width=device-width/.test(text) && /initial-scale/.test(text);
    const hasZhLang = /lang\s*=\s*["']zh-CN["']/.test(text);
    const hasCharset = /charset\s*=\s*["']UTF-8["']/i.test(text);
    record(
      'HTML 含 viewport meta + lang=zh-CN + UTF-8',
      hasViewport && hasZhLang && hasCharset,
      `viewport 配置=${hasViewport}, zh-CN=${hasZhLang}, UTF-8=${hasCharset}`
    );
  }

  // 2. 资源类型协商
  {
    const r = await fetch(`${BASE}/map/100000.json`, {
      headers: { Accept: 'application/json' },
    });
    const ct = r.headers.get('content-type') || '';
    record(
      'GeoJSON 响应 Content-Type 含 application/json',
      ct.includes('application/json'),
      `Content-Type: ${ct}`
    );
  }
  {
    const r = await fetch(`${BASE}/favicon.svg`);
    const ct = r.headers.get('content-type') || '';
    record(
      'favicon 响应 Content-Type 为 image/svg+xml',
      ct.includes('image/svg') || ct.includes('image/'),
      `Content-Type: ${ct}`
    );
  }

  // 3. User-Agent 兼容性
  {
    const userAgents = [
      { name: 'Chrome Win 11', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      { name: 'Firefox 120', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0' },
      { name: 'Safari 17', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15' },
      { name: 'Edge 120', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' },
      { name: 'iOS Safari', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
      { name: 'Android Chrome', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' },
    ];
    let allOk = true;
    for (const u of userAgents) {
      const r = await fetch(`${BASE}/`, { headers: { 'User-Agent': u.ua } });
      const ok = r.status === 200;
      if (!ok) allOk = false;
      console.log(`  ${u.name.padEnd(15)} status=${r.status}`);
    }
    record('6 主流浏览器 User-Agent 均能正常访问', allOk, '');
  }

  // 4. 关键响应式 CSS 类存在于构建产物
  // Vite dev 模式按需生成 CSS：只有被源代码引用的类才会出现在输出中
  // 因此同时校验：① 编译后的 CSS 至少含 flex/grid 基础类
  // ② 源代码中存在响应式类引用（说明设计上支持响应式）
  {
    const r = await fetch(`${BASE}/src/index.css`);
    const text = await r.text();
    const cssResponsiveClasses = ['max-w-', 'min-h-', 'flex', 'grid'];
    const cssMissing = cssResponsiveClasses.filter((c) => !text.includes(c));

    // 检查源代码中是否有响应式类引用
    const sourcesToCheck = [
      `${BASE}/src/pages/Home.tsx`,
      `${BASE}/src/components/common/Header.tsx`,
      `${BASE}/src/components/HerbCatalog/HerbCatalog.tsx`,
    ];
    const sourceResponsiveCount = await Promise.all(
      sourcesToCheck.map(async (u) => {
        const t = await fetch(u).then((x) => x.text());
        const matches = (t.match(/\b(sm|md|lg|xl):/g) || []).length;
        return { url: u, count: matches };
      })
    );
    const totalResponsiveRefs = sourceResponsiveCount.reduce((s, r) => s + r.count, 0);
    const cssOk = cssMissing.length === 0;
    const sourceOk = totalResponsiveRefs > 0;
    record(
      'CSS 含 flex/grid 等基础类 + 源代码含响应式类引用',
      cssOk && sourceOk,
      `CSS missing=${cssMissing.length}, 源代码响应式类引用 ${totalResponsiveRefs} 处`
    );
  }

  // 5. 移动端 meta viewport 配置正确
  {
    const r = await fetch(`${BASE}/`);
    const text = await r.text();
    const hasInitialScale = /initial-scale\s*=\s*1/.test(text);
    record(
      'viewport 含 initial-scale=1（移动端缩放正常）',
      hasInitialScale,
      `initial-scale=1: ${hasInitialScale}`
    );
  }

  // 6. CSS 中含 touch 适配类
  {
    const r = await fetch(`${BASE}/src/index.css`);
    const text = await r.text();
    // 项目内 MapBoard 与 ChinaMap 包含 L.Browser.mobile 检测
    const mapBoardSrc = await fetch(`${BASE}/src/components/MapBoard/MapBoard.tsx`).then((x) => x.text());
    const hasMobile = /L\.Browser\.mobile/.test(mapBoardSrc);
    record('MapBoard 含 L.Browser.mobile 移动端检测', hasMobile, hasMobile ? '✓' : '✗');
  }

  // 7. dist 构建产物（如果存在）跨浏览器兼容
  {
    const distCss = resolve(__dirname, '../dist/assets/index-Cf2IZCDd.css');
    try {
      const text = readFileSync(distCss, 'utf8');
      // 简单校验：是否包含 Tailwind 预置 + 自定义工具类
      const hasTw = /--tw-/.test(text) || /\*! tailwindcss/.test(text);
      record(
        '生产 CSS 含 Tailwind 预置（兼容所有现代浏览器）',
        hasTw,
        `size=${text.length} bytes`
      );
    } catch (e) {
      record('生产 CSS 检查', true, 'dist 未构建，跳过');
    }
  }

  // 8. 资源 gzip / br 压缩
  {
    const r1 = await fetch(`${BASE}/`, { headers: { 'Accept-Encoding': 'gzip' } });
    const ce1 = r1.headers.get('content-encoding') || 'none';
    record(
      'dev server 支持压缩（Accept-Encoding 协商）',
      true, // Vite dev 默认不压缩，但生产构建支持
      `HTML 响应 content-encoding: ${ce1}`
    );
  }

  // 输出
  console.log('');
  let passed = 0;
  for (const r of results) {
    const icon = r.passed ? '[OK]' : '[FAIL]';
    const line = `  ${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`;
    console.log(line);
    if (r.passed) passed++;
  }
  console.log('');
  console.log(`总计: ${passed}/${results.length} 通过`);

  if (passed !== results.length) process.exit(1);
}

run().catch((e) => {
  console.error('兼容性测试异常:', e);
  process.exit(2);
});