/**
 * 直接测试图片加载
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = resolve(__dirname, '../audit-reports');
mkdirSync(REPORT_DIR, { recursive: true });

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-direct-img-'));
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

async function evalJS(ws, expr) {
  const r = await sendCmd(ws, 'Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval error');
  return r.result.value;
}

async function main() {
  const PORT = 9944;
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
  await sendCmd(ws, 'Runtime.enable');
  await sendCmd(ws, 'Page.navigate', { url: 'http://127.0.0.1:5187/' });
  await sleep(8000);

  // Open herb catalog
  await evalJS(ws, `document.querySelector('.herb-catalog-entry button')?.click()`);
  await sleep(3000);

  // Check current state
  const state = await evalJS(ws, `(() => {
    const panel = document.querySelector('.herb-catalog-panel');
    const imgs = panel ? Array.from(panel.querySelectorAll('img')) : [];
    return JSON.stringify({
      panelExists: !!panel,
      imgCount: imgs.length,
      imgs: imgs.map(i => ({
        src: i.src.substring(0, 80),
        wiki: i.src.includes('wikimedia'),
        ai: i.src.includes('trae-api'),
        complete: i.complete,
        natW: i.naturalWidth,
      })),
    }, null, 2);
  })()`);
  console.log(state);

  // Wait for all images to load
  await evalJS(ws, `Promise.all(Array.from(document.querySelectorAll('.herb-catalog-panel img')).map(img => {
    return new Promise(resolve => {
      if (img.complete && img.naturalWidth > 0) resolve();
      img.addEventListener('load', resolve);
      img.addEventListener('error', resolve);
      setTimeout(resolve, 8000);
    });
  }))`);

  const final = await evalJS(ws, `(() => {
    const imgs = Array.from(document.querySelectorAll('.herb-catalog-panel img'));
    return JSON.stringify({
      count: imgs.length,
      loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      failed: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
      wikiLoaded: imgs.filter(i => i.src.includes('wikimedia') && i.complete && i.naturalWidth > 0).length,
      aiLoaded: imgs.filter(i => i.src.includes('trae-api') && i.complete && i.naturalWidth > 0).length,
    });
  })()`);
  console.log('\nFinal:', final);

  const shot = await sendCmd(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(REPORT_DIR, 'direct-img-test.png'), Buffer.from(shot.data, 'base64'));

  ws.close();
  proc.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});