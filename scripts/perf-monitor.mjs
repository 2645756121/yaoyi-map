/**
 * 性能与资源监测
 *
 * 监测指标：
 *   1. dev server 进程的 CPU / 内存占用（Node.js side）
 *   2. HTTP 响应时间分布（首屏 / 静态资源 / GeoJSON）
 *   3. 并发负载下的响应稳定性
 *   4. dev server 长时间运行的内存增长趋势
 *
 * 前置：dev server 启动监听 5176
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const BASE = 'http://127.0.0.1:5176';

async function timeFetch(url, init) {
  const start = performance.now();
  const r = await fetch(url, init);
  const text = await r.text();
  return {
    status: r.status,
    ms: performance.now() - start,
    size: text.length,
  };
}

async function measureLoad(url, iterations = 5) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const r = await timeFetch(url);
    times.push(r.ms);
  }
  times.sort((a, b) => a - b);
  return {
    min: times[0],
    max: times[times.length - 1],
    median: times[Math.floor(times.length / 2)],
    p95: times[Math.floor(times.length * 0.95)],
    avg: times.reduce((a, b) => a + b, 0) / times.length,
  };
}

async function getNodeProcesses() {
  // Windows: 用 tasklist 查找 node.exe
  try {
    const { stdout } = await execAsync(
      'tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH',
      { windowsHide: true }
    );
    return stdout
      .trim()
      .split('\n')
      .filter((l) => l.includes('node.exe'))
      .map((l) => {
        const parts = l.split('","');
        return {
          name: parts[0]?.replace('"', '').trim(),
          pid: parts[1]?.replace('"', '').trim(),
          memory: parts[4]?.replace('"', '').trim(), // 工作集大小
        };
      });
  } catch (e) {
    return [];
  }
}

async function run() {
  console.log('=== 性能与资源监测 ===');
  console.log('');

  // 1. 资源响应时间
  console.log('--- 资源响应时间（5 次采样）---');
  const urls = [
    { name: 'HTML 入口', url: `${BASE}/` },
    { name: '省级 GeoJSON', url: `${BASE}/map/100000.json` },
    { name: '县级 GeoJSON', url: `${BASE}/map/county_yao.json` },
    { name: 'favicon', url: `${BASE}/favicon.svg` },
    { name: 'leaflet CSS', url: `${BASE}/node_modules/leaflet/dist/leaflet.css` },
  ];
  for (const u of urls) {
    const m = await measureLoad(u.url, 5);
    console.log(
      `  ${u.name.padEnd(16)} min=${m.min.toFixed(0)}ms  med=${m.median.toFixed(0)}ms  p95=${m.p95.toFixed(0)}ms  max=${m.max.toFixed(0)}ms  avg=${m.avg.toFixed(0)}ms`
    );
  }
  console.log('');

  // 2. 并发负载
  console.log('--- 并发负载（20 并发请求 × 3 轮）---');
  for (let round = 1; round <= 3; round++) {
    const start = performance.now();
    const promises = Array.from({ length: 20 }, () => timeFetch(`${BASE}/`));
    const results = await Promise.all(promises);
    const ms = performance.now() - start;
    const ok = results.filter((r) => r.status === 200).length;
    const avg = results.reduce((s, r) => s + r.ms, 0) / results.length;
    console.log(`  Round ${round}: 20 req in ${ms.toFixed(0)}ms, ${ok}/20 OK, avg ${avg.toFixed(0)}ms/req`);
  }
  console.log('');

  // 3. dev server 进程资源
  console.log('--- dev server Node 进程资源 ---');
  const procs = await getNodeProcesses();
  if (procs.length === 0) {
    console.log('  未检测到 node 进程（可能非 Windows 或 tasklist 不可用）');
  } else {
    for (const p of procs) {
      console.log(`  PID ${p.pid}: ${p.name} - 内存: ${p.memory}`);
    }
  }
  console.log('');

  // 4. 长时间运行内存趋势
  console.log('--- dev server 内存变化（30 秒采样）---');
  for (let i = 0; i < 5; i++) {
    const procs2 = await getNodeProcesses();
    if (procs2.length > 0) {
      const mems = procs2.map((p) => p.memory).join(' / ');
      console.log(`  T+${i * 5}s: ${mems}`);
    } else {
      console.log(`  T+${i * 5}s: 进程未检测到`);
    }
    if (i < 4) await new Promise((r) => setTimeout(r, 5000));
  }
  console.log('');

  // 5. 端到端：模拟完整首屏加载
  console.log('--- 完整首屏加载链路 ---');
  const start = performance.now();
  await timeFetch(`${BASE}/`);
  await timeFetch(`${BASE}/src/main.tsx`);
  await timeFetch(`${BASE}/src/App.tsx`);
  await timeFetch(`${BASE}/src/index.css`);
  await timeFetch(`${BASE}/src/pages/Home.tsx`);
  await timeFetch(`${BASE}/map/100000.json`);
  await timeFetch(`${BASE}/map/county_yao.json`);
  await timeFetch(`${BASE}/favicon.svg`);
  const total = performance.now() - start;
  console.log(`  8 资源顺序加载：${total.toFixed(0)} ms`);
  console.log('  并行加载应 < 300ms；超 2000ms 视为不达标');
}

run().catch((e) => {
  console.error('监测异常:', e);
  process.exit(2);
});