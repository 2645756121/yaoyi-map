/**
 * 截图验证 UI 最终效果
 * 截取地图 + 县级弹窗的完整视图
 */

import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5185/';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1600 });

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
await new Promise((r) => setTimeout(r, 7000));

// 截图 1：地图区域（含兜底）
const mapSection = await page.$('section[aria-label="真实地理地图"]');
if (mapSection) {
  await mapSection.screenshot({ path: 'scripts/yao-ui-map.png' });
  console.log('✓ Saved scripts/yao-ui-map.png');
}

// 截图 2：点击金秀，截图弹窗
await page.evaluate(() => {
  window.dispatchEvent(
    new CustomEvent('yao-county-click', {
      detail: { code: '451324', name: '金秀瑶族自治县' },
    })
  );
});
await new Promise((r) => setTimeout(r, 1500));

// 截图弹窗
const modal = await page.$('.modal-layer-high');
if (modal) {
  await modal.screenshot({ path: 'scripts/yao-ui-modal-jinxiu.png' });
  console.log('✓ Saved scripts/yao-ui-modal-jinxiu.png');
}

// 截图 3：点击合山（自动生成的扩展资料）
await page.evaluate(() => {
  const m = document.querySelector('.modal-layer-high');
  const b = m?.querySelector('button[aria-label*="关闭"]');
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 400));

await page.evaluate(() => {
  window.dispatchEvent(
    new CustomEvent('yao-county-click', {
      detail: { code: '451381', name: '合山市' },
    })
  );
});
await new Promise((r) => setTimeout(r, 1500));

const modal2 = await page.$('.modal-layer-high');
if (modal2) {
  await modal2.screenshot({ path: 'scripts/yao-ui-modal-heshan.png' });
  console.log('✓ Saved scripts/yao-ui-modal-heshan.png');
}

await browser.close();
console.log('Done');