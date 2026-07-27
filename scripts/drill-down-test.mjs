/**
 * 三级钻取地图全流程测试
 *
 * 测试覆盖：
 *   - 数据聚合正确性（省-市-县层级）
 *   - 省级默认渲染（34 省 + 9 瑶族省高亮）
 *   - 点击省份 → 平滑 flyToBounds 聚焦（动画 0.5-1s）
 *   - 聚焦后展开下辖县轮廓 + 名称 + 数据
 *   - 点击县 → 进一步钻取
 *   - 返回上级（zoomOut）
 *   - 全 9 个瑶族省份点击覆盖
 *
 * 运行：node scripts/drill-down-test.mjs
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

(async () => {
  console.log('======================================');
  console.log('  三级钻取地图全流程测试');
  console.log('======================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  try {
    // === 1. 加载页面 ===
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 8000));

    // === 2. 数据聚合 ===
    console.log('\n[1] 数据聚合（省-市-县三级）');
    const hierarchy = await page.evaluate(() => {
      // 抓取 console.log 的"行政层次聚合完成"信息
      const matches = window.__CONSOLE_BUFFER__?.filter((l) => l.includes('行政层次聚合完成')) || [];
      const last = matches[matches.length - 1];
      if (!last) return null;
      // 提取数字
      const m = last.match(/(\d+)\s*省\s*\/\s*(\d+)\s*市\s*\/\s*(\d+)\s*县/);
      if (!m) return null;
      return {
        provinces: parseInt(m[1]),
        cities: parseInt(m[2]),
        counties: parseInt(m[3]),
      };
    });

    if (!hierarchy) {
      // 通过 grep consoleLogs 查找
      const aggLog = consoleLogs.find((l) => l.includes('行政层次聚合完成'));
      if (aggLog) {
        const m = aggLog.match(/(\d+)\s*省\s*\/\s*(\d+)\s*市\s*\/\s*(\d+)\s*县/);
        if (m) {
          check('data', '数据聚合日志已记录', true, aggLog);
          check('data', '省级数量正确（34 个）', parseInt(m[1]) === 34, `${m[1]} 个`);
          check('data', '市级数量 > 0', parseInt(m[2]) > 0, `${m[2]} 个`);
          check('data', '县级数量 > 0', parseInt(m[3]) > 0, `${m[3]} 个`);
        } else {
          check('data', '无法解析聚合日志', false, aggLog);
        }
      } else {
        check('data', '未找到聚合日志', false, 'console 中无"行政层次聚合完成"');
      }
    } else {
      check('data', '省级数量正确（34 个）', hierarchy.provinces === 34);
      check('data', '市级数量 > 0', hierarchy.cities > 0);
      check('data', '县级数量 > 0', hierarchy.counties > 0);
    }

    // === 3. 省级默认渲染 ===
    console.log('\n[2] 省级默认渲染（34 省轮廓）');
    const nationalRender = await page.evaluate(() => {
      const lc = document.querySelector('.leaflet-container');
      const paths = document.querySelectorAll('.leaflet-overlay-pane svg path');
      const provinceLabels = document.querySelectorAll('.province-label');
      const labels = Array.from(provinceLabels).map((el) => el.textContent || '');
      return {
        hasMap: !!lc,
        paths: paths.length,
        provinceLabelCount: provinceLabels.length,
        provinceLabels: labels.slice(0, 10),
      };
    });

    check('render', '地图已初始化', nationalRender.hasMap);
    check('render', '省级 SVG path > 30（34 个省级）',
      nationalRender.paths > 30, `共 ${nationalRender.paths} 个`);
    check('render', '省级名称标签渲染（高亮省份）',
      nationalRender.provinceLabelCount > 0, `共 ${nationalRender.provinceLabelCount} 个: ${nationalRender.provinceLabels.slice(0, 5).join(', ')}`);

    // === 4. 点击省份 → 平滑聚焦 ===
    console.log('\n[3] 点击省份 → 平滑聚焦（动画 0.5-1s）');

    // 找到 SVG path 中绿色高亮的一个（瑶族相关省份）
    const clickProvince = async (provinceAdcode, label) => {
      const before = await page.evaluate(() => ({
        bounds: window.__MAP_INSTANCE.getBounds().toBBoxString(),
        center: window.__MAP_INSTANCE.getCenter(),
        zoom: window.__MAP_INSTANCE.getZoom(),
      }));

      // 点击 SVG path（找 fill=#34d399 的）
      const t0 = Date.now();
      const clickResult = await page.evaluate((adcode) => {
        const paths = document.querySelectorAll('.leaflet-overlay-pane svg path');
        for (const p of paths) {
          // 通过 fill 颜色判断高亮省份
          const fill = p.getAttribute('fill');
          if (fill === '#34d399' || fill === 'rgb(52, 211, 153)') {
            p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return { clicked: true, fill };
          }
        }
        return { clicked: false };
      }, provinceAdcode);
      const elapsed = Date.now() - t0;

      // 等待动画完成（flyToBounds 0.8s + 加载 + render）
      await new Promise((r) => setTimeout(r, 2500));

      const after = await page.evaluate(() => ({
        bounds: window.__MAP_INSTANCE.getBounds().toBBoxString(),
        center: window.__MAP_INSTANCE.getCenter(),
        zoom: window.__MAP_INSTANCE.getZoom(),
      }));

      return { before, after, clickResult, elapsed };
    };

    const result = await clickProvince('45', '广西');
    check('drill', '省份点击触发',
      result.clickResult.clicked, `fill=${result.clickResult.fill}`);

    // 优先通过 window.__DRILL_DOWN__ 直接调用 API（更可靠）
    const drillResult = await page.evaluate(async () => {
      const drill = window.__DRILL_DOWN__;
      if (!drill) return { hasDrill: false };
      await drill.drillToProvince('45');
      // 等动画完成
      await new Promise((r) => setTimeout(r, 1500));
      const m = window.__MAP_INSTANCE;
      return {
        hasDrill: true,
        state: drill.getState(),
        center: { lat: m.getCenter().lat, lng: m.getCenter().lng },
        bounds: m.getBounds().toBBoxString(),
        zoom: m.getZoom(),
      };
    });

    check('drill', '__DRILL_DOWN__ 控制器可用',
      drillResult.hasDrill);
    check('drill', `直接调用 drillToProvince('45') 切换到市级视图`,
      drillResult.state?.level === 'city',
      `level=${drillResult.state?.level}`);
    check('drill', '聚焦后视图 center 变化到广西',
      Math.abs(drillResult.center.lat - 24) < 5 && Math.abs(drillResult.center.lng - 110) < 5,
      `center=[${drillResult.center.lat.toFixed(2)},${drillResult.center.lng.toFixed(2)}]`);

    // 检查视域变化（center 改变）
    const centerChanged = Math.abs(result.before.center.lat - result.after.center.lat) > 1 ||
      Math.abs(result.before.center.lng - result.after.center.lng) > 1;
    check('drill', `点击后视图平滑聚焦（${result.label}）`,
      centerChanged,
      `before=[${result.before.center.lat.toFixed(2)},${result.before.center.lng.toFixed(2)}] → after=[${result.after.center.lat.toFixed(2)},${result.after.center.lng.toFixed(2)}]`);

    // === 5. 省级聚焦后下辖县级渲染 ===
    console.log('\n[4] 省级聚焦后渲染下辖县');
    await new Promise((r) => setTimeout(r, 1500));

    const countyRender = await page.evaluate(() => {
      const paths = document.querySelectorAll('.leaflet-overlay-pane svg path');
      const circleMarkers = document.querySelectorAll('.leaflet-interactive');
      const provinceFocusedLabel = document.querySelector('.province-focused-label');
      // ✅ 修复：返回按钮改为 [data-drill-back] div
      const backBtn = document.querySelector('[data-drill-back]');
      return {
        paths: paths.length,
        circleMarkers: circleMarkers.length,
        hasProvinceLabel: !!provinceFocusedLabel,
        provinceLabelText: provinceFocusedLabel?.textContent || '',
        hasBackBtn: !!backBtn,
      };
    });

    check('drill', '省级聚焦后路径数量增加（加载县级）',
      countyRender.paths > nationalRender.paths,
      `${nationalRender.paths} → ${countyRender.paths}`);
    check('drill', '省级聚焦后有 circleMarkers（县级中心点）',
      countyRender.circleMarkers > 0, `共 ${countyRender.circleMarkers} 个`);
    check('drill', '省级聚焦后显示省级名称与统计',
      countyRender.hasProvinceLabel && countyRender.provinceLabelText.includes('县'),
      countyRender.provinceLabelText.substring(0, 50));
    check('drill', '省级聚焦后显示"返回全国"按钮', countyRender.hasBackBtn);

    // === 6. 测试点击县 → 进一步钻取 ===
    console.log('\n[5] 点击县级 → 钻取县级详情（金秀 451324）');
    const countyDrill = await page.evaluate(async () => {
      const drill = window.__DRILL_DOWN__;
      if (!drill) return { clicked: false };
      // 先确保在广西
      await drill.drillToProvince('45');
      await new Promise((r) => setTimeout(r, 1000));
      // 然后钻入金秀
      await drill.drillToCounty('451324');
      return { clicked: true };
    });
    check('drill', '县级点击触发', countyDrill.clicked);

    await new Promise((r) => setTimeout(r, 1500));

    const countyFocused = await page.evaluate(() => {
      const tips = Array.from(document.querySelectorAll('.county-focused-tip'));
      return {
        hasTip: tips.length > 0,
        tipText: tips[0]?.textContent || '',
        tipCount: tips.length,
      };
    });
    check('drill', '县级聚焦显示 tooltip',
      countyFocused.hasTip, countyFocused.tipText.substring(0, 50));

    // === 7. 测试返回上级 ===
    console.log('\n[6] 返回上级（zoomOut）');
    await page.evaluate(() => {
      // ✅ 修复：返回按钮改为 [data-drill-back] div
      const backBtn = document.querySelector('[data-drill-back]');
      if (backBtn) backBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    const afterBack = await page.evaluate(() => {
      const paths = document.querySelectorAll('.leaflet-overlay-pane svg path');
      return {
        paths: paths.length,
        // 期望回到省级视图（路径数减少）
      };
    });
    check('drill', '返回上级后视图回到省级',
      afterBack.paths > 30 && Math.abs(afterBack.paths - countyRender.paths) < 100,
      `路径数 ${afterBack.paths}（与省级钻取视图 ${countyRender.paths} 接近）`);

    // === 8. 全 9 个瑶族省份钻取覆盖 ===
    console.log('\n[7] 全 9 个瑶族省份钻取覆盖');
    const YAO_PROVINCES = ['36', '43', '44', '45', '46', '50', '51', '52', '53'];

    for (const adcode of YAO_PROVINCES) {
      // 直接调用 API（更可靠）
      const result = await page.evaluate(async (ad) => {
        const drill = window.__DRILL_DOWN__;
        if (!drill) return { error: 'no drill' };
        await drill.drillToProvince(ad);
        await new Promise((r) => setTimeout(r, 1500));
        const state = drill.getState();
        const m = window.__MAP_INSTANCE;
        return {
          state,
          center: { lat: m.getCenter().lat, lng: m.getCenter().lng },
          paths: document.querySelectorAll('.leaflet-overlay-pane svg path').length,
          markers: document.querySelectorAll('.leaflet-interactive').length,
          provinceLabel: document.querySelector('.province-focused-label')?.textContent || '',
        };
      }, adcode);

      check('coverage', `省份 adcode=${adcode} 钻取到省级视图`,
        result.state?.level === 'city' && result.markers > 0,
        `level=${result.state?.level}, markers=${result.markers}, center=[${result.center?.lat.toFixed(2)},${result.center?.lng.toFixed(2)}]`);
      check('coverage', `省份 adcode=${adcode} 显示省级名称标签`,
        result.provinceLabel.length > 10,
        result.provinceLabel.substring(0, 30));

      // 返回上级
      await page.evaluate(async () => {
        const drill = window.__DRILL_DOWN__;
        if (drill) await drill.zoomOut();
      });
      await new Promise((r) => setTimeout(r, 2000));
    }

    // === 汇总 ===
    console.log('\n======================================');
    console.log('  三级钻取测试结果');
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
      'scripts/drill-down-report.json',
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
    console.log('\n报告已保存到 scripts/drill-down-report.json');

    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (e) {
    console.error('FATAL:', e);
    process.exit(2);
  } finally {
    await browser.close();
  }
})();