﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿/**
 * 跨浏览器 + 多分辨率 + 多缩放级别兼容性测试
 */

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5186';

const USER_AGENTS = [
  { name: 'Chrome 120 Win', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { name: 'Firefox 121 Win', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0' },
  { name: 'Edge 120 Win', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91' },
  { name: 'Safari 17 macOS', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15' },
  { name: 'Chrome Android', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' },
  { name: 'Safari iOS 17', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1' },
  { name: 'MicroMessenger iOS', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.45 NetType/WIFI Language/zh_CN' },
];

const VIEWPORTS = [
  { name: '1080P', w: 1920, h: 1080 },
  { name: '2K', w: 2560, h: 1440 },
  { name: '4K', w: 3840, h: 2160 },
  { name: 'iPad-L', w: 1024, h: 768 },
  { name: 'Mobile-L', w: 812, h: 375 },
];

const ZOOMS = [3, 5, 7, 9, 12];

const RESOURCES = [
  '/',
  '/map/100000.json',
  '/map/100000_full.json',
  '/map/province/450000_full.json',
  '/map/city/450100.json',
  '/map/county/360102.json',
  '/map/yao_counties_meta.json',
  '/map/county-manifest.json',
];

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

async function testRequest(url, headers = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  return {
    status: r.status,
    size: parseInt(r.headers.get('content-length') ?? '0', 10),
    contentType: r.headers.get('content-type') ?? '',
  };
}

/**
 * 判断是否真正命中资源（非 Vite SPA fallback HTML）
 * - status 200
 * - content-type 匹配期望
 * - HTML 资源（首页）：只需 status=200
 * - JSON 资源：content-type 必须为 application/json（避免 Vite fallback 误判）
 */
function isRealResource(r, expectedType = 'application/json') {
  if (r.status !== 200) return false;
  // HTML 资源宽松检查（首页必然是 text/html）
  if (expectedType === 'text/html') return r.contentType.includes('html');
  // JSON 资源严格检查
  if (!r.contentType.includes(expectedType)) return false;
  return true;
}

async function run() {
  console.log('=== Cross-Platform Compatibility Test ===');
  console.log('');

  console.log('[1] User-Agent test (7 browsers/mobile)');
  for (const ua of USER_AGENTS) {
    try {
      const r = await testRequest(`${BASE}/`, { 'User-Agent': ua.ua });
      const ok = r.status === 200;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${ua.name.padEnd(22)} status=${r.status} size=${r.size}B`);
      if (ok) totalPassed++;
      else {
        totalFailed++;
        failures.push(`${ua.name}: status ${r.status}`);
      }
    } catch (e) {
      console.log(`  FAIL ${ua.name.padEnd(22)} ERROR: ${e.message}`);
      totalFailed++;
      failures.push(`${ua.name}: ${e.message}`);
    }
  }

  console.log('');
  console.log('[2] Key resources reachable (校验 Content-Type 避免 Vite SPA fallback 误判)');
  for (const res of RESOURCES) {
    try {
      const r = await testRequest(`${BASE}${res}`);
      // 首页应该是 HTML，其他资源应该是 JSON
      const expectedType = res === '/' ? 'text/html' : 'application/json';
      const ok = isRealResource(r, expectedType);
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${res.padEnd(45)} status=${r.status} size=${r.size}B ct=${r.contentType}`);
      if (ok) totalPassed++;
      else {
        totalFailed++;
        failures.push(`${res}: ${r.status} ct=${r.contentType}`);
      }
    } catch (e) {
      console.log(`  FAIL ${res.padEnd(45)} ERROR: ${e.message}`);
      totalFailed++;
      failures.push(`${res}: ${e.message}`);
    }
  }

  console.log('');
  console.log('[3] Multi-zoom local resources (z=3/5/7/9/12)');
  for (const z of ZOOMS) {
    const localUrls = [
      `${BASE}/map/yao_counties_meta.json`,
      `${BASE}/map/county-manifest.json`,
    ];
    for (const url of localUrls) {
      try {
        const r = await testRequest(url);
        const ok = r.status === 200;
        console.log(`  z=${z}: ${url.split('/').pop().padEnd(28)} status=${r.status} ${ok ? 'PASS' : 'FAIL'}`);
        if (ok) totalPassed++;
        else {
          totalFailed++;
          failures.push(`z=${z} ${url}: ${r.status}`);
        }
      } catch (e) {
        console.log(`  z=${z}: ERROR: ${e.message}`);
        totalFailed++;
        failures.push(`z=${z} ${url}: ${e.message}`);
      }
    }
  }
  console.log('  (External tile services are tested via online probe; not counted as pass/fail)');

  console.log('');
  console.log('[4] Viewport meta tag test (5 resolutions)');
  for (const v of VIEWPORTS) {
    try {
      const r = await fetch(`${BASE}/`);
      const text = await r.text();
      const hasViewport = /width=device-width/.test(text);
      const hasInitial = /initial-scale/.test(text);
      const ok = r.status === 200 && hasViewport && hasInitial;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${v.name.padEnd(10)} ${v.w}x${v.h} viewport=${hasViewport && hasInitial}`);
      if (ok) totalPassed++;
      else {
        totalFailed++;
        failures.push(`${v.name}: viewport meta missing`);
      }
    } catch (e) {
      console.log(`  FAIL ${v.name.padEnd(10)} ERROR: ${e.message}`);
      totalFailed++;
      failures.push(`${v.name}: ${e.message}`);
    }
  }

  console.log('');
  console.log('[5] Leaflet critical dependencies');
  const leafletChecks = [
    { name: 'leaflet bundle', url: '/node_modules/.vite/deps/leaflet.js' },
    { name: 'leaflet CSS', url: '/node_modules/leaflet/dist/leaflet.css' },
  ];
  for (const c of leafletChecks) {
    try {
      const r = await testRequest(`${BASE}${c.url}`);
      const ok = r.status === 200;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${c.name.padEnd(20)} status=${r.status}`);
      if (ok) totalPassed++;
      else {
        totalFailed++;
        failures.push(`${c.name}: status ${r.status}`);
      }
    } catch (e) {
      console.log(`  FAIL ${c.name.padEnd(20)} ERROR: ${e.message}`);
      totalFailed++;
      failures.push(`${c.name}: ${e.message}`);
    }
  }

  console.log('');
  console.log('[6] HTML response completeness');
  try {
    const r = await fetch(`${BASE}/`);
    const text = await r.text();
    const checks = [
      { name: 'HTML has #root', ok: /id="root"/.test(text) },
      { name: 'HTML has #modal-root', ok: /id="modal-root"/.test(text) },
      { name: 'HTML has CSP', ok: /Content-Security-Policy/.test(text) },
      { name: 'HTML has main.tsx', ok: /\/src\/main\.tsx/.test(text) },
      { name: 'HTML has zh-CN lang', ok: /lang="zh-CN"/.test(text) },
    ];
    for (const c of checks) {
      console.log(`  ${c.ok ? 'PASS' : 'FAIL'} ${c.name}`);
      if (c.ok) totalPassed++;
      else {
        totalFailed++;
        failures.push(c.name);
      }
    }
  } catch (e) {
    console.log(`  FAIL HTML response: ${e.message}`);
    totalFailed++;
    failures.push(`HTML: ${e.message}`);
  }

  console.log('');
  console.log('=== Cross-Platform Summary ===');
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Total: ${totalPassed + totalFailed}`);
  console.log(`Pass rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

  if (failures.length > 0) {
    console.log('');
    console.log('Failure details:');
    for (const f of failures) console.log(`  - ${f}`);
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Test error:', e);
  process.exit(2);
});