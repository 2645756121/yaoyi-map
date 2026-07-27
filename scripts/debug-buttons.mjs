#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-debug-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5173/';

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

async function evalJS(ws, expr, awaitPromise = true) {
  const r = await sendCmd(ws, 'Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
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

(async () => {
  await waitForEdge();
  const list = await getJSON('http://127.0.0.1:9334/json/list');
  const tab = list.find((t) => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));

  await sendCmd(ws, 'Page.enable');
  await sendCmd(ws, 'Runtime.enable');

  await sendCmd(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1366, height: 768, deviceScaleFactor: 1, mobile: false,
  });

  await sendCmd(ws, 'Page.navigate', { url: URL });
  await sleep(8000);

  // 列出所有按钮
  const btns = await evalJS(ws, `(() => {
    const all = Array.from(document.querySelectorAll('button'));
    return JSON.stringify(all.map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      text: (b.textContent || '').slice(0, 30),
      className: b.className.slice(0, 50),
    })));
  })()`);
  console.log('All buttons:', btns);

  edgeProc.kill();
  ws.close();
})().catch((e) => { console.error(e); edgeProc.kill(); process.exit(1); });