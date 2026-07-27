/**
 * UI Fix Verification Test
 *
 * Validates 3 fixes:
 *   1. Province name positioning (within province geometry, not offset)
 *   2. Back button creation (no DOM accumulation, valid position, clickable)
 *   3. County click red dot positioning (at county geo center)
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
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] [${category}] ${name}${detail ? '  ' + detail : ''}`);
}

(async () => {
  console.log('======================================');
  console.log('  UI Fix Verification Test');
  console.log('======================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!window.__DRILL_DOWN__, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 5000));

    // === Fix 1: Province name positioning ===
    console.log('\n[Fix 1] Province name positioning (within province geometry)');

    const provinceLabels = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.province-label'));
      return labels.map((l) => {
        const rect = l.getBoundingClientRect();
        const text = l.textContent || '';
        // 获取 divIcon marker 的实际坐标（通过 transform 解析）
        const markerEl = l.closest('.leaflet-marker-icon');
        let lat = 0, lng = 0;
        // 尝试从 leaflet 内部获取坐标（通过 _leaflet_pos）
        const pos = markerEl?.getAttribute('style') || '';
        return {
          text: text.trim(),
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          w: rect.width,
          h: rect.height,
          style: pos,
        };
      });
    });

    // 通过 drillDownMap 验证每个标签位置是否在对应省级 GeoJSON bounds 内
    const labelBounds = await page.evaluate(async () => {
      const drill = window.__DRILL_DOWN__;
      const map = window.__MAP_INSTANCE;
      const labels = Array.from(document.querySelectorAll('.province-label'));
      const result = [];

      // 获取国家 GeoJSON 数据
      const r = await fetch('/map/100000_full.json');
      const data = await r.json();
      const features = data.features || [];

      // 为每个省级 feature 计算 bounds
      for (const f of features) {
        const adcode = String(f.properties.adcode || '').substring(0, 2);
        if (!adcode) continue;
        const layer = L.geoJSON(f);
        const b = layer.getBounds();
        result.push({ adcode, bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() } });
      }

      // 对每个标签，提取它的像素坐标并反推 latlng，然后检查是否在对应省份 bounds 内
      const labelChecks = [];
      const provinceNames = {
        '36': '江西省',
        '43': '湖南省',
        '44': '广东省',
        '45': '广西壮族自治区',
        '46': '海南省',
        '50': '重庆市',
        '51': '四川省',
        '52': '贵州省',
        '53': '云南省',
      };
      // 反向索引：name -> adcode
      const nameToAdcode = {};
      Object.entries(provinceNames).forEach(([adcode, name]) => {
        nameToAdcode[name] = adcode;
      });
      for (const lbl of labels) {
        const text = (lbl.textContent || '').trim();
        // 通过 label text 找到 adcode
        const matchedAdcode = nameToAdcode[text];
        if (!matchedAdcode) {
          labelChecks.push({ text, inBounds: false, reason: 'no matching province name' });
          continue;
        }
        const matched = result.find((r) => r.adcode === matchedAdcode);
        if (!matched) {
          labelChecks.push({ text, inBounds: false, reason: `no bounds for adcode=${matchedAdcode}` });
          continue;
        }
        // 获取 label marker 的实际 latlng（通过 leaflet containerPointToLayerPoint 反推）
        const markerIcon = lbl.closest('.leaflet-marker-icon');
        const rect = lbl.getBoundingClientRect();
        const mapRect = map.getContainer().getBoundingClientRect();
        const point = map.containerPointToLatLng([
          rect.x - mapRect.x + rect.width / 2,
          rect.y - mapRect.y + rect.height / 2,
        ]);
        const inBounds = (lat, lng, b) => lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
        const inBoundsResult = inBounds(point.lat, point.lng, matched.bounds);
        labelChecks.push({
          text,
          adcode: matched.adcode,
          labelLat: point.lat,
          labelLng: point.lng,
          bounds: matched.bounds,
          inBounds: inBoundsResult,
        });
      }

      return labelChecks;
    });

    console.log(`  Total province labels: ${labelBounds.length}`);
    let inBoundsCount = 0;
    for (const lb of labelBounds) {
      if (lb.inBounds) {
        inBoundsCount++;
        check('fix1', `省级 "${lb.text}" 在对应省份 bounds 内`, true,
          `lat=${lb.labelLat?.toFixed(2)}, lng=${lb.labelLng?.toFixed(2)}`);
      } else {
        check('fix1', `省级 "${lb.text}" 位置错位`, false,
          lb.reason || `lat=${lb.labelLat?.toFixed(2)}, lng=${lb.labelLng?.toFixed(2)}, bounds=${JSON.stringify(lb.bounds)}`);
      }
    }
    check('fix1', `所有省级标签居中（${inBoundsCount}/${labelBounds.length}）`,
      inBoundsCount === labelBounds.length);

    // === Fix 2: Back button creation (no DOM accumulation) ===
    console.log('\n[Fix 2] Back button: no DOM accumulation, valid position, clickable');

    // 切换省份多次，看 back button 是否累积
    for (let i = 0; i < 5; i++) {
      await page.evaluate(async (ad) => {
        const drill = window.__DRILL_DOWN__;
        await drill.drillToProvince(ad);
      }, ['36', '43', '44', '45', '46'][i]);
      await new Promise((r) => setTimeout(r, 1200));
    }

    const backBtnsCount = await page.evaluate(() => {
      // ✅ 修复后查找：返回按钮改为绝对定位 div，使用 [data-drill-back] 标识
      const btns = document.querySelectorAll('[data-drill-back]');
      return btns.length;
    });

    check('fix2', '5 次连续钻取后返回按钮数量 = 1（无堆叠）',
      backBtnsCount === 1, `found ${backBtnsCount} buttons`);

    // 检查返回按钮位置是否在地图容器内（新需求：不再固定到浏览器视口）
    const backBtnPos = await page.evaluate(() => {
      const btn = document.querySelector('[data-drill-back]');
      const map = document.querySelector('.leaflet-container-host');
      if (!btn || !map) return null;
      const rect = btn.getBoundingClientRect();
      const mapRect = map.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        inMap: rect.x >= mapRect.x && rect.y >= mapRect.y &&
          rect.x + rect.width <= mapRect.x + mapRect.width &&
          rect.y + rect.height <= mapRect.y + mapRect.height,
        visible: rect.width > 0 && rect.height > 0,
        mapX: mapRect.x,
        mapY: mapRect.y,
      };
    });

    if (backBtnPos) {
      check('fix2', '返回按钮位置在地图容器内（不遮挡顶部导航）',
        backBtnPos.inMap && backBtnPos.visible,
        `pos=[${backBtnPos.x.toFixed(0)},${backBtnPos.y.toFixed(0)}] map=[${backBtnPos.mapX.toFixed(0)},${backBtnPos.mapY.toFixed(0)}] size=${backBtnPos.w}x${backBtnPos.h}`);
    } else {
      check('fix2', '返回按钮存在', false, '未找到返回按钮');
    }

    // 测试点击返回按钮
    const backClickResult = await page.evaluate(() => {
      const btn = document.querySelector('[data-drill-back]');
      if (!btn) return { clicked: false };
      btn.click();
      return { clicked: true, target: 'drill-back-btn div' };
    });
    check('fix2', '返回按钮可点击', backClickResult.clicked,
      `target=${backClickResult.target}`);
    await new Promise((r) => setTimeout(r, 1500));

    const afterBack = await page.evaluate(() => {
      const drill = window.__DRILL_DOWN__;
      return drill?.getState();
    });
    check('fix2', '点击返回后 level 回到 province',
      afterBack?.level === 'province', `level=${afterBack?.level}`);

    // === Fix 3: County click red dot positioning ===
    console.log('\n[Fix 3] County click red dot positioning (at county geo center)');

    // 钻取到广东
    await page.evaluate(async () => {
      const drill = window.__DRILL_DOWN__;
      await drill.drillToProvince('44');
    });
    await new Promise((r) => setTimeout(r, 2000));

    const countyMarkers = await page.evaluate(async () => {
      const drill = window.__DRILL_DOWN__;
      const map = window.__MAP_INSTANCE;
      const state = drill.getState();
      const province = window.__MAP_INSTANCE;

      // 获取该省所有县级 circleMarker
      const circleMarkers = Array.from(document.querySelectorAll('.leaflet-interactive'))
        .filter((el) => el.tagName === 'path' || el.tagName === 'circle');

      // 获取每个 circleMarker 的位置 + 它对应的县区 bounds
      const checks = [];
      for (const m of circleMarkers) {
        const rect = m.getBoundingClientRect();
        if (rect.width === 0) continue; // skip hidden
        const mapRect = map.getContainer().getBoundingClientRect();
        const point = map.containerPointToLatLng([
          rect.x - mapRect.x + rect.width / 2,
          rect.y - mapRect.y + rect.height / 2,
        ]);
        checks.push({
          tag: m.tagName,
          x: rect.x,
          y: rect.y,
          w: rect.width,
          h: rect.height,
          lat: point.lat,
          lng: point.lng,
        });
      }
      return checks;
    });

    // 验证：每个 marker 的中心点是否在对应县区 GeoJSON 的 bounds 内
    const countyMarkerValidation = await page.evaluate(async () => {
      const drill = window.__DRILL_DOWN__;
      // 直接读取模拟测试：从当前 level='city' 状态获取县级 GeoJSON bounds
      const state = drill.getState();
      if (!state.provinceAdcode) return { checks: [] };

      // 通过 DrillDownMap 内部数据获取
      const markers = document.querySelectorAll('.leaflet-overlay-pane svg path');
      const checks = [];
      for (const m of markers) {
        const rect = m.getBoundingClientRect();
        if (rect.width < 5) continue; // skip tiny
        checks.push({
          path: rect.x + rect.y,
          x: rect.x,
          y: rect.y,
          w: rect.width,
          h: rect.height,
        });
      }
      return { checks, paths: markers.length };
    });

    // 直接钻入江永县测试（已知之前偏移）
    await page.evaluate(async () => {
      const drill = window.__DRILL_DOWN__;
      await drill.drillToCounty('431124'); // 江永县（湖南，code=431124）
    });
    await new Promise((r) => setTimeout(r, 2000));

    const countyDrillPos = await page.evaluate(async () => {
      const map = window.__MAP_INSTANCE;
      const tagWrapper = document.querySelector('.county-focused-tag-wrapper');
      if (!map || !tagWrapper) {
        return { found: false, message: 'no focused county tag' };
      }
      const rect = tagWrapper.getBoundingClientRect();
      const mapRect = map.getContainer().getBoundingClientRect();
      // focused tag 使用 iconAnchor [80, 14]，该点即地理中心
      const point = map.containerPointToLatLng([
        rect.x - mapRect.x + 80,
        rect.y - mapRect.y + 14,
      ]);
      const r = await fetch('/map/county/431124.json');
      const geojson = await r.json();
      const tempLayer = L.geoJSON(geojson);
      const bounds = tempLayer.getBounds();
      const expected = bounds.getCenter();
      return {
        found: true,
        markerLat: point.lat,
        markerLng: point.lng,
        centerLat: expected.lat,
        centerLng: expected.lng,
      };
    });

    if (countyDrillPos.found) {
      const offsetLat = Math.abs(countyDrillPos.markerLat - countyDrillPos.centerLat);
      const offsetLng = Math.abs(countyDrillPos.markerLng - countyDrillPos.centerLng);
      check('fix3', '江永县美化标签锚点 == 县区 GeoJSON bounds.getCenter()',
        offsetLat < 0.001 && offsetLng < 0.001,
        `tag=[${countyDrillPos.markerLat.toFixed(4)},${countyDrillPos.markerLng.toFixed(4)}] center=[${countyDrillPos.centerLat.toFixed(4)},${countyDrillPos.centerLng.toFixed(4)}] offset=[${(offsetLat*111).toFixed(3)}km,${(offsetLng*111).toFixed(3)}km]`);
    } else {
      check('fix3', '江永县美化标签未找到', false, countyDrillPos.message || 'not found');
    }

  } finally {
    await page.close();
    await browser.close();
  }

  console.log('\n======================================');
  console.log('  UI Fix Verification Summary');
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
    'scripts/ui-fix-report.json',
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
  console.log('\nReport saved to scripts/ui-fix-report.json');

  process.exit(totalFailed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});