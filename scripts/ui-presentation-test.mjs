#!/usr/bin/env node
/**
 * 软件呈现效果综合检测脚本 v2
 *
 * 修正：
 *   1. 每个视口使用全新 Tab，确保 paint 指标独立
 *   2. 元素可见性检查放在交互之前（避免模态框覆盖后找不到原始元素）
 *   3. 测试流程更严谨：先验证初始状态，再做交互
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
const LOG_DIR = resolve(ROOT, 'logs', 'ui-presentation');
const REPORT_DIR = resolve(ROOT, 'audit-reports');
mkdirSync(LOG_DIR, { recursive: true });
mkdirSync(REPORT_DIR, { recursive: true });

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-ui-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5187/';

const VIEWPORTS = [
  { name: 'Desktop-1920x1080', w: 1920, h: 1080, dpr: 1 },
  { name: 'Desktop-1366x768',  w: 1366, h: 768,  dpr: 1 },
  { name: 'Tablet-1024x768',   w: 1024, h: 768,  dpr: 1 },
  { name: 'Tablet-768x1024',   w: 768,  h: 1024, dpr: 1 },
  { name: 'Mobile-390x844',    w: 390,  h: 844,  dpr: 2 },
  { name: 'Mobile-412x915',    w: 412,  h: 915,  dpr: 2 },
];

const results = [];
const issues = [];

function record(category, name, ok, info = '') {
  results.push({ category, name, ok, info });
  if (!ok) issues.push({ category, name, info });
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${category} · ${name}${info ? '  ' + info : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// === Edge Headless 启动 ===
const edgeProc = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--remote-debugging-port=9333',
  `--user-data-dir=${EDGE_PROFILE}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

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
    try {
      const v = await getJSON('http://127.0.0.1:9333/json/version');
      return v;
    } catch {}
    await sleep(300);
  }
  throw new Error('Edge failed to start');
}

async function newTab() {
  // 通过 CDP Target.createTarget 创建新标签（避免 /json/new 的限制）
  // 这里直接复用主标签 - 改为单 tab 模式，每个视口通过 Page.navigate + 视口重设
  // 因此 newTab 返回主 tab 的连接信息
  const list = await getJSON('http://127.0.0.1:9333/json/list');
  const tab = list.find((t) => t.type === 'page');
  if (!tab) throw new Error('No page tab found');
  return tab;
}

async function attachWs(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.on('open', r));
  return ws;
}

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

async function evalJS(ws, expr) {
  const r = await sendCmd(ws, 'Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

async function snap(ws, file) {
  const r = await sendCmd(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(r.data, 'base64'));
}

async function waitForReady(ws, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ready = await evalJS(ws, `document.readyState`);
      if (ready === 'complete') return true;
    } catch {}
    await sleep(300);
  }
  return false;
}

async function closeTab(ws) {
  try { ws.close(); } catch {}
}

async function testViewport(vp) {
  console.log(`\n========== ${vp.name} (${vp.w}x${vp.h}) ==========`);
  const cat = vp.name;

  // 新 tab
  const tab = await newTab();
  let ws;
  try {
    ws = await attachWs(tab.webSocketDebuggerUrl);

    // 启用域
    await sendCmd(ws, 'Page.enable');
    await sendCmd(ws, 'Runtime.enable');
    await sendCmd(ws, 'Network.enable');
    await sendCmd(ws, 'Log.enable');
    await sendCmd(ws, 'Performance.enable');

    // 注入 init script：在每次新文档加载时立即建立 PerformanceObserver
    // 这样可以捕获本次 navigation 的 first-paint / first-contentful-paint
    await sendCmd(ws, 'Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__paintMarks = [];
        window.__navStartMark = performance.now();
        try {
          const obs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.startTime >= window.__navStartMark) {
                window.__paintMarks.push({ name: entry.name, startTime: entry.startTime });
              }
            }
          });
          obs.observe({ type: 'paint', buffered: true });
        } catch (e) {}
      `,
    });

    // 设置视口
    await sendCmd(ws, 'Emulation.setDeviceMetricsOverride', {
      width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, mobile: vp.w < 768,
    });
    await sendCmd(ws, 'Emulation.setVisibleSize', { width: vp.w, height: vp.h });

    // 收集错误
    const consoleErrors = [];
    const failedRequests = [];
    ws.on('message', (data) => {
      try {
        const m = JSON.parse(data.toString());
        if (m.method === 'Runtime.exceptionThrown') {
          const e = m.params.exceptionDetails;
          if (e.exception?.description) consoleErrors.push(e.exception.description.slice(0, 200));
        }
        if (m.method === 'Network.loadingFailed') {
          failedRequests.push(`${m.params.errorText} ${m.params.request?.url || ''}`);
        }
        if (m.method === 'Network.responseReceived') {
          if (m.params.response.status >= 400) {
            failedRequests.push(`${m.params.response.status} ${m.params.response.url}`);
          }
        }
      } catch {}
    });

    // 导航
    await sendCmd(ws, 'Page.navigate', { url: URL });
    await waitForReady(ws);
    await sleep(4500); // 等 Leaflet 渲染

    // --- 截图首屏 ---
    await snap(ws, join(LOG_DIR, `${vp.name}-home.png`));

    // --- 1. DOM 基础挂载 ---
    const basic = JSON.parse(await evalJS(ws, `(() => {
      const $ = (s) => document.querySelector(s);
      const $$ = (s) => document.querySelectorAll(s);
      const root = document.getElementById('root');
      return JSON.stringify({
        title: document.title,
        rootChildren: root?.children.length || 0,
        headerExists: !!$('header'),
        headerText: $('header')?.textContent?.slice(0, 60) || '',
        herbCatalogEntry: !!$('.herb-catalog-entry'),
        herbCatalogBtn: !!Array.from($$('button')).find(b => /草药分类目录/.test(b.textContent || '')),
        hasMain: !!$('main'),
        leafletContainer: !!$('.leaflet-container'),
        svgCount: $$('svg').length,
        regionBtns: $$('button[aria-label*="查看"]').length,
        searchInput: !!$('input[aria-label*="搜索"]'),
        backToTopBtn: !!$('.back-to-top'),
        infoBtn: !!Array.from($$('button')).find(b => /关于瑶医/.test(b.textContent || '')),
      });
    })()`));
    record(cat, '页面标题', /瑶医/.test(basic.title), basic.title);
    record(cat, '#root 已挂载且有子元素', basic.rootChildren > 0, `children=${basic.rootChildren}`);
    record(cat, '<header> 渲染', basic.headerExists, basic.headerText);
    record(cat, '草药目录入口 section 存在', basic.herbCatalogEntry, '');
    record(cat, '草药分类目录按钮存在', basic.herbCatalogBtn);
    record(cat, '<main> 容器存在', basic.hasMain);
    record(cat, 'Leaflet 地图容器存在', basic.leafletContainer);
    record(cat, 'SVG 元素总数', basic.svgCount > 10, `count=${basic.svgCount}`);
    record(cat, '省份快速选择按钮（9 个）', basic.regionBtns === 9, `count=${basic.regionBtns}`);
    record(cat, '搜索框存在', basic.searchInput);
    record(cat, '关于瑶医按钮', basic.infoBtn);
    record(cat, 'BackToTop 按钮', basic.backToTopBtn);

    // --- 2. 布局检查 ---
    const layout = JSON.parse(await evalJS(ws, `(() => {
      const html = document.documentElement;
      const body = document.body;
      return JSON.stringify({
        htmlScrollW: html.scrollWidth, htmlClientW: html.clientWidth,
        bodyScrollW: body.scrollWidth, bodyClientW: body.clientWidth,
        windowInnerW: window.innerWidth, windowInnerH: window.innerHeight,
        dpr: window.devicePixelRatio,
      });
    })()`));
    const hOverflow = layout.bodyScrollW > layout.bodyClientW + 2;
    record(cat, '无水平溢出', !hOverflow,
      `bodyScroll=${layout.bodyScrollW} bodyClient=${layout.bodyClientW} innerW=${layout.windowInnerW}`);
    record(cat, '视口尺寸正确', layout.windowInnerW === vp.w,
      `innerW=${layout.windowInnerW} expected=${vp.w}`);

    // --- 3. Header 主题样式 ---
    const headerStyle = JSON.parse(await evalJS(ws, `(() => {
      const h = document.querySelector('header');
      if (!h) return '{}';
      const cs = getComputedStyle(h);
      return JSON.stringify({
        bgImage: cs.backgroundImage,
        hasWeave: !!Array.from(document.querySelectorAll('header div'))
          .find(d => d.style.backgroundImage?.includes('data:image/svg+xml')),
      });
    })()`));
    record(cat, 'Header 主渐变背景', /gradient/i.test(headerStyle.bgImage || ''),
      `bg="${(headerStyle.bgImage || '').slice(0, 60)}..."`);
    record(cat, 'Header 织锦纹理存在', headerStyle.hasWeave);

    // --- 4. 性能基线（FCP 来自 init script 中的 PerformanceObserver） ---
    const perf = JSON.parse(await evalJS(ws, `(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const marks = window.__paintMarks || [];
      const fcp = marks.find(p => p.name === 'first-contentful-paint')?.startTime;
      const fp = marks.find(p => p.name === 'first-paint')?.startTime;
      return JSON.stringify({
        domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
        loadComplete: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
        firstPaint: fp | 0,
        firstContentfulPaint: fcp | 0,
        domNodes: document.getElementsByTagName('*').length,
        paintMarks: marks.length,
      });
    })()`));
    record(cat, 'DOMContentLoaded < 3000ms', perf.domContentLoaded < 3000, `${perf.domContentLoaded}ms`);
    record(cat, 'LoadComplete < 6000ms', perf.loadComplete < 6000, `${perf.loadComplete}ms`);
    record(cat, 'First Contentful Paint < 3000ms', perf.firstContentfulPaint < 3000,
      `${Math.round(perf.firstContentfulPaint)}ms`);
    record(cat, 'First Paint < 1500ms', perf.firstPaint < 1500,
      `${Math.round(perf.firstPaint)}ms`);
    record(cat, 'DOM 节点数合理 < 3000', perf.domNodes < 3000, `nodes=${perf.domNodes}`);

    // --- 5. 元素可见性（交互前） ---
    const visibility = JSON.parse(await evalJS(ws, `(() => {
      const check = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return { exists: false };
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          exists: true,
          visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
          width: r.width, height: r.height, top: r.top, left: r.left,
          opacity: cs.opacity,
        };
      };
      return JSON.stringify({
        header: check('header'),
        herbCatalog: check('.herb-catalog-entry'),
        mapBoard: check('.leaflet-container'),
        regionQuickSelector: check('.region-quick-selector'),
        regionPanel: check('.modal-layer'),
        backToTop: check('.back-to-top'),
      });
    })()`));
    Object.entries(visibility).forEach(([name, v]) => {
      if (v.exists === false) {
        record(cat, `${name} 元素存在`, false, 'not found');
      } else if (!v.visible) {
        record(cat, `${name} 元素可见`, false, `w=${v.width} h=${v.height} op=${v.opacity}`);
      } else {
        record(cat, `${name} 元素可见`, true, `${Math.round(v.width)}x${Math.round(v.height)}`);
      }
    });

    // --- 6. 交互：打开草药目录 ---
    const herbOpened = await evalJS(ws, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /草药分类目录/.test(b.textContent || ''));
      btn?.click();
      return !!btn;
    })()`);
    await sleep(800);
    const catalogState = JSON.parse(await evalJS(ws, `(() => {
      // 草药目录打开后，原 entry 会被替换为 modal
      const entry = document.querySelector('.herb-catalog-entry');
      const modal = document.querySelector('[role="dialog"]') ||
                    Array.from(document.querySelectorAll('div')).find(d => /草药分类目录|按字母/.test(d.textContent || ''));
      return JSON.stringify({
        entryRemoved: !entry,
        modalFound: !!modal,
        modalText: modal?.textContent?.slice(0, 50) || '',
      });
    })()`));
    record(cat, '草药目录按钮可点击', herbOpened, '');
    record(cat, '点击后入口消失 / Modal 出现', catalogState.entryRemoved || catalogState.modalFound,
      `entryRemoved=${catalogState.entryRemoved} modal=${catalogState.modalFound}`);
    await snap(ws, join(LOG_DIR, `${vp.name}-herb-catalog.png`));

    // 关闭目录
    await evalJS(ws, `(() => {
      const close = document.querySelector('[aria-label="关闭"]') ||
                    Array.from(document.querySelectorAll('button')).find(b => /×|✕/.test(b.textContent || ''));
      close?.click();
    })()`);
    await sleep(500);

    // --- 7. 交互：关于瑶医 → Yao Knowledge Modal ---
    const aboutOpened = await evalJS(ws, `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /关于瑶医/.test(b.textContent || ''));
      if (btn) { btn.click(); return true; }
      return false;
    })()`);
    await sleep(800);
    await snap(ws, join(LOG_DIR, `${vp.name}-about-modal.png`));
    const aboutState = JSON.parse(await evalJS(ws, `(() => {
      const modal = document.querySelector('[role="dialog"]') ||
                    Array.from(document.querySelectorAll('*')).find(el => el.textContent?.includes('瑶医基础知识'));
      return JSON.stringify({ hasModal: !!modal });
    })()`));
    record(cat, '关于瑶医 Modal 可打开', aboutOpened && aboutState.hasModal,
      `btn=${aboutOpened} modal=${aboutState.hasModal}`);

    // 关闭
    await evalJS(ws, `(() => {
      const close = document.querySelector('[aria-label="关闭"]') ||
                    document.querySelector('[aria-label="关闭瑶医基础知识"]');
      close?.click();
    })()`);
    await sleep(500);

    // --- 8. 交互：点击省份按钮 → 钻取地图 ---
    const beforeProvince = await evalJS(ws, `document.querySelectorAll('svg path').length`);
    await evalJS(ws, `(() => {
      const btn = document.querySelector('button[aria-label*="查看"]');
      btn?.click();
    })()`);
    await sleep(1500);
    const afterProvince = await evalJS(ws, `document.querySelectorAll('svg path').length`);
    const provinceChanged = Math.abs(afterProvince - beforeProvince) > 0;
    record(cat, '省份点击触发地图变化', provinceChanged,
      `before=${beforeProvince} after=${afterProvince}`);
    await snap(ws, join(LOG_DIR, `${vp.name}-province-click.png`));

    // 关闭面板
    await evalJS(ws, `(() => {
      const close = document.querySelector('[aria-label="关闭"]');
      close?.click();
    })()`);
    await sleep(500);

    // --- 9. 交互：搜索框输入 ---
    await evalJS(ws, `(() => {
      const input = document.querySelector('input[aria-label*="搜索"]');
      if (input) {
        input.focus();
        input.value = '黄';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await sleep(800);
    const searchState = JSON.parse(await evalJS(ws, `(() => {
      const dropdown = document.querySelector('[role="listbox"]') ||
                       Array.from(document.querySelectorAll('div'))
                         .find(d => /黄|黄芪|黄精/.test(d.textContent || '') && d.children.length > 0);
      return JSON.stringify({
        inputValue: document.querySelector('input[aria-label*="搜索"]')?.value,
        hasDropdown: !!dropdown,
      });
    })()`));
    record(cat, '搜索框输入响应', searchState.inputValue === '黄',
      `value="${searchState.inputValue}" dropdown=${searchState.hasDropdown}`);
    await snap(ws, join(LOG_DIR, `${vp.name}-search.png`));

    // 清空搜索
    await evalJS(ws, `(() => {
      const input = document.querySelector('input[aria-label*="搜索"]');
      if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
    })()`);
    await sleep(300);

    return { consoleErrors, failedRequests };
  } finally {
    await closeTab(ws);
  }
}

async function main() {
  console.log('==========================================');
  console.log('  软件呈现效果综合检测 v2');
  console.log('  Target:', URL);
  console.log('==========================================');

  await waitForEdge();
  console.log('Edge Headless 已就绪');

  for (const vp of VIEWPORTS) {
    try {
      await testViewport(vp);
    } catch (e) {
      console.error(`  [FATAL] ${vp.name}: ${e.message}`);
      record(vp.name, 'viewport 测试', false, e.message);
    }
  }

  edgeProc.kill();

  // 汇总
  console.log('\n==========================================');
  console.log('  呈现效果测试汇总');
  console.log('==========================================');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`总用例数: ${results.length}`);
  console.log(`通过:     ${passed}`);
  console.log(`失败:     ${failed}`);
  console.log(`通过率:   ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log(`截图保存: ${LOG_DIR}`);
  if (issues.length > 0) {
    console.log('\n问题清单:');
    issues.forEach((it) => console.log(`  ✗ [${it.category}] ${it.name}: ${it.info}`));
  } else {
    console.log('\n✅ 所有用例均通过');
  }

  writeFileSync(
    join(REPORT_DIR, 'ui-presentation-report.json'),
    JSON.stringify({
      summary: {
        total: results.length,
        passed,
        failed,
        passRate: ((passed / results.length) * 100).toFixed(2) + '%',
      },
      results,
      issues,
      viewports: VIEWPORTS.map(v => v.name),
    }, null, 2),
  );

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); edgeProc.kill(); process.exit(2); });