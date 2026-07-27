/**
 * Map Interaction Multi-platform Compatibility Test
 *
 * Tests:
 *   - Initial: province-level only (no city/county subdivision)
 *   - Click province -> expand to subordinate cities/counties
 *   - Click blank area -> collapse back to province view
 *   - Click back button -> collapse back
 *   - Animation duration within 0.3-0.5s range
 *   - Desktop (1920x1080, 1366x768) compatibility
 *   - Tablet (iPad 1024x768) compatibility
 *   - Mobile (iPhone 14 390x844, Android 412x915) compatibility
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

async function testViewport(browser, vp, label) {
  console.log(`\n========== ${label} (${vp.w}x${vp.h}) ==========`);
  const page = await browser.newPage();
  await page.setViewport({ width: vp.w, height: vp.h });
  const consoleLogs = [];
  page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  try {
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 8000));

    // === 1. Initial province view ===
    console.log('\n[1] Initial province view');
    const initial = await page.evaluate(() => {
      const lc = document.querySelector('.leaflet-container');
      const paths = document.querySelectorAll('.leaflet-overlay-pane svg path');
      const allCircles = document.querySelectorAll('.leaflet-interactive');
      const drill = window.__DRILL_DOWN__;
      return {
        hasMap: !!lc,
        lcW: lc?.offsetWidth || 0,
        lcH: lc?.offsetHeight || 0,
        paths: paths.length,
        markers: allCircles.length,
        hasDrill: !!drill,
        state: drill?.getState() || null,
        nationalView: !!document.querySelector('.province-label'),
      };
    });

    check('init', `${label} map rendered`, initial.hasMap, `${initial.lcW}x${initial.lcH}`);
    check('init', `${label} province outlines (no city/county subdivision)`,
      initial.paths > 30 && initial.nationalView, `paths=${initial.paths}`);
    check('init', `${label} drill map controller initialized`, initial.hasDrill);
    check('init', `${label} initial level='province'`,
      initial.state?.level === 'province', `level=${initial.state?.level}`);

    // === 2. Click province -> expand ===
    console.log('\n[2] Click province -> expand to subordinate cities/counties');
    const t0 = Date.now();
    const drillResult = await page.evaluate(async () => {
      const drill = window.__DRILL_DOWN__;
      if (!drill) return { error: 'no drill' };
      await drill.drillToProvince('45'); // Guangxi
      return { ok: true };
    });
    const drillTime = Date.now() - t0;

    check('click', `${label} drillToProvince API call success`, drillResult.ok);
    await new Promise((r) => setTimeout(r, 2000));

    const afterDrill = await page.evaluate(() => {
      const drill = window.__DRILL_DOWN__;
      const m = window.__MAP_INSTANCE;
      return {
        state: drill?.getState(),
        paths: document.querySelectorAll('.leaflet-overlay-pane svg path').length,
        markers: document.querySelectorAll('.leaflet-interactive').length,
        hasProvinceLabel: !!document.querySelector('.province-focused-label'),
        provinceLabel: document.querySelector('.province-focused-label')?.textContent || '',
        hasBackBtn: !!document.querySelector('[data-drill-back]'),
        center: m ? { lat: m.getCenter().lat, lng: m.getCenter().lng } : null,
        zoom: m?.getZoom() || 0,
      };
    });

    check('click', `${label} after drill level='city'`,
      afterDrill.state?.level === 'city', `level=${afterDrill.state?.level}`);
    check('click', `${label} path count increased (sub-counties loaded)`,
      afterDrill.paths > initial.paths, `${initial.paths} -> ${afterDrill.paths}`);
    check('click', `${label} interactive markers increased (county centers)`,
      afterDrill.markers > initial.markers, `markers ${initial.markers} -> ${afterDrill.markers}`);
    check('click', `${label} shows province name label`,
      afterDrill.hasProvinceLabel, afterDrill.provinceLabel.substring(0, 30));
    check('click', `${label} shows back button`,
      afterDrill.hasBackBtn);
    check('click', `${label} map center moved to Guangxi`,
      afterDrill.center && Math.abs(afterDrill.center.lat - 24) < 5,
      `center=[${afterDrill.center?.lat.toFixed(2)},${afterDrill.center?.lng.toFixed(2)}]`);

    // === 3. Click blank area -> collapse ===
    console.log('\n[3] Click blank area -> collapse back to province');
    await page.evaluate(async () => {
      const map = window.__MAP_INSTANCE;
      map.fire('click', {
        latlng: map.containerPointToLatLng([100, 100]),
      });
    });
    await new Promise((r) => setTimeout(r, 1500));

    const afterBlankClick = await page.evaluate(() => {
      const drill = window.__DRILL_DOWN__;
      return { state: drill?.getState() };
    });

    check('blank-click', `${label} blank click -> level='province'`,
      afterBlankClick.state?.level === 'province',
      `level=${afterBlankClick.state?.level}`);

    // === 4. Click province + back button ===
    console.log('\n[4] Back button collapse');
    await page.evaluate(async () => {
      const drill = window.__DRILL_DOWN__;
      await drill.drillToProvince('43'); // Hunan
    });
    await new Promise((r) => setTimeout(r, 1500));

    const afterHunanDrill = await page.evaluate(() => ({
      state: window.__DRILL_DOWN__?.getState(),
    }));
    check('back-btn', `${label} drilled to Hunan province`,
      afterHunanDrill.state?.level === 'city');

    await page.evaluate(() => {
      const backBtn = document.querySelector('[data-drill-back]');
      if (backBtn) backBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const afterBack = await page.evaluate(() => ({
      state: window.__DRILL_DOWN__?.getState(),
    }));
    check('back-btn', `${label} after back button -> level='province'`,
      afterBack.state?.level === 'province', `level=${afterBack.state?.level}`);

    // === 5. Animation duration check ===
    console.log('\n[5] Animation duration check');
    const animTimings = await page.evaluate(async () => {
      const drill = window.__DRILL_DOWN__;
      const timings = [];
      for (const ad of ['45', '43', '36']) {
        const before = performance.now();
        await drill.drillToProvince(ad);
        const after = performance.now();
        timings.push({ adcode: ad, apiCallMs: after - before });
        await new Promise((r) => setTimeout(r, 1500));
        await drill.zoomOut();
        await new Promise((r) => setTimeout(r, 1500));
      }
      return timings;
    });

    const sourceCheck = await page.evaluate(async () => {
      const r = await fetch('/src/components/MapBoard/DrillDownMap.ts');
      const txt = await r.text();
      const m = txt.match(/ANIMATION_DURATION\s*=\s*([\d.]+)/);
      return m ? parseFloat(m[1]) : null;
    });

    check('animation', `${label} animation duration 0.3-0.5s`,
      sourceCheck !== null && sourceCheck >= 0.3 && sourceCheck <= 0.5,
      `ANIMATION_DURATION=${sourceCheck}s`);
    check('animation', `${label} drill API response < 100ms`,
      animTimings.every((t) => t.apiCallMs < 100),
      animTimings.map((t) => `${t.adcode}:${t.apiCallMs.toFixed(0)}ms`).join(' / '));

    // === 6. Stability under repeated clicks ===
    console.log('\n[6] Stability under repeated clicks');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(async () => {
        const drill = window.__DRILL_DOWN__;
        await drill.drillToProvince(['36', '43', '44', '45', '46'][Math.floor(Math.random() * 5)]);
      });
      await new Promise((r) => setTimeout(r, 800));
    }

    const stabilityState = await page.evaluate(() => {
      const drill = window.__DRILL_DOWN__;
      const paths = document.querySelectorAll('.leaflet-overlay-pane svg path');
      return {
        state: drill?.getState(),
        paths: paths.length,
        mapAlive: !!window.__MAP_INSTANCE?._mapPane,
      };
    });

    check('stability', `${label} 5x random drills, map still alive`,
      stabilityState.mapAlive && stabilityState.state?.level === 'city',
      `level=${stabilityState.state?.level}, paths=${stabilityState.paths}, alive=${stabilityState.mapAlive}`);

  } finally {
    await page.close();
  }
}

(async () => {
  console.log('======================================');
  console.log('  Map Interaction Multi-platform Test');
  console.log('======================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const VIEWPORTS = [
    { name: 'Desktop-1080P', w: 1920, h: 1080 },
    { name: 'Desktop-1366x768', w: 1366, h: 768 },
    { name: 'Tablet-iPad', w: 1024, h: 768 },
    { name: 'Mobile-iPhone14', w: 390, h: 844 },
    { name: 'Mobile-Android', w: 412, h: 915 },
  ];

  try {
    for (const vp of VIEWPORTS) {
      await testViewport(browser, vp, vp.name);
    }
  } finally {
    await browser.close();
  }

  console.log('\n======================================');
  console.log('  Interaction Test Summary');
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
    'scripts/map-interaction-report.json',
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
  console.log('\nReport saved to scripts/map-interaction-report.json');

  process.exit(totalFailed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});