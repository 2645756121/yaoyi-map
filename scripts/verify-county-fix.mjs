/**
 * 截图验证：县级多边形渲染
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-snap-'));
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
  const PORT = 9990;
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

  // 点击广西
  await evalJS(ws, `(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find(b => (b.textContent || '').indexOf('广西') >= 0 && b.classList.contains('px-4'));
    if (target) target.click();
    return 'clicked';
  })()`);
  await sleep(4000);

  // 截图
  const r = await sendCmd(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(REPORT_DIR, 'county-load-fixed.png'), Buffer.from(r.data, 'base64'));
  console.log('[snap] county-load-fixed.png');

  ws.close();
  proc.kill();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});