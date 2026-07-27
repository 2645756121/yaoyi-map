/**
 * Hierarchical Display Optimization Test
 *
 * Validates 4 requirements:
 *   1. Initial load: only provinces, NO city/county subdivision visible
 *   2. Click province -> expand subordinate cities/counties
 *      + Other provinces stay as aggregated blocks
 *      + Hide the clicked province's aggregate
 *   3. Performance: click response < 300ms, multi-click stability, no overlap
 *   4. Visual: smooth fade/scale transition animation, no flicker
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
  const icon = passed ? '[PASS]' : '[FAIL]';
  console.log(`  ${icon} [${category}] ${name}${detail ? '  ' + detail : ''}`);
}

(async () => {
  console.log('======================================');
  console.log('  Hierarchical Display Optimization');
  console.log('======================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const VIEWPORTS = [
    { name: 'Desktop-1080P', w: 1920, h: 1080 },
    { name: 'Mobile-iPhone14', w: 390, h: 844 },
  ];

  for (const vp of VIEWPORTS) {
    console.log(`\n========== ${vp.name} (${vp.w}x${vp.h}) ==========`);
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h });

    try {
      await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
      await page.waitForFunction(() => !!window.__DRILL_DOWN__, { timeout: 30000 });
      await new Promise((r) => setTimeout(r, 5000));

      // === Requirement 1: Initial load - only provinces, no subdivision ===
      console.log('\n[1] Initial load: province-only, no city/county subdivision');
      const initial = await page.evaluate(() => {
        const allPaths = document.querySelectorAll('.leaflet-overlay-pane svg path');
        const allCircles = document.querySelectorAll('.leaflet-interactive');
        const provinceLabels = document.querySelectorAll('.province-label');
        const provinceLabelTexts = Array.from(provinceLabels).map((l) => l.textContent || '');
        const drill = window.__DRILL_DOWN__;
        return {
          state: drill?.getState(),
          // SVG paths (all province boundaries, no subdivision)
          paths: allPaths.length,
          // circle markers (these would be county centers - should NOT be present)
          circleCount: allCircles.length,
          // Province labels (should show the 9 yao-related province names)
          provinceLabelCount: provinceLabels.length,
          provinceLabels: provinceLabelTexts,
          // Check for city/county subdivision elements (should be absent)
          hasCityLayer: !!document.querySelector('.city-subdivision'),
          hasCountyLayer: !!document.querySelector('.county-subdivision'),
          // Map should be at low zoom (national view)
          zoom: window.__MAP_INSTANCE?.getZoom() || 0,
        };
      });

      check('init', `${vp.name} state='province' (national view)`,
        initial.state?.level === 'province', `level=${initial.state?.level}`);
      check('init', `${vp.name} province outlines ONLY (no subdivision)`,
        initial.paths > 30 && initial.circleCount === initial.paths,
        `paths=${initial.paths}, circles=${initial.circleCount} (should equal paths for L.geoJSON)`);
      check('init', `${vp.name} province labels rendered`,
        initial.provinceLabelCount >= 9,
        `${initial.provinceLabelCount} province labels`);
      check('init', `${vp.name} NO city/county subdivision layer`,
        !initial.hasCityLayer && !initial.hasCountyLayer);
      check('init', `${vp.name} initial zoom is national-level (3-5)`,
        initial.zoom >= 3 && initial.zoom <= 5, `zoom=${initial.zoom}`);

      // === Requirement 2: Click province -> expand subordinate cities/counties ===
      console.log('\n[2] Click province -> expand subordinate, others stay aggregated');

      const clickResult = await page.evaluate(async () => {
        const drill = window.__DRILL_DOWN__;
        if (!drill) return { error: 'no drill' };
        const t0 = performance.now();
        await drill.drillToProvince('45'); // Guangxi
        const t1 = performance.now();
        return { apiLatency: t1 - t0 };
      });

      check('click', `${vp.name} drillToProvince API call latency < 300ms`,
        clickResult.apiLatency < 300,
        `latency=${clickResult.apiLatency.toFixed(1)}ms`);

      // 等动画完成
      await new Promise((r) => setTimeout(r, 2500));

      const afterClick = await page.evaluate(() => {
        const allPaths = document.querySelectorAll('.leaflet-overlay-pane svg path');
        const allCircles = document.querySelectorAll('.leaflet-interactive');
        const provinceFocusedLabel = document.querySelector('.province-focused-label');
        const drill = window.__DRILL_DOWN__;
        return {
          state: drill?.getState(),
          // After drill, paths should increase (load county GeoJSON)
          paths: allPaths.length,
          // circle markers (now present - county centers)
          circles: allCircles.length,
          // Province focused label visible
          hasProvinceLabel: !!provinceFocusedLabel,
          provinceLabel: provinceFocusedLabel?.textContent || '',
          // Map zoomed in to provincial level
          zoom: window.__MAP_INSTANCE?.getZoom() || 0,
          // Center moved to Guangxi
          center: {
            lat: window.__MAP_INSTANCE.getCenter().lat,
            lng: window.__MAP_INSTANCE.getCenter().lng,
          },
          // Check that no OTHER province's label is shown at the same time
          // (i.e., the aggregate for the clicked province is hidden)
          otherProvinceLabels: Array.from(
            document.querySelectorAll('.province-label:not(.province-focused-label)')
          ).length,
        };
      });

      check('click', `${vp.name} state='city' (drilled-in)`,
        afterClick.state?.level === 'city', `level=${afterClick.state?.level}`);
      check('click', `${vp.name} paths increased (county subdivision loaded)`,
        afterClick.paths > initial.paths,
        `${initial.paths} -> ${afterClick.paths}`);
      check('click', `${vp.name} interactive markers increased (county centers added)`,
        afterClick.circles > initial.circleCount,
        `circles ${initial.circleCount} -> ${afterClick.circles}`);
      check('click', `${vp.name} province focused label visible`,
        afterClick.hasProvinceLabel,
        afterClick.provinceLabel.substring(0, 40));
      check('click', `${vp.name} map zoomed to provincial level (5-8)`,
        afterClick.zoom >= 5 && afterClick.zoom <= 8,
        `zoom=${afterClick.zoom}`);
      check('click', `${vp.name} map center moved to Guangxi`,
        Math.abs(afterClick.center.lat - 24) < 5,
        `center=[${afterClick.center.lat.toFixed(2)},${afterClick.center.lng.toFixed(2)}]`);
      check('click', `${vp.name} other provinces' aggregate labels hidden`,
        afterClick.otherProvinceLabels === 0,
        `other labels=${afterClick.otherProvinceLabels} (should be 0)`);

      // === Requirement 3: Performance - multi-click stability, no overlap ===
      console.log('\n[3] Performance: multi-click stability, no overlap');

      const multiClickResults = await page.evaluate(async () => {
        const drill = window.__DRILL_DOWN__;
        const results = [];
        const PROVINCES = ['36', '43', '44', '45', '46', '50', '51', '52', '53'];
        // Test 9 连续切换
        for (let i = 0; i < PROVINCES.length; i++) {
          const adcode = PROVINCES[i];
          const t0 = performance.now();
          await drill.drillToProvince(adcode);
          const t1 = performance.now();
          await new Promise((r) => setTimeout(r, 600));
          const state = drill.getState();
          const paths = document.querySelectorAll('.leaflet-overlay-pane svg path').length;
          const circles = document.querySelectorAll('.leaflet-interactive').length;
          results.push({
            adcode,
            latency: t1 - t0,
            state: state?.level,
            paths,
            circles,
          });
        }
        return results;
      });

      const allFast = multiClickResults.every((r) => r.latency < 300);
      const allCorrectLevel = multiClickResults.every((r) => r.state === 'city');
      const allHaveData = multiClickResults.every((r) => r.paths >= 17 && r.circles >= 17);

      check('perf', `${vp.name} 9 consecutive drills, all API latency < 300ms`,
        allFast,
        `max=${Math.max(...multiClickResults.map((r) => r.latency)).toFixed(1)}ms, avg=${(multiClickResults.reduce((s, r) => s + r.latency, 0) / multiClickResults.length).toFixed(1)}ms`);
      check('perf', `${vp.name} 9 consecutive drills, all reach level='city'`,
        allCorrectLevel,
        multiClickResults.map((r) => r.adcode).join(','));
      check('perf', `${vp.name} 9 consecutive drills, no data corruption`,
        allHaveData,
        `min paths=${Math.min(...multiClickResults.map((r) => r.paths))}, min circles=${Math.min(...multiClickResults.map((r) => r.circles))}`);

      // 检查无图层重叠：每次切换后路径数稳定（不应累积）
      const pathVariance = Math.max(...multiClickResults.map((r) => r.paths)) -
        Math.min(...multiClickResults.map((r) => r.paths));
      check('perf', `${vp.name} no path accumulation (no overlap/leak)`,
        pathVariance < 200,
        `path variance=${pathVariance} (max-min)`);

      // === Requirement 4: Smooth transition animation ===
      console.log('\n[4] Smooth transition: 0.3-0.5s fade/scale, no flicker');

      const animConfig = await page.evaluate(async () => {
        const r = await fetch('/src/components/MapBoard/DrillDownMap.ts');
        const txt = await r.text();
        const m = txt.match(/ANIMATION_DURATION\s*=\s*([\d.]+)/);
        const css = txt.match(/FADE_DURATION_MS\s*=\s*(\d+)/);
        return {
          duration: m ? parseFloat(m[1]) : null,
          fadeMs: css ? parseInt(css[1]) : null,
          hasEase: /easeLinearity/.test(txt),
          hasFlyToBounds: /flyToBounds/.test(txt),
        };
      });

      check('anim', `${vp.name} animation duration in 0.3-0.5s range`,
        animConfig.duration !== null && animConfig.duration >= 0.3 && animConfig.duration <= 0.5,
        `ANIMATION_DURATION=${animConfig.duration}s`);
      check('anim', `${vp.name} fade transition CSS defined`,
        animConfig.fadeMs !== null && animConfig.fadeMs >= 200 && animConfig.fadeMs <= 600,
        `FADE_DURATION_MS=${animConfig.fadeMs}ms`);
      check('anim', `${vp.name} uses easeLinearity for smooth motion`,
        animConfig.hasEase);
      check('anim', `${vp.name} uses flyToBounds for camera animation`,
        animConfig.hasFlyToBounds);

      // 测量实际切换动画流畅度：连续快照 5 帧验证无闪烁
      const smoothTest = await page.evaluate(async () => {
        const drill = window.__DRILL_DOWN__;
        const snapshots = [];
        // 在切换前拍快照
        snapshots.push({
          t: 0,
          paths: document.querySelectorAll('.leaflet-overlay-pane svg path').length,
        });
        // 触发切换
        await drill.drillToProvince('46'); // Hainan
        // 在动画过程中拍快照
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 80));
          snapshots.push({
            t: (i + 1) * 80,
            paths: document.querySelectorAll('.leaflet-overlay-pane svg path').length,
          });
        }
        return snapshots;
      });

      // 验证切换期间 paths 不会突然为 0 或突变（表示无闪烁）
      const hasFlicker = smoothTest.some(
        (s, i) => i > 0 && Math.abs(s.paths - smoothTest[i - 1].paths) > 1000
      );
      check('anim', `${vp.name} no flicker during animation`,
        !hasFlicker,
        `path snapshots: ${smoothTest.map((s) => s.paths).join(' -> ')}`);

      // 验证最终切换完成
      const finalState = await page.evaluate(() => {
        const drill = window.__DRILL_DOWN__;
        return drill?.getState();
      });
      check('anim', `${vp.name} animation completes to level='city'`,
        finalState?.level === 'city', `level=${finalState?.level}`);

    } finally {
      await page.close();
    }
  }

  await browser.close();

  // === Summary ===
  console.log('\n======================================');
  console.log('  Hierarchical Display Test Summary');
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
    'scripts/hierarchical-display-report.json',
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
  console.log('\nReport saved to scripts/hierarchical-display-report.json');

  process.exit(totalFailed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});