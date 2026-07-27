/**
 * 深度排查海南地域入口的关联问题
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-hainan-'));
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
  const PORT = 9877;
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

  // 点击海南
  await evalJS(ws, `(() => {
    const buttons = document.querySelectorAll('.region-quick-selector button');
    const target = Array.from(buttons).find(b => b.textContent.includes('海南'));
    if (target) target.click();
    return true;
  })()`);
  await sleep(800);

  // 检查 store 状态
  const r1 = await evalJS(ws, `(() => {
    const store = window.__MAP_STORE__?.getState();
    return JSON.stringify({
      selectedRegionId: store?.selectedRegion?.id,
      selectedRegionName: store?.selectedRegion?.name,
      isPanelOpen: store?.isPanelOpen,
      viewLevel: store?.viewLevel,
      mapLayer: store?.mapLayer,
    }, null, 2);
  })()`);
  console.log('Store state after 海南 click:');
  console.log(r1);

  // 检查 RegionPanel DOM 内容
  const r2 = await evalJS(ws, `(() => {
    const panel = document.querySelector('[class*="region-panel"]');
    if (!panel) return JSON.stringify({ error: 'No region panel' });
    const text = panel.textContent || '';
    return JSON.stringify({
      hasPanel: true,
      hasContent: text.length > 50,
      contentSample: text.substring(0, 500),
    }, null, 2);
  })()`);
  console.log('\nRegionPanel DOM:');
  console.log(r2);

  // 检查 modal 内是否有内容（海南详情应在 modal 中或 panel 中）
  const r3 = await evalJS(ws, `(() => {
    const allText = document.body.textContent || '';
    const hasHainan = allText.includes('海南省') || allText.includes('海南');
    const hasHerb = allText.includes('玉竹') || allText.includes('石斛') || allText.includes('芒果叶');
    const hasTherapy = allText.includes('清热解毒') || allText.includes('湿热');
    return JSON.stringify({
      hasHainanText: hasHainan,
      hasHerbText: hasHerb,
      hasTherapyText: hasTherapy,
    }, null, 2);
  })()`);
  console.log('\nPage content check:');
  console.log(r3);

  // 截图
  const r = await sendCmd(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(REPORT_DIR, 'hainan-debug.png'), Buffer.from(r.data, 'base64'));

  ws.close();
  proc.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});