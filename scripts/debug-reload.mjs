#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-debug-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:5173/';

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
  await sendCmd(ws, 'Network.enable');

  // 收集 console error 和网络失败
  const consoleMsgs = [];
  ws.on('message', (data) => {
    try {
      const m = JSON.parse(data.toString());
      if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
        consoleMsgs.push({
          type: m.params.type,
          text: m.params.args?.map(a => a.value || a.description).join(' '),
        });
      }
      if (m.method === 'Runtime.exceptionThrown') {
        consoleMsgs.push({
          type: 'exception',
          text: m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text,
        });
      }
    } catch {}
  });

  await sendCmd(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1366, height: 768, deviceScaleFactor: 1, mobile: false,
  });

  console.log('1. 第一次加载');
  await sendCmd(ws, 'Page.navigate', { url: URL });
  await sleep(8000);
  const state1 = await evalJS(ws, `(() => ({ map: !!window.__MAP_INSTANCE__, drill: !!window.__DRILL_DOWN__ }))()`, false);
  console.log('   state:', state1);

  console.log('2. 第二次导航（重载）');
  await sendCmd(ws, 'Page.navigate', { url: URL });
  for (let i = 0; i < 12; i++) {
    await sleep(1000);
    const ready = await evalJS(ws, `!!window.__MAP_INSTANCE__`, false);
    if (ready) {
      console.log(`   map ready after ${(i+1)}s`);
      break;
    }
    if (i === 11) console.log('   map NOT ready after 12s');
  }
  const state2 = await evalJS(ws, `(() => ({ map: !!window.__MAP_INSTANCE__, drill: !!window.__DRILL_DOWN__, url: location.href, title: document.title }))()`, false);
  console.log('   state:', state2);

  console.log('3. 收集 console error');
  consoleMsgs.forEach(m => console.log('   ', m.type, '-', m.text.slice(0, 200)));

  edgeProc.kill();
  ws.close();
})().catch((e) => { console.error(e); edgeProc.kill(); process.exit(1); });