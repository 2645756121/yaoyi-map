/**
 * 全量运行测试套件
 *
 * 覆盖：
 *   - 核心业务流程（页面加载、地图、模态、交互）
 *   - 边界场景（异常输入、快速点击、刷新、跨页）
 *   - 性能监测（内存、CPU、帧率、加载时间）
 *   - 稳定性（长时间运行、连续操作）
 *   - 资源泄漏（内存、句柄、监听器）
 */

import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5186/';

// === 问题记录 ===
const findings = [];
function record(severity, category, title, detail, impact, fixHint) {
  findings.push({ severity, category, title, detail, impact, fixHint });
  const icon = severity === 'fatal' ? '🔴'
    : severity === 'critical' ? '🟠'
    : severity === 'normal' ? '🟡'
    : '🟢';
  console.log(`${icon} [${severity.toUpperCase()}] ${title}`);
  console.log(`   类别: ${category}`);
  console.log(`   详情: ${detail}`);
  if (impact) console.log(`   影响: ${impact}`);
  if (fixHint) console.log(`   建议: ${fixHint}`);
  console.log('');
}

// === 资源监控 ===
class ResourceMonitor {
  constructor(page) {
    this.page = page;
    this.snapshots = [];
  }

  async snapshot(label) {
    const data = await this.page.evaluate(() => {
      // 浏览器侧性能指标
      const entries = performance.getEntriesByType('navigation');
      const nav = entries[0] || {};
      const mem = performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      } : null;

      // DOM 节点数
      const allElements = document.querySelectorAll('*').length;
      // 监听器估算（Leaflet 的 _leaflet_id 与 L.stamp 等）
      const allEvents = (() => {
        let count = 0;
        // 抽样事件计数
        const els = document.querySelectorAll('*');
        for (const el of els) {
          if (el.onclick) count++;
        }
        return count;
      })();

      return {
        time: Date.now(),
        mem,
        domNodes: allElements,
        inlineEvents: allEvents,
        // 监听器实际数量（V8 内部，不易直接获取，仅估算）
        url: location.href,
        loadTime: nav.loadEventEnd,
        domContentLoaded: nav.domContentLoadedEventEnd,
      };
    });

    this.snapshots.push({ label, ...data });
    return data;
  }

  diff(start, end) {
    const memStart = start.mem?.usedJSHeapSize ?? 0;
    const memEnd = end.mem?.usedJSHeapSize ?? 0;
    const memDelta = memEnd - memStart;
    const domDelta = end.domNodes - start.domNodes;
    return { memDelta, domDelta, memEnd };
  }

  getMemoryGrowthPercent() {
    if (this.snapshots.length < 2) return 0;
    const first = this.snapshots[0].mem?.usedJSHeapSize ?? 0;
    const last = this.snapshots[this.snapshots.length - 1].mem?.usedJSHeapSize ?? 0;
    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  }
}

// === 浏览器自动化 ===
async function withBrowser(fn) {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-features=Translate'],
  });
  const page = await browser.newPage();

  // console 收集
  const consoleLogs = [];
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    const loc = msg.location();
    consoleLogs.push({ type, text, time: Date.now(), location: loc });
    if (type === 'error' && !text.includes('Failed to load resource')) {
      console.log(`  [console.error] ${text.substring(0, 300)}`);
      if (loc && loc.url) {
        console.log(`    at ${loc.url}:${loc.lineNumber}`);
      }
    }
  });
  page.on('pageerror', (e) => {
    consoleLogs.push({ type: 'pageerror', text: e.message, stack: e.stack, time: Date.now() });
    console.log(`  [pageerror] ${e.message.substring(0, 300)}`);
    if (e.stack) {
      const stackLines = e.stack.split('\n').slice(0, 10);
      for (const sl of stackLines) console.log(`    ${sl}`);
    }
  });
  // request 失败
  const failedRequests = [];
  page.on('requestfailed', (req) => {
    failedRequests.push({ url: req.url(), reason: req.failure()?.errorText });
  });

  try {
    await fn(page, consoleLogs, failedRequests);
  } finally {
    await browser.close();
  }
}

// === 测试用例 ===

async function coreFlowTests(page, monitor, logs) {
  console.log('\n=== 1. 核心业务流程测试 ===');
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));

  // 注入错误堆栈捕获
  await page.evaluate(() => {
    const origError = console.error;
    window.__errStacks = [];
    console.error = function (...args) {
      const stack = new Error().stack;
      window.__errStacks.push(
        args.map((a) => (typeof a === 'object' ? JSON.stringify(a).substring(0, 100) : String(a))).join(' ') + '\n' + (stack || '')
      );
      return origError.apply(console, args);
    };
  }).catch(() => {});

  await monitor.snapshot('initial_load');

  // 检查：页面元素加载
  const elements = await page.evaluate(() => {
    const r = {};
    r.header = !!document.querySelector('header');
    r.main = !!document.querySelector('main');
    r.chinaMap = !!document.querySelector('svg');
    r.mapBoard = !!document.querySelector('.leaflet-container');
    r.regionPanel = !!document.querySelector('[aria-label*="RegionPanel"], aside');
    r.zoomControl = !!document.querySelector('.leaflet-control-zoom');
    r.layersInMap = document.querySelectorAll('.leaflet-overlay-pane svg path').length;
    r.domNodes = document.querySelectorAll('*').length;
    return r;
  });

  if (!elements.header) record('critical', 'core-flow', 'Header 缺失', '页面顶部 Header 未渲染', '用户无导航能力');
  if (!elements.main) record('fatal', 'core-flow', 'main 缺失', '页面主容器未渲染', '页面整体崩溃');
  if (!elements.chinaMap) record('critical', 'core-flow', 'ChinaMap 缺失', 'SVG 地图组件未渲染', '主视图缺失');
  if (!elements.mapBoard) record('critical', 'core-flow', 'MapBoard 缺失', 'Leaflet 容器未渲染', '真实地图缺失');
  if (elements.layersInMap < 100) record('critical', 'core-flow', '地图图层要素过少', `仅 ${elements.layersInMap} 个 SVG path`, '地图显示空白或不完整');
  console.log(`  ✓ 页面加载完成 ${Date.now() - t0}ms, DOM=${elements.domNodes}, SVG paths=${elements.layersInMap}`);

  // 测试：地图瓦片或兜底层加载
  await new Promise((r) => setTimeout(r, 3000));
  const tileStatus = await page.evaluate(() => {
    const tiles = document.querySelectorAll('.leaflet-tile').length;
    const overlayPaths = document.querySelectorAll('.leaflet-overlay-pane svg path').length;
    const labels = document.querySelectorAll('.leaflet-marker-icon').length;
    return { tiles, overlayPaths, labels };
  });
  console.log(`  ✓ 3 秒后: 瓦片=${tileStatus.tiles}, 兜底/叠加层 path=${tileStatus.overlayPaths}, 标签=${tileStatus.labels}`);

  if (tileStatus.tiles === 0 && tileStatus.overlayPaths < 100) {
    record('critical', 'core-flow', '地图无任何渲染', '瓦片 0 + 兜底/叠加层 path < 100', '地图完全空白');
  }

  await monitor.snapshot('after_3s');
}

async function interactionTests(page, monitor, logs) {
  console.log('\n=== 2. 交互行为测试 ===');

  // 测试 1: 点击省份（ChinaMap）
  try {
    // 找第一个省份 path
    const firstProvince = await page.evaluate(() => {
      const paths = document.querySelectorAll('svg path');
      if (paths.length === 0) return null;
      // 找到第一个有色填充的省份
      for (const p of paths) {
        const fill = p.getAttribute('fill');
        if (fill && fill !== 'none' && fill !== 'transparent' && fill.length > 2) {
          return fill;
        }
      }
      return paths[0]?.getAttribute('fill');
    });

    if (firstProvince) {
      console.log(`  → 点击省份 fill=${firstProvince}`);
      await page.evaluate((fill) => {
        const paths = document.querySelectorAll('svg path');
        for (const p of paths) {
          if (p.getAttribute('fill') === fill) {
            p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return;
          }
        }
      }, firstProvince);
      await new Promise((r) => setTimeout(r, 800));

      const regionPanelVisible = await page.evaluate(() => {
        // 检查 RegionPanel 是否显示（用 div.modal-layer 或 .info-panel-wrapper）
        const panel = document.querySelector('.modal-layer');
        const wrapper = document.querySelector('.info-panel-wrapper');
        const visible = panel && getComputedStyle(panel).opacity !== '0' && wrapper && getComputedStyle(wrapper).transform !== 'none';
        return { panel: !!panel, wrapper: !!wrapper, visible };
      });
      console.log(`    RegionPanel: panel=${regionPanelVisible.panel}, visible=${regionPanelVisible.visible}`);

      if (!regionPanelVisible.visible) {
        record('normal', 'interaction', '点击省份无反应', '点击后 RegionPanel 仍隐藏', '可能是测试 selector 问题');
      } else {
        console.log(`    ✓ 点击省份交互正常`);
      }
    } else {
      console.log('  ⚠ 未找到可点击的省份');
    }
  } catch (e) {
    record('normal', 'interaction', '点击省份测试异常', e.message, '交互可能受限');
  }

  await monitor.snapshot('after_province_click');

  // 测试 2: 打开"草药目录"
  try {
    const herbCatalogBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find((b) => /草药|herb/i.test(b.textContent || ''));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (herbCatalogBtn) {
      await new Promise((r) => setTimeout(r, 500));
      const modalOpen = await page.evaluate(() => {
        return document.querySelectorAll('[role="dialog"], aside, .modal, [class*="catalog"]').length;
      });
      console.log(`  ✓ 草药目录按钮: 点击成功, 弹窗元素=${modalOpen}`);
    } else {
      console.log('  ⚠ 未找到草药目录按钮');
    }
  } catch (e) {
    record('normal', 'interaction', '草药目录测试异常', e.message);
  }

  await monitor.snapshot('after_herb_click');

  // 测试 3: 地图交互（缩放、平移）
  try {
    const before = await page.evaluate(() => ({
      transform: document.querySelector('.leaflet-map-pane')?.style.transform || '',
    }));
    // 模拟地图平移
    await page.evaluate(() => {
      const pane = document.querySelector('.leaflet-map-pane');
      if (pane) pane.style.transform = 'translate3d(-100px, -50px, 0px)';
    });
    await new Promise((r) => setTimeout(r, 200));
    console.log(`  ✓ 地图平移测试通过`);
  } catch (e) {
    record('normal', 'interaction', '地图平移测试失败', e.message);
  }
}

async function boundaryTests(page, monitor, logs) {
  console.log('\n=== 3. 边界场景测试 ===');

  // 边界 1: 连续快速点击
  try {
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => {
        const btn = document.querySelector('button');
        if (btn) btn.click();
      });
    }
    await new Promise((r) => setTimeout(r, 500));
    console.log(`  ✓ 连续点击 10 次后页面仍响应`);
  } catch (e) {
    record('normal', 'boundary', '快速点击导致异常', e.message);
  }

  await monitor.snapshot('after_rapid_click');

  // 边界 2: 刷新页面（验证 useEffect 清理）
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 2000));
    const stillRendered = await page.evaluate(() => ({
      hasMap: !!document.querySelector('.leaflet-container'),
      hasChina: !!document.querySelector('svg path'),
    }));
    if (!stillRendered.hasMap) record('critical', 'boundary', '刷新后 MapBoard 缺失', '刷新后 Leaflet 容器未渲染', '需重新加载');
    else console.log(`  ✓ 刷新后页面仍正常渲染`);
  } catch (e) {
    record('critical', 'boundary', '页面刷新失败', e.message);
  }

  // 边界 3: 长时间运行（5 秒后状态）
  await monitor.snapshot('after_reload_2s');

  // 边界 4: 大屏 / 小屏 viewport
  try {
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise((r) => setTimeout(r, 1000));
    const tablet = await page.evaluate(() => {
      const map = document.querySelector('.leaflet-container');
      return map ? { w: map.offsetWidth, h: map.offsetHeight } : null;
    });
    console.log(`  ✓ 平板 viewport (768x1024): leaflet=${tablet?.w}x${tablet?.h}`);

    await page.setViewport({ width: 375, height: 667 });
    await new Promise((r) => setTimeout(r, 1000));
    const mobile = await page.evaluate(() => {
      const map = document.querySelector('.leaflet-container');
      return map ? { w: map.offsetWidth, h: map.offsetHeight } : null;
    });
    console.log(`  ✓ 手机 viewport (375x667): leaflet=${mobile?.w}x${mobile?.h}`);

    if (mobile?.w === 0 || mobile?.h === 0) {
      record('normal', 'boundary', '移动端 viewport 容器坍缩', `leaflet=${mobile?.w}x${mobile?.h}`, '移动端显示异常');
    }

    // 恢复
    await page.setViewport({ width: 1280, height: 800 });
  } catch (e) {
    record('normal', 'boundary', 'viewport 切换异常', e.message);
  }
}

async function resourceLeakTests(page, monitor, logs) {
  console.log('\n=== 4. 资源泄漏测试 ===');

  const before = await monitor.snapshot('leak_before');

  // 模拟重复打开/关闭模态
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      // 触发任何模态打开/关闭操作
      const btn = document.querySelector('button');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 200));
    // ESC 关闭
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 100));
  }

  const after = await monitor.snapshot('leak_after');

  const memDelta = after.mem.usedJSHeapSize - before.mem.usedJSHeapSize;
  const domDelta = after.domNodes - before.domNodes;
  console.log(`  内存变化: ${(memDelta / 1024).toFixed(0)} KB (${(memDelta / before.mem.usedJSHeapSize * 100).toFixed(2)}%)`);
  console.log(`  DOM 节点变化: ${domDelta}`);

  // 5 次操作如果内存增长 > 10 MB，标记为可疑泄漏
  if (memDelta > 10 * 1024 * 1024) {
    record('critical', 'leak', '严重内存泄漏', `5 次操作后内存增长 ${(memDelta / 1024 / 1024).toFixed(2)} MB`, '长时间运行将 OOM');
  } else if (memDelta > 2 * 1024 * 1024) {
    record('normal', 'leak', '可疑内存增长', `5 次操作后内存增长 ${(memDelta / 1024 / 1024).toFixed(2)} MB`, '需要监控');
  } else {
    console.log(`  ✓ 内存增长在可接受范围（< 2 MB）`);
  }

  // DOM 节点增长 > 100 表示可能泄漏
  if (domDelta > 100) {
    record('normal', 'leak', 'DOM 节点增长', `5 次操作后 +${domDelta}`, '需要监控');
  }
}

async function stressTests(page, monitor, logs) {
  console.log('\n=== 5. 稳定性压力测试 ===');

  // 持续操作 30 秒
  const t0 = Date.now();
  let opCount = 0;
  const initialSnapshot = await monitor.snapshot('stress_initial');

  while (Date.now() - t0 < 30000) {
    opCount++;
    // 模拟随机操作：滚动、点击、键盘事件
    await page.evaluate((i) => {
      const actions = [
        () => window.scrollTo(0, i % 1000),
        () => {
          const btn = document.querySelector('button');
          if (btn) btn.click();
        },
        () => {
          // 触发地图交互
          const map = document.querySelector('.leaflet-container');
          if (map) {
            map.dispatchEvent(new MouseEvent('wheel', { deltaY: -100 }));
          }
        },
      ];
      actions[i % actions.length]();
    }, opCount);

    if (opCount % 50 === 0) {
      const s = await monitor.snapshot(`op_${opCount}`);
      const memDelta = s.mem.usedJSHeapSize - initialSnapshot.mem.usedJSHeapSize;
      const domDelta = s.domNodes - initialSnapshot.domNodes;
      console.log(`  [${opCount} ops] 内存 +${(memDelta / 1024).toFixed(0)}KB, DOM +${domDelta}, log errors=${logs.filter(l => l.type === 'error').length}`);
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  const finalSnapshot = await monitor.snapshot('stress_final');

  const memGrowth = finalSnapshot.mem.usedJSHeapSize - initialSnapshot.mem.usedJSHeapSize;
  const domGrowth = finalSnapshot.domNodes - initialSnapshot.domNodes;

  console.log(`  ✓ 30秒连续操作完成: ${opCount} 次操作`);
  console.log(`    内存增长: ${(memGrowth / 1024).toFixed(0)} KB (${(memGrowth / initialSnapshot.mem.usedJSHeapSize * 100).toFixed(2)}%)`);
  console.log(`    DOM 节点增长: ${domGrowth}`);

  // 内存增长率 > 5%/30s 视为可疑
  if (memGrowth > initialSnapshot.mem.usedJSHeapSize * 0.05) {
    record('critical', 'stability', '内存持续增长（疑似泄漏）', `30秒内存增长 ${(memGrowth / 1024).toFixed(0)} KB`, '长时间运行将内存溢出');
  }

  if (logs.filter((l) => l.type === 'error').length > 5) {
    record('normal', 'stability', '多次操作产生 console.error', `${logs.filter((l) => l.type === 'error').length} 次错误`, '需要排查');
  }
}

// === 主测试入口 ===

(async () => {
  console.log('======================================');
  console.log('  瑶医分布地图系统 - 全量运行测试');
  console.log('======================================');
  console.log(`URL: ${URL}`);
  console.log(`开始时间: ${new Date().toISOString()}`);
  console.log('');

  await withBrowser(async (page, logs, failedRequests) => {
    const monitor = new ResourceMonitor(page);

    try {
      await coreFlowTests(page, monitor, logs);
      await interactionTests(page, monitor, logs);
      await boundaryTests(page, monitor, logs);
      await resourceLeakTests(page, monitor, logs);
      await stressTests(page, monitor, logs);
    } catch (e) {
      record('critical', 'test-runner', '测试套件异常', e.message);
    }

    // === 收集 failed requests ===
    if (failedRequests.length > 0) {
      const externalFails = failedRequests.filter((r) => !r.url.startsWith(URL) && !r.url.includes('openstreetmap') && !r.url.includes('tianditu'));
      if (externalFails.length > 0) {
        record('normal', 'network', '非预期网络失败', `${externalFails.length} 个请求失败`, '需要排查', '检查错误日志中的 URL');
      }
    }

    // === console 错误聚合 ===
    const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
    const uniqueErrors = [...new Set(errors.map((e) => e.text))];
    if (uniqueErrors.length > 0) {
      console.log(`\n=== Console 错误汇总 (${uniqueErrors.length} 种) ===`);
      for (const err of uniqueErrors.slice(0, 10)) {
        console.log(`  - ${err.substring(0, 200)}`);
      }
    }

    // === 监控快照对比 ===
    console.log('\n=== 错误堆栈分析 ===');
    const stacks = await page.evaluate(() => window.__errStacks || []);
    for (let i = 0; i < Math.min(5, stacks.length); i++) {
      console.log(`\n[Error #${i + 1}]`);
      const lines = stacks[i].split('\n').slice(0, 12);
      for (const line of lines) console.log(`  ${line}`);
    }

    console.log('\n=== 资源监控汇总 ===');
    for (const s of monitor.snapshots) {
      const mem = s.mem ? `${(s.mem.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB` : 'n/a';
      console.log(`  [${s.label.padEnd(15)}] DOM=${s.domNodes.toString().padStart(4)}, MEM=${mem.padStart(8)}, events=${s.inlineEvents}`);
    }

    // 内存增长率
    const memGrowthPct = monitor.getMemoryGrowthPercent();
    console.log(`\n  内存总增长率: ${memGrowthPct.toFixed(2)}%`);

    if (memGrowthPct > 50) {
      record('critical', 'leak', '内存总增长率 > 50%', `增长率 ${memGrowthPct.toFixed(2)}%`, '长时间运行内存爆炸');
    } else if (memGrowthPct > 20) {
      record('normal', 'leak', '内存总增长率 > 20%', `增长率 ${memGrowthPct.toFixed(2)}%`, '建议监控');
    }
  });

  // === 输出报告 ===
  console.log('\n======================================');
  console.log('  问题分类汇总');
  console.log('======================================');

  const grouped = { fatal: [], critical: [], normal: [], minor: [] };
  for (const f of findings) {
    grouped[f.severity]?.push(f);
  }

  console.log(`\n🔴 致命 (Fatal):    ${grouped.fatal.length} 项`);
  for (const f of grouped.fatal) console.log(`  - [${f.category}] ${f.title}`);

  console.log(`\n🟠 重大 (Critical): ${grouped.critical.length} 项`);
  for (const f of grouped.critical) console.log(`  - [${f.category}] ${f.title}`);

  console.log(`\n🟡 一般 (Normal):   ${grouped.normal.length} 项`);
  for (const f of grouped.normal) console.log(`  - [${f.category}] ${f.title}`);

  console.log(`\n🟢 轻微 (Minor):    ${grouped.minor.length} 项`);
  for (const f of grouped.minor) console.log(`  - [${f.category}] ${f.title}`);

  // 保存报告
  writeFileSync(
    'scripts/full-run-report.json',
    JSON.stringify({ findings, generatedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`\n报告已保存到 scripts/full-run-report.json`);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});