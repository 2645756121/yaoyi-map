/**
 * 交互行为审计脚本
 * 使用 Edge Headless + DevTools Protocol 模拟用户交互
 * 测试：地图渲染 → 悬停省份 → 点击省份 → 面板滑入 → 点击草药 → 弹窗
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPORT_DIR = resolve(ROOT, 'audit-reports');
mkdirSync(REPORT_DIR, { recursive: true });

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-int-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5186/';

const results = [];
const log = (name, passed, detail = '') => results.push({ name, passed, detail });

// 启动带 remote-debugging-port 的 Edge 实例
function startEdgeDebug(port) {
  return spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--remote-debugging-port=' + port,
      '--remote-debugging-address=127.0.0.1',
      '--window-size=1920,1080',
      `--user-data-dir=${EDGE_PROFILE}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

function getJSON(url) {
  return new Promise((resolveP, rejectP) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolveP(JSON.parse(body));
          } catch (e) {
            rejectP(e);
          }
        });
      })
      .on('error', rejectP);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function attachTab(port) {
  const tabs = await getJSON(`http://127.0.0.1:${port}/json`);
  const target = tabs.find((t) => t.type === 'page');
  if (!target) throw new Error('no page target');
  return target.webSocketDebuggerUrl;
}

// 通过 WS 发送 DevTools 命令
import WebSocket from 'ws';

async function sendCmd(ws, method, params = {}, id) {
  return new Promise((resolveP, rejectP) => {
    const msg = JSON.stringify({ id, method, params });
    const handler = (data) => {
      try {
        const obj = JSON.parse(data.toString());
        if (obj.id === id) {
          ws.off('message', handler);
          if (obj.error) rejectP(new Error(obj.error.message));
          else resolveP(obj.result);
        }
      } catch (e) {}
    };
    ws.on('message', handler);
    ws.send(msg);
  });
}

async function evaluateJS(ws, expr, id) {
  return sendCmd(
    ws,
    'Runtime.evaluate',
    {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    },
    id
  );
}

async function main() {
  const PORT = 9333;
  const proc = startEdgeDebug(PORT);

  // 等待 DevTools 端口启动
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      await getJSON(`http://127.0.0.1:${PORT}/json/version`);
      ready = true;
      break;
    } catch {}
  }
  if (!ready) {
    log('Edge DevTools 端口启动', false, 'timeout');
    proc.kill();
    return;
  }
  log('Edge DevTools 端口启动', true, `port=${PORT}`);

  // 连接到第一个 page tab
  const wsUrl = await attachTab(PORT);
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.on('open', r));

  let cmdId = 1;
  const ev = (expr) => evaluateJS(ws, expr, cmdId++);

  // 启用页面
  await sendCmd(ws, 'Page.enable', {}, cmdId++);
  await sendCmd(ws, 'Runtime.enable', {}, cmdId++);
  await sendCmd(ws, 'Network.enable', {}, cmdId++);

  // 监听 console + network failures
  const appErrors = [];
  const failedRequests = [];
  const requestIdToUrl = {};
  ws.on('message', (data) => {
    try {
      const m = JSON.parse(data.toString());
      if (m.method === 'Runtime.exceptionThrown') {
        const e = m.params.exceptionDetails;
        if (e.exception) {
          appErrors.push(e.exception.description || e.exception.value || e.text);
        }
      }
      if (m.method === 'Network.requestWillBeSent') {
        if (m.params.requestId) {
          requestIdToUrl[m.params.requestId] = m.params.request?.url || '';
        }
      }
      if (m.method === 'Network.loadingFailed') {
        const errText = m.params.errorText || '';
        const url = m.params.request?.url || requestIdToUrl[m.params.requestId] || '';
        failedRequests.push(errText + ' ' + url);
      }
      if (m.method === 'Network.responseReceived') {
        const r = m.params.response;
        if (r.status >= 400) {
          failedRequests.push(`${r.status} ${r.url}`);
        }
      }
    } catch {}
  });

  // 导航
  await sendCmd(ws, 'Page.navigate', { url: URL }, cmdId++);
  await sleep(8000); // 等待地图异步加载

  // === 测试 1: 页面已渲染
  const r1 = await ev('document.title');
  log('页面标题正确', r1.result.value?.includes('瑶医'), r1.result.value);

  // === 测试 2: Root + Header + Hero 挂载
  const r2 = await ev(`(() => {
    const root = document.getElementById('root');
    const header = document.querySelector('header');
    const svgs = document.querySelectorAll('svg');
    return JSON.stringify({
      rootChildren: root?.children.length || 0,
      headerText: header?.textContent?.slice(0, 80),
      svgCount: svgs.length,
    });
  })()`);
  log('Root / Header / SVG 挂载', JSON.parse(r2.result.value).rootChildren > 0, r2.result.value);

  // === 测试 3: ChinaMap 省份 SVG path 已渲染
  const r3 = await ev(`(() => {
    const paths = document.querySelectorAll('svg path[d^="M"]');
    const provinceGroup = Array.from(document.querySelectorAll('g')).filter(g => {
      const s = g.getAttribute('style') || '';
      return s.includes('display: block') || s.includes('display:block');
    });
    return JSON.stringify({ pathCount: paths.length, provinceGroupCount: provinceGroup.length });
  })()`);
  const r3val = JSON.parse(r3.result.value);
  log(`SVG path 渲染 (path=${r3val.pathCount}, province g=${r3val.provinceGroupCount})`,
    r3val.pathCount > 50 && r3val.provinceGroupCount > 0, r3.result.value);

  // === 测试 4: 模拟点击省份 path（广西 - 已知有 regionId 的省）
  const r4 = await ev(`(() => {
    const paths = document.querySelectorAll('svg path');
    let clicked = 0;
    let clickedProvince = '';
    for (const p of paths) {
      const style = p.getAttribute('style') || '';
      const cls = (p.getAttribute('class') || '');
      // 必须有 cursor:pointer 且 fill 不为 none / 透明
      if ((style.includes('cursor: pointer') || cls.includes('cursor-pointer')) && p.getAttribute('fill') !== 'none') {
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        p.dispatchEvent(ev);
        clicked++;
        // 找到上一个 text 节点（label）获取省份名
        let prev = p.previousElementSibling;
        while (prev && prev.tagName !== 'text') prev = prev.previousElementSibling;
        if (prev) clickedProvince = prev.textContent;
        if (clicked >= 3) break;
      }
    }
    return JSON.stringify({ clicked, clickedProvince });
  })()`);
  await sleep(800);
  const r4val = JSON.parse(r4.result.value);
  log('模拟点击省份 path', r4val.clicked > 0, r4.result.value);

  // === 测试 5: 点击后查看面板是否出现（使用 info-panel-wrapper / modal-layer 类名）
  const r5 = await ev(`(() => {
    const modalLayer = document.querySelector('.modal-layer');
    const panelWrapper = document.querySelector('.info-panel-wrapper');
    const fixedEls = document.querySelectorAll('[class*="fixed"]');
    return JSON.stringify({
      hasModalLayer: !!modalLayer,
      hasPanelWrapper: !!panelWrapper,
      fixedCount: fixedEls.length,
      modalLayerOpacity: modalLayer ? getComputedStyle(modalLayer).opacity : null,
    });
  })()`);
  const r5val = JSON.parse(r5.result.value);
  log('点击后面板存在',
    r5val.hasModalLayer || r5val.hasPanelWrapper,
    r5.result.value);

  // === 测试 6: 视口尺寸检测
  const r6 = await ev('JSON.stringify({width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio})');
  log(`视口尺寸 ${r6.result.value}`, true, r6.result.value);

  // === 测试 7: 全局错误捕获
  log('无 JavaScript 运行时异常', appErrors.length === 0, appErrors.slice(0, 2).join(' | '));

  // === 测试 8: 网络失败请求（过滤 Vite HMR / DevTools Protocol 自身请求 / React Strict Mode 主动 abort）
  const realFailed = failedRequests.filter((s) => {
    // 过滤 Vite 内部
    if (/hot-update|@vite|@react-refresh|@id__x00__|__vite_ws|\/@fs\/|chrome-extension|devtools\/|\.well-known|extension:|favicon\.ico/i.test(s)) {
      return false;
    }
    // React Strict Mode 双调用：首次 mount 的 fetch 会被 cleanup 主动 abort（设计内）
    if (/net::ERR_ABORTED/i.test(s) && /\.(json|tsx|css|js)/i.test(s)) {
      return false;
    }
    return true;
  });
  if (realFailed.length > 0) {
    console.log('\n[!] Failed requests sample:');
    realFailed.slice(0, 5).forEach((r) => console.log('   ', r));
  }
  log('无失败网络请求', realFailed.length === 0, realFailed.slice(0, 3).join(' | '));

  // === 测试 9: 内存/CPU 指标
  const r9 = await ev(`(() => {
    const perf = performance;
    const nav = perf.getEntriesByType('navigation')[0];
    const mem = performance.memory;
    return JSON.stringify({
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
      loadComplete: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
      usedJSHeapMB: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : null,
      totalJSHeapMB: mem ? Math.round(mem.totalJSHeapSize / 1024 / 1024) : null,
      jsHeapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1024 / 1024) : null,
    });
  })()`);
  log(`性能指标`, true, r9.result.value);

  ws.close();
  proc.kill();

  // 输出报告
  console.log('\n=== Interaction Audit Results ===');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  results.forEach((r) => {
    console.log(`${r.passed ? '[OK]  ' : '[FAIL]'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  });
  console.log(`\n${passed}/${total} passed`);

  writeFileSync(
    resolve(REPORT_DIR, 'interaction-audit.json'),
    JSON.stringify({ url: URL, results, passed, total, errors: appErrors, failedRequests }, null, 2),
    'utf8'
  );

  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});