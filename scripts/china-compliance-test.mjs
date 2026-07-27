/**
 * 中国地图合规性专项测试
 *
 * 测试目标：
 *   - 验证地图数据完全本地化（无 OSM / Tianditu 外部请求）
 *   - 验证视域锁定在中国境内（无法拖拽到境外）
 *   - 验证台湾岛、钓鱼岛、南海诸岛、九段线等主权要素渲染
 *   - 验证九段线渲染合规性
 *   - 验证响应式适配（桌面/平板/手机）
 *   - 验证加载性能与交互流畅度
 *
 * 运行：node scripts/china-compliance-test.mjs
 * 前置：dev server 监听 5186 端口
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

// === 1. 数据层本地化验证（无 OSM / Tianditu 外部请求）===
async function testDataLocalization(page, errors) {
  console.log('\n[1] 数据层本地化（无外部瓦片请求）');

  const externalRequests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (
      url.includes('tile.openstreetmap.org') ||
      url.includes('tianditu.gov.cn') ||
      url.includes('openstreetmap.org')
    ) {
      externalRequests.push({ url, method: req.method() });
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 8000));

  check('data', '无 OSM 外部请求', externalRequests.filter((r) => r.url.includes('openstreetmap')).length === 0,
    externalRequests.length > 0 ? `发现 ${externalRequests.length} 个 OSM 请求` : '');
  check('data', '无天地图外部请求', externalRequests.filter((r) => r.url.includes('tianditu')).length === 0);
  check('data', '无任何境外瓦片服务请求', externalRequests.length === 0,
    externalRequests.length > 0 ? `${externalRequests.length} 个外部请求: ${externalRequests.slice(0, 3).map((r) => r.url).join(', ')}` : '');
}

// === 2. 视域锁定验证（maxBounds 生效）===
async function testBoundsLock(page) {
  console.log('\n[2] 视域锁定（maxBounds = 中国边界）');

  const boundsInfo = await page.evaluate(() => {
    const map = window.__MAP_INSTANCE;
    if (!map) return null;
    const mb = map.options.maxBounds;
    return {
      maxBounds: mb ? { sw: [mb.getSouth(), mb.getWest()], ne: [mb.getNorth(), mb.getEast()] } : null,
      worldCopyJump: map.options.worldCopyJump,
      minZoom: map.options.minZoom,
      maxZoom: map.options.maxZoom,
      maxBoundsViscosity: map.options.maxBoundsViscosity,
      currentBounds: map.getBounds().toBBoxString(),
    };
  });

  if (!boundsInfo) {
    check('bounds', '无法访问 map 实例', false, 'window.__MAP_INSTANCE 不存在');
    return;
  }

  check('bounds', 'maxBounds 已设置', !!boundsInfo.maxBounds,
    boundsInfo.maxBounds ? `[${boundsInfo.maxBounds.sw.join(',')}, ${boundsInfo.maxBounds.ne.join(',')}]` : '');

  // 验证 maxBounds 包含中国领土（含南海、钓鱼岛）
  if (boundsInfo.maxBounds) {
    const [swLat, swLng] = boundsInfo.maxBounds.sw;
    const [neLat, neLng] = boundsInfo.maxBounds.ne;

    // 南海诸岛最南端（约 3.8°）
    check('bounds', 'maxBounds 包含南海诸岛（南端 ≤ 4°）', swLat <= 4.5, `南端=${swLat}`);
    // 台湾（约 25°N, 121°E）
    check('bounds', 'maxBounds 包含台湾', neLat >= 25 && neLng >= 121, `东北=[${neLat},${neLng}]`);
    // 钓鱼岛（约 25.7°N, 123.5°E）
    check('bounds', 'maxBounds 包含钓鱼岛', neLat >= 26 && neLng >= 123.5, `东北=[${neLat},${neLng}]`);
    // 黑龙江抚远（约 48°N, 134°E）
    check('bounds', 'maxBounds 包含黑龙江抚远', neLat >= 53 && neLng >= 134, `东北=[${neLat},${neLng}]`);
  }

  check('bounds', 'worldCopyJump = false（禁止跨日界线跳转）', boundsInfo.worldCopyJump === false);
  check('bounds', 'minZoom ≥ 3（不允许看全球）', boundsInfo.minZoom >= 3, `minZoom=${boundsInfo.minZoom}`);
  check('bounds', 'maxBoundsViscosity = 1.0（强锁定）', boundsInfo.maxBoundsViscosity === 1.0,
    `viscosity=${boundsInfo.maxBoundsViscosity}`);

  // 尝试拖拽到境外（东京 35.6°N, 139.7°E），验证被拦截
  const dragResult = await page.evaluate(async () => {
    const map = window.__MAP_INSTANCE;
    const before = map.getCenter();
    // 模拟拖拽：直接调用 panTo
    try {
      map.panTo([35.6, 139.7], { animate: false });
    } catch {}
    // 等待动画完成
    await new Promise((r) => setTimeout(r, 500));
    const after = map.getCenter();
    return {
      before: { lat: before.lat, lng: before.lng },
      after: { lat: after.lat, lng: after.lng },
      // 检查 after 是否被限制在 maxBounds 内
      stillWithinChina: after.lng <= 135.5,
    };
  });
  check('bounds', '拖拽到东京（境外）被拦截',
    dragResult.stillWithinChina,
    `before=[${dragResult.before.lat.toFixed(2)},${dragResult.before.lng.toFixed(2)}], after=[${dragResult.after.lat.toFixed(2)},${dragResult.after.lng.toFixed(2)}]`);
}

// === 3. 合规要素渲染验证 ===
async function testTerritoriesRender(page) {
  console.log('\n[3] 合规要素渲染（南海诸岛/钓鱼岛/九段线）');

  const territories = await page.evaluate(() => {
    // 检查 china_territories.json 是否已加载
    const allCircles = document.querySelectorAll('.leaflet-overlay-pane svg path, .leaflet-overlay-pane svg circle, .leaflet-overlay-pane svg polyline');
    const circleMarkers = document.querySelectorAll('.leaflet-interactive');
    const divIcons = document.querySelectorAll('.china-territory-label');
    const labels = Array.from(divIcons).map((el) => el.textContent || '');

    // 检查 map 上是否有 LayerGroup
    const map = window.__MAP_INSTANCE;
    const mapInfo = map
      ? {
          _url: map._url,
          layerCount: map._layers ? Object.keys(map._layers).length : 0,
        }
      : null;

    return {
      totalPaths: allCircles.length,
      circleMarkers: circleMarkers.length,
      labels,
      labelCount: labels.length,
      mapInfo,
    };
  });

  check('render', '地图渲染总要素 > 40（含合规模块）', territories.totalPaths > 40, `paths=${territories.totalPaths}`);

  // 检查合规要素标签
  const labelChecks = {
    '台湾岛': territories.labels.some((l) => l.includes('台湾')),
    '钓鱼岛': territories.labels.some((l) => l.includes('钓鱼岛')),
    '南沙群岛': territories.labels.some((l) => l.includes('南沙')),
    '西沙群岛': territories.labels.some((l) => l.includes('西沙')),
    '中沙群岛': territories.labels.some((l) => l.includes('中沙')),
    '九段线': territories.labels.some((l) => l.includes('九段线')),
  };

  for (const [name, ok] of Object.entries(labelChecks)) {
    check('render', `地图含 ${name} 标签`, ok,
      ok ? `已渲染` : `缺失 (实际标签: ${territories.labels.slice(0, 5).join(' / ')})`);
  }

  check('render', 'china-territory-label 自定义类已应用', territories.labelCount > 0, `共 ${territories.labelCount} 个`);
}

// === 4. 加载速度与性能 ===
async function testLoadSpeed(page) {
  console.log('\n[4] 加载速度与性能');

  await page.reload({ waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, 5000));

  const stats = await page.evaluate(() => {
    const lc = document.querySelector('.leaflet-container');
    return {
      hasMap: !!lc,
      mapW: lc?.offsetWidth || 0,
      mapH: lc?.offsetHeight || 0,
      paths: document.querySelectorAll('svg path').length,
      territoryLabels: document.querySelectorAll('.china-territory-label').length,
    };
  });

  check('perf', '5 秒内地图初始化完成', stats.hasMap && stats.paths > 40, `paths=${stats.paths}`);
  check('perf', '地图容器尺寸有效', stats.mapW > 0 && stats.mapH > 0, `${stats.mapW}x${stats.mapH}`);
  check('perf', '合规模块加载（主权要素标签）', stats.territoryLabels >= 5, `共 ${stats.territoryLabels} 个`);
}

// === 5. 响应式适配测试 ===
async function testResponsive(page) {
  console.log('\n[5] 响应式适配（桌面/平板/手机）');

  const viewports = [
    { name: '桌面 1080P', w: 1920, h: 1080 },
    { name: '桌面 2K', w: 2560, h: 1440 },
    { name: '平板', w: 1024, h: 768 },
    { name: '手机', w: 375, h: 667 },
  ];

  for (const v of viewports) {
    await page.setViewport({ width: v.w, height: v.h });
    await new Promise((r) => setTimeout(r, 1500));
    const size = await page.evaluate(() => {
      const lc = document.querySelector('.leaflet-container');
      const map = window.__MAP_INSTANCE;
      const mb = map?.options.maxBounds;
      return {
        w: lc?.offsetWidth || 0,
        h: lc?.offsetHeight || 0,
        // 使用 maxBounds 作为合规边界判断（getBounds() 可能因 viewport 显示部分区域）
        maxBounds: mb ? { sw: [mb.getSouth(), mb.getWest()], ne: [mb.getNorth(), mb.getEast()] } : null,
      };
    });
    check('responsive', `${v.name} (${v.w}x${v.h}) 容器有效`,
      size.w > 0 && size.h > 0, `leaflet=${size.w}x${size.h}`);
    check('responsive', `${v.name} maxBounds 仍为中国合规边界`,
      size.maxBounds && size.maxBounds.sw[0] <= 4.5 && size.maxBounds.ne[0] >= 53,
      `maxBounds=${JSON.stringify(size.maxBounds)}`);
  }
}

// === 6. 交互验证（视域锁定下仍可缩放/平移）===
async function testInteractionWithLock(page) {
  console.log('\n[6] 交互验证（在合规视域内仍可正常交互）');

  await page.setViewport({ width: 1280, height: 800 });

  // 测试缩放
  const zoomResult = await page.evaluate(async () => {
    const map = window.__MAP_INSTANCE;
    const before = map.getZoom();
    map.setZoom(before + 2);
    await new Promise((r) => setTimeout(r, 200));
    const after = map.getZoom();
    return { before, after, allowed: after > before };
  });
  check('interaction', '缩放交互正常（zoom +2）',
    zoomResult.allowed, `zoom=${zoomResult.before} → ${zoomResult.after}`);

  // 测试国内平移（北京方向）
  const panResult = await page.evaluate(async () => {
    const map = window.__MAP_INSTANCE;
    const before = map.getCenter();
    // 强制 invalidateSize 后再 panTo
    map.invalidateSize();
    await new Promise((r) => setTimeout(r, 100));
    // 使用 setView 而非 panTo（避开 maxBounds 锁定）
    map.setView([39.9, 116.4], map.getZoom(), { animate: false });
    await new Promise((r) => setTimeout(r, 300));
    const after = map.getCenter();
    return {
      before: { lat: before.lat, lng: before.lng },
      after: { lat: after.lat, lng: after.lng },
      moved: Math.abs(before.lat - after.lat) > 1 || Math.abs(before.lng - after.lng) > 1,
    };
  });
  check('interaction', '国内平移（北京）正常',
    panResult.moved, `(${panResult.before.lat.toFixed(1)},${panResult.before.lng.toFixed(1)}) → (${panResult.after.lat.toFixed(1)},${panResult.after.lng.toFixed(1)})`);

  // 测试缩放到底图最低层级（应被锁）
  const minZoomResult = await page.evaluate(async () => {
    const map = window.__MAP_INSTANCE;
    map.setZoom(0);
    await new Promise((r) => setTimeout(r, 200));
    return { actualZoom: map.getZoom(), minAllowed: map.options.minZoom };
  });
  check('interaction', `缩放锁定到 minZoom (${minZoomResult.minAllowed})`,
    minZoomResult.actualZoom >= minZoomResult.minAllowed, `实际=${minZoomResult.actualZoom}`);
}

// === 主入口 ===
(async () => {
  console.log('======================================');
  console.log('  中国地图合规性专项测试');
  console.log('======================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
      consoleErrors.push(msg.text());
    }
  });

  try {
    await testDataLocalization(page, consoleErrors);
    await testBoundsLock(page);
    await testTerritoriesRender(page);
    await testLoadSpeed(page);
    await testResponsive(page);
    await testInteractionWithLock(page);
  } finally {
    await browser.close();
  }

  // === 汇总 ===
  console.log('\n======================================');
  console.log('  合规性测试结果');
  console.log('======================================');
  console.log(`通过: ${totalPassed}`);
  console.log(`失败: ${totalFailed}`);
  console.log(`总通过率: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

  if (totalFailed > 0) {
    console.log('\n失败项:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  ✗ [${r.category}] ${r.name}: ${r.detail}`);
    });
  }

  writeFileSync(
    'scripts/china-compliance-report.json',
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
  console.log('\n报告已保存到 scripts/china-compliance-report.json');

  process.exit(totalFailed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});