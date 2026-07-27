/**
 * 验证点击区域后 Leaflet 地图是否正确钻取
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-drill-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5187/';

function getJSON(url) {
  return new Promise((resolveP, rejectP) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => { try { resolveP(JSON.parse(body)); } catch (e) { rejectP(e); } });
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

  // 点击 海南
  await evalJS(ws, `(() => {
    const buttons = document.querySelectorAll('.region-quick-selector button');
    const target = Array.from(buttons).find(b => b.textContent.includes('海南'));
    if (target) target.click();
    return true;
  })()`);

  // 等待地图钻取完成（flyToBounds 默认 0.4s + 加载 GeoJSON ~1s）
  await sleep(3500);

  // 检查 Leaflet 地图状态
  const r = await evalJS(ws, `(() => {
    const drill = window.__DRILL_DOWN__;
    if (!drill) return JSON.stringify({ error: 'No drill controller' });
    const state = drill.getState();
    return JSON.stringify({
      drillLevel: state.level,
      provinceAdcode: state.provinceAdcode,
    }, null, 2);
  })()`);
  console.log('DrillDown state:', r);

  // 关闭面板，截图查看地图
  await evalJS(ws, `window.__MAP_STORE__?.set({ isPanelOpen: false, selectedRegion: null });`);
  await sleep(500);

  const r2 = await evalJS(ws, `(() => {
    const drill = window.__DRILL_DOWN__;
    const state = drill.getState();
    return JSON.stringify({
      drillLevel: state.level,
      provinceAdcode: state.provinceAdcode,
      cityAdcode: state.cityAdcode,
    }, null, 2);
  })()`);
  console.log('After closing panel:', r2);

  const shot = await sendCmd(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(REPORT_DIR, 'hainan-drill.png'), Buffer.from(shot.data, 'base64'));
  console.log('Screenshot saved: hainan-drill.png');

  ws.close();
  proc.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});