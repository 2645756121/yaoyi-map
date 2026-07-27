/**
 * 点击交互流畅性测试（简化版）
 *
 * 前置：dev server 监听 5184 端口
 */

import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5184/';

console.log('=== 点击交互流畅性测试 ===\n');

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1600 });

const logs = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') logs.push(`[error] ${msg.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

console.log('加载页面...');
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
await new Promise((r) => setTimeout(r, 6000));

let passCount = 0;
let failCount = 0;

function check(label, ok) {
  if (ok) {
    passCount++;
    console.log(`  ✓ ${label}`);
  } else {
    failCount++;
    console.log(`  ✗ ${label}`);
  }
}

// 测试 1：触发点击打开弹窗
console.log('\n[1] 模拟点击金秀瑶族自治县 (code=451324)');
const r1 = await page.evaluate(() => {
  window.dispatchEvent(
    new CustomEvent('yao-county-click', {
      detail: { code: '451324', name: '金秀瑶族自治县' },
    })
  );
  return true;
});
await new Promise((r) => setTimeout(r, 600));

const modalState = await page.evaluate(() => {
  const m = document.querySelector('.modal-layer-high');
  if (!m) return null;
  return {
    visible: !m.classList.contains('opacity-0') && !m.classList.contains('pointer-events-none'),
    title: m.querySelector('h2')?.textContent?.trim() ?? null,
    text: m.textContent ?? '',
  };
});

if (!modalState) {
  check('弹窗 DOM 存在', false);
} else {
  check('弹窗可见', modalState.visible);
  check(`标题为"${modalState.title}"`, modalState.title === '金秀瑶族自治县');
  check('显示省份（广西）', modalState.text.includes('广西'));
  check('显示特有瑶药资源章节', modalState.text.includes('当地特有瑶药资源'));
  check('含瑶山杜鹃药材', modalState.text.includes('瑶山杜鹃'));
  check('含七叶一枝花药材', modalState.text.includes('七叶一枝花'));
  check('含采集方法论', modalState.text.includes('采集方法论'));
  check('含临床应用案例', modalState.text.includes('临床应用案例'));
  check('含传承保护现状', modalState.text.includes('传承保护现状'));
  check('含当前挑战', modalState.text.includes('当前挑战'));
  check('含代表性医疗机构', modalState.text.includes('代表性医疗机构'));
}

// 测试 2：关闭按钮
console.log('\n[2] 点击关闭按钮');
await page.evaluate(() => {
  const m = document.querySelector('.modal-layer-high');
  const b = m?.querySelector('button[aria-label*="关闭"]');
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 400));
const closed = await page.evaluate(() => {
  const m = document.querySelector('.modal-layer-high');
  return m?.classList.contains('opacity-0') ?? true;
});
check('弹窗关闭', closed);

// 测试 3：快速切换多个县（流畅性）
console.log('\n[3] 快速切换 4 个县的弹窗（响应时间）');
const codes = ['451324', '451228', '441825', '431322'];
const times = [];
for (const c of codes) {
  const t0 = Date.now();
  await page.evaluate((code) => {
    window.dispatchEvent(
      new CustomEvent('yao-county-click', {
        detail: { code, name: code },
      })
    );
  }, c);
  // 等待弹窗可见
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 20));
    const visible = await page.evaluate(() => {
      const m = document.querySelector('.modal-layer-high');
      return m && !m.classList.contains('opacity-0') && !m.classList.contains('pointer-events-none');
    });
    if (visible) break;
  }
  const t1 = Date.now();
  times.push(t1 - t0);
  // 关闭
  await page.evaluate(() => {
    const m = document.querySelector('.modal-layer-high');
    const b = m?.querySelector('button[aria-label*="关闭"]');
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 100));
}
const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0);
const maxTime = Math.max(...times);
console.log(`  响应时间: ${times.map((t) => `${t}ms`).join(', ')}`);
console.log(`  平均: ${avgTime}ms, 最大: ${maxTime}ms`);
check(`平均响应时间 < 500ms (${avgTime}ms)`, parseInt(avgTime) < 500);

// 测试 4：已补全资料的小县（任意选一个 45xxxx 开头的扩展项）
console.log('\n[4] 验证自动生成的扩展资料（451302 县）');
await page.evaluate(() => {
  window.dispatchEvent(
    new CustomEvent('yao-county-click', {
      detail: { code: '451302', name: '象州县' },
    })
  );
});
await new Promise((r) => setTimeout(r, 500));
const autoGen = await page.evaluate(() => {
  const m = document.querySelector('.modal-layer-high');
  if (!m) return null;
  const t = m.textContent ?? '';
  return {
    title: m.querySelector('h2')?.textContent?.trim(),
    hasHerbSection: t.includes('当地特有瑶药资源'),
    hasMethodology: t.includes('采集方法论'),
    hasHeritage: t.includes('传承保护现状'),
    hasChallenge: t.includes('当前挑战'),
  };
});
check('自动生成扩展资料加载成功', !!autoGen);
if (autoGen) {
  check(`  - 标题: ${autoGen.title}`, autoGen.title?.length > 0);
  check('  - 含特有瑶药章节', autoGen.hasHerbSection);
  check('  - 含采集方法论', autoGen.hasMethodology);
  check('  - 含传承保护', autoGen.hasHeritage);
  check('  - 含当前挑战', autoGen.hasChallenge);
}

console.log('\n=== 错误日志 ===');
if (logs.length === 0) {
  console.log('  ✓ 无错误日志');
} else {
  for (const l of logs) console.log('  ' + l);
}

console.log('\n=== 汇总 ===');
console.log(`通过: ${passCount}`);
console.log(`失败: ${failCount}`);
console.log(`总测试项: ${passCount + failCount}`);

await browser.close();
process.exit(failCount > 0 ? 1 : 0);