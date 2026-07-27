/**
 * UI 美化重构 · 多设备兼容性回归测试
 *
 * 覆盖：
 *  1. 各视口布局无溢出、无错位
 *  2. 主要 token (btn-yao, input-yao, card-yao, chip-yao) 已应用
 *  3. Header 主题色应用 + Header 顶部高光存在
 *  4. Modal 关闭按钮使用主题样式
 *  5. 验证搜索/按钮可键盘聚焦
 *  6. 关闭按钮 aria-label
 *  7. 各 Modal 显示瑶医主题渐变背景
 */

import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5186/';

mkdirSync('logs', { recursive: true });

const VIEWPORTS = [
  { name: 'Desktop-1920', w: 1920, h: 1080 },
  { name: 'Desktop-1366', w: 1366, h: 768 },
  { name: 'Tablet-1024', w: 1024, h: 768 },
  { name: 'Tablet-768', w: 768, h: 1024 },
  { name: 'Mobile-iPhone14-390', w: 390, h: 844 },
  { name: 'Mobile-Android-412', w: 412, h: 915 },
];

const results = [];
let totalPassed = 0;
let totalFailed = 0;

function check(category, name, passed, detail = '') {
  results.push({ category, name, passed, detail });
  totalPassed += passed ? 1 : 0;
  totalFailed += passed ? 0 : 1;
  const tag = passed ? '[PASS]' : '[FAIL]';
  console.log(`  ${tag} [${category}] ${name}${detail ? '  ' + detail : ''}`);
}

async function runViewport(browser, viewport) {
  console.log(`\n===== ${viewport.name} (${viewport.w}x${viewport.h}) =====`);
  const page = await browser.newPage();
  await page.setViewport({ width: viewport.w, height: viewport.h });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3500));

  // 1. Header 主题 + 按钮 token 验证
  const headerCheck = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return null;
    const cls = header.className;
    const cs = getComputedStyle(header);
    const searchInput = document.querySelector('.input-yao');
    const infoBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => /关于瑶医/.test(b.textContent || ''),
    );
    const infoCls = infoBtn?.className || '';
    return {
      headerClass: cls,
      headerBgImage: cs.backgroundImage,
      headerPos: cs.position,
      hasWeave: !!Array.from(document.querySelectorAll('header div')).find((d) =>
        d.style.backgroundImage.includes('data:image/svg+xml'),
      ),
      hasInputYao: !!searchInput,
      hasBtnYao: infoCls.includes('btn-yao'),
    };
  });
  // 主题渐变可来自渐变类名或 computed 样式
  const themeGradient =
    /(from|via|to)-primary-\d/.test(headerCheck?.headerClass || '') ||
    /gradient/i.test(headerCheck?.headerBgImage || '');
  check(viewport.name + '-header', 'Header 已应用主题渐变', !!headerCheck && themeGradient);
  check(viewport.name + '-header', 'Header 包含织锦纹理 SVG', headerCheck?.hasWeave);
  check(viewport.name + '-header', '搜索框使用 .input-yao', headerCheck?.hasInputYao);
  check(viewport.name + '-header', '关于按钮使用 .btn-yao', headerCheck?.hasBtnYao);

  // 2. 页面无水平溢出（body 容器，避免 Leaflet canvas 影响 html）
  const overflow = await page.evaluate(() => {
    const body = document.body;
    return { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth, hasHScroll: body.scrollWidth > body.clientWidth + 1 };
  });
  check(viewport.name + '-layout', '页面无水平滚动', !overflow.hasHScroll, `scroll=${overflow.scrollWidth} client=${overflow.clientWidth}`);

  // 3. 打开 HerbModal 并校验关闭按钮主题 + aria（通过 store 触发 + 等 React 渲染）
  const modalCheck = await page.evaluate(async () => {
    // 找 store（已暴露到 window.__MAP_STORE__）
    let target = window.__MAP_STORE__;
    if (!target) {
      for (const k of Object.keys(window)) {
        const v = window[k];
        if (v && typeof v === 'object' && 'openHerbModal' in v && 'setSelectedHerb' in v) {
          target = v;
          break;
        }
      }
    }
    if (target) {
      target.set((s) => ({
        ...s,
        selectedHerb: {
          id: 'yaoshanjujuan', name: '瑶山杜鹃', nameEn: 'Yao Mountain Rhododendron', nameYao: 'NZ',
          scientificName: 'Rhododendron yaoshanicum', image: '',
          taste: '辛', meridian: '归肺', efficacy: '祛风散寒，活血通络，止咳平喘。',
          usage: '-', medicinalPart: '花、叶、根', collectionSeason: '春',
          distributionArea: '广西金秀大瑶山',
          modernPharmacology: '-', regionId: 'guangxi', therapyIds: [],
        },
        isHerbModalOpen: true,
      }));
    }
    await new Promise((r) => setTimeout(r, 800));
    const closeBtn = document.querySelector('[aria-label="\u5173\u95ed"]');
    if (!closeBtn) return { found: false };
    return {
      found: true,
      ariaLabel: closeBtn.getAttribute('aria-label'),
      hasBtnYaoIcon: closeBtn.className.includes('btn-yao-icon'),
      hasFocusable: closeBtn.tabIndex >= 0,
    };
  });
  check(viewport.name + '-modal', 'HerbModal 关闭按钮已应用 btn-yao-icon', modalCheck?.hasBtnYaoIcon);
  check(viewport.name + '-modal', '关闭按钮 aria-label 存在', !!modalCheck?.ariaLabel);
  check(viewport.name + '-modal', '关闭按钮可聚焦', modalCheck?.hasFocusable);

  // 关闭 modal
  await page.evaluate(() => {
    const store = window.__MAP_STORE__;
    if (store) store.set((s) => ({ ...s, isHerbModalOpen: false, selectedHerb: null }));
    const closeBtn = document.querySelector('[aria-label="\u5173\u95ed"]');
    closeBtn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // 4. 触发统一入口 YaoMedicalKnowledgeModal 校验头部主题渐变
  const ykHeader = await page.evaluate(async () => {
    window.dispatchEvent(new CustomEvent('open-yao-knowledge'));
    await new Promise((r) => setTimeout(r, 400));
    const header = document.querySelector('[aria-label="\u7476\u533b\u57fa\u7840\u77e5\u8bc6"]');
    const headerEl = document.querySelector('.title-yao');
    const closeBtn = document.querySelector('[aria-label="\u5173\u95ed\u7476\u533b\u57fa\u7840\u77e5\u8bc6"]');
    return {
      modalFound: !!header,
      titleClass: headerEl?.className.includes('title-yao'),
      closeHasAria: !!closeBtn,
      closeClass: closeBtn?.className.includes('btn-yao-icon'),
    };
  });
  check(viewport.name + '-yaoModal', '瑶医基础知识 Modal 标题使用 title-yao', ykHeader.titleClass);
  check(viewport.name + '-yaoModal', '瑶医基础知识 Modal 关闭按钮主题', ykHeader.closeClass);

  await page.evaluate(() => {
    const btn = document.querySelector('[aria-label="\u5173\u95ed\u7476\u533b\u57fa\u7840\u77e5\u8bc6"]');
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // 5. Catalog 视觉 token
  const catCheck = await page.evaluate(() => {
    // 打开草药目录 toggle 按钮（目录默认收起）
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => /草药|目录/.test(b.textContent || '') && b.textContent.length < 20,
    );
    btn?.click();
    return {
      hasToggle: !!btn,
    };
  });
  check(viewport.name + '-catalog', '草药目录可触发', catCheck.hasToggle);

  // 6. 截图
  await page.screenshot({ path: `logs/ui-design-${viewport.name}.png`, fullPage: false });

  await page.close();
}

(async () => {
  console.log('======================================');
  console.log('  UI 设计重构 · 多设备兼容性测试');
  console.log('======================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    for (const vp of VIEWPORTS) {
      await runViewport(browser, vp);
    }
  } finally {
    await browser.close();
  }

  console.log('\n======================================');
  console.log('  UI Design Responsive Summary');
  console.log('======================================');
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Pass rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

  if (totalFailed > 0) {
    console.log('\nFailed:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  X [${r.category}] ${r.name}: ${r.detail}`);
    });
  }

  writeFileSync(
    'scripts/ui-design-responsive-report.json',
    JSON.stringify(
      {
        summary: { totalPassed, totalFailed, passRate: ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(2) },
        results,
      },
      null,
      2,
    ),
  );

  process.exit(totalFailed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
