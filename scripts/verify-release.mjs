import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import http from 'node:http';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = resolve(__dirname, '../audit-reports');
mkdirSync(REPORT_DIR, { recursive: true });

const EDGE_PROFILE = mkdtempSync(os.tmpdir() + 'edge-rel-');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5199/';

function getJSON(url) {
  return new Promise((resP, rejP) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resP({ status: res.statusCode, body }));
    }).on('error', rejP);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const PORT = 9955;
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + EDGE_PROFILE,
    URL,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try { await getJSON('http://127.0.0.1:' + PORT + '/json/version'); break; } catch {}
  }

  const tabsData = await getJSON('http://127.0.0.1:' + PORT + '/json');
  const tabs = Array.isArray(tabsData) ? tabsData : (tabsData.targets || []);
  const target = tabs.find((t) => t.type === 'page') || tabs[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let nextId = 1;
  function sendCmd(method, params) {
    const id = nextId++;
    return new Promise((resP, rejP) => {
      const h = (data) => {
        try {
          const o = JSON.parse(data.toString());
          if (o.id === id) { ws.off('message', h); o.error ? rejP(new Error(o.error.message)) : resP(o.result); }
        } catch {}
      };
      ws.on('message', h);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await sendCmd('Page.enable');
  await sleep(6000);

  const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(REPORT_DIR, 'release-verify.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved:', resolve(REPORT_DIR, 'release-verify.png'));

  ws.close();
  proc.kill();
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });