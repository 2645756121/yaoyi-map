import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  // Desktop high DPI
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5186/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__DRILL_DOWN__, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 6000));

  // Step 1: Initial province
  await page.screenshot({ path: 'scripts/show-1-province-only.png' });
  console.log('1. Initial province (no subdivision)');

  // Step 2: Drill into Guangxi (longer wait)
  await page.evaluate(async () => {
    const drill = window.__DRILL_DOWN__;
    if (!drill) throw new Error('no drill');
    await drill.drillToProvince('45');
  });
  await new Promise((r) => setTimeout(r, 3500));
  const state2 = await page.evaluate(() => ({
    level: window.__DRILL_DOWN__.getState().level,
    center: window.__MAP_INSTANCE.getCenter(),
    zoom: window.__MAP_INSTANCE.getZoom(),
  }));
  console.log('2. After Guangxi drill:', JSON.stringify(state2));
  await page.screenshot({ path: 'scripts/show-2-guangxi-detail.png' });

  // Step 3: Click Hunan
  await page.evaluate(async () => {
    const drill = window.__DRILL_DOWN__;
    await drill.drillToProvince('43');
  });
  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: 'scripts/show-3-hunan-detail.png' });
  console.log('3. Hunan drill');

  // Step 4: Mobile view (back to national first)
  await page.evaluate(async () => {
    const drill = window.__DRILL_DOWN__;
    await drill.zoomOut();
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: 'scripts/show-4-mobile.png' });
  console.log('4. Mobile province view');

  // Step 5: Mobile drill
  await page.evaluate(async () => {
    const drill = window.__DRILL_DOWN__;
    await drill.drillToProvince('46'); // Hainan
  });
  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: 'scripts/show-5-mobile-hainan.png' });
  console.log('5. Mobile Hainan drill');

  await browser.close();
  console.log('All saved');
})();