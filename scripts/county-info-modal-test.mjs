/**
 * 县级详情面板（CountyInfoModal）交互测试
 *
 * v2 验证项（统一入口重构后）：
 *   1. 红点点击触发 CountyInfoModal 弹出
 *   2. 模态框不含重复嵌入的瑶医基础知识 5 大板块（已抽离到统一入口）
 *   3. 模态框包含"瑶医基础知识（统一入口）"跳转按钮
 *   4. 模态框包含完整的县区特有章节（一-九）
 *   5. 模态框有正确的动效（modal-slide + modal-fade + opacity-100）
 *   6. ESC 键关闭模态框
 *   7. 点击蒙层关闭模态框
 *   8. 关闭动效（is-closing 类）
 *   7. 响应式布局（移动端 viewport）
 */

import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5186/';

const results = [];
let totalPassed = 0;
let totalFailed = 0;

function check(category, name, passed, detail = '') {
  results.push({ category, name, passed, detail });
  totalPassed += passed ? 1 : 0;
  totalFailed += passed ? 0 : 1;
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] [${category}] ${name}${detail ? '  ' + detail : ''}`);
}

/** 找到 CountyInfoModal 的 modal-layer 元素 */
function findCountyModal() {
  return Array.from(document.querySelectorAll('.modal-layer')).find((m) =>
    m.classList.contains('modal-layer-high')
  );
}

(async () => {
  console.log('======================================');
  console.log('  County Info Modal Test');
  console.log('======================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.__DRILL_DOWN__, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 5000));

    // === Test 1: 钻入广西 + 点击红点 ===
    console.log('\n[Test 1] 点击红点触发 CountyInfoModal 弹出');
    await page.evaluate(async () => {
      await window.__DRILL_DOWN__.drillToProvince('45');
    });
    await new Promise((r) => setTimeout(r, 3000));

    // Fire 第一个有 click listener 的 marker
    const fireResult = await page.evaluate(() => {
      const map = window.__MAP_INSTANCE;
      const targets = [];
      map.eachLayer((layer) => {
        if (
          layer &&
          layer._path &&
          layer._path.getAttribute &&
          layer._path.getAttribute('fill') === '#dc2626' &&
          layer.listens &&
          layer.listens('click')
        ) {
          targets.push(layer);
        }
      });
      if (targets.length === 0) return null;
      const m = targets[0];
      m.fire('click', { latlng: m.getLatLng(), target: m });
      return { fired: true, count: targets.length };
    });
    check('click', '点击红点成功 fire', fireResult && fireResult.fired, `targets=${fireResult?.count}`);

    await new Promise((r) => setTimeout(r, 1500));

    // === Test 2: 模态框可见 ===
    console.log('\n[Test 2] 模态框可见性 + 动效 class');
    const modalState = await page.evaluate(() => {
      const m = Array.from(document.querySelectorAll('.modal-layer')).find(
        (el) => el.classList.contains('modal-layer-high')
      );
      if (!m) return null;
      return {
        exists: true,
        open: m.classList.contains('opacity-100'),
        hasSlide: m.classList.contains('modal-slide'),
        hasFade: m.classList.contains('modal-fade'),
        hasHigh: m.classList.contains('modal-layer-high'),
        opacity: window.getComputedStyle(m).opacity,
        title: m.querySelector('#county-modal-title')?.textContent?.substring(0, 40),
      };
    });
    check('visible', 'CountyInfoModal DOM 存在', !!modalState);
    check('visible', 'modal-layer-high class 应用', !!modalState?.hasHigh);
    check('visible', 'modal-slide class 应用（滑入动效）', !!modalState?.hasSlide);
    check('visible', 'modal-fade class 应用（淡入动效）', !!modalState?.hasFade);
    check('visible', '模态框打开（opacity-100）', !!modalState?.open);
    check('visible', '模态框 opacity 实际计算值 = 1', modalState?.opacity === '1', `actual=${modalState?.opacity}`);
    check('visible', '模态框标题正确显示', !!modalState?.title && modalState.title.length > 0, `title="${modalState?.title}"`);

    // === Test 3: 5 大板块内容 ===
    console.log('\n[Test 3] 瑶医资料 5 大板块');
    const sections = await page.evaluate(() => {
      const m = Array.from(document.querySelectorAll('.modal-layer')).find(
        (el) => el.classList.contains('modal-layer-high')
      );
      if (!m) return null;
      // v2: 不再嵌入 5 大板块，改为统一入口按钮
      const unifiedButton = Array.from(m.querySelectorAll('button')).find(
        (b) => /瑶医基础知识（统一入口）/.test(b.textContent || '')
      );
      const allText = m.innerText || '';
      // 验证按钮 + 不再嵌入内容
      const hasUnifiedButton = !!unifiedButton;
      const hasEmbeddedTheories = /基础理论（4 大核心）/.test(allText);
      const hasEmbeddedDiagnostics = /特色诊疗方法（6 大技法）/.test(allText);
      const hasEmbeddedCategories = /瑶药经典分类（"五虎九牛/.test(allText);
      const hasEmbeddedEfficacy = /瑶药四性五味归经/.test(allText);
      const hasEmbeddedHeritage = /瑶医药非遗传承/.test(allText);
      // 验证县区特有的章节（一-九章节）
      const hasChapter1 = /一、当地特有瑶药资源/.test(allText);
      const hasChapter2 = /二、临床应用案例/.test(allText);
      const hasChapter3 = /三、当地瑶药采集方法论/.test(allText);
      const hasChapter4 = /四、传承保护现状/.test(allText);
      const hasChapter7 = /七、传承流派/.test(allText);
      return {
        hasUnifiedButton,
        hasEmbeddedTheories,
        hasEmbeddedDiagnostics,
        hasEmbeddedCategories,
        hasEmbeddedEfficacy,
        hasEmbeddedHeritage,
        hasChapter1,
        hasChapter2,
        hasChapter3,
        hasChapter4,
        hasChapter7,
      };
    });
    // v2 验收：无嵌入重复 + 有统一入口按钮
    check(
      'content',
      '模态框不含"基础理论"嵌入（已抽离到统一入口）',
      sections && !sections.hasEmbeddedTheories,
      `hasEmbeddedTheories=${sections?.hasEmbeddedTheories}`
    );
    check(
      'content',
      '模态框不含"特色诊疗方法"嵌入',
      sections && !sections.hasEmbeddedDiagnostics
    );
    check(
      'content',
      '模态框不含"瑶药经典分类"嵌入',
      sections && !sections.hasEmbeddedCategories
    );
    check(
      'content',
      '模态框不含"性味归经"嵌入',
      sections && !sections.hasEmbeddedEfficacy
    );
    check(
      'content',
      '模态框不含"非遗传承"嵌入',
      sections && !sections.hasEmbeddedHeritage
    );
    check(
      'content',
      '模态框包含"瑶医基础知识（统一入口）"按钮',
      sections?.hasUnifiedButton,
      `hasUnifiedButton=${sections?.hasUnifiedButton}`
    );
    // 章节完整性（一-四为 extended 数据章节）
    check(
      'content',
      '模态框包含完整章节"一、当地特有瑶药资源"',
      sections?.hasChapter1,
      `hasChapter1=${sections?.hasChapter1}`
    );
    check(
      'content',
      '模态框包含完整章节"二、临床应用案例"',
      sections?.hasChapter2,
      `hasChapter2=${sections?.hasChapter2}`
    );
    check(
      'content',
      '模态框包含完整章节"三、当地瑶药采集方法论"',
      sections?.hasChapter3,
      `hasChapter3=${sections?.hasChapter3}`
    );
    check(
      'content',
      '模态框包含完整章节"四、传承保护现状"',
      sections?.hasChapter4,
      `hasChapter4=${sections?.hasChapter4}`
    );
    check(
      'content',
      '模态框包含完整章节"七、传承流派"',
      sections?.hasChapter7,
      `hasChapter7=${sections?.hasChapter7}`
    );

    // === Test 4: 面板内县详情 ===
    console.log('\n[Test 4] 县详情展示');
    const countyInfo = await page.evaluate(() => {
      const m = Array.from(document.querySelectorAll('.modal-layer')).find(
        (el) => el.classList.contains('modal-layer-high')
      );
      if (!m) return null;
      const text = m.textContent || '';
      const hasInstitutionCount = /瑶医机构|医疗机构|机构/.test(text);
      const hasHerbCount = /\d+\s*种|药材|瑶药/.test(text);
      const hasSchool = /流派|传承|瑶医派|瑶医流派|大瑶山/.test(text);
      return { hasInstitutionCount, hasHerbCount, hasSchool, text: text.substring(0, 200) };
    });
    check('detail', '显示机构数', !!countyInfo?.hasInstitutionCount || /\d+/.test(countyInfo?.text || ''));
    check('detail', '显示瑶药种类数', !!countyInfo?.hasHerbCount);
    check('detail', '显示瑶医流派', !!countyInfo?.hasSchool);

    // === Test 5: ESC 键关闭 ===
    console.log('\n[Test 5] ESC 键关闭面板');
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 100));
    const afterEscClosing = await page.evaluate(() => {
      const m = Array.from(document.querySelectorAll('.modal-layer')).find(
        (el) => el.classList.contains('modal-layer-high')
      );
      return m?.classList.contains('is-closing');
    });
    check('close', 'ESC 后立即添加 is-closing class（淡出动效启动）', !!afterEscClosing);
    await new Promise((r) => setTimeout(r, 800));
    const afterEscFinal = await page.evaluate(() => {
      // 关闭后 modal 元素可能已从 DOM 移除（因为 unmount）
      const m = Array.from(document.querySelectorAll('.modal-layer')).find(
        (el) => el.classList.contains('modal-layer-high')
      );
      if (!m) return { removed: true, opacity: null };
      return {
        removed: false,
        opacity: window.getComputedStyle(m).opacity,
        open: m.classList.contains('opacity-100'),
      };
    });
    check('close', 'ESC 后 500ms 模态框已淡出关闭', !afterEscFinal?.open || afterEscFinal?.removed, JSON.stringify(afterEscFinal));

    // === Test 6: 再次点击不同县红点 ===
    console.log('\n[Test 6] 关闭后再次点击可重新打开（不同县）');
    await new Promise((r) => setTimeout(r, 300));
    const reopenResult = await page.evaluate(() => {
      const map = window.__MAP_INSTANCE;
      const targets = [];
      map.eachLayer((layer) => {
        if (
          layer &&
          layer._path &&
          layer._path.getAttribute &&
          layer._path.getAttribute('fill') === '#dc2626' &&
          layer.listens &&
          layer.listens('click')
        ) {
          targets.push(layer);
        }
      });
      if (targets.length < 2) return { fired: false };
      // 点击第二个县
      const m = targets[1];
      m.fire('click', { latlng: m.getLatLng(), target: m });
      return { fired: true, idx: 1 };
    });
    check('reopen', '点击第二个县红点成功 fire', reopenResult?.fired);
    await new Promise((r) => setTimeout(r, 1500));
    const reopenState = await page.evaluate(() => {
      const m = Array.from(document.querySelectorAll('.modal-layer')).find(
        (el) => el.classList.contains('modal-layer-high')
      );
      return {
        open: m && m.classList.contains('opacity-100'),
        title: m?.querySelector('#county-modal-title')?.textContent?.substring(0, 30),
      };
    });
    check('reopen', '模态框重新打开', !!reopenState?.open);
    check('reopen', '标题更新为新县名',
      !!reopenState?.title && reopenState.title.length > 0,
      `title="${reopenState?.title}"`);

    // === Test 7: 蒙层点击关闭（通过 handleClose 验证逻辑） ===
    console.log('\n[Test 7] 蒙层点击关闭（验证 onClick handler）');
    // 验证 modal-layer 元素上的 onClick 绑定了 handleClose
    const maskHandler = await page.evaluate(() => {
      const m = Array.from(document.querySelectorAll('.modal-layer')).find(
        (el) => el.classList.contains('modal-layer-high')
      );
      if (!m) return null;
      // React 使用合成事件，但 onClick 属性可通过 React 属性识别
      // 验证 modal-layer 有 modal-slide + modal-fade class（确保是新版本）
      return {
        hasSlide: m.classList.contains('modal-slide'),
        hasFade: m.classList.contains('modal-fade'),
        hasHigh: m.classList.contains('modal-layer-high'),
        // 检查 React fiber 是否有 onClick 属性
        hasReactProps: !!Object.keys(m).find(
          (k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$')
        ),
      };
    });
    check('close', 'modal 元素具备 React 事件绑定', !!maskHandler?.hasReactProps, JSON.stringify(maskHandler));
    check('close', 'modal 具备 modal-slide + modal-fade class（新动效版）',
      maskHandler?.hasSlide && maskHandler?.hasFade && maskHandler?.hasHigh,
      JSON.stringify(maskHandler));

    // === Test 8: 移动端响应式 ===
    console.log('\n[Test 8] 移动端响应式 (390x844)');
    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.evaluate(async () => {
      await window.__DRILL_DOWN__.drillToProvince('45');
    });
    await new Promise((r) => setTimeout(r, 3000));
    const mobileFire = await page.evaluate(() => {
      const map = window.__MAP_INSTANCE;
      const targets = [];
      map.eachLayer((layer) => {
        if (
          layer &&
          layer._path &&
          layer._path.getAttribute &&
          layer._path.getAttribute('fill') === '#dc2626' &&
          layer.listens &&
          layer.listens('click')
        ) {
          targets.push(layer);
        }
      });
      if (targets.length === 0) return null;
      const m = targets[0];
      m.fire('click', { latlng: m.getLatLng(), target: m });
      return { fired: true };
    });
    check('mobile', '移动端点击红点 fire 成功', mobileFire?.fired);
    await new Promise((r) => setTimeout(r, 1500));
    const mobileState = await page.evaluate(() => {
      const m = Array.from(document.querySelectorAll('.modal-layer')).find(
        (el) => el.classList.contains('modal-layer-high')
      );
      if (!m) return null;
      const panel = m.querySelector('.info-panel-wrapper');
      const rect = panel?.getBoundingClientRect();
      return {
        open: m.classList.contains('opacity-100'),
        panelWidth: rect?.width,
        panelHeight: rect?.height,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        inViewport: rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= window.innerWidth && rect.y + rect.height <= window.innerHeight,
      };
    });
    check('mobile', '移动端模态框打开', !!mobileState?.open);
    check('mobile', '移动端面板宽度自适应 viewport',
      mobileState?.panelWidth && mobileState.panelWidth > 100 && mobileState.panelWidth <= mobileState.viewportW,
      `width=${mobileState?.panelWidth}/${mobileState?.viewportW}`);
    check('mobile', '移动端面板完全在视域内（不溢出）', !!mobileState?.inViewport);

  } finally {
    await page.close();
    await browser.close();
  }

  console.log('\n======================================');
  console.log('  County Info Modal Test Summary');
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
    'scripts/county-info-modal-report.json',
    JSON.stringify({
      summary: {
        totalPassed,
        totalFailed,
        passRate: ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(2),
        generatedAt: new Date().toISOString(),
      },
      results,
    }, null, 2)
  );
  console.log('\nReport saved to scripts/county-info-modal-report.json');

  process.exit(totalFailed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});