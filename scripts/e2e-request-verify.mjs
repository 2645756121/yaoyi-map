/**
 * 端到端请求验证脚本
 * 目的：按规范流程发起 HTTP 请求、监控响应、指数退避重试、解析响应、执行业务验证
 *
 * 流程：
 *   1. 核对请求参数完整性
 *   2. 探测目标服务可用性
 *   3. 发起 HTTP 请求（指数退避重试 ≤ 3 次）
 *   4. 解析响应数据
 *   5. 执行业务校验（HTML 必需元素 / 地图资源 / 初始化参数）
 *   6. 执行用户交互业务（点击省份）
 *   7. 汇总执行日志
 */

import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://127.0.0.1:5186';

// === 日志收集 ===
const logs = [];
function log(level, message, detail = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...detail,
  };
  logs.push(entry);
  const icon = {
    info: 'ℹ️',
    ok: '✅',
    warn: '⚠️',
    error: '❌',
    retry: '🔄',
  }[level] || '·';
  const detailStr = Object.keys(detail).length > 0 ? ' ' + JSON.stringify(detail) : '';
  console.log(`${icon} [${entry.timestamp.slice(11, 23)}] ${message}${detailStr}`);
}

// === 指数退避重试 ===
async function withRetry(fn, maxRetries = 3, baseDelayMs = 500) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log('info', `[重试] 尝试 ${attempt}/${maxRetries}`);
      const result = await fn(attempt);
      if (attempt > 1) {
        log('ok', `[重试] 第 ${attempt} 次成功`);
      }
      return result;
    } catch (e) {
      lastError = e;
      log('warn', `[重试] 第 ${attempt} 次失败`, { error: e.message });
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
        log('info', `[重试] 等待 ${delay}ms 后重试（指数退避）`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// === 业务校验结果 ===
const businessChecks = [];
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      businessChecks.push({ name, passed: true });
      log('ok', `[业务] ${name}`);
    })
    .catch((e) => {
      businessChecks.push({ name, passed: false, error: e.message });
      log('error', `[业务] ${name}`, { error: e.message });
    });
}

// === 1. 核对请求参数 ===
function verifyRequestParams() {
  log('info', '=== 1. 核对请求参数完整性 ===');

  const params = {
    baseUrl: BASE_URL,
    homePage: `${BASE_URL}/`,
    mapBoardSrc: `${BASE_URL}/src/components/MapBoard/MapBoard.tsx`,
    mapData: `${BASE_URL}/map/100000.json`,
    countyManifest: `${BASE_URL}/map/county-manifest.json`,
    browser: 'Edge Headless',
    timeoutMs: 30000,
    retries: 3,
  };

  if (!params.baseUrl) throw new Error('缺少 baseUrl');
  if (!params.homePage.startsWith('http')) throw new Error('homePage URL 格式错误');
  if (params.timeoutMs < 1000) throw new Error('timeoutMs 过小');
  if (params.retries > 5) throw new Error('retries 超过上限');

  log('ok', '请求参数核对通过', params);
  return params;
}

// === 2. 探测目标服务可用性 ===
async function probeTargetService(params) {
  log('info', '=== 2. 探测目标服务可用性 ===');

  const probeResult = await withRetry(async () => {
    const t0 = Date.now();
    const resp = await fetch(params.homePage, { method: 'HEAD' });
    const elapsed = Date.now() - t0;
    if (!resp.ok) {
      throw new Error(`HEAD 失败 status=${resp.status}`);
    }
    return { status: resp.status, elapsed, headers: resp.headers };
  });

  log('ok', '目标服务探测通过', probeResult);
  return probeResult;
}

// === 3. 发起 HTTP 请求并解析 ===
async function fetchHomePage(params) {
  log('info', '=== 3. 发起首页 HTTP 请求（指数退避） ===');

  const response = await withRetry(async (attempt) => {
    const t0 = Date.now();
    const requestTime = new Date().toISOString();
    try {
      const resp = await fetch(params.homePage, {
        headers: { 'User-Agent': 'Mozilla/5.0 (E2E-Verifier)' },
      });
      const elapsed = Date.now() - t0;
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }
      return {
        status: resp.status,
        statusText: resp.statusText,
        elapsedMs: elapsed,
        attempt,
        requestTime,
        responseTime: new Date().toISOString(),
        headers: {
          contentType: resp.headers.get('content-type'),
          contentLength: resp.headers.get('content-length'),
          cacheControl: resp.headers.get('cache-control'),
        },
      };
    } catch (e) {
      throw new Error(`第 ${attempt} 次失败 [${requestTime}]: ${e.message}`);
    }
  });

  log('ok', 'HTTP 请求成功', response);
  return response;
}

// === 4. 解析 HTML 响应 ===
async function fetchHtmlContent(params) {
  log('info', '=== 4. 解析 HTML 响应 ===');

  const html = await withRetry(async () => {
    const r = await fetch(params.homePage);
    return r.text();
  });

  log('info', 'HTML 内容长度', { length: html.length });

  // 提取关键信息
  const meta = {
    hasDoctype: /<!DOCTYPE html>/i.test(html),
    hasRootDiv: /<div\s+id="root"/.test(html),
    hasMainScript: /<script\s+type="module"\s+src="\/src\/main\.tsx"/.test(html),
    title: html.match(/<title>([^<]+)<\/title>/)?.[1] || '(无 title)',
    charset: html.match(/charset="([^"]+)"/)?.[1] || '(无 charset)',
    viewport: html.match(/viewport"[^>]*content="([^"]+)"/)?.[1] || '(无 viewport)',
  };

  log('ok', 'HTML 解析完成', meta);
  return { html, meta };
}

// === 5. 启动浏览器执行端到端验证 ===
async function runBrowserEndToEnd(params, htmlMeta) {
  log('info', '=== 5. 启动浏览器执行端到端验证 ===');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
      log('warn', `[console.error] ${msg.text().substring(0, 150)}`);
    }
  });

  try {
    // 5.1 加载页面
    log('info', '[E2E] 导航到首页');
    const navResp = await page.goto(params.homePage, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });
    log('ok', '[E2E] 页面加载完成', {
      status: navResp.status(),
      url: page.url(),
    });

    // 5.2 等待 React 挂载
    await new Promise((r) => setTimeout(r, 4000));

    // === 6. 业务校验 ===
    log('info', '=== 6. 执行业务校验 ===');

    await check('HTML 包含 root div', async () => {
      const hasRoot = await page.evaluate(() => !!document.querySelector('#root'));
      if (!hasRoot) throw new Error('未找到 #root');
    });

    await check('HTML title 包含"瑶医"', async () => {
      const title = await page.title();
      if (!/瑶医/.test(title)) throw new Error(`title="${title}"`);
    });

    await check('页面包含 ChinaMap SVG', async () => {
      const svgCount = await page.evaluate(() => document.querySelectorAll('svg').length);
      if (svgCount === 0) throw new Error('无 SVG');
    });

    await check('MapBoard Leaflet 容器存在', async () => {
      const lc = await page.evaluate(() => !!document.querySelector('.leaflet-container'));
      if (!lc) throw new Error('无 .leaflet-container');
    });

    await check('MapBoard 容器宽度 > 0（避免坍缩）', async () => {
      const w = await page.evaluate(() => document.querySelector('.leaflet-container')?.offsetWidth || 0);
      if (w <= 0) throw new Error(`宽度=${w}`);
    });

    await check('MapBoard 容器高度 > 0（避免坍缩）', async () => {
      const h = await page.evaluate(() => document.querySelector('.leaflet-container')?.offsetHeight || 0);
      if (h <= 0) throw new Error(`高度=${h}`);
    });

    await check('Leaflet 实例已创建（window.__MAP_INSTANCE）', async () => {
      const hasInstance = await page.evaluate(() => !!window.__MAP_INSTANCE);
      if (!hasInstance) throw new Error('window.__MAP_INSTANCE 不存在');
    });

    await check('map center 在中国范围内', async () => {
      const c = await page.evaluate(() => {
        const m = window.__MAP_INSTANCE;
        return m ? { lat: m.getCenter().lat, lng: m.getCenter().lng } : null;
      });
      if (!c) throw new Error('map 不存在');
      if (c.lat < 16 || c.lat > 54 || c.lng < 73 || c.lng > 135) {
        throw new Error(`center 异常: lat=${c.lat}, lng=${c.lng}`);
      }
    });

    await check('map _mapPane 已创建（无销毁检测误报）', async () => {
      const hasPane = await page.evaluate(() => !!window.__MAP_INSTANCE?._mapPane);
      if (!hasPane) throw new Error('_mapPane 为 null（map 已销毁）');
    });

    await check('地图瓦片或兜底已渲染', async () => {
      const stat = await page.evaluate(() => ({
        tiles: document.querySelectorAll('.leaflet-tile').length,
        overlayPaths: document.querySelectorAll('.leaflet-overlay-pane svg path').length,
        markers: document.querySelectorAll('.leaflet-marker-icon').length,
      }));
      if (stat.tiles === 0 && stat.overlayPaths < 100 && stat.markers === 0) {
        throw new Error(`地图无任何渲染: ${JSON.stringify(stat)}`);
      }
      log('info', '渲染统计', stat);
    });

    await check('省级 SVG path 至少 30 个', async () => {
      const n = await page.evaluate(() => document.querySelectorAll('svg path').length);
      if (n < 30) throw new Error(`仅 ${n} 个 path`);
    });

    // === 7. 验证资源 HTTP 200 ===
    log('info', '=== 7. 验证关键地图资源 HTTP 200 ===');
    const resources = [
      ['map/100000.json', '国家级边界'],
      ['map/100000_full.json', '国家级含省级'],
      ['map/province/450000_full.json', '广西省 full'],
      ['map/city/450100.json', '南宁市'],
      ['map/county/450122.json', '武鸣县'],
      ['map/yao_counties_meta.json', '县级 metadata'],
      ['map/county-manifest.json', '县级 manifest'],
    ];

    for (const [path, label] of resources) {
      await check(`资源 ${label} (${path})`, async () => {
        const r = await fetch(`${BASE_URL}/${path}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
    }

    // === 8. 用户交互业务校验 ===
    log('info', '=== 8. 验证用户交互业务逻辑 ===');

    await check('点击省份触发事件', async () => {
      const result = await page.evaluate(() => {
        const paths = document.querySelectorAll('svg path');
        for (const p of paths) {
          const fill = p.getAttribute('fill');
          if (fill && fill !== '#f1f5f9' && fill !== 'none') {
            p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return { clicked: true, fill };
          }
        }
        return { clicked: false };
      });
      if (!result.clicked) throw new Error('未找到可点击省份');
      log('info', '点击详情', result);
    });

    await new Promise((r) => setTimeout(r, 500));

    await check('RegionPanel 弹窗显示（modal-layer opacity=1）', async () => {
      const opacity = await page.evaluate(() => {
        const el = document.querySelector('.modal-layer');
        return el ? getComputedStyle(el).opacity : null;
      });
      if (opacity !== '1') throw new Error(`opacity=${opacity}`);
    });

    // === 9. 验证 React Strict Mode 安全（无 appendChild 错误）===
    log('info', '=== 9. 验证 React Strict Mode 安全（3 次刷新无 appendChild 错误）===');
    const errorLog = [];
    page.on('pageerror', (e) => errorLog.push(e.message));

    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await new Promise((r) => setTimeout(r, 4000));
    }

    const appendChildErrors = errorLog.filter((m) => /appendChild/.test(m));
    await check('3 次刷新未产生 undefined.appendChild 错误', async () => {
      if (appendChildErrors.length > 0) throw new Error(`发现 ${appendChildErrors.length} 次 appendChild 错误`);
    });

    // === 10. 性能基线 ===
    log('info', '=== 10. 性能基线 ===');
    const before = await page.evaluate(() => ({
      domNodes: document.querySelectorAll('*').length,
      mem: performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0,
    }));

    for (let i = 0; i < 30; i++) {
      await page.evaluate((scrollY) => {
        const btns = document.querySelectorAll('button');
        if (btns.length > 0) btns[0].click();
        window.scrollTo(0, scrollY);
      }, i * 5);
      await new Promise((r) => setTimeout(r, 50));
    }

    const after = await page.evaluate(() => ({
      domNodes: document.querySelectorAll('*').length,
      mem: performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0,
    }));

    const memGrowth = after.mem - before.mem;
    await check('30 次操作后内存增长 < 10MB', async () => {
      if (memGrowth >= 10) throw new Error(`增长 ${memGrowth.toFixed(2)}MB`);
      log('info', '内存增长', { growthMB: memGrowth.toFixed(2) });
    });
  } finally {
    await browser.close();
  }
}

// === 主入口 ===
(async () => {
  console.log('========================================');
  console.log('  端到端请求验证（含指数退避重试）');
  console.log('========================================');
  console.log('');

  let fatalError;
  try {
    // 步骤 1: 参数核对
    const params = verifyRequestParams();

    // 步骤 2: 服务探测
    await probeTargetService(params);

    // 步骤 3: HTTP 请求（指数退避）
    const response = await fetchHomePage(params);

    // 步骤 4: HTML 解析
    const { meta } = await fetchHtmlContent(params);

    // 步骤 5-10: 业务校验
    await runBrowserEndToEnd(params, meta);
  } catch (e) {
    fatalError = e;
    log('error', '严重错误', { error: e.message, stack: e.stack });
  }

  // === 输出汇总 ===
  console.log('\n========================================');
  console.log('  执行日志汇总');
  console.log('========================================');

  const passed = businessChecks.filter((c) => c.passed).length;
  const failed = businessChecks.filter((c) => !c.passed).length;
  const total = businessChecks.length;

  console.log(`\n业务校验: ${passed}/${total} 通过`);
  if (failed > 0) {
    console.log('\n失败项:');
    businessChecks.filter((c) => !c.passed).forEach((c) => {
      console.log(`  ✗ ${c.name}: ${c.error}`);
    });
  }

  console.log(`\n日志总数: ${logs.length}`);
  const errLogs = logs.filter((l) => l.level === 'error').length;
  const warnLogs = logs.filter((l) => l.level === 'warn').length;
  console.log(`  - 错误: ${errLogs}`);
  console.log(`  - 警告: ${warnLogs}`);

  // 保存完整日志
  writeFileSync(
    'scripts/e2e-verify-report.json',
    JSON.stringify({
      summary: {
        totalChecks: total,
        passed,
        failed,
        fatalError: fatalError ? { message: fatalError.message, stack: fatalError.stack } : null,
        generatedAt: new Date().toISOString(),
      },
      businessChecks,
      logs,
    }, null, 2)
  );
  console.log('\n完整报告已保存到: scripts/e2e-verify-report.json');

  process.exit(failed === 0 && !fatalError ? 0 : 1);
})();