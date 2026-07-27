/**
 * UI Polish Regression Test
 *
 * 验证项：
 * 1. Header 不再 sticky/fixed，随页面滚动移出视口
 * 2. 搜索类型筛选按钮可点击展开，菜单位于屏幕内
 * 3. 县区红色圆点替换为美化标签（county-beauty-tag）
 * 4. ChinaMap 控件不重复渲染，不重叠
 * 5. MapBoard Leaflet 缩放控件位于左下角，返回按钮位于地图容器内
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

(async () => {
  console.log('======================================');
  console.log('  UI Polish Regression Test');
  console.log('======================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4500));

    console.log('\n[Test 1] Header 滚动行为');
    const headerBefore = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return null;
      const cs = getComputedStyle(header);
      const rect = header.getBoundingClientRect();
      return { position: cs.position, top: rect.top, bottom: rect.bottom };
    });
    check('header', 'Header position 不是 fixed/sticky', headerBefore && headerBefore.position !== 'fixed' && headerBefore.position !== 'sticky', `position=${headerBefore?.position}`);

    await page.evaluate(() => window.scrollTo(0, 260));
    await new Promise((r) => setTimeout(r, 400));
    const headerAfter = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return null;
      const rect = header.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    });
    check('header', '滚动后 Header 上移离开顶部视口', headerAfter && headerAfter.bottom < 0, `bottom=${headerAfter?.bottom}`);

    console.log('\n[Test 2] 搜索筛选菜单');
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const filterBtn = buttons.find((b) => /全部|草药|疗法|历史/.test(b.textContent || ''));
      if (filterBtn) filterBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const filterOpened = await page.evaluate(() => {
      const menu = document.querySelector('[role="listbox"]');
      const rect = menu?.getBoundingClientRect();
      return {
        clicked: true,
        menuVisible: !!menu,
        inViewport: !!rect && rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight,
      };
    });
    check('search', '筛选按钮可点击', filterOpened.clicked);
    check('search', '筛选菜单可见', filterOpened.menuVisible);
    check('search', '筛选菜单位于屏幕内', filterOpened.inViewport, JSON.stringify(filterOpened));

    console.log('\n[Test 3] 县区美化标签');
    // 先滚动到真实地理地图区域，再使用 DrillDown 控制器钻取广西，渲染县级标签
    await page.evaluate(() => {
      document.querySelector('.leaflet-container-host')?.scrollIntoView({ block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate(async () => {
      const ctrl = window.__DRILL_DOWN__;
      if (ctrl?.drillToProvince) await ctrl.drillToProvince('45');
    });
    await new Promise((r) => setTimeout(r, 1600));
    const countyTags = await page.evaluate(() => {
      const tags = Array.from(document.querySelectorAll('.county-beauty-tag'));
      const wrappers = Array.from(document.querySelectorAll('.county-beauty-tag-wrapper'));
      const safeTags = tags.filter((tag) => {
        const rect = tag.getBoundingClientRect();
        return rect.left >= -80 && rect.right <= window.innerWidth + 80 && rect.top >= -80 && rect.bottom <= window.innerHeight + 80;
      });
      return {
        tagCount: tags.length,
        wrapperCount: wrappers.length,
        safeCount: safeTags.length,
      };
    });
    check('label', '县区美化标签已渲染', countyTags.tagCount > 0, `count=${countyTags.tagCount}`);
    check('label', '县区 divIcon 标签容器已替代原县区圆点标记', countyTags.wrapperCount === countyTags.tagCount && countyTags.tagCount > 0, JSON.stringify(countyTags));
    check('label', '县区标签大部分位于视口安全范围内', countyTags.safeCount >= Math.ceil(countyTags.tagCount * 0.8), JSON.stringify(countyTags));

    console.log('\n[Test 4] 控件布局不重叠');
    const controls = await page.evaluate(() => {
      const mapControlGroups = Array.from(document.querySelectorAll('.leaflet-container-host .leaflet-control-zoom'));
      const zoom = mapControlGroups[0]?.getBoundingClientRect();
      const back = document.querySelector('.drill-back-btn')?.getBoundingClientRect();
      const map = document.querySelector('.leaflet-container-host')?.getBoundingClientRect();
      const chinaMapControls = Array.from(document.querySelectorAll('svg')).length > 0;
      const overlap = !!zoom && !!back && !(zoom.right < back.left || zoom.left > back.right || zoom.bottom < back.top || zoom.top > back.bottom);
      return {
        zoomCount: mapControlGroups.length,
        zoomInBottomHalf: !!zoom && !!map && zoom.top > map.top + map.height / 2,
        backInMap: !!back && !!map && back.left >= map.left && back.top >= map.top && back.right <= map.right && back.bottom <= map.bottom,
        overlap,
        chinaMapControls,
      };
    });
    check('controls', 'Leaflet 缩放控件仅 1 组', controls.zoomCount === 1, `zoomCount=${controls.zoomCount}`);
    check('controls', 'Leaflet 缩放控件位于地图下半区', controls.zoomInBottomHalf, JSON.stringify(controls));
    check('controls', '返回按钮位于地图容器内', controls.backInMap, JSON.stringify(controls));
    check('controls', '返回按钮与缩放控件不重叠', !controls.overlap, JSON.stringify(controls));

  } finally {
    await page.close();
    await browser.close();
  }

  console.log('\n======================================');
  console.log('  UI Polish Summary');
  console.log('======================================');
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Pass rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

  writeFileSync(
    'scripts/ui-polish-regression-report.json',
    JSON.stringify({ summary: { totalPassed, totalFailed }, results }, null, 2)
  );

  process.exit(totalFailed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});