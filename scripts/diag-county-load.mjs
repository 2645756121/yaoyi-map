/**
 * 详细诊断县级多边形问题
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-diag2-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5186/';

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

async function main() {
  const PORT = 9998;
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
  // 在导航前注册 network 监听
  await sendCmd(ws, 'Network.enable');
  const networkLog = [];
  ws.on('message', (data) => {
    try {
      const m = JSON.parse(data.toString());
      if (m.method === 'Network.responseReceived') {
        const r = m.params.response;
        networkLog.push({ url: r.url, status: r.status });
      }
      if (m.method === 'Network.loadingFailed') {
        networkLog.push({ failed: m.params.errorText, requestId: m.params.requestId });
      }
    } catch {}
  });

  await sendCmd(ws, 'Page.navigate', { url: URL });
  await sleep(12000);

  console.log('=== 全部网络请求 ===');
  networkLog.forEach(r => console.log(' ', r.status || 'FAIL', '-', r.url || r.failed));

  // 检查 county_paths 状态
  console.log('\n=== 检查 countyPaths 状态 ===');
  const initialState = await evalJS(ws, `(() => {
    // 访问 countyPaths - 需要找到组件实例
    // React DevTools 不可用，通过 DOM 反向推断
    const allPathCount = document.querySelectorAll('svg path[d]').length;
    const countyGCount = document.querySelectorAll('svg g[style*="display"]').length;
    return JSON.stringify({
      allPathCount,
      countyGCount,
      hasCountyData: allPathCount > 50,
    });
  })()`);
  console.log('初始状态:', initialState);

  // 点击广西
  console.log('\n=== 点击广西按钮 ===');
  const clickResult = await evalJS(ws, `(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find(b => (b.textContent || '').indexOf('广西') >= 0 && b.classList.contains('px-4'));
    if (!target) return 'not found: ' + buttons.filter(b => b.textContent.includes('广西')).length + ' matches';
    target.click();
    return 'clicked';
  })()`);
  console.log('点击结果:', clickResult);
  await sleep(3000);

  // 详细检查
  console.log('\n=== 点击后详细状态 ===');
  const afterClick = await evalJS(ws, `(() => {
    const store = window.__MAP_STORE__?.getState();
    const allPaths = document.querySelectorAll('svg path[d]').length;
    // 找视图内显示的提示文字
    let viewportMatch = null;
    document.querySelectorAll('p').forEach(p => {
      const t = p.textContent || '';
      const m = t.match(/视口内显示\\s*(\\d+)\\s*个/);
      if (m) viewportMatch = m[1];
    });
    // 找 countyPaths 数组 - 通过 React Fiber 不易获取，改通过数据特征推断
    return JSON.stringify({
      store: {
        viewLevel: store?.viewLevel,
        mapLayer: store?.mapLayer,
        viewBox: store?.viewBox,
      },
      allPathCount: allPaths,
      viewportMatch,
    });
  })()`);
  console.log('点击后:', afterClick);

  // 检查 county paths 的 bbox 与 viewBox
  console.log('\n=== 检查 county paths bbox ===');
  const bboxCheck = await evalJS(ws, `(() => {
    // 通过 store viewBox 与 county bbox 计算应该可见数量
    const store = window.__MAP_STORE__?.getState();
    if (!store) return JSON.stringify({ error: 'no store' });
    // 用直接 fetch 拿到 county data 自己计算
    return fetch('/map/county_yao.json').then(r => r.json()).then(data => {
      // 应用 projectLngLat 计算 bbox
      const MAP_PROJECTION = { padding: 20, viewBoxWidth: 900, viewBoxHeight: 600, minLon: 73, maxLon: 135, minLat: 18, maxLat: 54 };
      const lonRange = 62, latRange = 36;
      const scaleX = (900 - 40) / lonRange;
      const scaleY = (600 - 40) / latRange;
      const scale = Math.min(scaleX, scaleY);
      const project = (lng, lat) => [20 + (lng - 73) * scale, 20 + (54 - lat) * scale];
      const viewBox = store.viewBox;
      const allBboxes = data.features.map(f => {
        const coords = f.geometry.coordinates[0];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        coords.forEach(c => {
          const [x, y] = project(c[0], c[1]);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        });
        return { name: f.properties.name, bbox: { minX, maxX, minY, maxY } };
      });
      // 计算可见
      const visible = allBboxes.filter(b => !(
        viewBox.x > b.bbox.maxX ||
        viewBox.x + viewBox.width < b.bbox.minX ||
        viewBox.y > b.bbox.maxY ||
        viewBox.y + viewBox.height < b.bbox.minY
      ));
      return JSON.stringify({
        viewBox,
        totalFeatures: data.features.length,
        first3Bboxes: allBboxes.slice(0, 3),
        visibleCount: visible.length,
        visibleNames: visible.map(v => v.name),
      });
    });
  })()`);
  console.log('bbox 检查:', bboxCheck);

  ws.close();
  proc.kill();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});