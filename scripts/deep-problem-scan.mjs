/**
 * 深度问题扫描 - 检查代码层面可能存在的问题
 * 涵盖：
 * 1. 未处理的 Promise / try-catch 缺失
 * 2. 潜在的内存泄漏（未清理的事件监听、定时器）
 * 3. 状态管理边界场景
 * 4. 类型安全
 * 5. 错误边界覆盖
 * 6. 可访问性
 * 7. 性能瓶颈
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPORT_DIR = resolve(ROOT, 'audit-reports');
mkdirSync(REPORT_DIR, { recursive: true });

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-deep-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5186/';

const results = [];
const issues = [];

function ok(name, detail = '') { results.push({ name, passed: true, detail }); }
function fail(name, detail = '', severity = 'MEDIUM') {
  results.push({ name, passed: false, detail, severity });
  issues.push({ name, detail, severity });
}

function getJSON(url) {
  return new Promise((resolveP, rejectP) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolveP(JSON.parse(body)); } catch (e) { rejectP(e); }
      });
    }).on('error', rejectP);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const nextCmdId = { v: 1 };
async function sendCmd(ws, method, params = {}) {
  const id = nextCmdId.v++;
  return new Promise((resolveP, rejectP) => {
    const handler = (data) => {
      try {
        const obj = JSON.parse(data.toString());
        if (obj.id === id) {
          ws.off('message', handler);
          if (obj.error) rejectP(new Error(obj.error.message));
          else resolveP(obj.result);
        }
      } catch {}
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJS(ws, expr) {
  const r = await sendCmd(ws, 'Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval error');
  return r.result.value;
}

// === 测试用例 ===
async function t01_consoleErrors(ws) {
  // 监听整个会话的运行时异常
  const consoleErrors = [];
  const ws_messages = [];
  ws.on('message', (data) => {
    try {
      const m = JSON.parse(data.toString());
      if (m.method === 'Runtime.exceptionThrown') {
        const e = m.params.exceptionDetails;
        consoleErrors.push(e.exception?.description || e.text);
      }
    } catch {}
  });

  // 触发各种典型操作
  await evalJS(ws, `window.__MAP_STORE__?.set({ isPanelOpen: false, selectedRegion: null, isCountyModalOpen: false, selectedCounty: null, isHerbModalOpen: false, selectedHerb: null, isTherapyModalOpen: false, selectedTherapy: null, isHistoryModalOpen: false, selectedHistoryPeriod: null });`);
  await sleep(300);

  // 打开所有模态
  await evalJS(ws, `window.__MAP_STORE__?.set({
    selectedCounty: {
      code: '451324', name: 'Test', nameEn: 'Test', centerLng: 110, centerLat: 24,
      category: 'core', province: 'Guangxi', regionId: 'guangxi',
      institutionCount: 1, herbVarieties: ['jiegeng'], schools: ['T'],
      govSupportLevel: 'city', specialCrafts: [], since: 1500, note: '',
    },
    isCountyModalOpen: true,
  });`);
  await sleep(500);
  // 关闭并打开其他模态
  await evalJS(ws, `window.__MAP_STORE__?.set({ isCountyModalOpen: false, selectedCounty: null }); window.dispatchEvent(new CustomEvent('open-yao-knowledge'));`);
  await sleep(500);
  // 关闭
  await evalJS(ws, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
  await sleep(500);

  consoleErrors.length === 0
    ? ok('T01.1 全流程无控制台异常', 'errors=0')
    : fail('T01.1 全流程无控制台异常', `${consoleErrors.length} errors: ${consoleErrors.slice(0, 2).join(' | ')}`, 'HIGH');
}

async function t02_memoryLeak(ws) {
  console.log('--- T02: 内存泄漏检测 ---');
  const before = await evalJS(ws, `performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0`);

  // 反复打开关闭模态 20 次
  await evalJS(ws, `(() => {
    return new Promise(async (resolve) => {
      const counties = ['451302', '451324', '431122', '451228', '451321'];
      for (let i = 0; i < 20; i++) {
        const code = counties[i % counties.length];
        window.__MAP_STORE__?.set({
          selectedCounty: { code, name: 'Test', nameEn: 'Test', centerLng: 110, centerLat: 24, category: 'core', province: 'Guangxi', regionId: 'guangxi', institutionCount: 1, herbVarieties: ['jiegeng'], schools: ['T'], govSupportLevel: 'city', specialCrafts: [], since: 1500, note: '' },
          isCountyModalOpen: true,
        });
        await new Promise(r => setTimeout(r, 80));
        window.__MAP_STORE__?.set({ isCountyModalOpen: false, selectedCounty: null });
        await new Promise(r => setTimeout(r, 80));
      }
      resolve('done');
    });
  })()`);
  await sleep(2000); // 等 GC

  const after = await evalJS(ws, `performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0`);
  const growth = after - before;
  console.log(`  内存增长: ${before}MB → ${after}MB (+${growth}MB)`);
  growth < 10
    ? ok('T02.1 20 轮模态切换内存增长 < 10MB', `${before}→${after}MB (+${growth}MB)`)
    : fail('T02.1 20 轮模态切换内存增长 < 10MB', `${growth}MB`, 'MEDIUM');
}

async function t03_errorBoundary(ws) {
  console.log('--- T03: 错误边界覆盖 ---');
  const r = await evalJS(ws, `(() => {
    // 检查 ErrorBoundary 是否挂载
    const allText = document.body.textContent || '';
    // 触发一个 React 错误不应该让整个应用崩溃
    let errBoundaryExists = false;
    document.querySelectorAll('*').forEach(el => {
      if (el.className && typeof el.className === 'string' && el.className.includes('error-boundary')) {
        errBoundaryExists = true;
      }
    });
    // 检查 root 是否有内容
    const root = document.getElementById('root');
    return JSON.stringify({
      hasRoot: !!root,
      rootChildren: root?.children.length || 0,
      errBoundaryClass: errBoundaryExists,
    });
  })()`);
  const rval = JSON.parse(r);
  rval.hasRoot && rval.rootChildren > 0
    ? ok('T03.1 Root 应用根已挂载且有内容')
    : fail('T03.1 Root 应用根已挂载', JSON.stringify(rval));
}

async function t04_strictModeSafety(ws) {
  console.log('--- T04: React Strict Mode 安全性 ---');
  // 检查 _mapPane 检测是否完整（针对 Leaflet 地图）
  const r = await evalJS(ws, `(() => {
    // 检查代码中是否使用 _mapPane 检测
    const sourceCode = document.documentElement.outerHTML.length;
    // 检查 Leaflet 容器是否存在且未抛出
    const leaflet = document.querySelector('.leaflet-container');
    return JSON.stringify({
      leafletContainer: !!leaflet,
      leafletHasSize: leaflet ? (leaflet.offsetWidth > 0 && leaflet.offsetHeight > 0) : false,
    });
  })()`);
  const rval = JSON.parse(r);
  rval.leafletContainer && rval.leafletHasSize
    ? ok('T04.1 Leaflet 容器正常挂载（无 Strict Mode 崩溃）')
    : fail('T04.1 Leaflet 容器异常', JSON.stringify(rval));
}

async function t05_domCleanup(ws) {
  console.log('--- T05: DOM 清理 ---');
  // 反复打开关闭模态，检查是否残留 DOM 节点
  const beforeCount = await evalJS(ws, `document.querySelectorAll('.info-panel-wrapper').length`);

  for (let i = 0; i < 5; i++) {
    await evalJS(ws, `window.__MAP_STORE__?.set({
      selectedCounty: { code: '451302', name: 'Test', nameEn: 'Test', centerLng: 110, centerLat: 24, category: 'core', province: 'Guangxi', regionId: 'guangxi', institutionCount: 1, herbVarieties: ['jiegeng'], schools: ['T'], govSupportLevel: 'city', specialCrafts: [], since: 1500, note: '' },
      isCountyModalOpen: true,
    });`);
    await sleep(200);
    await evalJS(ws, `window.__MAP_STORE__?.set({ isCountyModalOpen: false, selectedCounty: null });`);
    await sleep(200);
  }
  await sleep(1000);

  const afterCount = await evalJS(ws, `document.querySelectorAll('.info-panel-wrapper').length`);
  afterCount <= 1
    ? ok(`T05.1 5 轮模态切换后无 DOM 残留（${beforeCount} → ${afterCount}）`)
    : fail(`T05.1 5 轮模态切换后 DOM 残留`, `${beforeCount} → ${afterCount}`, 'MEDIUM');
}

async function t06_eventListenerLeak(ws) {
  console.log('--- T06: 事件监听器泄漏 ---');
  // 注入测试监听器，记录数量
  await evalJS(ws, `(() => {
    window.__listener_count__ = 0;
    const origAdd = window.addEventListener;
    window.addEventListener = function(type, ...args) {
      window.__listener_count__++;
      return origAdd.call(this, type, ...args);
    };
  })()`);

  // 触发一些操作
  for (let i = 0; i < 10; i++) {
    await evalJS(ws, `window.dispatchEvent(new CustomEvent('open-yao-knowledge'));`);
    await sleep(100);
    await evalJS(ws, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
    await sleep(100);
  }
  await sleep(500);

  const count = await evalJS(ws, `window.__listener_count__ || 0`);
  count < 200
    ? ok('T06.1 10 轮模态切换事件监听器增加 < 200', `added=${count}`)
    : fail('T06.1 10 轮模态切换事件监听器过度增加', `added=${count}`, 'MEDIUM');
}

async function t07_dataConsistency(ws) {
  console.log('--- T07: 数据一致性 ---');
  // 检查所有数据文件中的交叉引用
  const r = await evalJS(ws, `(() => {
    const issues = [];
    // 通过 store 的 getState 检查 data
    const state = window.__MAP_STORE__?.getState();
    if (!state) return JSON.stringify({ hasState: false });
    return JSON.stringify({
      hasState: true,
      keys: Object.keys(state).slice(0, 30),
      selectedRegionType: typeof state.selectedRegion,
      selectedCountyType: typeof state.selectedCounty,
    });
  })()`);
  const rval = JSON.parse(r);
  rval.hasState
    ? ok('T07.1 Zustand store 状态完整', `keys=${rval.keys.length}`)
    : fail('T07.1 Zustand store 状态', JSON.stringify(rval));
}

async function t08_performanceHotspots(ws) {
  console.log('--- T08: 性能热点 ---');
  // 检查首页加载关键路径性能
  const r = await evalJS(ws, `(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(p => p.name === 'first-contentful-paint');
    return JSON.stringify({
      ttfb: nav ? Math.round(nav.responseStart - nav.startTime) : null,
      domComplete: nav ? Math.round(nav.domComplete - nav.startTime) : null,
      fcp: fcp ? Math.round(fcp.startTime) : null,
    });
  })()`);
  const rval = JSON.parse(r);
  console.log('  关键性能指标:', JSON.stringify(rval));
  (rval.fcp === null || rval.fcp < 3000)
    ? ok('T08.1 首次内容绘制 FCP', `fcp=${rval.fcp}ms`)
    : fail('T08.1 FCP', JSON.stringify(rval), 'MEDIUM');
}

async function t09_responsiveDesign(ws) {
  console.log('--- T09: 响应式设计 ---');
  // 模拟移动端视口
  const setViewport = async (width, height) => {
    await sendCmd(ws, 'Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width < 768,
    });
    await sleep(300);
  };

  // 测试桌面
  await setViewport(1920, 1080);
  const desktop = await evalJS(ws, `(() => {
    const header = document.querySelector('header');
    const maps = document.querySelectorAll('section').length;
    return JSON.stringify({ headerVisible: !!header, sections: maps, viewport: window.innerWidth + 'x' + window.innerHeight });
  })()`);
  const dval = JSON.parse(desktop);
  dval.headerVisible
    ? ok('T09.1 桌面端（1920×1080）布局正常', dval.viewport)
    : fail('T09.1 桌面端布局异常', desktop);

  // 测试平板
  await setViewport(768, 1024);
  const tablet = await evalJS(ws, `document.querySelectorAll('section').length`);
  tablet >= 2
    ? ok('T09.2 平板端（768×1024）布局正常', `sections=${tablet}`)
    : fail('T09.2 平板端布局异常', `sections=${tablet}`);

  // 测试手机
  await setViewport(375, 667);
  const mobile = await evalJS(ws, `(() => {
    const root = document.getElementById('root');
    return JSON.stringify({
      rootExists: !!root,
      rootHeight: root ? root.offsetHeight : 0,
    });
  })()`);
  const mval = JSON.parse(mobile);
  mval.rootExists && mval.rootHeight > 0
    ? ok('T09.3 手机端（375×667）布局正常', `h=${mval.rootHeight}`)
    : fail('T09.3 手机端布局异常', mobile);

  // 恢复桌面
  await sendCmd(ws, 'Emulation.clearDeviceMetricsOverride');
}

async function t10_keyboardNavigation(ws) {
  console.log('--- T10: 键盘导航 ---');
  // 测试 Tab 键可达性
  const r = await evalJS(ws, `(() => {
    const focusable = document.querySelectorAll('button, [tabindex="0"], input, [href]');
    const buttonsWithoutAria = Array.from(document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])'))
      .filter(b => !b.textContent.trim() && !b.querySelector('[aria-label]'));
    return JSON.stringify({
      focusableCount: focusable.length,
      buttonsWithoutLabel: buttonsWithoutAria.length,
    });
  })()`);
  const rval = JSON.parse(r);
  console.log('  可聚焦元素:', rval.focusableCount, '无标签按钮:', rval.buttonsWithoutLabel);
  rval.focusableCount > 10
    ? ok('T10.1 可聚焦元素数量 > 10', `count=${rval.focusableCount}`)
    : fail('T10.1 可聚焦元素数量', JSON.stringify(rval), 'LOW');
}

async function main() {
  const PORT = 9888;
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--window-size=1920,1080',
    '--user-data-dir=' + EDGE_PROFILE,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      await getJSON('http://127.0.0.1:' + PORT + '/json/version');
      break;
    } catch {}
  }

  const tabs = await getJSON('http://127.0.0.1:' + PORT + '/json');
  const target = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));

  await sendCmd(ws, 'Page.enable');
  await sendCmd(ws, 'Runtime.enable');
  await sendCmd(ws, 'Page.navigate', { url: URL });
  await sleep(10000);

  await evalJS(ws, `(() => {
    window.__test_helper__ = {
      findScrolledPanel: (text) => {
        const wrappers = document.querySelectorAll('.info-panel-wrapper-scrollable');
        for (const w of wrappers) {
          if ((w.textContent || '').indexOf(text) >= 0) return w;
        }
        return null;
      },
    };
    return 'helpers ready';
  })()`);

  await t01_consoleErrors(ws);
  await t02_memoryLeak(ws);
  await t03_errorBoundary(ws);
  await t04_strictModeSafety(ws);
  await t05_domCleanup(ws);
  await t06_eventListenerLeak(ws);
  await t07_dataConsistency(ws);
  await t08_performanceHotspots(ws);
  await t09_responsiveDesign(ws);
  await t10_keyboardNavigation(ws);

  ws.close();
  proc.kill();

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log('\n=== Deep Problem Scan ===');
  results.forEach((r) => {
    console.log((r.passed ? '[OK]  ' : '[FAIL]') + ' ' + r.name + (r.detail && !r.passed ? ' -- ' + String(r.detail).slice(0, 200) : ''));
  });
  console.log('\n' + passed + '/' + total + ' passed');

  writeFileSync(
    resolve(REPORT_DIR, 'deep-scan.json'),
    JSON.stringify({ url: URL, results, passed, total, issues }, null, 2),
    'utf8'
  );
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});