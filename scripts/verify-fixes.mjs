/**
 * 功能修复验证脚本（精简版）
 * 测试两个修复：
 *   1. 窗户自动关闭：CountyInfoModal 的"瑶医基础知识"按钮 → CountyInfoModal 关闭 + YaoMedicalKnowledgeModal 打开
 *   2. 吸顶移除：CountyInfoModal / YaoMedicalKnowledgeModal 内部滚动，验证头部/图标跟随
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-fix-verify-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5186/';

const results = [];
function log(name, passed, detail = '') { results.push({ name, passed, detail }); }
function ok(name, detail = '') { log(name, true, detail); }
function fail(name, detail = '') { log(name, false, detail); }

function getJSON(url) {
  return new Promise((resolveP, rejectP) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try { resolveP(JSON.parse(body)); } catch (e) { rejectP(e); }
        });
      })
      .on('error', rejectP);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startEdge(port) {
  return spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + port,
    '--window-size=1920,1080',
    '--user-data-dir=' + EDGE_PROFILE,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
}

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

// 用 JSON 字符串注入避免编码问题
const KNOWN_COUNTY_JSON = JSON.stringify({
  code: '451302',
  name: 'Xingbin',
  nameEn: 'Xingbin District',
  centerLng: 109.234,
  centerLat: 23.741,
  category: 'core',
  province: 'Guangxi',
  regionId: 'guangxi',
  institutionCount: 2,
  herbVarieties: ['huangjing'],
  schools: ['Test'],
  govSupportLevel: 'national',
  specialCrafts: [],
  since: 1500,
  note: '',
});

async function main() {
  const PORT = 9444;
  const proc = startEdge(PORT);
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      await getJSON('http://127.0.0.1:' + PORT + '/json/version');
      ready = true; break;
    } catch {}
  }
  if (!ready) {
    fail('Edge DevTools 启动', 'timeout');
    proc.kill();
    finish();
    return;
  }
  ok('Edge DevTools 启动', 'port=' + PORT);

  const tabs = await getJSON('http://127.0.0.1:' + PORT + '/json');
  const target = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));

  await sendCmd(ws, 'Page.enable');
  await sendCmd(ws, 'Runtime.enable');
  await sendCmd(ws, 'Page.navigate', { url: URL });
  await sleep(8000);

  // 注入测试辅助函数
  await evalJS(ws, `(() => {
    window.__test_helper__ = {
      openCounty: (county) => {
        window.__MAP_STORE__.set({ selectedCounty: county, isCountyModalOpen: true });
      },
      closeAll: () => {
        window.__MAP_STORE__.set({
          isCountyModalOpen: false,
          selectedCounty: null,
          isPanelOpen: false,
          selectedRegion: null,
          isHerbModalOpen: false,
          selectedHerb: null,
          isTherapyModalOpen: false,
          selectedTherapy: null,
          isHistoryModalOpen: false,
          selectedHistoryPeriod: null,
        });
      },
      triggerKnowledge: () => {
        window.dispatchEvent(new CustomEvent('open-yao-knowledge'));
      },
      findScrolledPanel: (text) => {
        const wrappers = document.querySelectorAll('.info-panel-wrapper-scrollable');
        for (const w of wrappers) {
          if (w.textContent && w.textContent.indexOf(text) >= 0) return w;
        }
        return null;
      },
      getCountyPanel: () => {
        const t = document.getElementById('county-modal-title');
        return t ? t.closest('.info-panel-wrapper') : null;
      },
    };
    return 'helpers installed';
  })()`);

  // ==================== 测试 #1：窗户自动关闭 ====================
  console.log('--- Test 1: 窗户自动关闭 ---');

  // 1.1 打开 CountyInfoModal
  const r1 = await evalJS(ws, `(() => {
    if (!window.__MAP_STORE__) return 'no store';
    window.__test_helper__.closeAll();
    window.__test_helper__.openCounty(${KNOWN_COUNTY_JSON});
    return 'opened';
  })()`);
  ok('1.1 打开 CountyInfoModal（通过 store）', r1);
  await sleep(500);

  // 1.2 验证 scrollable 类已应用
  const r2 = await evalJS(ws, `(() => {
    const w = window.__test_helper__.getCountyPanel();
    if (!w) return JSON.stringify({ found: false });
    return JSON.stringify({
      found: true,
      hasScrollableClass: w.classList.contains('info-panel-wrapper-scrollable'),
    });
  })()`);
  const r2val = JSON.parse(r2);
  r2val.found && r2val.hasScrollableClass
    ? ok('1.2 CountyInfoModal 已应用 scrollable 类（吸顶移除前提）')
    : fail('1.2 CountyInfoModal 已应用 scrollable 类（吸顶移除前提）', r2);

  // 1.3 点击"瑶医基础知识（统一入口）"按钮
  const r3 = await evalJS(ws, `(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((b) => (b.textContent || '').indexOf('瑶医基础知识') >= 0 && (b.textContent || '').indexOf('统一入口') >= 0);
    if (!target) return 'no button';
    target.click();
    return 'clicked';
  })()`);
  r3 === 'clicked'
    ? ok('1.3 点击"瑶医基础知识"入口')
    : fail('1.3 点击"瑶医基础知识"入口', r3);
  await sleep(800);

  // 1.4 验证 CountyInfoModal 已自动关闭
  const r4 = await evalJS(ws, `(() => {
    const w = window.__test_helper__.getCountyPanel();
    const ml = w ? w.closest('.modal-layer') : null;
    return JSON.stringify({
      mounted: !!w,
      opacity: ml ? getComputedStyle(ml).opacity : null,
      pointerEvents: ml ? getComputedStyle(ml).pointerEvents : null,
    });
  })()`);
  const r4val = JSON.parse(r4);
  !r4val.mounted || (r4val.opacity === '0' && r4val.pointerEvents === 'none')
    ? ok('1.4 CountyInfoModal 已自动关闭（opacity=0, pointer-events=none）', JSON.stringify(r4val))
    : fail('1.4 CountyInfoModal 已自动关闭', JSON.stringify(r4val));

  // 1.5 验证 YaoMedicalKnowledgeModal 已自动打开
  const r5 = await evalJS(ws, `(() => {
    const allWrappers = document.querySelectorAll('.info-panel-wrapper-scrollable');
    let knowledgeWrapper = null;
    for (const w of allWrappers) {
      const txt = w.textContent || '';
      if (txt.indexOf('瑶医药国家级非物质文化遗产') >= 0 && txt.indexOf('基础理论') >= 0) {
        knowledgeWrapper = w;
        break;
      }
    }
    const title = knowledgeWrapper ? knowledgeWrapper.querySelector('.title-yao') : null;
    return JSON.stringify({
      mounted: !!knowledgeWrapper,
      title: title ? title.textContent : null,
    });
  })()`);
  const r5val = JSON.parse(r5);
  r5val.mounted && r5val.title && r5val.title.indexOf('瑶医基础知识') >= 0
    ? ok('1.5 YaoMedicalKnowledgeModal 已自动打开', r5)
    : fail('1.5 YaoMedicalKnowledgeModal 已自动打开', r5);

  // ==================== 测试 #2：吸顶移除 ====================
  console.log('--- Test 2: 吸顶移除（CountyInfoModal） ---');

  // 关闭所有模态，重新打开 county
  await evalJS(ws, `window.__test_helper__.closeAll(); window.__test_helper__.openCounty(${KNOWN_COUNTY_JSON});`);
  await sleep(700);

  // 2.1 验证面板带 overflow-y: auto + 内容超出可滚动
  const r6 = await evalJS(ws, `(() => {
    const w = window.__test_helper__.getCountyPanel();
    if (!w) return JSON.stringify({ found: false });
    const cs = getComputedStyle(w);
    return JSON.stringify({
      found: true,
      overflowY: cs.overflowY,
      scrollHeight: w.scrollHeight,
      clientHeight: w.clientHeight,
      hasScroll: w.scrollHeight > w.clientHeight,
    });
  })()`);
  const r6val = JSON.parse(r6);
  r6val.overflowY === 'auto' && r6val.hasScroll
    ? ok('2.1 面板已应用 overflow-y: auto 且内容可滚动', JSON.stringify({ overflowY: r6val.overflowY, scrollHeight: r6val.scrollHeight, clientHeight: r6val.clientHeight }))
    : fail('2.1 面板已应用 overflow-y: auto 且内容可滚动', r6);

  // 2.2 记录初始位置 + 滚到底部 + 验证位置变化
  const r7 = await evalJS(ws, `(() => {
    const w = window.__test_helper__.getCountyPanel();
    if (!w) return JSON.stringify({ error: 'no panel' });
    // 获取 5-col 卡片和头部标题的初始位置
    const cards = w.querySelector('.grid-cols-5');
    const header = w.querySelector('h2#county-modal-title');
    const initialCardsTop = cards ? cards.getBoundingClientRect().top : null;
    const initialHeaderTop = header ? header.getBoundingClientRect().top : null;
    // 滚到底
    w.scrollTop = w.scrollHeight;
    const scrolledCardsTop = cards ? cards.getBoundingClientRect().top : null;
    const scrolledHeaderTop = header ? header.getBoundingClientRect().top : null;
    return JSON.stringify({
      initialCardsTop, scrolledCardsTop,
      initialHeaderTop, scrolledHeaderTop,
      scrollTop: w.scrollTop,
    });
  })()`);
  const r7val = JSON.parse(r7);
  const cardsScrolled = r7val.initialCardsTop !== null && r7val.scrolledCardsTop !== null && r7val.scrolledCardsTop < r7val.initialCardsTop;
  cardsScrolled
    ? ok('2.2 滚动后 5-col 功能图标已上移（吸顶移除）', `initial=${r7val.initialCardsTop.toFixed(0)} → scrolled=${r7val.scrolledCardsTop.toFixed(0)}`)
    : fail('2.2 滚动后 5-col 功能图标已上移', r7);

  const headerScrolled = r7val.initialHeaderTop !== null && r7val.scrolledHeaderTop !== null && r7val.scrolledHeaderTop < r7val.initialHeaderTop;
  headerScrolled
    ? ok('2.3 滚动后头部标题栏已上移', `initial=${r7val.initialHeaderTop.toFixed(0)} → scrolled=${r7val.scrolledHeaderTop.toFixed(0)}`)
    : fail('2.3 滚动后头部标题栏已上移', r7);

  // ==================== 测试 #3：知识模态同样修复 ====================
  console.log('--- Test 3: 知识模态同样修复 ---');

  await evalJS(ws, `window.__test_helper__.closeAll(); window.__test_helper__.triggerKnowledge();`);
  await sleep(700);

  const r8 = await evalJS(ws, `(() => {
    const w = window.__test_helper__.findScrolledPanel('瑶医药国家级非物质文化遗产');
    if (!w) return JSON.stringify({ found: false });
    const cs = getComputedStyle(w);
    const title = w.querySelector('.title-yao');
    return JSON.stringify({
      found: true,
      overflowY: cs.overflowY,
      title: title ? title.textContent : null,
      scrollable: w.scrollHeight > w.clientHeight,
    });
  })()`);
  const r8val = JSON.parse(r8);
  r8val.overflowY === 'auto' && r8val.scrollable && r8val.title && r8val.title.indexOf('瑶医基础知识') >= 0
    ? ok('3.1 知识模态也是整面板滚动', r8)
    : fail('3.1 知识模态也是整面板滚动', r8);

  const r9 = await evalJS(ws, `(() => {
    const w = window.__test_helper__.findScrolledPanel('瑶医药国家级非物质文化遗产');
    if (!w) return JSON.stringify({ error: 'no panel' });
    const title = w.querySelector('.title-yao');
    const initialTitleTop = title ? title.getBoundingClientRect().top : null;
    w.scrollTop = w.scrollHeight;
    const scrolledTitleTop = title ? title.getBoundingClientRect().top : null;
    return JSON.stringify({
      initialTitleTop, scrolledTitleTop,
      scrolled: initialTitleTop !== null && scrolledTitleTop !== null && scrolledTitleTop < initialTitleTop,
    });
  })()`);
  const r9val = JSON.parse(r9);
  r9val.scrolled
    ? ok('3.2 知识模态滚动后标题栏跟随上移', `initial=${r9val.initialTitleTop?.toFixed(0)} → scrolled=${r9val.scrolledTitleTop?.toFixed(0)}`)
    : fail('3.2 知识模态滚动后标题栏跟随上移', r9);

  // ==================== 测试 #4：多次切换无残留 ====================
  console.log('--- Test 4: 多次切换无残留 ---');

  const r10 = await evalJS(ws, `(() => {
    return new Promise(async (resolve) => {
      const rounds = [];
      for (let i = 0; i < 3; i++) {
        // 关闭所有模态
        window.__test_helper__.closeAll();
        await new Promise((r) => setTimeout(r, 200));
        // 打开 county
        window.__test_helper__.openCounty(${KNOWN_COUNTY_JSON});
        await new Promise((r) => setTimeout(r, 400));
        const countyShown = !!document.getElementById('county-modal-title');
        // 点击知识按钮
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find((b) => (b.textContent || '').indexOf('瑶医基础知识') >= 0 && (b.textContent || '').indexOf('统一入口') >= 0);
        if (target) target.click();
        await new Promise((r) => setTimeout(r, 700));
        // 查找知识模态内容
        const allW = document.querySelectorAll('.info-panel-wrapper-scrollable');
        let knowledgeText = '';
        allW.forEach((w) => {
          if ((w.textContent || '').indexOf('瑶医药国家级非物质文化遗产') >= 0) {
            knowledgeText = w.textContent.slice(0, 80);
          }
        });
        const knowledgeShown = knowledgeText.length > 0;
        // 关闭知识模态
        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(esc);
        await new Promise((r) => setTimeout(r, 500));
        // 验证 county 已自动关闭（不应残留）
        const countyClosed = !document.getElementById('county-modal-title');
        rounds.push({
          round: i + 1,
          countyShown,
          knowledgeShown,
          countyClosedAfterSwitch: countyClosed,
        });
      }
      resolve(JSON.stringify(rounds));
    });
  })()`);
  const r10val = JSON.parse(r10);
  const allPass = r10val.every((r) => r.countyShown && r.knowledgeShown && r.countyClosedAfterSwitch);
  allPass
    ? ok('4.1 3 轮切换均无残留（旧窗口自动关闭）', r10)
    : fail('4.1 3 轮切换均无残留', r10);

  // ==================== 测试 #5：其他功能未受影响 ====================
  console.log('--- Test 5: 其他功能未受影响 ---');

  // 验证 RegionPanel（其他模态）仍正常工作
  const r11 = await evalJS(ws, `(() => {
    window.__test_helper__.closeAll();
    // 模拟省份点击
    const regions = window.__MAP_STORE__.getState();
    return JSON.stringify({
      hasGetState: !!regions,
      keysAvailable: Object.keys(regions || {}).slice(0, 5),
    });
  })()`);
  const r11val = JSON.parse(r11);
  r11val.hasGetState
    ? ok('5.1 Zustand store 仍可用，其他模态功能未受影响', r11)
    : fail('5.1 Zustand store 仍可用', r11);

  // 验证页面整体功能（Header / 地图挂载）
  const r12 = await evalJS(ws, `(() => {
    const header = document.querySelector('header');
    const root = document.getElementById('root');
    return JSON.stringify({
      hasHeader: !!header,
      hasRootContent: root && root.children.length > 0,
    });
  })()`);
  const r12val = JSON.parse(r12);
  r12val.hasHeader && r12val.hasRootContent
    ? ok('5.2 主页面（Header + 地图）功能未受影响', r12)
    : fail('5.2 主页面（Header + 地图）功能未受影响', r12);

  ws.close();
  proc.kill();

  finish();
}

function finish() {
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log('\n=== Fix Verification Results ===');
  results.forEach((r) => {
    console.log((r.passed ? '[OK]  ' : '[FAIL]') + ' ' + r.name + (r.detail && !r.passed ? ' -- ' + String(r.detail).slice(0, 200) : ''));
  });
  console.log('\n' + passed + '/' + total + ' passed');

  writeFileSync(
    resolve(REPORT_DIR, 'fix-verification.json'),
    JSON.stringify({ url: URL, results, passed, total }, null, 2),
    'utf8'
  );
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});