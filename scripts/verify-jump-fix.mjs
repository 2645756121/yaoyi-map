/**
 * 验证章节编号动态化修复效果
 * 截取 CountyInfoModal 在多个县级（不同数据完整度）的渲染结果
 * 验证编号是否连续无跳跃
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-jump-verify-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5186/';

const results = [];
function log(name, passed, detail = '') { results.push({ name, passed, detail }); }

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

async function snap(ws, path) {
  const r = await sendCmd(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(path, Buffer.from(r.data, 'base64'));
}

async function main() {
  const PORT = 9666;
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
  await sleep(7000);

  // 测试 1: 兴宾区 (451302) - 缺少 industryBase（导致五→七跳号）
  console.log('--- Test 1: 兴宾区（缺六、产业基地） ---');
  await evalJS(ws, `(() => {
    window.__MAP_STORE__.set({
      selectedCounty: {
        code: '451302', name: 'Xingbin', nameEn: 'Xingbin District',
        centerLng: 109.234, centerLat: 23.741, category: 'development',
        province: 'Guangxi', regionId: 'guangxi', institutionCount: 2,
        herbVarieties: ['jiegeng', 'gancao'], schools: ['Test'],
        govSupportLevel: 'city', specialCrafts: [], since: 1500, note: '',
      },
      isCountyModalOpen: true,
    });
    return 'opened';
  })()`);
  await sleep(500);
  await snap(ws, resolve(REPORT_DIR, 'jump-fix-1-xingbin.png'));

  // 收集所有渲染的章节标题中的数字
  const r1 = await evalJS(ws, `(() => {
    const wrapper = document.getElementById('county-modal-title')?.closest('.info-panel-wrapper');
    if (!wrapper) return JSON.stringify({ error: 'no wrapper' });
    const headings = Array.from(wrapper.querySelectorAll('h3'))
      .filter(h => /^[一二三四五六七八九]、/.test(h.textContent.trim()))
      .map(h => h.textContent.trim());
    return JSON.stringify({ headings });
  })()`);
  const r1val = JSON.parse(r1);
  console.log('兴宾区章节标题:', r1val.headings);
  const nums1 = r1val.headings.map(h => '一二三四五六七八九'.indexOf(h[0]));
  const continuous1 = nums1.every((n, i) => i === 0 || n === nums1[i - 1] + 1);
  log('T1.1 兴宾区章节编号连续（修复前为五→七，修复后应连续）',
    continuous1 && nums1.length > 0,
    JSON.stringify({ nums: nums1, headings: r1val.headings }));

  // 测试 2: 金秀 (451324) - 完整数据（验证无回归）
  console.log('--- Test 2: 金秀（完整数据） ---');
  await evalJS(ws, `(() => {
    window.__MAP_STORE__.set({
      selectedCounty: {
        code: '451324', name: 'Jinxiu', nameEn: 'Jinxiu Yao Autonomous County',
        centerLng: 110.183, centerLat: 24.133, category: 'core',
        province: 'Guangxi', regionId: 'guangxi', institutionCount: 5,
        herbVarieties: ['jiegeng', 'lingzhi', 'gancao', 'huangjing'],
        schools: ['大瑶山瑶医流派'], govSupportLevel: 'national',
        specialCrafts: [], since: 1700, note: '',
      },
      isCountyModalOpen: true,
    });
    return 'opened';
  })()`);
  await sleep(500);
  await snap(ws, resolve(REPORT_DIR, 'jump-fix-2-jinxiu.png'));

  const r2 = await evalJS(ws, `(() => {
    const wrapper = document.getElementById('county-modal-title')?.closest('.info-panel-wrapper');
    if (!wrapper) return JSON.stringify({ error: 'no wrapper' });
    const headings = Array.from(wrapper.querySelectorAll('h3'))
      .filter(h => /^[一二三四五六七八九]、/.test(h.textContent.trim()))
      .map(h => h.textContent.trim());
    return JSON.stringify({ headings });
  })()`);
  const r2val = JSON.parse(r2);
  console.log('金秀章节标题:', r2val.headings);
  const nums2 = r2val.headings.map(h => '一二三四五六七八九'.indexOf(h[0]));
  const continuous2 = nums2.every((n, i) => i === 0 || n === nums2[i - 1] + 1);
  log('T2.1 金秀完整数据章节编号连续',
    continuous2 && nums2.length > 0,
    JSON.stringify({ nums: nums2, headings: r2val.headings }));

  // 测试 3: 罗城 (451225) - 也缺产业基地
  console.log('--- Test 3: 罗城（缺六、产业基地） ---');
  await evalJS(ws, `(() => {
    window.__MAP_STORE__.set({
      selectedCounty: {
        code: '451225', name: 'Luocheng', nameEn: 'Luocheng Mulam Autonomous County',
        centerLng: 108.9, centerLat: 24.7, category: 'development',
        province: 'Guangxi', regionId: 'guangxi', institutionCount: 1,
        herbVarieties: ['jiegeng'], schools: ['Test'],
        govSupportLevel: 'city', specialCrafts: [], since: 1500, note: '',
      },
      isCountyModalOpen: true,
    });
    return 'opened';
  })()`);
  await sleep(500);

  const r3 = await evalJS(ws, `(() => {
    const wrapper = document.getElementById('county-modal-title')?.closest('.info-panel-wrapper');
    if (!wrapper) return JSON.stringify({ error: 'no wrapper' });
    const headings = Array.from(wrapper.querySelectorAll('h3'))
      .filter(h => /^[一二三四五六七八九]、/.test(h.textContent.trim()))
      .map(h => h.textContent.trim());
    return JSON.stringify({ headings });
  })()`);
  const r3val = JSON.parse(r3);
  console.log('罗城章节标题:', r3val.headings);
  const nums3 = r3val.headings.map(h => '一二三四五六七八九'.indexOf(h[0]));
  const continuous3 = nums3.every((n, i) => i === 0 || n === nums3[i - 1] + 1);
  log('T3.1 罗城缺产业基地时章节编号连续',
    continuous3 && nums3.length > 0,
    JSON.stringify({ nums: nums3, headings: r3val.headings }));

  ws.close();
  proc.kill();

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log('\n=== Jump Fix Verification ===');
  results.forEach((r) => {
    console.log((r.passed ? '[OK]  ' : '[FAIL]') + ' ' + r.name + (r.detail ? ' -- ' + String(r.detail).slice(0, 200) : ''));
  });
  console.log('\n' + passed + '/' + total + ' passed');

  writeFileSync(
    resolve(REPORT_DIR, 'jump-fix-verification.json'),
    JSON.stringify({ url: URL, results, passed, total }, null, 2),
    'utf8'
  );
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});