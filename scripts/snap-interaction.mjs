import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://127.0.0.1:5186/', { waitUntil: 'networkidle0' });

  // 等待 drill 控制器初始化
  await page.waitForFunction(() => !!window.__DRILL_DOWN__, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));

  // 截图1: 初始省级视图
  await page.screenshot({ path: 'scripts/interaction-1-province.png' });

  // 截图2: 钻取到广西
  const drillResult = await page.evaluate(async () => {
    const drill = window.__DRILL_DOWN__;
    if (!drill) return { error: 'no drill' };
    await drill.drillToProvince('45');
    await new Promise(r => setTimeout(r, 500));
    return { ok: true, state: drill.getState(), center: window.__MAP_INSTANCE.getCenter() };
  });
  console.log('Drill result:', JSON.stringify(drillResult));

  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'scripts/interaction-2-drill-guangxi.png' });

  // 截图3: 返回按钮合并回省级
  const backResult = await page.evaluate(async () => {
    const drill = window.__DRILL_DOWN__;
    if (!drill) return { error: 'no drill' };
    await drill.zoomOut();
    await new Promise(r => setTimeout(r, 500));
    return { ok: true, state: drill.getState() };
  });
  console.log('Back result:', JSON.stringify(backResult));

  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'scripts/interaction-3-back-to-province.png' });

  // 截图4: 移动端
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'scripts/interaction-4-mobile.png' });

  console.log('Done: 4 screenshots');
  await browser.close();
})();