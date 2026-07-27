import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  // Desktop 1280x720
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:5186/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__DRILL_DOWN__, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 5000));

  await page.screenshot({ path: 'scripts/demo-1-initial.png' });
  console.log('Step 1: Initial province view captured');

  // Click Guangxi province
  await page.evaluate(async () => {
    const drill = window.__DRILL_DOWN__;
    await drill.drillToProvince('45');
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: 'scripts/demo-2-guangxi.png' });
  console.log('Step 2: Drill into Guangxi captured');

  // Switch to Hunan
  await page.evaluate(async () => {
    const drill = window.__DRILL_DOWN__;
    await drill.drillToProvince('43');
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: 'scripts/demo-3-hunan.png' });
  console.log('Step 3: Drill into Hunan captured');

  // Back to national view
  await page.evaluate(async () => {
    const drill = window.__DRILL_DOWN__;
    await drill.zoomOut();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Mobile 390x844
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: 'scripts/demo-4-mobile.png' });
  console.log('Step 4: Mobile view captured');

  // Mobile drill into Hainan
  await page.evaluate(async () => {
    const drill = window.__DRILL_DOWN__;
    await drill.drillToProvince('46');
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: 'scripts/demo-5-mobile-drill.png' });
  console.log('Step 5: Mobile drill captured');

  console.log('All 5 demo screenshots saved');
  await browser.close();
})();