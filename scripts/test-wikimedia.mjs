/**
 * 测试 Wikimedia 访问能力
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-wiki-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

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

async function main() {
  const PORT = 9922;
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--window-size=1920,1080',
    '--user-data-dir=' + EDGE_PROFILE,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try { await getJSON('http://127.0.0.1:' + PORT + '/json/version'); break; } catch {}
  }

  const tabs = await getJSON('http://127.0.0.1:' + PORT + '/json');
  const target = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  await sendCmd(ws, 'Page.enable');

  // 直接访问 wikimedia 图片测试
  const url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Platycodon_grandiflorus%2C_Seoul.jpg/1920px-Platycodon_grandiflorus%2C_Seoul.jpg';

  const result = await sendCmd(ws, 'Page.navigate', { url });
  await sleep(8000);

  const content = await sendCmd(ws, 'Page.getResourceContent', {
    frameId: target.id,
    url,
  }).catch(() => null);

  // 使用 fetch 测试
  const fetchResult = await new Promise((resolveP) => {
    sendCmd(ws, 'Runtime.evaluate', {
      expression: `fetch(${JSON.stringify(url)}).then(r => ({ status: r.status, ok: r.ok, type: r.headers.get('content-type') })).catch(e => ({ error: e.message }))`,
      awaitPromise: true,
      returnByValue: true,
    }).then(r => resolveP(r.result?.value));
  });

  console.log('Fetch result:', JSON.stringify(fetchResult, null, 2));

  ws.close();
  proc.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});