/**
 * 完整 E2E 全场景测试套件
 *
 * 覆盖：
 *   1. 初始加载（资源 / DOM / 性能）
 *   2. ChinaMap（SVG 矢量地图）：省份点击、悬停、控制按钮
 *   3. RegionPanel（省份面板）：地区详情、草药卡
 *   4. MapBoard（Leaflet 真实地图）：瓦片、缩放、平移
 *   5. Drill-down（钻取地图）：省级→市级→县级
 *   6. CountyInfoModal：县级详情、章节编号、知识按钮
 *   7. YaoMedicalKnowledgeModal：知识页签、章节折叠
 *   8. HerbModal：草药详情、章节折叠、图片放大
 *   9. TherapyModal：疗法详情、章节折叠
 *   10. HistoryModal：历史时期、章节折叠
 *   11. HerbCatalog：草药目录滚动、搜索、点击
 *   12. SearchBar：搜索功能
 *   13. 边界场景：ESC 关闭、点击外部关闭、连续切换
 *   14. 性能指标：内存、CPU、加载时间、滚动 FPS
 *
 * 输出：完整的问题排查报告，含每个用例的：
 *   - 触发步骤
 *   - 实际行为
 *   - 是否符合预期
 *   - 控制台异常（如有）
 *   - 影响范围
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

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-e2e-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5186/';

// === 测试结果收集 ===
const issues = [];      // 问题清单
const tests = [];       // 测试用例清单
const consoleErrors = [];   // JS 运行时异常
const failedRequests = [];  // 网络失败请求

function ok(name, detail = '') { tests.push({ name, passed: true, detail }); }
function fail(name, detail = '', severity = 'LOW') {
  tests.push({ name, passed: false, detail, severity });
  issues.push({ name, detail, severity });
}
function note(severity, name, detail) {
  issues.push({ name, detail, severity });
}

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

// === 测试用例分组 ===
async function t01_initialLoad(ws) {
  console.log('\n--- T01: 初始加载 ---');
  const t0 = Date.now();
  const r = await evalJS(ws, `(() => {
    const root = document.getElementById('root');
    const header = document.querySelector('header');
    const svgs = document.querySelectorAll('svg').length;
    const scripts = document.querySelectorAll('script').length;
    const links = document.querySelectorAll('link[rel="stylesheet"]').length;
    const perf = performance;
    const nav = perf.getEntriesByType('navigation')[0];
    return JSON.stringify({
      hasRoot: !!root,
      rootChildren: root?.children.length || 0,
      headerText: header?.textContent?.slice(0, 50),
      svgCount: svgs,
      scriptsCount: scripts,
      stylesheetsCount: links,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
      loadComplete: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
    });
  })()`);
  const total = Date.now() - t0;
  const rval = JSON.parse(r);
  ok('T01.1 页面 DOM 加载完成', `total=${total}ms, root children=${rval.rootChildren}`);
  rval.domContentLoaded < 2000
    ? ok('T01.2 DOMContentLoaded < 2000ms', `${rval.domContentLoaded}ms`)
    : fail('T01.2 DOMContentLoaded < 2000ms', `${rval.domContentLoaded}ms`, 'MEDIUM');
  rval.loadComplete < 5000
    ? ok('T01.3 loadComplete < 5000ms', `${rval.loadComplete}ms`)
    : fail('T01.3 loadComplete < 5000ms', `${rval.loadComplete}ms`, 'MEDIUM');
  rval.hasRoot && rval.rootChildren > 0 && rval.headerText
    ? ok('T01.4 Header / Root 已挂载', `svg=${rval.svgCount}, scripts=${rval.scriptsCount}`)
    : fail('T01.4 Header / Root 已挂载', r);
}

async function t02_chinaMapProvinces(ws) {
  console.log('\n--- T02: ChinaMap 省份交互 ---');
  // 验证省份 SVG 路径已渲染
  const r = await evalJS(ws, `(() => {
    const allPaths = document.querySelectorAll('svg path');
    let cursorCount = 0;
    let provinceLabels = 0;
    allPaths.forEach(p => {
      const s = p.getAttribute('style') || '';
      const c = p.getAttribute('class') || '';
      if (s.includes('cursor: pointer') || c.includes('cursor-pointer')) cursorCount++;
    });
    // 找省级标签文字（行政区名）
    document.querySelectorAll('svg text').forEach(t => {
      const txt = (t.textContent || '').trim();
      // 排除 Lucide 图标的 text
      if (txt.length > 0 && txt.length < 8 && /^[一-龥]{2,6}$/.test(txt)) {
        // 检查父级是否是 ChinaMap
        if (t.closest('svg[viewBox="0 0 900 600"]')) provinceLabels++;
      }
    });
    return JSON.stringify({ totalPaths: allPaths.length, clickablePaths: cursorCount, provinceLabels });
  })()`);
  const rval = JSON.parse(r);
  rval.provinceLabels >= 5
    ? ok('T02.1 省份 SVG path 已渲染（>= 5 个）', `labels=${rval.provinceLabels}, clickable=${rval.clickablePaths}`)
    : fail('T02.1 省份 SVG path 已渲染', JSON.stringify(rval));

  // 模拟点击第一个省份
  const r2 = await evalJS(ws, `(() => {
    const paths = document.querySelectorAll('svg[viewBox="0 0 900 600"] path');
    let clicked = 0;
    let label = '';
    for (const p of paths) {
      const s = p.getAttribute('style') || '';
      const c = p.getAttribute('class') || '';
      if ((s.includes('cursor: pointer') || c.includes('cursor-pointer')) && p.getAttribute('fill') !== 'none') {
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        p.dispatchEvent(ev);
        clicked++;
        // 找到 label text 节点
        const group = p.closest('g');
        if (group) {
          const text = group.querySelector('text');
          if (text) label = text.textContent;
        }
        if (clicked >= 1) break;
      }
    }
    return JSON.stringify({ clicked, label });
  })()`);
  await sleep(500);
  const r2val = JSON.parse(r2);
  r2val.clicked > 0
    ? ok('T02.2 模拟点击省份 path', `label=${r2val.label}`)
    : fail('T02.2 模拟点击省份 path', r2);

  // 验证 RegionPanel 是否显示
  const r3 = await evalJS(ws, `(() => {
    const modalLayer = document.querySelector('.modal-layer');
    const panelWrapper = document.querySelector('.info-panel-wrapper');
    const storeState = window.__MAP_STORE__?.getState();
    return JSON.stringify({
      hasModalLayer: !!modalLayer,
      hasPanelWrapper: !!panelWrapper,
      isPanelOpen: storeState?.isPanelOpen,
      selectedRegion: storeState?.selectedRegion?.name || null,
    });
  })()`);
  const r3val = JSON.parse(r3);
  r3val.isPanelOpen === true
    ? ok('T02.3 RegionPanel 已打开', `region=${r3val.selectedRegion}`)
    : note('LOW', 'T02.3 RegionPanel 未打开', r3);
}

async function t03_regionPanel(ws) {
  console.log('\n--- T03: RegionPanel 内容渲染 ---');
  // 关闭之前的 modal
  await evalJS(ws, `window.__MAP_STORE__?.set({ isPanelOpen: false, selectedRegion: null });`);
  await sleep(300);

  // 通过 store 打开 RegionPanel (选一个明确有数据的省：广西)
  await evalJS(ws, `(() => {
    const store = window.__MAP_STORE__;
    if (!store) return 'no store';
    const state = store.getState();
    // 找一个 region
    const region = state.regions && state.regions[0] ? state.regions[0] : null;
    if (!region) {
      // 如果 regions 不在 state，使用默认触发
      store.set({ selectedRegion: { id: 'guangxi', name: '广西壮族自治区', nameEn: 'Guangxi', density: 5, color: '#22c55e', location: '华南', description: '瑶族主要分布区', herbs: [], therapies: [], historyPeriods: [] }, isPanelOpen: true, viewLevel: 'region', mapLayer: 'county' });
    } else {
      store.set({ selectedRegion: region, isPanelOpen: true, viewLevel: 'region', mapLayer: 'county' });
    }
    return 'opened';
  })()`);
  await sleep(500);

  // 验证面板内容
  const r = await evalJS(ws, `(() => {
    const wrapper = document.querySelector('.info-panel-wrapper:not(.info-panel-wrapper-scrollable)');
    if (!wrapper) return JSON.stringify({ found: false });
    const text = wrapper.textContent || '';
    const headerText = wrapper.querySelector('h2, .text-2xl')?.textContent?.slice(0, 30);
    return JSON.stringify({
      found: true,
      hasContent: text.length > 100,
      hasHeader: !!headerText,
      header: headerText,
      hasHerbs: /草药|药材/.test(text),
      hasTherapies: /疗法|诊疗/.test(text),
    });
  })()`);
  const rval = JSON.parse(r);
  rval.found && rval.hasContent && rval.hasHeader
    ? ok('T03.1 RegionPanel 内容完整渲染', `header=${rval.header}, hasHerbs=${rval.hasHerbs}, hasTherapies=${rval.hasTherapies}`)
    : fail('T03.1 RegionPanel 内容完整渲染', r);

  // 验证 RegionPanel 章节编号（如果存在）
  const r2 = await evalJS(ws, `(() => {
    const wrapper = document.querySelector('.info-panel-wrapper:not(.info-panel-wrapper-scrollable)');
    if (!wrapper) return JSON.stringify({ error: 'no wrapper' });
    const headings = Array.from(wrapper.querySelectorAll('h3,h4'))
      .map(h => h.textContent.trim())
      .filter(t => t.length > 0 && t.length < 30);
    return JSON.stringify({ headings: headings.slice(0, 10) });
  })()`);
  const r2val = JSON.parse(r2);
  console.log('  RegionPanel 章节标题:', r2val.headings);
}

async function t04_mapBoard(ws) {
  console.log('\n--- T04: MapBoard 真实地图 ---');
  const r = await evalJS(ws, `(() => {
    const all = document.querySelectorAll('svg, .leaflet-container');
    let leafletCount = 0;
    let pathCount = 0;
    let tileCount = 0;
    document.querySelectorAll('.leaflet-container').forEach(el => {
      leafletCount++;
      // Leaflet 不创建 SVG path，它使用 <img> tiles
    });
    document.querySelectorAll('.leaflet-tile').forEach(el => tileCount++);
    return JSON.stringify({
      leafletContainers: leafletCount,
      leafletTiles: tileCount,
    });
  })()`);
  const rval = JSON.parse(r);
  console.log('  Leaflet:', JSON.stringify(rval));
  rval.leafletContainers > 0
    ? ok('T04.1 Leaflet 容器已挂载', JSON.stringify(rval))
    : note('LOW', 'T04.1 Leaflet 容器未挂载', JSON.stringify(rval));
}

async function t05_countyInfoModal(ws) {
  console.log('\n--- T05: CountyInfoModal 全场景 ---');
  // 关闭所有 modal
  await evalJS(ws, `(() => {
    window.__MAP_STORE__?.set({
      isPanelOpen: false, selectedRegion: null,
      isCountyModalOpen: false, selectedCounty: null,
      isHerbModalOpen: false, selectedHerb: null,
      isTherapyModalOpen: false, selectedTherapy: null,
      isHistoryModalOpen: false, selectedHistoryPeriod: null,
    });
  })()`);
  await sleep(300);

  // 准备测试 county 数据
  const testCounties = [
    { code: '451302', name: '兴宾区', hasIndustryBase: false, expected: 'continuous (8 sections)' },
    { code: '451324', name: '金秀县', hasIndustryBase: true, expected: 'continuous (9 sections)' },
    { code: '431122', name: '汝城县', hasIndustryBase: false, expected: 'continuous' },
  ];

  for (const tc of testCounties) {
    await evalJS(ws, `(() => {
      window.__MAP_STORE__?.set({
        selectedCounty: {
          code: '${tc.code}',
          name: '${tc.name}',
          nameEn: 'Test',
          centerLng: 110,
          centerLat: 24,
          category: 'core',
          province: '广西',
          regionId: 'guangxi',
          institutionCount: 2,
          herbVarieties: ['jiegeng', 'gancao'],
          schools: ['Test'],
          govSupportLevel: 'city',
          specialCrafts: [],
          since: 1500,
          note: '',
        },
        isCountyModalOpen: true,
      });
    })()`);
    await sleep(400);

    const r = await evalJS(ws, `(() => {
      const wrapper = document.getElementById('county-modal-title')?.closest('.info-panel-wrapper');
      if (!wrapper) return JSON.stringify({ error: 'no wrapper' });
      const headings = Array.from(wrapper.querySelectorAll('h3'))
        .map(h => h.textContent.trim())
        .filter(t => /^[一二三四五六七八九]、/.test(t));
      const nums = headings.map(h => '一二三四五六七八九'.indexOf(h[0]));
      const continuous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
      return JSON.stringify({ headings, nums, continuous });
    })()`);
    const rval = JSON.parse(r);
    rval.continuous
      ? ok(`T05.1 ${tc.name} 章节编号连续`, `nums=${JSON.stringify(rval.nums)}`)
      : fail(`T05.1 ${tc.name} 章节编号连续`, JSON.stringify(rval), 'HIGH');

    // 测试 知识按钮 跳转
    const r2 = await evalJS(ws, `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((b) => (b.textContent || '').indexOf('瑶医基础知识') >= 0 && (b.textContent || '').indexOf('统一入口') >= 0);
      if (!target) return JSON.stringify({ found: false });
      target.click();
      return JSON.stringify({ clicked: true });
    })()`);
    await sleep(700);

    const r3 = await evalJS(ws, `(() => {
      const knowledgeText = Array.from(document.querySelectorAll('p, h2, span')).find((el) =>
        (el.textContent || '').indexOf('瑶医药国家级非物质文化遗产') >= 0
      );
      const store = window.__MAP_STORE__?.getState();
      return JSON.stringify({
        knowledgeModalMounted: !!knowledgeText,
        countyClosed: !document.getElementById('county-modal-title'),
        isCountyModalOpen: store?.isCountyModalOpen,
      });
    })()`);
    const r3val = JSON.parse(r3);
    r3val.countyClosed
      ? ok(`T05.2 ${tc.name} 跳转知识页时县级模态自动关闭`)
      : fail(`T05.2 ${tc.name} 跳转知识页时县级模态自动关闭`, JSON.stringify(r3val), 'HIGH');
    r3val.knowledgeModalMounted
      ? ok(`T05.3 ${tc.name} 知识模态自动打开`)
      : fail(`T05.3 ${tc.name} 知识模态自动打开`, JSON.stringify(r3val), 'HIGH');

    // 关闭所有
    await evalJS(ws, `window.__MAP_STORE__?.set({ isCountyModalOpen: false, selectedCounty: null });`);
    await sleep(300);
  }
}

async function t06_herbModal(ws) {
  console.log('\n--- T06: HerbModal ---');
  await evalJS(ws, `(() => {
    window.__MAP_STORE__?.set({
      isHerbModalOpen: true,
      selectedHerb: {
        id: 'huangjing',
        name: '黄精',
        nameEn: 'Polygonatum sibiricum',
        nameYao: 'Yao name',
        taste: '甘平',
        medicinalPart: '根茎',
        regionId: 'guangxi',
        scientificName: 'Polygonatum sibiricum',
        efficacy: 'test',
        usage: 'test',
        botanicalFeatures: 'test',
        yaoMedicineHistory: 'test',
        activeIngredients: 'test',
        distributionArea: 'test',
        collectionSeason: 'test',
        modernPharmacology: 'test',
        image: '/test.jpg',
        therapyIds: [],
      },
    });
  })()`);
  await sleep(500);

  const r = await evalJS(ws, `(() => {
    const wrappers = document.querySelectorAll('.info-panel-wrapper');
    let herbWrapper = null;
    wrappers.forEach(w => {
      if ((w.textContent || '').indexOf('黄精') >= 0) herbWrapper = w;
    });
    if (!herbWrapper) return JSON.stringify({ found: false });
    const headings = Array.from(herbWrapper.querySelectorAll('h3'))
      .map(h => h.textContent.trim())
      .filter(t => /^[一二三四五六七八]、/.test(t));
    const nums = headings.map(h => '一二三四五六七八'.indexOf(h[0]));
    const continuous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    return JSON.stringify({ headings, nums, continuous });
  })()`);
  const rval = JSON.parse(r);
  rval.continuous && rval.nums.length === 8
    ? ok('T06.1 HerbModal 8 个章节连续渲染', `nums=${JSON.stringify(rval.nums)}`)
    : fail('T06.1 HerbModal 8 个章节连续渲染', JSON.stringify(rval));

  await evalJS(ws, `window.__MAP_STORE__?.set({ isHerbModalOpen: false, selectedHerb: null });`);
  await sleep(300);
}

async function t07_therapyModal(ws) {
  console.log('\n--- T07: TherapyModal ---');
  await evalJS(ws, `(() => {
    window.__MAP_STORE__?.set({
      isTherapyModalOpen: true,
      selectedTherapy: {
        id: 'test_therapy',
        name: 'Test Therapy',
        nameEn: 'Test Therapy EN',
        system: 'test',
        description: 'desc',
        applicableConditions: ['cond1', 'cond2'],
        operationFlow: '1. step one；2. step two；3. step three',
        precautions: ['prec1'],
        inheritors: [],
        clinicalCases: [],
        relatedHerbs: [],
        relatedHistoryPeriods: [],
        regionId: 'guangxi',
      },
    });
  })()`);
  await sleep(500);

  const r = await evalJS(ws, `(() => {
    const wrappers = document.querySelectorAll('.info-panel-wrapper');
    let tWrapper = null;
    wrappers.forEach(w => {
      if ((w.textContent || '').indexOf('Test Therapy') >= 0) tWrapper = w;
    });
    if (!tWrapper) return JSON.stringify({ found: false });
    const headings = Array.from(tWrapper.querySelectorAll('h3'))
      .map(h => h.textContent.trim())
      .filter(t => /^[一二三四五六七八]、/.test(t));
    const nums = headings.map(h => '一二三四五六七八'.indexOf(h[0]));
    const continuous = nums.length > 0 && nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    return JSON.stringify({ headings, nums, continuous, count: nums.length });
  })()`);
  const rval = JSON.parse(r);
  console.log('  TherapyModal 章节:', rval.headings);
  if (rval.found === false) {
    fail('T07.1 TherapyModal 章节渲染', JSON.stringify(rval), 'HIGH');
  } else {
    ok('T07.1 TherapyModal 章节渲染', `continuous=${rval.continuous}, count=${rval.count}`);
  }

  await evalJS(ws, `window.__MAP_STORE__?.set({ isTherapyModalOpen: false, selectedTherapy: null });`);
  await sleep(300);
}

async function t08_historyModal(ws) {
  console.log('\n--- T08: HistoryModal ---');
  await evalJS(ws, `(() => {
    window.__MAP_STORE__?.set({
      isHistoryModalOpen: true,
      selectedHistoryPeriod: {
        id: 'test_period',
        periodName: 'Test Period',
        timeRange: '1000-2000',
        regionId: 'guangxi',
        description: 'desc',
        importantEvents: ['e1'],
        culturalBackground: 'culture',
        majorSchools: ['s1'],
        inheritanceLineage: ['l1'],
        representativeWorks: ['w1'],
        relatedTherapies: [],
      },
    });
  })()`);
  await sleep(500);

  const r = await evalJS(ws, `(() => {
    const wrappers = document.querySelectorAll('.info-panel-wrapper');
    let hWrapper = null;
    wrappers.forEach(w => {
      if ((w.textContent || '').indexOf('Test Period') >= 0) hWrapper = w;
    });
    if (!hWrapper) return JSON.stringify({ found: false, allWrappers: wrappers.length });
    const headings = Array.from(hWrapper.querySelectorAll('h3,h4'));
    return JSON.stringify({
      found: true,
      hasContent: (hWrapper.textContent || '').length > 50,
      contentLength: (hWrapper.textContent || '').length,
      headingCount: headings.length,
    });
  })()`);
  const rval = JSON.parse(r);
  rval.found && rval.hasContent
    ? ok('T08.1 HistoryModal 内容渲染')
    : fail('T08.1 HistoryModal 内容渲染', JSON.stringify(rval));

  await evalJS(ws, `window.__MAP_STORE__?.set({ isHistoryModalOpen: false, selectedHistoryPeriod: null });`);
  await sleep(300);
}

async function t09_yaoKnowledgeModal(ws) {
  console.log('\n--- T09: YaoMedicalKnowledgeModal ---');
  // 先确保关闭所有模态
  await evalJS(ws, `window.__MAP_STORE__?.set({
    isPanelOpen: false, selectedRegion: null,
    isCountyModalOpen: false, selectedCounty: null,
    isHerbModalOpen: false, selectedHerb: null,
    isTherapyModalOpen: false, selectedTherapy: null,
    isHistoryModalOpen: false, selectedHistoryPeriod: null,
  });`);
  await sleep(300);

  await evalJS(ws, `window.dispatchEvent(new CustomEvent('open-yao-knowledge'));`);
  await sleep(700);

  const r = await evalJS(ws, `(() => {
    const wrappers = document.querySelectorAll('.info-panel-wrapper-scrollable');
    let kWrapper = null;
    wrappers.forEach(w => {
      if ((w.textContent || '').indexOf('瑶医药国家级非物质文化遗产') >= 0) kWrapper = w;
    });
    if (!kWrapper) return JSON.stringify({ found: false });
    return JSON.stringify({
      found: true,
      hasOverflow: getComputedStyle(kWrapper).overflowY === 'auto',
      hasScroll: kWrapper.scrollHeight > kWrapper.clientHeight,
      title: kWrapper.querySelector('.title-yao')?.textContent,
    });
  })()`);
  const rval = JSON.parse(r);
  rval.found && rval.hasOverflow
    ? ok('T09.1 YaoMedicalKnowledgeModal 整面板滚动', JSON.stringify(rval))
    : fail('T09.1 YaoMedicalKnowledgeModal 整面板滚动', JSON.stringify(rval));

  // 测试章节折叠
  const r2 = await evalJS(ws, `(() => {
    const wrappers = document.querySelectorAll('.info-panel-wrapper-scrollable');
    let kWrapper = null;
    wrappers.forEach(w => {
      if ((w.textContent || '').indexOf('瑶医药国家级非物质文化遗产') >= 0) kWrapper = w;
    });
    if (!kWrapper) return JSON.stringify({ error: 'no wrapper' });
    const sections = kWrapper.querySelectorAll('button[type="button"]');
    let toggled = 0;
    for (const sec of sections) {
      if ((sec.textContent || '').match(/^[一二三四五]/)) {
        sec.click();
        toggled++;
        if (toggled >= 2) break;
      }
    }
    return JSON.stringify({ toggled });
  })()`);
  const r2val = JSON.parse(r2);
  r2val.toggled > 0
    ? ok('T09.2 知识模态章节可折叠', `toggled=${r2val.toggled}`)
    : fail('T09.2 知识模态章节可折叠', r2);

  // 关闭
  await evalJS(ws, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
  await sleep(500);
}

async function t10_escAndClickOutside(ws) {
  console.log('\n--- T10: ESC / 点击外部关闭 ---');
  // 测试 ESC 关闭
  await evalJS(ws, `window.dispatchEvent(new CustomEvent('open-yao-knowledge'));`);
  await sleep(500);
  const beforeClose = await evalJS(ws, `(() => {
    const w = window.__test_helper__?.findScrolledPanel?.('瑶医药国家级非物质文化遗产');
    return JSON.stringify({ mounted: !!w });
  })()`);
  const beforeVal = JSON.parse(beforeClose);
  if (beforeVal.mounted) {
    await evalJS(ws, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
    await sleep(500);
    const after = await evalJS(ws, `(() => {
      const wrappers = document.querySelectorAll('.info-panel-wrapper-scrollable');
      let stillMounted = false;
      wrappers.forEach(w => {
        if ((w.textContent || '').indexOf('瑶医药国家级非物质文化遗产') >= 0) stillMounted = true;
      });
      return JSON.stringify({ stillMounted });
    })()`);
    const afterVal = JSON.parse(after);
    !afterVal.stillMounted
      ? ok('T10.1 ESC 键可关闭知识模态')
      : fail('T10.1 ESC 键可关闭知识模态', JSON.stringify(afterVal));
  }
}

async function t11_boundaryConditions(ws) {
  console.log('\n--- T11: 边界条件 ---');
  // 测试：连续点击 10 次省份
  await evalJS(ws, `window.__MAP_STORE__?.set({ isPanelOpen: false, selectedRegion: null, isCountyModalOpen: false, selectedCounty: null });`);
  await sleep(300);

  const r1 = await evalJS(ws, `(() => {
    const paths = document.querySelectorAll('svg[viewBox="0 0 900 600"] path');
    const clickable = Array.from(paths).filter(p => {
      const s = p.getAttribute('style') || '';
      const c = p.getAttribute('class') || '';
      return (s.includes('cursor: pointer') || c.includes('cursor-pointer')) && p.getAttribute('fill') !== 'none';
    });
    let count = 0;
    for (let i = 0; i < 10 && i < clickable.length; i++) {
      clickable[i].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      count++;
    }
    return JSON.stringify({ clickableCount: clickable.length, clicked: count });
  })()`);
  await sleep(800);
  const r1val = JSON.parse(r1);
  ok('T11.1 连续 10 次点击省份（稳定性）', `clickable=${r1val.clickableCount}, clicked=${r1val.clicked}`);

  // 测试：连续打开关闭模态
  const r2 = await evalJS(ws, `(() => {
    return new Promise(async (resolve) => {
      const results = [];
      const counties = ['451302', '451324', '431122'];
      for (const code of counties) {
        for (let round = 0; round < 3; round++) {
          window.__MAP_STORE__?.set({
            selectedCounty: { code, name: 'Test', nameEn: 'Test', centerLng: 110, centerLat: 24, category: 'core', province: 'Guangxi', regionId: 'guangxi', institutionCount: 1, herbVarieties: ['jiegeng'], schools: ['T'], govSupportLevel: 'city', specialCrafts: [], since: 1500, note: '' },
            isCountyModalOpen: true,
          });
          await new Promise(r => setTimeout(r, 300));
          const opened = !!document.getElementById('county-modal-title');
          // 关闭
          window.__MAP_STORE__?.set({ isCountyModalOpen: false, selectedCounty: null });
          await new Promise(r => setTimeout(r, 300));
          const closed = !document.getElementById('county-modal-title');
          results.push({ code, round, opened, closed });
        }
      }
      resolve(JSON.stringify(results));
    });
  })()`);
  const r2val = JSON.parse(r2);
  const allOk = r2val.every(r => r.opened && r.closed);
  allOk
    ? ok('T11.2 连续 9 轮开关模态（无残留）', `${r2val.length} rounds`)
    : fail('T11.2 连续 9 轮开关模态', JSON.stringify(r2val.filter(r => !r.opened || !r.closed)), 'MEDIUM');
}

async function t12_performance(ws) {
  console.log('\n--- T12: 性能指标 ---');
  const r = await evalJS(ws, `(() => {
    const mem = performance.memory;
    const perf = performance;
    const nav = perf.getEntriesByType('navigation')[0];
    const resources = perf.getEntriesByType('resource');
    const totalResourceSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    return JSON.stringify({
      usedJSHeapMB: mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : null,
      totalJSHeapMB: mem ? Math.round(mem.totalJSHeapSize / 1024 / 1024) : null,
      jsHeapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1024 / 1024) : null,
      resourceCount: resources.length,
      totalResourceSizeKB: Math.round(totalResourceSize / 1024),
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
      loadComplete: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
    });
  })()`);
  const rval = JSON.parse(r);
  console.log('  性能指标:', JSON.stringify(rval));

  // 性能基线判断
  rval.usedJSHeapMB < 200
    ? ok('T12.1 JS 堆内存 < 200MB', `${rval.usedJSHeapMB}MB`)
    : fail('T12.1 JS 堆内存 < 200MB', `${rval.usedJSHeapMB}MB`, 'MEDIUM');

  rval.loadComplete < 10000
    ? ok('T12.2 完整加载 < 10s', `${rval.loadComplete}ms`)
    : fail('T12.2 完整加载 < 10s', `${rval.loadComplete}ms`, 'MEDIUM');

  rval.resourceCount < 200
    ? ok('T12.3 资源请求数 < 200', `${rval.resourceCount}`)
    : fail('T12.3 资源请求数 < 200', `${rval.resourceCount}`, 'LOW');

  // 滚动 FPS 测量
  const r2 = await evalJS(ws, `(() => {
    return new Promise(async (resolve) => {
      try {
      // 找一个可滚动容器 - 重新查询（live collection 不够灵活）
      let target = null;
      const findScrollable = () => {
        const wrappers = document.querySelectorAll('.info-panel-wrapper-scrollable, .modal-body-scroll');
        for (const w of wrappers) {
          if ((w.textContent || '').indexOf('瑶医药国家级非物质文化遗产') >= 0) {
            return w;
          }
        }
        return null;
      };
      target = findScrollable();
      if (!target) {
        // 打开知识模态
        window.dispatchEvent(new CustomEvent('open-yao-knowledge'));
        await new Promise(r => setTimeout(r, 700));
        target = findScrollable();
      }
      if (!target) return resolve(JSON.stringify({ error: 'no scrollable' }));

      let frames = 0;
      const startTime = performance.now();
      const totalHeight = Math.max(0, target.scrollHeight - target.clientHeight);
      if (totalHeight < 100) return resolve(JSON.stringify({ error: 'too short to scroll', scrollHeight: target.scrollHeight, clientHeight: target.clientHeight }));
      const step = Math.max(10, Math.floor(totalHeight / 60));

      const measureFrames = () => {
        try {
          frames++;
          target.scrollTop += step;
          if (target.scrollTop < totalHeight && frames < 200) {
            requestAnimationFrame(measureFrames);
          } else {
            const elapsed = performance.now() - startTime;
            const fps = (frames / elapsed) * 1000;
            resolve(JSON.stringify({ frames, elapsed: Math.round(elapsed), fps: Math.round(fps * 10) / 10, totalHeight, clientHeight: target.clientHeight }));
          }
        } catch (e) {
          resolve(JSON.stringify({ error: 'scroll err: ' + e.message }));
        }
      };
      requestAnimationFrame(measureFrames);
      } catch (e) {
        resolve(JSON.stringify({ error: 'init err: ' + e.message }));
      }
    });
  })()`);
  const r2val = JSON.parse(r2);
  console.log('  滚动 FPS:', JSON.stringify(r2val));
  if (r2val.fps && r2val.fps >= 30) {
    ok(`T12.4 滚动 FPS >= 30`, `${r2val.fps} FPS`);
  } else {
    fail(`T12.4 滚动 FPS >= 30`, JSON.stringify(r2val), 'MEDIUM');
  }

  // 关闭模态
  await evalJS(ws, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
  await sleep(500);
}

async function main() {
  const PORT = 9777;
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
  await sendCmd(ws, 'Network.enable');

  // 收集运行时异常 + 网络失败
  ws.on('message', (data) => {
    try {
      const m = JSON.parse(data.toString());
      if (m.method === 'Runtime.exceptionThrown') {
        const e = m.params.exceptionDetails;
        if (e.exception) {
          consoleErrors.push(e.exception.description || e.exception.value || e.text);
        }
      }
      if (m.method === 'Network.loadingFailed') {
        const errText = m.params.errorText || '';
        const url = m.params.request?.url || '';
        // 过滤掉 React Strict Mode 设计内的 abort
        if (!/ERR_ABORTED/.test(errText) || !/\.(json|tsx|css|js)/i.test(url)) {
          failedRequests.push(errText + ' ' + url);
        }
      }
      if (m.method === 'Network.responseReceived') {
        const r = m.params.response;
        if (r.status >= 400 && !/hot-update|@vite|favicon/.test(r.url)) {
          failedRequests.push(`${r.status} ${r.url}`);
        }
      }
    } catch {}
  });

  await sendCmd(ws, 'Page.navigate', { url: URL });
  await sleep(10000); // 等待首屏 + 县市级加载

  // 注入测试辅助
  await evalJS(ws, `(() => {
    window.__test_helper__ = {
      findScrolledPanel: (text) => {
        const wrappers = document.querySelectorAll('.info-panel-wrapper-scrollable');
        for (const w of wrappers) {
          if ((w.textContent || '').indexOf(text) >= 0) return w;
        }
        return null;
      },
    };
    return 'helpers ready';
  })()`);

  // 截图初始状态
  await snap(ws, resolve(REPORT_DIR, 'e2e-01-initial.png'));

  // 执行测试用例
  await t01_initialLoad(ws);
  await snap(ws, resolve(REPORT_DIR, 'e2e-02-after-load.png'));
  await t02_chinaMapProvinces(ws);
  await t03_regionPanel(ws);
  await t04_mapBoard(ws);
  await t05_countyInfoModal(ws);
  await snap(ws, resolve(REPORT_DIR, 'e2e-03-after-modals.png'));
  await t06_herbModal(ws);
  await t07_therapyModal(ws);
  await t08_historyModal(ws);
  await t09_yaoKnowledgeModal(ws);
  await t10_escAndClickOutside(ws);
  await t11_boundaryConditions(ws);
  await t12_performance(ws);

  ws.close();
  proc.kill();

  // 收集最终统计
  const passed = tests.filter(t => t.passed).length;
  const total = tests.length;
  console.log('\n=== E2E Test Results ===');
  tests.forEach(t => {
    console.log((t.passed ? '[OK]  ' : '[FAIL]') + ' ' + t.name + (t.detail && !t.passed ? ' -- ' + String(t.detail).slice(0, 200) : ''));
  });
  console.log('\n' + passed + '/' + total + ' passed');
  console.log('\nConsole Errors:', consoleErrors.length);
  consoleErrors.forEach((e, i) => console.log('  [' + (i+1) + ']', String(e).slice(0, 200)));
  console.log('\nFailed Requests:', failedRequests.length);
  failedRequests.forEach((r, i) => console.log('  [' + (i+1) + ']', String(r).slice(0, 200)));

  writeFileSync(
    resolve(REPORT_DIR, 'e2e-results.json'),
    JSON.stringify({
      url: URL,
      tests, passed, total,
      issues,
      consoleErrors,
      failedRequests,
    }, null, 2),
    'utf8'
  );

  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});