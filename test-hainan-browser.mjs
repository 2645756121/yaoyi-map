#!/usr/bin/env node
/**
 * 端到端验证：海南点击下钻
 *
 * 通过 CDP 连接 Edge headless，模拟点击海南省按钮，
 * 验证 DrillDownMap 能正确加载并渲染 3 个下辖县区。
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname);
const LOG_DIR = resolve(ROOT, 'logs', 'hainan-drilldown');
mkdirSync(LOG_DIR, { recursive: true });

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-hainan-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5187/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextId = { v: 1 };

function sendCmd(ws, method, params = {}) {
  const id = nextId.v++;
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
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

async function snap(ws, file) {
  const r = await sendCmd(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(r.data, 'base64'));
}

function getJSON(url) {
  return new Promise((resolveP, rejectP) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => { try { resolveP(JSON.parse(body)); } catch (e) { rejectP(e); } });
    }).on('error', rejectP);
  });
}

async function waitForEdge() {
  for (let i = 0; i < 30; i++) {
    try { await getJSON('http://127.0.0.1:9334/json/version'); return; } catch {}
    await sleep(300);
  }
  throw new Error('Edge failed to start');
}

const edgeProc = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--remote-debugging-port=9334',
  `--user-data-dir=${EDGE_PROFILE}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

const results = [];
function record(name, ok, info = '') {
  results.push({ name, ok, info });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${info ? ' — ' + info : ''}`);
}

(async () => {
  await waitForEdge();
  console.log('Edge ready');

  const list = await getJSON('http://127.0.0.1:9334/json/list');
  const tab = list.find((t) => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));

  await sendCmd(ws, 'Page.enable');
  await sendCmd(ws, 'Runtime.enable');
  await sendCmd(ws, 'Network.enable');
  await sendCmd(ws, 'Log.enable');

  // 收集网络请求用于验证县区加载
  const requests = [];
  ws.on('message', (data) => {
    try {
      const m = JSON.parse(data.toString());
      if (m.method === 'Network.responseReceived' && m.params.response.url.includes('/map/county/')) {
        const url = m.params.response.url;
        const adcode = url.match(/county\/(\d+)\.json/)?.[1];
        requests.push({ adcode, status: m.params.response.status });
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        console.error('  Console error:', m.params.args?.map(a => a.value).join(' '));
      }
    } catch {}
  });

  // 设置视口
  await sendCmd(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1366, height: 768, deviceScaleFactor: 1, mobile: false,
  });

  // 导航
  await sendCmd(ws, 'Page.navigate', { url: URL });
  await sleep(5000); // 等 Leaflet + 地图数据加载

  await snap(ws, join(LOG_DIR, '00-initial.png'));

  // === 1. 找到 "海南" 快速选择按钮并点击 ===
  console.log('\n── 1. 点击"海南"按钮 ──');

  // 列出所有省份按钮
  const provinceBtns = JSON.parse(await evalJS(ws, `(() => {
    const btns = Array.from(document.querySelectorAll('button[aria-label*="查看"]'));
    return JSON.stringify(btns.map(b => ({
      label: b.getAttribute('aria-label'),
      text: b.textContent?.trim(),
    })));
  })()`));
  console.log('  省份按钮:', provinceBtns.map(b => b.text).join(', '));
  const hainanBtn = provinceBtns.find(b => b.text === '海南');
  record('找到"海南"快速选择按钮', !!hainanBtn);

  await evalJS(ws, `(() => {
    const btn = Array.from(document.querySelectorAll('button[aria-label*="查看"]'))
      .find(b => b.textContent?.trim() === '海南');
    btn?.click();
  })()`);
  await sleep(2000);
  await snap(ws, join(LOG_DIR, '01-after-hainan-click.png'));

  // === 2. 检查地图是否 flyToBounds 到海南 ===
  console.log('\n── 2. 验证 flyToBounds 到海南 ──');
  const mapState = JSON.parse(await evalJS(ws, `(() => {
    const labels = Array.from(document.querySelectorAll('.province-label')).map(l => l.textContent);
    const markers = Array.from(document.querySelectorAll('.province-focused-label')).map(l => l.textContent);
    const paths = Array.from(document.querySelectorAll('svg path.leaflet-interactive'));
    return JSON.stringify({
      labels,
      markers,
      pathsCount: paths.length,
    });
  })()`));
  record('出现省级聚焦标签', mapState.markers.length > 0,
    `markers=${JSON.stringify(mapState.markers)}`);
  record('SVG path 渲染', mapState.pathsCount > 0, `paths=${mapState.pathsCount}`);

  // === 3. 验证网络请求：3 个海南县区都成功加载 ===
  console.log('\n── 3. 验证县区网络请求 ──');
  console.log('  请求:', requests);
  const hainanRequests = requests.filter(r => ['469030', '469029', '469002'].includes(r.adcode));
  record('3 个海南县区都被请求', hainanRequests.length === 3,
    `${hainanRequests.length}/3 requested: ${hainanRequests.map(r => r.adcode).join(', ')}`);
  record('所有请求返回 200', hainanRequests.every(r => r.status === 200),
    hainanRequests.map(r => `${r.adcode}=${r.status}`).join(', '));

  // === 4. 检查 SVG path 数量应增加（海南有省级 + 县级轮廓）===
  console.log('\n── 4. 验证 SVG path 数量 ──');
  // 等待 geojson 加载完（flyToBounds 后再 2 秒）
  await sleep(2000);
  const finalPaths = await evalJS(ws, `document.querySelectorAll('svg path.leaflet-interactive').length`);
  record('海南钻取后 path 数量 > 5', finalPaths > 5, `paths=${finalPaths}`);
  await snap(ws, join(LOG_DIR, '02-final-hainan-drilldown.png'));

  // === 5. 验证 3 个县级标签渲染 ===
  console.log('\n── 5. 验证 3 个县级标签 ──');
  const countyTags = JSON.parse(await evalJS(ws, `(() => {
    const tags = Array.from(document.querySelectorAll('.county-beauty-tag-wrapper'));
    return JSON.stringify(tags.map(t => t.textContent?.trim().replace(/\\s+/g, ' ')));
  })()`));
  console.log('  县级标签:', countyTags);
  const expected = ['琼中', '保亭', '琼海'];
  const matchedExpected = expected.filter(name => countyTags.some(t => t?.includes(name)));
  record('3 个预期县区标签', matchedExpected.length === 3,
    `matched=${matchedExpected.join(', ')}`);

  // === 6. 验证点击琼中县区标签打开模态框 ===
  console.log('\n── 6. 点击"琼中"县区标签 ──');
  await evalJS(ws, `(() => {
    const tag = Array.from(document.querySelectorAll('.county-beauty-tag-wrapper'))
      .find(t => t.textContent?.includes('琼中'));
    tag?.click();
  })()`);
  await sleep(1500);
  await snap(ws, join(LOG_DIR, '03-county-modal.png'));

  const modalShown = JSON.parse(await evalJS(ws, `(() => {
    // 模态框存在性检测
    const modal = document.querySelector('[role="dialog"]') ||
                  Array.from(document.querySelectorAll('*')).find(el => /琼中黎族苗族自治县/.test(el.textContent || '') && el.children.length > 2);
    return JSON.stringify({
      hasModal: !!modal,
      modalText: modal?.textContent?.slice(0, 100),
    });
  })()`));
  record('点击琼中触发模态框', modalShown.hasModal, `text=${modalShown.modalText}`);

  // === 7. 关闭模态框并返回上级，验证其他省份不受影响 ===
  console.log('\n── 7. 关闭模态框 + 返回上级 ──');
  // 关闭 RegionPanel（多次点击以确保关闭所有模态）
  for (let i = 0; i < 3; i++) {
    await evalJS(ws, `(() => {
      const close = document.querySelector('[aria-label="关闭"]');
      if (close) close.click();
    })()`);
    await sleep(300);
  }

  // 点击返回按钮
  await evalJS(ws, `(() => {
    const back = document.querySelector('.drill-back-btn');
    back?.click();
  })()`);
  await sleep(2500);
  await snap(ws, join(LOG_DIR, '04-back-to-national.png'));

  const backState = JSON.parse(await evalJS(ws, `(() => {
    const backBtn = document.querySelector('.drill-back-btn');
    const focusedLabel = document.querySelector('.province-focused-label');
    return JSON.stringify({
      backBtnExists: !!backBtn,
      focusedLabelExists: !!focusedLabel,
    });
  })()`));
  record('返回全国视图成功', !backState.focusedLabelExists, '省级聚焦标签应消失');

  // === 8. 验证其他省份仍正常（用全新导航，避免状态残留）===
  console.log('\n── 8. 跨省隔离验证（重新加载 + 点击广西） ──');
  await sendCmd(ws, 'Page.navigate', { url: URL });
  await sleep(5000);

  await evalJS(ws, `(() => {
    const btn = Array.from(document.querySelectorAll('button[aria-label*="查看"]'))
      .find(b => /广西/.test(b.textContent || ''));
    btn?.click();
  })()`);
  await sleep(3000);
  await snap(ws, join(LOG_DIR, '05-guangxi-cross-check.png'));

  const guangxiState = JSON.parse(await evalJS(ws, `(() => {
    const tags = Array.from(document.querySelectorAll('.county-beauty-tag-wrapper')).map(t => t.textContent?.trim());
    const focused = !!document.querySelector('.province-focused-label');
    return JSON.stringify({ tags, focused, tagsCount: tags.length });
  })()`));
  record('广西钻取后聚焦', guangxiState.focused);
  record('广西加载县区 > 5', guangxiState.tagsCount > 5, `count=${guangxiState.tagsCount}`);

  edgeProc.kill();
  ws.close();

  // 汇总
  console.log('\n======================================');
  console.log(`  结果: ${results.filter(r => r.ok).length}/${results.length} 通过`);
  console.log('======================================');
  if (results.some(r => !r.ok)) {
    console.log('\n失败项:');
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  ✗ ${r.name}: ${r.info}`);
    }
    process.exit(1);
  }
})().catch((e) => { console.error('FATAL:', e); edgeProc.kill(); process.exit(1); });