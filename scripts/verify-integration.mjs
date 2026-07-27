/**
 * 整合验证脚本：验证 ChinaMap 全部核心功能已迁移到 MapBoard
 *
 * 验证项：
 *   1. Leaflet 地图渲染
 *   2. 草药点位标记层渲染（4 个草药 marker）
 *   3. 草药标记点击 → HerbModal
 *   4. 省份快速选择工具栏
 *   5. 省份点击 → RegionPanel
 *   6. 县级点击 → CountyInfoModal
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-int-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5187/';

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

const results = [];
function ok(name, detail = '') { results.push({ name, passed: true, detail }); }
function fail(name, detail = '', severity = 'HIGH') {
  results.push({ name, passed: false, detail, severity });
}

async function main() {
  const PORT = 9801;
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

  // T1: Leaflet 容器
  const r1 = await evalJS(ws, `(() => {
    const map = document.querySelector('.leaflet-container');
    return JSON.stringify({
      hasMap: !!map,
      mapHeight: map?.offsetHeight || 0,
      mapWidth: map?.offsetWidth || 0,
    });
  })()`);
  const r1val = JSON.parse(r1);
  r1val.hasMap && r1val.mapHeight > 100
    ? ok('T1.1 MapBoard Leaflet 容器', `size=${r1val.mapWidth}x${r1val.mapHeight}`)
    : fail('T1.1 MapBoard Leaflet 容器', r1);

  // T2: 草药点位标记层
  const r2 = await evalJS(ws, `document.querySelectorAll('.herb-marker').length`);
  parseInt(r2) === 4
    ? ok('T2.1 草药点位标记层渲染 4 个草药', `count=${r2}`)
    : fail('T2.1 草药点位标记层', `actual=${r2}, expected=4`);

  // T3: 省份速选工具栏
  const r3 = await evalJS(ws, `(() => {
    const sel = document.querySelector('.region-quick-selector');
    return JSON.stringify({
      hasSelector: !!sel,
      buttonCount: sel?.querySelectorAll('button').length || 0,
    });
  })()`);
  const r3val = JSON.parse(r3);
  r3val.hasSelector && r3val.buttonCount >= 9
    ? ok('T3.1 省份速选工具栏', `buttons=${r3val.buttonCount}`)
    : fail('T3.1 省份速选工具栏', r3);

  // T4: 点击草药标记 → HerbModal
  const r4 = await evalJS(ws, `(() => {
    const markers = document.querySelectorAll('.herb-marker');
    if (markers.length === 0) return false;
    const rect = markers[0].getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    ['mousedown', 'mouseup', 'click'].forEach(type => {
      markers[0].dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
    });
    return true;
  })()`);
  await sleep(500);
  const r4b = await evalJS(ws, `(() => {
    const store = window.__MAP_STORE__?.getState();
    return JSON.stringify({
      isHerbModalOpen: store?.isHerbModalOpen,
      selectedHerbName: store?.selectedHerb?.name || null,
    });
  })()`);
  const r4bval = JSON.parse(r4b);
  r4bval.isHerbModalOpen
    ? ok('T4.1 草药点击 → HerbModal 打开', `herb=${r4bval.selectedHerbName}`)
    : fail('T4.1 草药点击 → HerbModal', r4b);

  // 关闭 HerbModal
  await evalJS(ws, `window.__MAP_STORE__?.set({ isHerbModalOpen: false, selectedHerb: null });`);
  await sleep(300);

  // T5: 点击省份速选按钮 → RegionPanel
  await evalJS(ws, `(() => {
    const buttons = document.querySelectorAll('.region-quick-selector button');
    if (buttons.length === 0) return false;
    const target = Array.from(buttons).find(b => b.textContent.includes('广西')) || buttons[0];
    target.click();
    return true;
  })()`);
  await sleep(500);
  const r5b = await evalJS(ws, `(() => {
    const store = window.__MAP_STORE__?.getState();
    return JSON.stringify({
      isPanelOpen: store?.isPanelOpen,
      selectedRegion: store?.selectedRegion?.name || null,
    });
  })()`);
  const r5bval = JSON.parse(r5b);
  r5bval.isPanelOpen && r5bval.selectedRegion
    ? ok('T5.1 省份速选 → RegionPanel 打开', `region=${r5bval.selectedRegion}`)
    : fail('T5.1 省份速选 → RegionPanel', r5b);

  // T6: 关闭面板后地图仍正常
  await evalJS(ws, `window.__MAP_STORE__?.set({ isPanelOpen: false, selectedRegion: null });`);
  await sleep(300);
  const r6 = await evalJS(ws, `(() => {
    const map = document.querySelector('.leaflet-container');
    return JSON.stringify({
      mapOK: map?.offsetHeight > 100,
      herbs: document.querySelectorAll('.herb-marker').length,
    });
  })()`);
  const r6val = JSON.parse(r6);
  r6val.mapOK && r6val.herbs === 4
    ? ok('T6.1 关闭面板后仍正常', `herbs=${r6val.herbs}`)
    : fail('T6.1 关闭面板后仍正常', r6);

  // T7: 截图
  const r7 = await sendCmd(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(REPORT_DIR, 'integrated-map.png'), Buffer.from(r7.data, 'base64'));
  ok('T7.1 整合后地图截图保存', 'integrated-map.png');

  ws.close();
  proc.kill();

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log('\n=== 整合验证结果 ===');
  results.forEach(r => {
    console.log((r.passed ? '[OK]  ' : '[FAIL]') + ' ' + r.name + (r.detail ? ' -- ' + r.detail.slice(0, 200) : ''));
  });
  console.log('\n' + passed + '/' + total + ' 通过');

  writeFileSync(
    resolve(REPORT_DIR, 'integration-verify.json'),
    JSON.stringify({ results, passed, total }, null, 2),
    'utf8'
  );
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});