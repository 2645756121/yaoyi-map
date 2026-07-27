/**
 * 布局专项测试：验证本次 UI 调整是否正确落地
 *
 * 检查项：
 *   1. HerbCatalog.tsx 不再含 fixed 吸顶定位
 *   2. HerbCatalog.tsx 缩略图已缩小到 w-6 h-6 (24px, 30% reduction from 36px)
 *   3. HerbCatalog.tsx 缩略图保持 aspect-square 1:1 宽高比
 *   4. Home.tsx main 使用 min-height 而非固定 height
 *   5. Home.tsx HerbCatalog 在 main 之后渲染（普通流位置）
 *   6. 确认 main 高度策略可让 body 滚动条出现（页面高于视口）
 *
 * 运行方式： node scripts/layout-test.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const herbCatalogSrc = readFileSync(
  resolve(__dirname, '../src/components/HerbCatalog/HerbCatalog.tsx'),
  'utf8'
);
const homeSrc = readFileSync(resolve(__dirname, '../src/pages/Home.tsx'), 'utf8');

const results = [];
const log = (name, passed, detail = '') => results.push({ name, passed, detail });

function check(label, fn) {
  try {
    fn();
    log(label, true);
  } catch (e) {
    log(label, false, e.message);
  }
}

// === 1. HerbCatalog.tsx 不再含 fixed 吸顶定位 ===
check('HerbCatalog 触发按钮已移除 fixed 定位', () => {
  if (/fixed\s+(?:right-4|top-20|top-24)/.test(herbCatalogSrc)) {
    throw new Error('仍含 fixed right-4 top-20 等吸顶定位类');
  }
});

check('HerbCatalog 触发按钮已使用普通文档流容器', () => {
  if (!/justify-end\s+px-4\s+py-3/.test(herbCatalogSrc)) {
    throw new Error('未找到普通流容器类');
  }
});

check('HerbCatalog 触发按钮已使用 inline-flex 而非 fixed', () => {
  // inline-flex 是普通流的弹性盒模型；fixed 是固定定位
  if (!/inline-flex/.test(herbCatalogSrc)) {
    throw new Error('未使用 inline-flex');
  }
});

// === 2. 缩略图尺寸按比例缩小 30% ===
check('缩略图已从 w-9 h-9 (36×36px) 缩小到 w-6 h-6 (24×24px)', () => {
  // w-6 h-6 = 24px, w-9 h-9 = 36px → 24/36 ≈ 66.7% (即缩小 33%)
  if (!/w-6\s+h-6\s+rounded-md/.test(herbCatalogSrc)) {
    throw new Error('未使用 w-6 h-6 rounded-md 缩略图');
  }
  if (/w-9\s+h-9\s+rounded-lg\s+bg-gradient-to-br/.test(herbCatalogSrc)) {
    throw new Error('仍存在原始 w-9 h-9 缩略图');
  }
});

check('Leaf 占位图标已从 w-4 h-4 缩小到 w-3 h-3', () => {
  // Leaf 图标 12px（原 16px，缩小 25%）
  if (!/Leaf\s+className="w-3\s+h-3/.test(herbCatalogSrc)) {
    throw new Error('Leaf 图标未缩小');
  }
});

// === 3. 缩略图保持 1:1 宽高比 ===
check('缩略图包含 aspect-square 类保证 1:1 比例', () => {
  if (!/aspect-square/.test(herbCatalogSrc)) {
    throw new Error('未使用 aspect-square 保证宽高比');
  }
});

// === 4. Home.tsx main 使用 min-height ===
check('Home.tsx main 已使用 min-height 而非固定 height', () => {
  if (!/main[\s\S]*?minHeight:\s*['"]calc\(100vh\s*-\s*80px\)['"]/.test(homeSrc)) {
    throw new Error('main 未使用 min-height');
  }
  // 旧的固定 height 应该已被移除
  if (/main[\s\S]*?height:\s*['"]calc\(100vh\s*-\s*80px\)['"]/.test(homeSrc)) {
    throw new Error('main 仍含固定 height');
  }
});

check('Home.tsx 外层 div 使用 min-height: 100vh 以保证至少一屏高度', () => {
  if (!/minHeight:\s*['"]100vh['"]/.test(homeSrc)) {
    throw new Error('外层 div 未使用 min-height: 100vh');
  }
});

// === 5. HerbCatalog 在 main 之后渲染（普通流位置）===
check('Home.tsx HerbCatalog 在 main 之后渲染', () => {
  const mainIdx = homeSrc.indexOf('<main');
  const herbCatalogIdx = homeSrc.indexOf('<HerbCatalog');
  const regionPanelIdx = homeSrc.indexOf('<RegionPanel');
  if (mainIdx === -1) throw new Error('未找到 <main>');
  if (herbCatalogIdx === -1) throw new Error('未找到 <HerbCatalog />');
  if (regionPanelIdx === -1) throw new Error('未找到 <RegionPanel />');
  if (!(mainIdx < herbCatalogIdx)) {
    throw new Error('HerbCatalog 应在 main 之后');
  }
  if (!(herbCatalogIdx < regionPanelIdx)) {
    throw new Error('HerbCatalog 应在 RegionPanel 之前');
  }
});

// === 6. 整体页面可滚动（main 内容超出视口时触发 body 滚动）===
check('Home.tsx 外层 div 移除了 min-h-screen（已被 minHeight 替代）', () => {
  if (/min-h-screen/.test(homeSrc)) {
    throw new Error('外层仍使用 min-h-screen 类');
  }
});

check('Home.tsx 内层地图容器使用 flex 自适应高度', () => {
  if (!/flex:\s*['"]1 1 auto['"]/.test(homeSrc)) {
    throw new Error('内层未使用 flex 自适应');
  }
});

// === 7. CSS 产物应包含新类 ===
const cssPath = resolve(__dirname, '../src/index.css');
const cssSrc = readFileSync(cssPath, 'utf8');
check('CSS 中保留 .text-indent 类（带正确注释）', () => {
  // CSS 中应保留 text-indent 但有注释说明
  if (!/\.text-indent\s*\{/.test(cssSrc)) {
    throw new Error('CSS 中 .text-indent 类缺失');
  }
});

// === 输出 ===
const passed = results.filter((r) => r.passed).length;
const total = results.length;

console.log('\n=== Layout Test Results ===');
results.forEach((r) => {
  const icon = r.passed ? '[OK]' : '[FAIL]';
  const line = `${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`;
  console.log(line);
});
console.log(`\n${passed}/${total} passed\n`);

if (passed !== total) process.exit(1);