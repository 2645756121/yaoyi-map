/**
 * 探针：Leaflet map.remove() 后内部状态变化
 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5186/';

const probeCode = `
async () => {
  const map = window.__MAP_INSTANCE;
  if (!map) return { error: 'map not found' };

  const before = {
    _loaded: map._loaded,
    _size_type: typeof map._size,
    _size_x: map._size ? map._size.x : null,
    _container_id: map._container ? map._container._leaflet_id : null,
    _container_isConnected: map._container ? map._container.isConnected : null,
    _mapPane: map._mapPane ? 'present' : null,
  };

  map.remove();

  const after = {
    _loaded: map._loaded,
    _size_type: typeof map._size,
    _size_x: map._size ? map._size.x : null,
    _container_id: map._container ? map._container._leaflet_id : null,
    _container_isConnected: map._container ? map._container.isConnected : null,
    _mapPane: map._mapPane ? 'present' : null,
  };

  return { before, after };
}
`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 5000));

  const result = await page.evaluate(eval(probeCode));
  console.log('PROBE_RESULT_BEGIN');
  console.log(JSON.stringify(result, null, 2));
  console.log('PROBE_RESULT_END');
  await browser.close();
})();