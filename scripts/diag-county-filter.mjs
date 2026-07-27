/**
 * 直接读取 countyLoadStatus 和 countyPaths
 */

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPORT_DIR = resolve(ROOT, 'audit-reports');
mkdirSync(REPORT_DIR, { recursive: true });

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-diag4-'));
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
  const PORT = 9996;
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

  // 触发 fetch 然后检查状态
  const r = await evalJS(ws, `(() => {
    // 通过 fetch 直接获取 county data，绕过 React 状态
    return fetch('/map/county_yao.json')
      .then(r => r.json())
      .then(data => {
        // 计算所有 features 的 bbox（与 React 组件相同逻辑）
        const MAP_PROJECTION = { padding: 20, viewBoxWidth: 900, viewBoxHeight: 600, minLon: 73, maxLon: 135, minLat: 18, maxLat: 54 };
        const lonRange = 62, latRange = 36;
        const scale = Math.min((900 - 40) / lonRange, (600 - 40) / latRange);
        const project = (lng, lat) => [20 + (lng - 73) * scale, 20 + (54 - lat) * scale];

        const features = data.features;
        const bboxes = features.map(f => {
          const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          coords.forEach(c => {
            const [x, y] = project(c[0], c[1]);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          });
          return { name: f.properties.name, bbox: { minX, maxX, minY, maxY }, centerLng: f.properties.centerLng, centerLat: f.properties.centerLat };
        });

        // 测试 viewBox = {x:0, y:0, width:900, height:600} 的可见性
        const viewBox = { x: 0, y: 0, width: 900, height: 600 };
        const visible = bboxes.filter(b => {
          const a = viewBox;
          const bb = b.bbox;
          return !(
            a.x > bb.maxX ||
            a.x + a.width < bb.minX ||
            a.y > bb.maxY ||
            a.y + a.height < bb.minY
          );
        });

        return JSON.stringify({
          totalFeatures: features.length,
          scale,
          viewBox,
          visibleCount: visible.length,
          first5Visible: visible.slice(0, 5).map(v => v.name),
          first3Bboxes: bboxes.slice(0, 3),
        });
      });
  })()`);
  console.log('=== 直接计算 visible ===');
  console.log(r);

  // 检查 React state 通过 fiber
  console.log('\n=== 检查 React 组件状态 ===');
  const r2 = await evalJS(ws, `(() => {
    // 找 chinaMap 组件
    function findFiber(dom) {
      const key = Object.keys(dom).find(k => k.startsWith('__reactFiber'));
      return key ? dom[key] : null;
    }
    // 找 svg 元素
    const svg = document.querySelector('svg[viewBox="0 0 900 600"]');
    if (!svg) return JSON.stringify({ error: 'no svg' });
    let fiber = findFiber(svg);
    let depth = 0;
    let result = {};
    while (fiber && depth < 10) {
      const name = fiber.type?.name || fiber.type?.displayName || 'unknown';
      const props = fiber.memoizedProps || {};
      // 找到 stateNode 包含 countyLoadStatus 的
      if (fiber.stateNode === null || typeof fiber.stateNode !== 'object') {
        // hooks state
        result.fiberChain = result.fiberChain || [];
        result.fiberChain.push(name);
      }
      fiber = fiber.return;
      depth++;
    }
    return JSON.stringify(result);
  })()`);
  console.log(r2.substring(0, 1000));

  ws.close();
  proc.kill();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});