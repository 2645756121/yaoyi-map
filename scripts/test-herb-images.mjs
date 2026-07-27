/**
 * 测试草药图片加载情况：真实实拍图 vs AI 图
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-images-'));
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
  const PORT = 9900;
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

  // 打开草药目录
  await evalJS(ws, `(() => {
    const btn = document.querySelector('.herb-catalog-entry button');
    if (btn) btn.click();
    return true;
  })()`);
  await sleep(2000);

  // 选中 J 分组（桔梗、灵芝、甘草）
  await evalJS(ws, `(() => {
    const buttons = document.querySelectorAll('.herb-catalog-panel button');
    // 找字母 J 按钮
    for (const b of buttons) {
      if (b.textContent.trim() === 'J') {
        b.click();
        break;
      }
    }
    return true;
  })()`);
  await sleep(1500);

  // 检查图片加载
  const r = await evalJS(ws, `(() => {
    const imgs = Array.from(document.querySelectorAll('.herb-catalog-panel img'));
    return JSON.stringify(imgs.slice(0, 10).map(img => ({
      src: img.src,
      loaded: img.complete && img.naturalWidth > 0,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      width: img.offsetWidth,
      height: img.offsetHeight,
    })));
  })()`);

  const images = JSON.parse(r);
  console.log(`Found ${images.length} images`);
  images.forEach((img, i) => {
    console.log(`  ${i+1}. ${img.loaded ? '✓' : '✗'} ${img.src.substring(0, 80)}... (${img.naturalWidth}x${img.naturalHeight})`);
  });

  const realCount = images.filter(img => img.loaded && img.naturalWidth >= 800).length;
  console.log(`\n${realCount}/${images.length} images loaded successfully with sufficient resolution`);

  // 截图
  const shot = await sendCmd(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(REPORT_DIR, 'herb-images.png'), Buffer.from(shot.data, 'base64'));

  ws.close();
  proc.kill();
  process.exit(realCount > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});