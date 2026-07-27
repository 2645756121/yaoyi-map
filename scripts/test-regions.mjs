/**
 * 测试所有省份入口的关联逻辑
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-region-'));
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

const results = [];
function ok(name, detail = '') { results.push({ name, passed: true, detail }); }
function fail(name, detail = '') { results.push({ name, passed: false, detail }); }

async function main() {
  const PORT = 9844;
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

  // 获取所有区域列表
  const r1 = await evalJS(ws, `(() => {
    const buttons = document.querySelectorAll('.region-quick-selector button');
    return JSON.stringify(Array.from(buttons).map(b => ({
      label: b.textContent,
      ariaLabel: b.getAttribute('aria-label'),
    })));
  })()`);
  const regionButtons = JSON.parse(r1);
  console.log('Available region buttons:', regionButtons.length);

  // 测试每个省份点击
  for (const btn of regionButtons) {
    const name = btn.label.trim();
    await evalJS(ws, `(() => {
      const buttons = document.querySelectorAll('.region-quick-selector button');
      const target = Array.from(buttons).find(b => b.textContent.trim() === ${JSON.stringify(name)});
      if (target) target.click();
      return true;
    })()`);
    await sleep(400);

    const r = await evalJS(ws, `(() => {
      const store = window.__MAP_STORE__?.getState();
      return JSON.stringify({
        selectedRegionId: store?.selectedRegion?.id || null,
        selectedRegionName: store?.selectedRegion?.name || null,
        herbsCount: store?.selectedRegion ? window.__PANEL_DATA__?.herbsCount : null,
        isPanelOpen: store?.isPanelOpen,
      });
    })()`);
    const val = JSON.parse(r);
    const passed = val.selectedRegionId !== null && val.isPanelOpen;
    if (passed) {
      ok(`${name} 关联`, `region=${val.selectedRegionId}, panelOpen=${val.isPanelOpen}`);
    } else {
      fail(`${name} 关联`, `region=null, panelOpen=${val.isPanelOpen}`);
    }

    // 关闭面板
    await evalJS(ws, `window.__MAP_STORE__?.set({ isPanelOpen: false, selectedRegion: null });`);
    await sleep(200);
  }

  ws.close();
  proc.kill();

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log('\n=== 省份入口关联测试结果 ===');
  results.forEach(r => {
    console.log((r.passed ? '[OK]  ' : '[FAIL]') + ' ' + r.name);
  });
  console.log('\n' + passed + '/' + total + ' 通过');

  writeFileSync(
    resolve(REPORT_DIR, 'region-link-test.json'),
    JSON.stringify({ results, passed, total }, null, 2),
    'utf8'
  );
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});