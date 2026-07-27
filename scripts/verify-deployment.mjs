#!/usr/bin/env node
/**
 * 部署验证脚本（端到端）
 *
 * 使用：node scripts/verify-deployment.mjs http://localhost:5187
 * 默认检查 http://127.0.0.1:5199/
 */

import http from 'node:http';

const BASE = process.argv[2] || 'http://127.0.0.1:5199';
const BASE_URL = new URL(BASE);
const HOST = BASE_URL.hostname;
const PORT = parseInt(BASE_URL.port || '80', 10);

const get = (path, headers = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: HOST, port: PORT, path, method: 'GET', headers }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, length: data.length, data }));
  });
  req.on('error', reject);
  req.end();
});

let pass = 0, fail = 0;
const ok = (msg) => { console.log(`  ✓ ${msg}`); pass++; };
const bad = (msg) => { console.log(`  ✗ ${msg}`); fail++; };

(async () => {
  console.log(`\n=========================================`);
  console.log(`  部署验证目标: ${BASE}`);
  console.log(`=========================================\n`);

  // ==========================================================
  // STAGE 1: 基础健康检查
  // ==========================================================
  console.log('▼ STAGE 1: 基础健康检查');
  const routes = [
    { path: '/', expect: 200, desc: '首页 index.html' },
    { path: '/healthz', expect: 200, desc: '健康检查' },
    { path: '/readyz', expect: 200, desc: '就绪检查' },
    { path: '/metrics', expect: 200, desc: 'Prometheus 指标' },
    { path: '/map/100000.json', expect: 200, desc: '国家 GeoJSON' },
    { path: '/map/100000_full.json', expect: 200, desc: '国家 GeoJSON (full)' },
    { path: '/herbs/gancao.svg', expect: 200, desc: '草药 SVG' },
    { path: '/favicon.svg', expect: 200, desc: 'favicon' },
    { path: '/assets/index-BwfCDTIc.css', expect: 200, desc: '主 CSS chunk' },
    { path: '/assets/index-Dsi55u3x.js', expect: 200, desc: '主 JS chunk' },
  ];
  for (const r of routes) {
    const res = await get(r.path);
    const len = res.headers['content-length'] || res.length;
    const cc = res.headers['cache-control'] || 'none';
    if (res.status === r.expect) {
      const ccNote = cc.includes('immutable') ? '🟢 1y immutable' : cc.includes('max-age=3600') ? '🟡 1h' : '⚪ no-cache';
      ok(`${r.path.padEnd(34)} ${res.status} | len=${len.toString().padStart(7)} | ${ccNote}`);
    } else {
      bad(`${r.path} → ${res.status} (期望 ${r.expect})`);
    }
  }

  // ==========================================================
  // STAGE 2: SPA fallback
  // ==========================================================
  console.log('\n▼ STAGE 2: SPA fallback (所有未匹配路径应回退到 index.html)');
  const spaPaths = ['/about', '/random/path/123', '/api/non-existent', '/'];
  for (const p of spaPaths) {
    const r = await get(p);
    const has = r.data.includes('id="root"') && r.data.includes('src="/assets/index');
    if (has && r.status === 200) ok(`${p.padEnd(28)} → 200 + SPA shell`);
    else bad(`${p} → ${r.status}, SPA shell=${has}`);
  }

  // ==========================================================
  // STAGE 3: 错误处理
  // ==========================================================
  console.log('\n▼ STAGE 3: 错误处理');
  const r404 = await get('/assets/no-such-file.js');
  if (r404.status === 404) ok('不存在的资源 → 404');
  else bad(`/assets/no-such-file.js → ${r404.status} (期望 404)`);

  // ==========================================================
  // STAGE 4: Gzip 压缩
  // ==========================================================
  console.log('\n▼ STAGE 4: Gzip 压缩效果');
  const r1 = await get('/', { 'Accept-Encoding': 'gzip' });
  const r2 = await get('/');
  if (r1.headers['content-encoding'] === 'gzip') {
    ok(`gzip 生效 (Accept-Encoding 请求)`);
    ok(`原始 HTML: 1386B → gzip 后: ${r1.length}B  (节省 ${Math.round((1 - r1.length/1386) * 100)}%)`);
  } else {
    bad(`gzip 未生效: enc=${r1.headers['content-encoding']}`);
  }

  // GeoJSON gzip
  const rg1 = await get('/map/100000.json', { 'Accept-Encoding': 'gzip' });
  const rg2 = await get('/map/100000.json');
  const orig = parseInt(rg2.headers['content-length']);
  if (rg1.headers['content-encoding'] === 'gzip') {
    ok(`/map/100000.json gzip: ${orig}B → ${rg1.length}B  (节省 ${Math.round((1 - rg1.length/orig) * 100)}%)`);
  }

  // ==========================================================
  // STAGE 5: 安全头
  // ==========================================================
  console.log('\n▼ STAGE 5: 安全 HTTP 头');
  const rIdx = await get('/');
  const secChecks = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': 'default-src',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  for (const [name, expectedFragment] of Object.entries(secChecks)) {
    const got = rIdx.headers[name.toLowerCase()];
    if (got && got.includes(expectedFragment)) {
      ok(`${name.padEnd(28)} = ${got.substring(0, 90)}${got.length > 90 ? '...' : ''}`);
    } else {
      bad(`${name} missing or wrong: ${got || 'NOT SET'}`);
    }
  }
  console.log('  ℹ 注：Strict-Transport-Security / Cross-Origin-Opener-Policy / Permissions-Policy 由 nginx 容器配置提供');
  console.log('        当前 server.cjs 仅在 HTTPS 模式下启用 HSTS');

  // ==========================================================
  // STAGE 6: 缓存策略
  // ==========================================================
  console.log('\n▼ STAGE 6: 缓存策略');
  const cacheChecks = [
    { path: '/', expects: /no-cache|no-store|must-revalidate/, name: 'HTML 不缓存' },
    { path: '/map/100000.json', expects: /max-age=3600/, name: 'GeoJSON 1 小时缓存' },
    { path: '/assets/index-BwfCDTIc.css', expects: /max-age=31536000|immutable/, name: '带 hash 资源 1 年 immutable' },
  ];
  for (const c of cacheChecks) {
    const r = await get(c.path);
    const cc = r.headers['cache-control'] || '';
    if (c.expects.test(cc)) ok(`${c.path.padEnd(34)} ${cc}`);
    else bad(`${c.path} → Cache-Control: ${cc}`);
  }

  // ==========================================================
  // STAGE 7: 主页内容核查
  // ==========================================================
  console.log('\n▼ STAGE 7: 主页内容核查');
  const main = await get('/');
  const checks = [
    ['<!doctype html>', 'HTML5 doctype'],
    ['id="root"', 'root 容器'],
    ['id="modal-root"', 'modal 容器'],
    ['src="/assets/index-', '主入口 JS'],
    ['href="/assets/index-', '主入口 CSS'],
    ['href="/favicon.svg"', 'favicon'],
    ['Content-Security-Policy', 'CSP meta 标签'],
    ['viewport', 'viewport meta'],
    ['lang="zh-CN"', '语言声明'],
  ];
  for (const [needle, desc] of checks) {
    if (main.data.includes(needle)) ok(`包含 ${desc}`);
    else bad(`缺少 ${desc}`);
  }

  // ==========================================================
  // STAGE 8: GeoJSON 数据完整性
  // ==========================================================
  console.log('\n▼ STAGE 8: GeoJSON 数据完整性');
  const geo = JSON.parse((await get('/map/100000.json')).data);
  if (geo.type === 'FeatureCollection') {
    ok(`/map/100000.json: FeatureCollection, ${geo.features.length} features`);
  } else {
    bad(`GeoJSON 结构错误: ${geo.type}`);
  }

  // ==========================================================
  // 汇总
  // ==========================================================
  console.log(`\n=========================================`);
  console.log(`  总计: ${pass} 通过 / ${fail} 失败`);
  console.log(`=========================================\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
