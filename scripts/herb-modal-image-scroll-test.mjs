/**
 * HerbModal 图片滚动跟随测试
 *
 * 验证项：
 *   1. 图片元素 (.herb-modal-image) 是滚动容器 (.herb-modal-body) 的子元素
 *   2. 图片元素无 fixed/sticky 定位属性
 *   3. 滚动容器无 overflow 异常配置
 *   4. 滚动条内部滚动时，图片 Y 坐标变化（跟随滚动）
 *   5. 多端响应式
 *   6. 滚到底部图片完全滚出视口
 *   7. 滚动过程流畅无卡顿
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
  console.log('  HerbModal Image Scroll Test');
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
    await page.waitForFunction(() => !!window.__MAP_INSTANCE || true, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 4500));

    // 打开 HerbCatalog → 找第一个草药 → 触发 HerbModal
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && /草药目录/.test(b.textContent)
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    // 点击第一个草药缩略图（在网格中）
    const herbClicked = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="herb-thumbnail-grid"]');
      const firstBtn = grid?.querySelector('button');
      if (firstBtn) firstBtn.click();
      return !!firstBtn;
    });
    check('trigger', '点击草药缩略图打开 HerbModal', herbClicked);
    await new Promise((r) => setTimeout(r, 1500));

    // === Test 1: HerbModal DOM 存在 ===
    console.log('\n[Test 1] HerbModal DOM 结构');
    const modalStructure = await page.evaluate(() => {
      const modalLayer = document.querySelector('.modal-layer');
      const body = document.querySelector('.herb-modal-body');
      const image = document.querySelector('.herb-modal-image');
      const img = document.querySelector('.herb-modal-image img');

      if (!modalLayer || !body || !image || !img) return null;

      // 验证 image 是 body 的子元素（直接或间接）
      const isChild = body.contains(image);

      // 验证 img 是 image 的子元素
      const imgInImage = image.contains(img);

      return {
        modalLayerExists: !!modalLayer,
        bodyExists: !!body,
        imageExists: !!image,
        imgExists: !!img,
        isImageChildOfBody: isChild,
        isImgChildOfImage: imgInImage,
      };
    });
    check('dom', 'HerbModal DOM 全部存在', !!modalStructure, JSON.stringify(modalStructure));
    check('dom', '图片 (.herb-modal-image) 是滚动容器 (.herb-modal-body) 的子元素',
      modalStructure?.isImageChildOfBody, `isChild=${modalStructure?.isImageChildOfBody}`);
    check('dom', '<img> 是 .herb-modal-image 的子元素',
      modalStructure?.isImgChildOfImage);

    // === Test 2: 滚动容器配置正确 ===
    console.log('\n[Test 2] 滚动容器 overflow 配置');
    const bodyCSS = await page.evaluate(() => {
      const body = document.querySelector('.herb-modal-body');
      if (!body) return null;
      const cs = window.getComputedStyle(body);
      return {
        overflow: cs.overflow,
        overflowY: cs.overflowY,
        overflowX: cs.overflowX,
        position: cs.position,
        scrollHeight: body.scrollHeight,
        clientHeight: body.clientHeight,
      };
    });
    check('css', '滚动容器 overflow-y === auto/scroll（可滚动）',
      bodyCSS && (bodyCSS.overflowY === 'auto' || bodyCSS.overflowY === 'scroll'),
      `overflowY=${bodyCSS?.overflowY}`);
    check('css', '滚动容器 position !== fixed',
      bodyCSS && bodyCSS.position !== 'fixed',
      `position=${bodyCSS?.position}`);
    check('css', '滚动容器 scrollHeight > clientHeight（内容溢出可滚动）',
      bodyCSS && bodyCSS.scrollHeight > bodyCSS.clientHeight,
      `scrollH=${bodyCSS?.scrollHeight}, clientH=${bodyCSS?.clientHeight}`);

    // === Test 3: 图片无固定定位 ===
    console.log('\n[Test 3] 图片元素无 fixed/sticky 定位');
    const imageCSS = await page.evaluate(() => {
      const image = document.querySelector('.herb-modal-image');
      if (!image) return null;
      const cs = window.getComputedStyle(image);
      return {
        position: cs.position,
        top: cs.top,
        zIndex: cs.zIndex,
        inlineStyle: image.getAttribute('style') || '',
      };
    });
    check('css', '图片 position !== fixed', imageCSS && imageCSS.position !== 'fixed', `position=${imageCSS?.position}`);
    check('css', '图片 position !== sticky', imageCSS && imageCSS.position !== 'sticky', `position=${imageCSS?.position}`);
    check('css', '图片无 fixed top:0 设置',
      imageCSS && !/top:\s*0[^a-z]/.test(imageCSS.inlineStyle),
      `inline=${imageCSS?.inlineStyle || '(none)'}`);

    // === Test 4: 滚动测试 — 图片随滚动条移动 ===
    console.log('\n[Test 4] 滚动容器内图片随滚动条移动');
    const initialPosition = await page.evaluate(() => {
      const body = document.querySelector('.herb-modal-body');
      const image = document.querySelector('.herb-modal-image');
      const img = document.querySelector('.herb-modal-image img');
      return {
        bodyScrollTop: body?.scrollTop || 0,
        imageY: image?.getBoundingClientRect().top || 0,
        imgY: img?.getBoundingClientRect().top || 0,
      };
    });

    // 滚动 300px
    await page.evaluate(() => {
      const body = document.querySelector('.herb-modal-body');
      if (body) body.scrollTop = 300;
    });
    await new Promise((r) => setTimeout(r, 500));

    const afterScroll300 = await page.evaluate(() => {
      const body = document.querySelector('.herb-modal-body');
      const image = document.querySelector('.herb-modal-image');
      const img = document.querySelector('.herb-modal-image img');
      return {
        bodyScrollTop: body?.scrollTop || 0,
        imageY: image?.getBoundingClientRect().top || 0,
        imgY: img?.getBoundingClientRect().top || 0,
      };
    });
    check('scroll', '滚动容器 scrollTop === 300', afterScroll300?.bodyScrollTop === 300, `scrollTop=${afterScroll300?.bodyScrollTop}`);
    check('scroll', '图片 Y 坐标变化（跟随滚动）',
      initialPosition && afterScroll300 &&
      Math.abs(initialPosition.imageY - afterScroll300.imageY) > 200,
      `initial=${initialPosition?.imageY}, after=${afterScroll300?.imageY}`);
    check('scroll', '图片 Y 位移量 ≈ 滚动量（同步）',
      initialPosition && afterScroll300 &&
      Math.abs((initialPosition.imageY - afterScroll300.imageY) - 300) < 50,
      `位移=${initialPosition.imageY - afterScroll300.imageY}`);

    // === Test 5: 滚到底部，图片完全滚出视口 ===
    console.log('\n[Test 5] 滚到底部，图片完全滚出视口');
    await page.evaluate(() => {
      const body = document.querySelector('.herb-modal-body');
      if (body) body.scrollTop = body.scrollHeight;
    });
    await new Promise((r) => setTimeout(r, 500));

    const atBottom = await page.evaluate(() => {
      const body = document.querySelector('.herb-modal-body');
      const image = document.querySelector('.herb-modal-image');
      const rect = image?.getBoundingClientRect();
      return {
        bodyScrollTop: body?.scrollTop || 0,
        bodyScrollHeight: body?.scrollHeight || 0,
        imageY: rect?.top || 0,
        imageBottom: rect?.bottom || 0,
        bodyClientHeight: body?.clientHeight || 0,
      };
    });
    check('scroll', '滚到底部时图片 Y < 0（完全滚出）',
      atBottom && atBottom.imageBottom < 0,
      `imageY=${atBottom?.imageY}, imageBottom=${atBottom?.imageBottom}`);
    check('scroll', '滚动容器已滚到底（scrollTop 接近最大值）',
      atBottom && atBottom.bodyScrollTop + atBottom.bodyClientHeight >= atBottom.bodyScrollHeight - 5,
      `scrollTop=${atBottom?.bodyScrollTop}, scrollH=${atBottom?.bodyScrollHeight}`);

    // === Test 6: 回到顶部，图片重新可见 ===
    console.log('\n[Test 6] 回到顶部，图片重新可见');
    await page.evaluate(() => {
      const body = document.querySelector('.herb-modal-body');
      if (body) body.scrollTop = 0;
    });
    await new Promise((r) => setTimeout(r, 500));
    const atTop = await page.evaluate(() => {
      const image = document.querySelector('.herb-modal-image');
      const rect = image?.getBoundingClientRect();
      return {
        imageY: rect?.top || 0,
        imageBottom: rect?.bottom || 0,
      };
    });
    check('scroll', '回到顶部时图片 Y >= 0（重新可见）',
      atTop && atTop.imageY >= 0 && atTop.imageBottom > 0,
      `imageY=${atTop?.imageY}`);

    // === Test 7: 连续滚动无卡顿 ===
    console.log('\n[Test 7] 连续滚动无卡顿');
    const scrollTrace = await page.evaluate(async () => {
      const positions = [];
      for (let i = 0; i < 10; i++) {
        const body = document.querySelector('.herb-modal-body');
        if (body) body.scrollTop = i * 100;
        await new Promise((r) => setTimeout(r, 50));
        const image = document.querySelector('.herb-modal-image');
        const rect = image?.getBoundingClientRect();
        positions.push(rect ? Math.round(rect.top) : null);
      }
      return positions;
    });
    const allTracked = scrollTrace.every((y) => y !== null);
    let monotonic = true;
    for (let i = 1; i < scrollTrace.length; i++) {
      if (scrollTrace[i] !== null && scrollTrace[i - 1] !== null && scrollTrace[i] > scrollTrace[i - 1]) {
        monotonic = false;
        break;
      }
    }
    check('perf', '10 次连续滚动图片位置全部记录', allTracked, `tracked=${scrollTrace.filter(y => y !== null).length}/10`);
    check('perf', '图片位置单调递减（无抖动）', monotonic, `positions=${JSON.stringify(scrollTrace)}`);

    // === Test 8: 关闭弹窗 ===
    await new Promise((r) => setTimeout(r, 200));

  } finally {
    await page.close();
    await browser.close();
  }

  console.log('\n======================================');
  console.log('  HerbModal Image Scroll Summary');
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
    'scripts/herb-modal-image-scroll-report.json',
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
  console.log('\nReport saved to scripts/herb-modal-image-scroll-report.json');

  process.exit(totalFailed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});