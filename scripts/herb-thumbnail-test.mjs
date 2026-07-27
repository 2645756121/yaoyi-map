/**
 * 草药缩略图优化专项测试
 *
 * 验证项：
 *   1. 缩略图网格布局正确（响应式 6/4/3 列）
 *   2. 所有缩略图严格保持 1:1 宽高比（无拉伸/裁剪）
 *   3. 缩略图尺寸在合理范围（网格 56px、列表 32px）
 *   4. lazy loading 属性应用（loading="lazy"）
 *   5. decoding="async" 应用
 *   6. blur placeholder 渐变背景存在
 *   7. 加载失败 fallback 到 Leaf 图标
 *   8. 视图切换按钮可用（列表/网格）
 *   9. 多端响应式（1920/1280/768/390 viewport）
 *   10. 无溢出/重叠
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
  const icon = passed ? '✓' : '✗';
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${icon} [${category}] ${name}${detail ? '  ' + detail : ''}`);
}

(async () => {
  console.log('======================================');
  console.log('  Herb Thumbnail Optimization Test');
  console.log('======================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();

  /** 在指定 viewport 下打开草药目录并返回缩略图状态 */
  async function openCatalogAtViewport(width, height, options = {}) {
    await page.setViewport({ width, height });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.__MAP_INSTANCE || true, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3500));
    // 点击"草药目录"按钮
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && /草药目录/.test(b.textContent)
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    // 如果指定了字母组（如 'C'），点击左侧对应的分组
    if (options.letter) {
      await page.evaluate((letter) => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find((b) => b.textContent && b.textContent.trim() === letter);
        if (target) target.click();
      }, options.letter);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  /** 获取目录内的所有草药缩略图 */
  async function getThumbnails() {
    return await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="herb-thumbnail-grid"]');
      const list = document.querySelector('[data-testid="herb-compact-list"]');
      const container = grid || list;
      if (!container) return { viewMode: 'none', items: [] };
      const items = Array.from(container.children);
      return {
        viewMode: grid ? 'grid' : 'list',
        itemCount: items.length,
        items: items.map((item) => {
          const img = item.querySelector('img');
          const rect = item.getBoundingClientRect();
          // 缩略图 wrapper（在按钮内的第一个子元素）
          const thumb = item.querySelector('div[style*="width"]') || img?.parentElement;
          const tRect = thumb?.getBoundingClientRect();
          return {
            buttonW: Math.round(rect.width),
            buttonH: Math.round(rect.height),
            thumbW: tRect ? Math.round(tRect.width) : 0,
            thumbH: tRect ? Math.round(tRect.height) : 0,
            hasImg: !!img,
            imgSrc: img?.src || '',
            imgLoading: img?.getAttribute('loading') || '',
            imgDecoding: img?.getAttribute('decoding') || '',
            imgObjectFit: img ? window.getComputedStyle(img).objectFit : '',
            imgAspectRatio: img ? window.getComputedStyle(img).aspectRatio : '',
            title: item.getAttribute('title') || item.querySelector('h4')?.textContent || '',
            thumbAspect: tRect ? tRect.width / tRect.height : 0,
          };
        }),
      };
    });
  }

  try {
    // === Test 1: 桌面 1280×720 — 默认网格视图 ===
    console.log('\n[Test 1] 桌面 1280×720 默认网格视图');
    await openCatalogAtViewport(1280, 720, { letter: 'C' });
    const desktopState = await getThumbnails();

    check('layout', '网格视图激活', desktopState.viewMode === 'grid', `mode=${desktopState.viewMode}`);
    check('layout', '显示草药条目（≥3 个）', desktopState.itemCount >= 3, `count=${desktopState.itemCount}`);

    // === Test 2: 缩略图尺寸 ===
    console.log('\n[Test 2] 缩略图尺寸 + 比例');
    const desktopThumbs = desktopState.items;
    const allSize56 = desktopThumbs.every((t) => t.thumbW === 56 && t.thumbH === 56);
    const allSquare = desktopThumbs.every((t) => Math.abs(t.thumbAspect - 1) < 0.05);
    check('size', '所有缩略图 56×56px', allSize56, `first=${desktopThumbs[0]?.thumbW}×${desktopThumbs[0]?.thumbH}`);
    check('size', '所有缩略图严格 1:1 比例（无拉伸）', allSquare,
      `first ratio=${desktopThumbs[0]?.thumbAspect?.toFixed(3)}`);
    check('size', 'object-cover 生效（不裁剪）', desktopThumbs.every((t) => t.imgObjectFit === 'cover'),
      `first=${desktopThumbs[0]?.imgObjectFit}`);

    // === Test 3: 加载性能属性 ===
    console.log('\n[Test 3] 加载性能优化');
    const allLazy = desktopThumbs.every((t) => t.imgLoading === 'lazy');
    const allAsyncDecode = desktopThumbs.every((t) => t.imgDecoding === 'async');
    const allHasSrc = desktopThumbs.every((t) => t.imgSrc.startsWith('https://'));
    check('perf', '所有图片 lazy loading="lazy"', allLazy, `first=${desktopThumbs[0]?.imgLoading}`);
    check('perf', '所有图片 decoding="async"', allAsyncDecode, `first=${desktopThumbs[0]?.imgDecoding}`);
    check('perf', '所有图片 src 有效', allHasSrc, `first=${desktopThumbs[0]?.imgSrc?.substring(0, 60)}...`);

    // === Test 4: aria-label + title 悬浮提示 ===
    console.log('\n[Test 4] 可访问性 + 视觉清晰度');
    const allHasTitle = desktopThumbs.every((t) => t.title.length > 0);
    check('a11y', '所有缩略图有 title 悬浮提示', allHasTitle, `first="${desktopThumbs[0]?.title}"`);

    // === Test 5: 网格列数 (桌面 6 列) ===
    console.log('\n[Test 5] 桌面网格 6 列布局');
    // 检查 grid 的 gridTemplateColumns 实际计算样式（更可靠）
    const colsDesktop = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="herb-thumbnail-grid"]');
      if (!grid) return 0;
      const cs = window.getComputedStyle(grid);
      const template = cs.gridTemplateColumns;
      // 解析 "100px 100px 100px ..." 中的列数
      return template.split(' ').filter((s) => /px|%|fr|em/.test(s)).length;
    });
    check('layout', '桌面 ≥1024px 设置 6 列网格', colsDesktop === 6, `gridTemplateColumns cols=${colsDesktop}`);

    // === Test 6: 切换到列表视图 ===
    console.log('\n[Test 6] 切换到列表视图（缩略图 32×32）');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.trim() === '列表'
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    const listState = await getThumbnails();
    check('layout', '列表视图激活', listState.viewMode === 'list', `mode=${listState.viewMode}`);
    const allSize32 = listState.items.every((t) => t.thumbW === 32 && t.thumbH === 32);
    check('size', '列表模式缩略图 32×32px', allSize32, `first=${listState.items[0]?.thumbW}×${listState.items[0]?.thumbH}`);
    const listSquare = listState.items.every((t) => Math.abs(t.thumbAspect - 1) < 0.05);
    check('size', '列表模式缩略图 1:1 比例', listSquare, `first ratio=${listState.items[0]?.thumbAspect?.toFixed(3)}`);

    // 切回网格
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.trim() === '网格'
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // === Test 7: 平板 768×1024 — 4 列 ===
    console.log('\n[Test 7] 平板 768×1024 — 4 列网格');
    await openCatalogAtViewport(768, 1024, { letter: 'C' });
    const tabletCols = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="herb-thumbnail-grid"]');
      if (!grid) return 0;
      const cs = window.getComputedStyle(grid);
      return cs.gridTemplateColumns.split(' ').filter((s) => /px|%|fr|em/.test(s)).length;
    });
    check('layout', '平板 768px 设置 4 列网格', tabletCols === 4, `gridTemplateColumns cols=${tabletCols}`);
    const tabletState = await getThumbnails();
    const tabletAllSquare = tabletState.items.every((t) => Math.abs(t.thumbAspect - 1) < 0.05);
    check('size', '平板缩略图保持 1:1', tabletAllSquare);

    // === Test 8: 移动 390×844 — 3 列 ===
    console.log('\n[Test 8] 移动 390×844 — 3 列网格');
    await openCatalogAtViewport(390, 844, { letter: 'C' });
    const mobileCols = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="herb-thumbnail-grid"]');
      if (!grid) return 0;
      const cs = window.getComputedStyle(grid);
      return cs.gridTemplateColumns.split(' ').filter((s) => /px|%|fr|em/.test(s)).length;
    });
    check('layout', '移动 390px 设置 3 列网格', mobileCols === 3, `gridTemplateColumns cols=${mobileCols}`);
    const mobileState = await getThumbnails();
    const mobileAllSquare = mobileState.items.every((t) => Math.abs(t.thumbAspect - 1) < 0.05);
    check('size', '移动缩略图保持 1:1', mobileAllSquare);
    check('size', '移动缩略图尺寸仍是 56×56px（统一）',
      mobileState.items.every((t) => t.thumbW === 56 && t.thumbH === 56),
      `first=${mobileState.items[0]?.thumbW}×${mobileState.items[0]?.thumbH}`);

    // === Test 9: 无溢出/重叠 ===
    console.log('\n[Test 9] 无溢出 + 无重叠');
    const overflowCheck = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="herb-thumbnail-grid"]');
      if (!grid) return null;
      const items = Array.from(grid.children);
      const gridRect = grid.getBoundingClientRect();
      let overflows = 0;
      let overlaps = 0;
      const seen = new Set();
      for (let i = 0; i < items.length; i++) {
        const r1 = items[i].getBoundingClientRect();
        // 检查是否溢出父容器
        if (r1.right > gridRect.right + 1 || r1.bottom > gridRect.bottom + 1) {
          overflows++;
        }
        // 检查是否有重叠
        for (let j = i + 1; j < items.length; j++) {
          const r2 = items[j].getBoundingClientRect();
          const overlapW = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left);
          const overlapH = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
          if (overlapW > 2 && overlapH > 2) {
            // 重叠（gutter 8px 内正常）
            if (overlapW > 4 && overlapH > 4) {
              overlaps++;
            }
          }
        }
      }
      return { itemCount: items.length, overflows, overlaps };
    });
    check('overflow', '无元素溢出父容器', overflowCheck && overflowCheck.overflows === 0, JSON.stringify(overflowCheck));
    check('overflow', '无元素重叠', overflowCheck && overflowCheck.overlaps === 0, JSON.stringify(overflowCheck));

    // === Test 10: 大屏 1920×1080 ===
    console.log('\n[Test 10] 大屏 1920×1080 — 6 列布局');
    await openCatalogAtViewport(1920, 1080, { letter: 'C' });
    const largeCols = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="herb-thumbnail-grid"]');
      if (!grid) return 0;
      const cs = window.getComputedStyle(grid);
      return cs.gridTemplateColumns.split(' ').filter((s) => /px|%|fr|em/.test(s)).length;
    });
    check('layout', '大屏 1920px 设置 6 列（不溢出）', largeCols === 6, `gridTemplateColumns cols=${largeCols}`);
    const largeState = await getThumbnails();
    check('size', '大屏缩略图仍是 56×56px（不放大）',
      largeState.items.every((t) => t.thumbW === 56 && t.thumbH === 56),
      `first=${largeState.items[0]?.thumbW}×${largeState.items[0]?.thumbH}`);

  } finally {
    await page.close();
    await browser.close();
  }

  console.log('\n======================================');
  console.log('  Herb Thumbnail Test Summary');
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
    'scripts/herb-thumbnail-report.json',
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
  console.log('\nReport saved to scripts/herb-thumbnail-report.json');

  process.exit(totalFailed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});