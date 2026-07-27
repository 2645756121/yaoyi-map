import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('[DrillDown]') || t.includes('[MapBoard]') || t.includes('TRIGGERED')) {
    console.log('[B]', t);
  }
});
page.on('pageerror', (e) => console.log('[PERR]', e.message));

await page.goto('http://127.0.0.1:5186/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__DRILL_DOWN__, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 5000));

// ✅ MapBoard 已经注册了 setOnCountyClick（用 zustand store）
// 无需在测试中重新注册 — 直接 fire 后检查 modal
await page.evaluate(() => {
  window.__modalTriggered = null;
});
await new Promise((r) => setTimeout(r, 200));

// 钻入广西
await page.evaluate(async () => {
  await window.__DRILL_DOWN__.drillToProvince('45');
});
await new Promise((r) => setTimeout(r, 3500));

// 审计 markers
const audit = await page.evaluate(() => {
  const map = window.__MAP_INSTANCE;
  const reds = [];
  map.eachLayer((layer) => {
    if (
      layer &&
      layer._path &&
      layer._path.getAttribute &&
      layer._path.getAttribute('fill') === '#dc2626'
    ) {
      reds.push({
        listensClick: layer.listens ? layer.listens('click') : 'no listens',
        className: layer.constructor && layer.constructor.name,
        radius: layer.options && layer.options.radius,
      });
    }
  });
  return {
    total: reds.length,
    listensYes: reds.filter((r) => r.listensClick).length,
    listensNo: reds.filter((r) => !r.listensClick).length,
    firstFew: reds.slice(0, 3),
  };
});
console.log('Audit:', JSON.stringify(audit, null, 2));

// 直接 fire 第一个有 click listener 的 marker
if (audit.listensYes > 0) {
  const result = await page.evaluate(() => {
    const map = window.__MAP_INSTANCE;
    const reds = [];
    map.eachLayer((layer) => {
      if (
        layer &&
        layer._path &&
        layer._path.getAttribute &&
        layer._path.getAttribute('fill') === '#dc2626' &&
        layer.listens('click')
      ) {
        reds.push(layer);
      }
    });
    if (reds.length === 0) return 'no click listener';
    const m = reds[0];
    m.fire('click', { latlng: m.getLatLng(), target: m });
    return window.__modalTriggered;
  });
  console.log('After fire:', result);
  await new Promise((r) => setTimeout(r, 2500));
}

const state = await page.evaluate(() => {
  const modals = Array.from(document.querySelectorAll('.modal-layer'));
  return {
    modalCount: modals.length,
    modalClasses: modals.map((m) => m.className),
    modalOpens: modals.map((m) => ({
      open: m.classList.contains('opacity-100'),
      style: window.getComputedStyle(m).opacity,
      title: m.querySelector('#county-modal-title')?.textContent?.substring(0, 30),
    })),
    title: document.getElementById('county-modal-title')?.textContent?.substring(0, 30),
    totalDetails: document.querySelectorAll('details').length,
  };
});
console.log('Modal state:', JSON.stringify(state));

await browser.close();