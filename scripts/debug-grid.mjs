import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto('http://127.0.0.1:5186/', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 4000));

await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent && /草药目录/.test(b.textContent)
  );
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 1500));

const gridInfo = await page.evaluate(() => {
  const grid = document.querySelector('[data-testid="herb-thumbnail-grid"]');
  if (!grid) return null;
  const gridRect = grid.getBoundingClientRect();
  const cs = window.getComputedStyle(grid);
  const items = Array.from(grid.children);
  const firstRow = items.filter(
    (it) => Math.abs(it.getBoundingClientRect().top - items[0].getBoundingClientRect().top) < 5
  );
  // 找出右侧 flex-1 容器宽度
  const panel = grid.closest('.info-panel-wrapper');
  const panelRect = panel?.getBoundingClientRect();
  const leftSidebar = panel?.querySelector('.modal-body-scroll');
  return {
    grid: { w: gridRect.width, h: gridRect.height, cols: cs.gridTemplateColumns },
    items: items.length,
    firstRowCount: firstRow.length,
    firstRowRect: firstRow.map((r) => ({ x: r.getBoundingClientRect().x, w: r.getBoundingClientRect().width })),
    panelW: panelRect?.width,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
});
console.log(JSON.stringify(gridInfo, null, 2));
await browser.close();