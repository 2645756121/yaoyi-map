#!/usr/bin/env node
/**
 * server.cjs 回归测试
 *
 * 覆盖：
 *   A. 空字节 URL 不再导致进程崩溃（必须 400 拒绝）
 *   B. 错误编码 URL 优雅拒绝
 *   C. 路径遍历仍被阻断
 *   D. Vite 哈希资源正确设置 immutable 缓存
 *   E. 服务在多次恶意请求后仍存活
 *   F. 正常流量不受影响
 */

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1';
const PORT = 5187;
const DIST_DIR = path.resolve(__dirname, 'dist');

const results = [];
function record(name, ok, info = '') {
  results.push({ name, ok, info });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${info ? ' — ' + info : ''}`);
}

function request(p, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HOST, port: PORT, path: p, method: opts.method || 'GET', headers: opts.headers || {},
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function tcpAlive() {
  return new Promise((r) => {
    const s = net.createConnection({ port: PORT, host: HOST });
    let ok = false;
    s.on('connect', () => { ok = true; s.end(); });
    s.on('error', () => r(false));
    s.on('close', () => { if (ok) r(true); });
    setTimeout(() => { if (!ok) { s.destroy(); r(false); } }, 2000);
  });
}

async function section(name, fn) {
  console.log(`\n── ${name} ──`);
  await fn();
}

// === A. 空字节 URL ===
async function testNullByte() {
  await section('A. 空字节 URL 防御', async () => {
    const alive1 = await tcpAlive();
    record('A0 服务存活（pre-check）', alive1, alive1 ? 'TCP OK' : 'TCP FAIL');

    // 直接发 /%00bad
    const r1 = await request('/%00bad');
    record('A1 /%00bad 返回 400', r1.status === 400, `status=${r1.status}`);
    record('A2 响应体含 null-byte 提示',
      /null byte/i.test(r1.body.toString('utf8')), r1.body.toString('utf8').slice(0, 60));

    // 仍然存活
    const alive2 = await tcpAlive();
    record('A3 空字节请求后服务仍存活', alive2);

    // 多个变种
    const variants = [
      '/file%00.txt',
      '/%00',
      '/index.html%00.js',
      '/%C0%80',  // overlong null byte (UTF-8)
      '/normal/%00/inside',
    ];
    for (const v of variants) {
      const r = await request(v);
      record(`A4 ${v} 安全处理`, r.status === 400 || r.status === 200 || r.status === 403 || r.status === 404,
        `status=${r.status}`);
    }

    const alive3 = await tcpAlive();
    record('A5 连续空字节攻击后服务存活', alive3);
  });
}

// === B. 错误编码 ===
async function testBadEncoding() {
  await section('B. 错误编码 URL 防御', async () => {
    // %FF%FE 是非法的 UTF-8 编码序列
    const r = await request('/%FF%FEabc');
    record('B1 %FF%FE 编码拒绝', r.status === 400, `status=${r.status}`);
    record('B2 响应体说明', /invalid URL encoding/i.test(r.body.toString('utf8')),
      r.body.toString('utf8').slice(0, 60));
    const alive = await tcpAlive();
    record('B3 错误编码后服务存活', alive);
  });
}

// === C. 路径遍历 ===
async function testPathEscape() {
  await section('C. 路径遍历阻断', async () => {
    const r1 = await request('/../../../etc/passwd');
    record('C1 /../../../etc/passwd → 403', r1.status === 403, `status=${r1.status}`);
    const r2 = await request('/%2e%2e/%2e%2e/etc/passwd');
    record('C2 URL 编码的 ../ → 403', r2.status === 403, `status=${r2.status}`);
    const alive = await tcpAlive();
    record('C3 路径遍历后服务存活', alive);
  });
}

// === D. 缓存头修复 ===
async function testCacheHeader() {
  await section('D. 哈希资源缓存头', async () => {
    // Vite 实际产物名
    const assetsDir = path.join(DIST_DIR, 'assets');
    const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js') && !f.endsWith('.map'));
    record('D0 发现 hashed JS 文件', jsFiles.length > 0, `${jsFiles.length} files`);

    // 列出所有 JS 文件及其缓存头
    let allImmutable = true;
    for (const js of jsFiles) {
      const r = await request(`/assets/${js}`);
      const cc = r.headers['cache-control'] || '';
      const isImmutable = /max-age=31536000/.test(cc) && /immutable/.test(cc);
      if (!isImmutable) allImmutable = false;
      record(`D1 ${js} → immutable`, isImmutable, `cache-control="${cc}"`);
    }
    record('D2 全部 hashed 资源 immutable', allImmutable);

    // CSS 也应如此
    const cssFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.css'));
    for (const css of cssFiles) {
      const r = await request(`/assets/${css}`);
      const cc = r.headers['cache-control'] || '';
      record(`D3 ${css} → immutable`, /max-age=31536000/.test(cc) && /immutable/.test(cc), `cache-control="${cc}"`);
    }

    // 非 hashed 资源应使用 max-age=3600
    const r4 = await request('/herbs/huangqi.svg');
    const cc4 = r4.headers['cache-control'] || '';
    record('D4 herb SVG 短期缓存', /max-age=3600/.test(cc4), `cache-control="${cc4}"`);

    // index.html 必须 no-cache
    const r5 = await request('/');
    const cc5 = r5.headers['cache-control'] || '';
    record('D5 index.html no-cache', /no-cache/.test(cc5), `cache-control="${cc5}"`);
  });
}

// === E. 持续存活测试 ===
async function testResilience() {
  await section('E. 服务存活能力', async () => {
    // 100 次交替恶意 / 正常请求
    let crash = false;
    for (let i = 0; i < 50; i++) {
      try {
        await request('/%00attack_' + i);
        await request('/');
        await request('/assets/' + fs.readdirSync(path.join(DIST_DIR, 'assets'))[0]);
      } catch (e) {
        crash = true;
        break;
      }
      if (!(await tcpAlive())) {
        crash = true;
        break;
      }
    }
    record('E1 100 次混合请求后存活', !crash);
    const finalAlive = await tcpAlive();
    record('E2 最终 TCP 连接存活', finalAlive);
  });
}

// === F. 正常流量回归 ===
async function testNormalTraffic() {
  await section('F. 正常流量回归', async () => {
    // 首页
    const r1 = await request('/');
    record('F1 GET /', r1.status === 200 && /瑶医分布/.test(r1.body.toString('utf8')),
      `status=${r1.status}`);

    // favicon
    const r2 = await request('/favicon.svg');
    record('F2 GET /favicon.svg', r2.status === 200);

    // map 数据
    const r3 = await request('/map/100000.json');
    record('F3 GET /map/100000.json', r3.status === 200);

    // SPA fallback
    const r4 = await request('/some/route');
    record('F4 GET /some/route (SPA fallback)', r4.status === 200 && /text\/html/.test(r4.headers['content-type'] || ''));

    // 草药 SVG
    const r5 = await request('/herbs/huangqi.svg');
    record('F5 GET /herbs/huangqi.svg', r5.status === 200);

    // 县级 GeoJSON
    const r6 = await request('/map/county/360102.json');
    record('F6 GET /map/county/360102.json', r6.status === 200);

    // 并发
    const promises = [];
    for (let i = 0; i < 30; i++) promises.push(request('/'));
    const results = await Promise.all(promises);
    const okCount = results.filter(r => r.status === 200).length;
    record('F7 30 并发首页请求', okCount === 30, `${okCount}/30`);

    // gzip
    const r8 = await request('/', { headers: { 'Accept-Encoding': 'gzip' } });
    record('F8 gzip 压缩', r8.status === 200 && r8.headers['content-encoding'] === 'gzip',
      `encoding=${r8.headers['content-encoding']}`);

    // 安全头
    record('F9 CSP 设置', !!r1.headers['content-security-policy']);
    record('F10 X-Content-Type-Options', r1.headers['x-content-type-options'] === 'nosniff');
    record('F11 Referrer-Policy', r1.headers['referrer-policy'] === 'strict-origin-when-cross-origin');
  });
}

async function run() {
  console.log('======================================');
  console.log('  server.cjs 回归测试');
  console.log('======================================');

  const startAlive = await tcpAlive();
  record('前置检查：服务在运行', startAlive);
  if (!startAlive) {
    console.error('服务未运行，请先执行：node server.cjs --no-browser 5187');
    process.exit(2);
  }

  await testNullByte();
  await testBadEncoding();
  await testPathEscape();
  await testCacheHeader();
  await testResilience();
  await testNormalTraffic();

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log('\n======================================');
  console.log(`  结果: ${passed}/${results.length} 通过, ${failed} 失败`);
  console.log('======================================');
  if (failed > 0) {
    console.log('\n失败项:');
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  ✗ ${r.name}: ${r.info}`);
    }
    process.exit(1);
  }
}

run().catch((e) => { console.error('FATAL:', e); process.exit(1); });