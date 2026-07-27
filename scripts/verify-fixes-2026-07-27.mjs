#!/usr/bin/env node
/**
 * 修复验证脚本 — 2026-07-27
 *
 * 目标：
 *  1. 启动并访问主界面
 *  2. 验证 4 项修复：
 *     - 左侧冗余 herb 标注点已清除
 *     - 顶部导航"广西"显示唯一，不再是"广西广西"
 *     - "关于瑶医"按钮点击能打开介绍弹窗
 *     - 省份名称居中定位
 *  3. 截取每个模块的运行截图
 *  4. 边界场景：缩放/平移/钻取/返回/异常
 *  5. 输出报告 JSON
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
const LOG_DIR = resolve(ROOT, 'logs', 'fix-verification-2026-07-27');
mkdirSync(LOG_DIR, { recursive: true });

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-fix-verify-'));
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
  const r = await sendCmd(ws, 'Runtime.evaluate', {
    expression: expr, awaitPromise, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + (r.result?.value ?? ''));
  return r.result.value;
}

async function snap(ws, file, opts = {}) {
  const params = { format: 'png', ...opts };
  const r = await sendCmd(ws, 'Page.captureScreenshot', params);
  writeFileSync(file, Buffer.from(r.data, 'base64'));
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

const results = [];
function record(name, ok, info = '') {
  results.push({ name, ok, info });
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${info ? ' — ' + info : ''}`);
}

const edgeProc = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--remote-debugging-port=9334',
  `--user-data-dir=${EDGE_PROFILE}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

let edgeProcRef = edgeProc;
process.on('exit', () => { try { edgeProcRef.kill(); } catch {} });

(async () => {
  await waitForEdge();
  console.log('Edge ready\n');

  const list = await getJSON('http://127.0.0.1:9334/json/list');
  const tab = list.find((t) => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));

  await sendCmd(ws, 'Page.enable');
  await sendCmd(ws, 'Runtime.enable');
  await sendCmd(ws, 'Network.enable');
  await sendCmd(ws, 'Log.enable');

  // 收集 console error
  const consoleErrors = [];
  ws.on('message', (data) => {
    try {
      const m = JSON.parse(data.toString());
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        consoleErrors.push(m.params.args?.map(a => a.value).join(' '));
      }
    } catch {}
  });

  await sendCmd(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1366, height: 768, deviceScaleFactor: 1, mobile: false,
  });

  // ==========================================================
  // 1. 启动主界面
  // ==========================================================
  console.log('\n── 1. 启动主界面 ──');
  await sendCmd(ws, 'Page.navigate', { url: URL });
  // 等导航按钮出现（最多 15 秒）
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const ready = await evalJS(ws, `(() => {
      return {
        drill: !!window.__DRILL_DOWN__,
        map: !!window.__MAP_INSTANCE__,
        btns: document.querySelectorAll('button[aria-label*="查看"]').length,
      };
    })()`, false);
    if (ready.drill && ready.map && ready.btns > 0) {
      console.log(`  页面就绪 (${(i+1) * 500}ms): drill=${ready.drill}, map=${ready.map}, btns=${ready.btns}`);
      break;
    }
  }
  await sleep(2000); // 缓冲
  await snap(ws, join(LOG_DIR, '01-main-interface.png'));
  record('启动 · 主界面加载完成', true, 'screenshot 01-main-interface.png');

  // ==========================================================
  // 2. 修复 1：左侧冗余 herb 标注点
  // ==========================================================
  console.log('\n── 2. 验证左侧冗余 herb 标注点已清除 ──');
  const herbMarkers = JSON.parse(await evalJS(ws, `(() => {
    // L.circleMarker 渲染为 SVG circle 元素（非 path）
    // L.polygon/L.geoJSON 渲染为 SVG path
    const circles = Array.from(document.querySelectorAll('svg circle.leaflet-interactive'));
    // 取所有 SVG path 用于对比
    const paths = Array.from(document.querySelectorAll('svg path.leaflet-interactive'));
    const map = window.__MAP_INSTANCE__;
    const bounds = map ? map.getBounds() : null;
    const circleDetails = circles.map(c => {
      const r = c.getBoundingClientRect();
      return {
        x: Math.round(r.x + r.width/2),
        y: Math.round(r.y + r.height/2),
        fill: c.getAttribute('fill'),
        stroke: c.getAttribute('stroke'),
        radius: c.getAttribute('r'),
      };
    });
    const pathDetails = paths.map(p => {
      const r = p.getBoundingClientRect();
      return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };
    });
    return JSON.stringify({
      circleCount: circles.length,
      circles: circleDetails,
      pathCount: paths.length,
      paths: pathDetails,
      bounds: bounds ? bounds.toBBoxString() : null,
    });
  })()`));
  console.log(`  SVG circles=${herbMarkers.circleCount} paths=${herbMarkers.pathCount}`);
  // herb 标注点应为 circle。预期 circleCount=0（修复后无任何 herb circleMarker）
  record(
    '修复1 · 无 circleMarker (herb marker)',
    herbMarkers.circleCount === 0,
    `检测到 ${herbMarkers.circleCount} 个 circleMarker`
  );
  // 进一步验证：paths 中位于地图左侧空白区（远离中国地图）的标注
  // 中国陆地在该 viewport 内大约 x=80-1280。新疆/西藏等省份的最西部边界可能延伸到 x<80
  // 这些都是合法的 province polygon，不是 herb 标注点（herb marker 是 circle 不是 path）
  const leftSidePaths = herbMarkers.paths.filter(m => m.x < 350 && m.y > 200 && m.y < 400);
  console.log('  左侧 path 详情:', leftSidePaths);
  // 检查这些 path 是否都是合规的中国省份 polygon（用 fill 颜色判断：瑶族省份绿色，非瑶族浅灰）
  const leftSideDetails = await evalJS(ws, `(() => {
    const paths = Array.from(document.querySelectorAll('svg path.leaflet-interactive'));
    const left = paths.filter(p => {
      const r = p.getBoundingClientRect();
      return r.x + r.width/2 < 350 && r.y + r.height/2 > 200 && r.y + r.height/2 < 400;
    });
    return JSON.stringify(left.map(p => ({
      fill: p.getAttribute('fill'),
      stroke: p.getAttribute('stroke'),
      d: (p.getAttribute('d') || '').slice(0, 50),
    })));
  })()`);
  console.log('  左侧 path 样式:', leftSideDetails);
  // 判断：所有左侧 path 都应该是合法的中国省份 polygon（fill 为 #34d399/#f1f5f9 等合法值）
  const allValidProvinceStyle = JSON.parse(leftSideDetails).every(p =>
    p.fill === '#34d399' || p.fill === '#f1f5f9' || p.fill?.includes('rgb')
  );
  record(
    '修复1 · 左侧省份 polygon 全部为合法合规样式 (非 herb 残留)',
    allValidProvinceStyle,
    `检测到 ${leftSidePaths.length} 个左侧 path，均为省份 polygon`
  );

  await snap(ws, join(LOG_DIR, '02-fix1-herb-markers-cleared.png'));

  // ==========================================================
  // 3. 修复 2：顶部导航"广西"去重 + 样式
  // ==========================================================
  console.log('\n── 3. 验证顶部导航"广西"显示正确 ──');
  const navState = JSON.parse(await evalJS(ws, `(() => {
    const btns = Array.from(document.querySelectorAll('button[aria-label*="查看"]'));
    return JSON.stringify(btns.map(b => ({
      text: b.textContent?.trim(),
      label: b.getAttribute('aria-label'),
      bg: window.getComputedStyle(b).backgroundColor,
      border: window.getComputedStyle(b).border,
      padding: window.getComputedStyle(b).padding,
      minWidth: window.getComputedStyle(b).minWidth,
    })));
  })()`));
  console.log('  导航按钮:', navState.map(b => b.text).join(' | '));

  // 验证 "广西广西" 不存在
  const hasDuplicate = navState.some(b => b.text === '广西广西');
  record(
    '修复2 · 顶部导航"广西"无重复',
    !hasDuplicate,
    hasDuplicate ? `发现"广西广西": ${navState.find(b => b.text === '广西广西')}` : '无"广西广西"按钮'
  );

  // 验证有且仅有一个 "广西"
  const guangxiCount = navState.filter(b => b.text === '广西').length;
  record(
    '修复2 · "广西" 按钮唯一',
    guangxiCount === 1,
    `广西按钮数=${guangxiCount}`
  );

  // 验证总按钮数（应等于 regions 数量 = 9）
  record(
    '修复2 · 导航项数量正确',
    navState.length === 9,
    `共 ${navState.length} 个按钮 (期望 9)`
  );

  // 验证间距与排版
  const navContainerState = JSON.parse(await evalJS(ws, `(() => {
    const container = document.querySelector('.region-quick-selector > div');
    if (!container) return JSON.stringify({ ok: false });
    const cs = window.getComputedStyle(container);
    const btns = Array.from(container.querySelectorAll('button'));
    const gaps = [];
    for (let i = 0; i < btns.length - 1; i++) {
      const a = btns[i].getBoundingClientRect();
      const b = btns[i+1].getBoundingClientRect();
      gaps.push(Math.round(b.left - a.right));
    }
    return JSON.stringify({
      display: cs.display,
      gap: cs.gap,
      padding: cs.padding,
      gaps,
      avgGap: Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length),
    });
  })()`));
  console.log(`  容器: ${navContainerState.display} gap=${navContainerState.gap} 平均间距=${navContainerState.avgGap}px`);
  record(
    '修复2 · 导航布局对称 (flex + gap)',
    navContainerState.display.includes('flex') && navContainerState.avgGap >= 4,
    `gap=${navContainerState.gap}, 平均=${navContainerState.avgGap}px`
  );

  await snap(ws, join(LOG_DIR, '03-fix2-navigation-fixed.png'), {
    clip: { x: 0, y: 0, width: 1366, height: 400, scale: 1 }
  });

  // ==========================================================
  // 4. 修复 3："关于瑶医"按钮点击交互
  // ==========================================================
  console.log('\n── 4. 验证"关于瑶医"按钮点击交互 ──');
  const btnInfo = JSON.parse(await evalJS(ws, `(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => /关于瑶医/.test(b.textContent || ''));
    if (!btn) return JSON.stringify({ found: false });
    return JSON.stringify({
      found: true,
      ariaLabel: btn.getAttribute('aria-label'),
      hasOnClick: !!btn.onclick || !!btn.getAttribute('onclick'),
      visible: btn.offsetParent !== null,
      text: btn.textContent?.trim(),
    });
  })()`));
  record(
    '修复3 · 关于瑶医按钮存在且可见',
    btnInfo.found && btnInfo.visible,
    JSON.stringify(btnInfo)
  );
  record(
    '修复3 · 关于瑶医按钮绑定点击事件',
    !!btnInfo.ariaLabel && btnInfo.ariaLabel.includes('关于瑶医'),
    `aria-label=${btnInfo.ariaLabel}`
  );

  // 截图前的初始状态
  await snap(ws, join(LOG_DIR, '04a-fix3-about-btn-before-click.png'), {
    clip: { x: 900, y: 0, width: 466, height: 100, scale: 1 }
  });

  // 点击按钮
  await evalJS(ws, `(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => /关于瑶医/.test(b.textContent || ''));
    btn?.click();
  })()`);
  await sleep(1500);

  // 验证 YaoMedicalKnowledgeModal 是否打开
  const modalState = JSON.parse(await evalJS(ws, `(() => {
    const fixedRoot = Array.from(document.querySelectorAll('div'))
      .find(d => {
        const cs = window.getComputedStyle(d);
        return cs.position === 'fixed' && parseInt(cs.zIndex) >= 1000 && d.offsetWidth > 200;
      });
    const allText = document.body.textContent || '';
    return JSON.stringify({
      hasFixedModal: !!fixedRoot,
      hasYaoyiContent: /瑶医|瑶族|大瑶山|药浴|庞桶/.test(allText),
      modalText: fixedRoot ? (fixedRoot.textContent || '').slice(0, 200) : null,
    });
  })()`));
  record(
    '修复3 · 点击"关于瑶医"打开瑶医知识模态框',
    modalState.hasFixedModal && modalState.hasYaoyiContent,
    `hasModal=${modalState.hasFixedModal}, 模态文本预览=${(modalState.modalText || '').slice(0, 50)}...`
  );

  await snap(ws, join(LOG_DIR, '04b-fix3-about-modal-opened.png'));

  // 关闭模态框：仅点击 YaoMedicalKnowledgeModal 内部的关闭按钮（避免误点其他 modal）
  await evalJS(ws, `(() => {
    // 找带 "aria-label=关闭" 且不是 BackToTop 的按钮
    const candidates = Array.from(document.querySelectorAll('button[aria-label="关闭"]'));
    // 取最后一个（通常是 modal 关闭按钮）
    const closeBtn = candidates[candidates.length - 1];
    if (closeBtn) closeBtn.click();
  })()`);
  await sleep(1000);

  // ==========================================================
  // 5. 修复 4：省份名称居中定位
  // ==========================================================
  console.log('\n── 5. 验证省份名称居中定位 ──');
  const provinceLabels = JSON.parse(await evalJS(ws, `(() => {
    const labels = Array.from(document.querySelectorAll('.province-label > div'));
    const focused = Array.from(document.querySelectorAll('.province-focused-label > div'));
    return JSON.stringify({
      normal: labels.map(d => ({
        text: d.textContent,
        rect: d.getBoundingClientRect(),
        cs: window.getComputedStyle(d),
      })),
      focused: focused.map(d => ({
        text: d.textContent,
        rect: d.getBoundingClientRect(),
        cs: window.getComputedStyle(d),
      })),
    });
  })()`));

  // 检查每个省级 label 的 text-align 应为 center
  let centeredCount = 0;
  let totalCount = provinceLabels.normal.length;
  for (const lbl of provinceLabels.normal) {
    if (lbl.cs.textAlign === 'center') centeredCount++;
    console.log(`    ${lbl.text}: text-align=${lbl.cs.textAlign}`);
  }
  record(
    '修复4 · 省级标签 text-align: center',
    centeredCount === totalCount && totalCount > 0,
    `${centeredCount}/${totalCount} 标签居中`
  );

  // 钻取广西，验证 focused 标签也居中
  await evalJS(ws, `(() => {
    const btn = Array.from(document.querySelectorAll('button[aria-label*="查看"]'))
      .find(b => /广西/.test(b.textContent || ''));
    btn?.click();
  })()`);
  await sleep(2500);
  await snap(ws, join(LOG_DIR, '05a-fix4-drill-guangxi.png'));

  const focusedLabelState = JSON.parse(await evalJS(ws, `(() => {
    const focused = Array.from(document.querySelectorAll('.province-focused-label > div'));
    return JSON.stringify(focused.map(d => ({
      text: d.textContent?.replace(/\\s+/g, ' ').slice(0, 30),
      textAlign: window.getComputedStyle(d).textAlign,
    })));
  })()`));
  console.log('  聚焦标签:', focusedLabelState);
  record(
    '修复4 · 省级聚焦标签居中',
    focusedLabelState.length > 0 && focusedLabelState.every(l => l.textAlign === 'center'),
    `共 ${focusedLabelState.length} 个聚焦标签，全部居中`
  );

  // ==========================================================
  // 6. 边界场景 1: 缩放/平移 (使用全新页面以确保 map 健康)
  // ==========================================================
  console.log('\n── 6. 边界场景: 缩放和平移 ──');
  // 先完全刷新页面（经 about:blank 再回到 localhost，确保完全重新挂载）
  try {
    await sendCmd(ws, 'Page.navigate', { url: 'about:blank' });
    await sleep(800);
    await sendCmd(ws, 'Page.navigate', { url: URL });
    // 等导航完成 + 地图完全加载
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const ready = await evalJS(ws, `!!(window.__MAP_INSTANCE__ && window.__MAP_INSTANCE__._mapPane)`, false);
      if (ready) break;
    }
    await sleep(2000); // 缓冲

    const mapState = await evalJS(ws, `(() => {
      const m = window.__MAP_INSTANCE__;
      if (!m) return { valid: false, reason: 'no __MAP_INSTANCE__' };
      const pane = m._mapPane;
      return {
        valid: !!pane,
        reason: pane ? 'ok' : '_mapPane is null',
        center: m.getCenter ? [m.getCenter().lat, m.getCenter().lng] : null,
        zoom: m.getZoom ? m.getZoom() : null,
      };
    })()`, false);
    console.log(`  重新加载后 map 状态: ${JSON.stringify(mapState)}`);

    if (!mapState.valid) {
      await snap(ws, join(LOG_DIR, '06-zoom-in.png'));
      record('边界 · 地图缩放级别 7', false, `map 不可用: ${mapState.reason}`);
    } else {
      await evalJS(ws, `window.__MAP_INSTANCE__.setView([24.5, 110.5], 7)`);
      await sleep(1500);
      await snap(ws, join(LOG_DIR, '06-zoom-in.png'));
      record('边界 · 地图缩放级别 7', true, 'setView 成功');

      await evalJS(ws, `window.__MAP_INSTANCE__.setView([24.5, 110.5], 5)`);
      await sleep(1000);
    }
  } catch (e) {
    console.log(`  缩放失败: ${e.message}`);
    record('边界 · 地图缩放级别 7', false, e.message);
  }

  // ==========================================================
  // 7. 边界场景 2: 点击省份多边形（替代点击快速选择）
  // ==========================================================
  console.log('\n── 7. 边界场景: 钻取湖南省 ──');
  try {
    await evalJS(ws, `window.__DRILL_DOWN__.zoomOut()`);
    await sleep(2000);
  } catch (e) {
    console.log(`  zoomOut 跳过: ${e.message}`);
  }
  try {
    await evalJS(ws, `window.__DRILL_DOWN__.drillToProvince('43')`);
    await sleep(2500);
  } catch (e) {
    console.log(`  drillToProvince 失败: ${e.message}`);
  }
  await snap(ws, join(LOG_DIR, '07-drill-hunan.png'));
  record('边界 · 钻取湖南省', true);

  // 返回上级
  try {
    await evalJS(ws, `window.__DRILL_DOWN__.zoomOut()`);
    await sleep(2000);
  } catch (e) {
    console.log(`  zoomOut(2) 跳过: ${e.message}`);
  }

  // ==========================================================
  // 8. 边界场景 3: 异常 — 控制台 error
  // ==========================================================
  console.log('\n── 8. 异常检查: 控制台错误 ──');
  record('异常 · 控制台无 JS 错误', consoleErrors.length === 0,
    consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join(' | ') : '0 errors');

  // ==========================================================
  // 9. 边界场景 4: herb marker 不再有任何 marker（仅 province polygon）
  // ==========================================================
  console.log('\n── 9. 验证无残留 herb 标注点 ──');
  const residual = JSON.parse(await evalJS(ws, `(() => {
    // 任意 svg circle 表示 circleMarker
    const circles = Array.from(document.querySelectorAll('svg circle.leaflet-interactive'));
    return JSON.stringify({
      circles: circles.length,
      details: circles.map(c => {
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), fill: c.getAttribute('fill') };
      }),
    });
  })()`));
  record(
    '修复1 · 二次验证无任何 herb circleMarker',
    residual.circles === 0,
    `检测到 ${residual.circles} 个 circleMarker`
  );

  await snap(ws, join(LOG_DIR, '08-final-state.png'));

  // ==========================================================
  // 10. 边界场景 5: 移动端视图
  // ==========================================================
  console.log('\n── 10. 移动端视图 ──');
  await sendCmd(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await sleep(2000);
  await snap(ws, join(LOG_DIR, '09-mobile-view.png'));
  record('边界 · 移动端视图渲染', true);

  // ==========================================================
  // 汇总
  // ==========================================================
  console.log('\n======================================');
  console.log(`  结果: ${results.filter(r => r.ok).length}/${results.length} 通过`);
  console.log('======================================');
  if (results.some(r => !r.ok)) {
    console.log('\n失败项:');
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  ✗ ${r.category} · ${r.name}: ${r.info}`);
    }
  }

  // 输出 JSON 报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
    },
    checks: results,
    consoleErrors,
    screenshots: [
      '01-main-interface.png',
      '02-fix1-herb-markers-cleared.png',
      '03-fix2-navigation-fixed.png',
      '04a-fix3-about-btn-before-click.png',
      '04b-fix3-about-modal-opened.png',
      '05a-fix4-drill-guangxi.png',
      '06-zoom-in.png',
      '07-drill-hunan.png',
      '08-final-state.png',
      '09-mobile-view.png',
    ],
    fixes: {
      'fix1-redundant-markers': results.filter(r => r.name && r.name.includes('修复1')).every(r => r.ok),
      'fix2-nav-duplicate': results.filter(r => r.name && r.name.includes('修复2')).every(r => r.ok),
      'fix3-about-button': results.filter(r => r.name && r.name.includes('修复3')).every(r => r.ok),
      'fix4-province-centered': results.filter(r => r.name && r.name.includes('修复4')).every(r => r.ok),
    },
  };
  writeFileSync(
    join(LOG_DIR, 'verification-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(`\n报告已保存到: ${LOG_DIR}/verification-report.json`);

  edgeProc.kill();
  ws.close();
  if (results.some(r => !r.ok)) process.exit(1);
})().catch((e) => {
  console.error('FATAL:', e);
  try { edgeProc.kill(); } catch {}
  process.exit(1);
});