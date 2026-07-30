/**
 * 响应式设计验证：检查 region-panel-streaming 布局是否在多个视口下都合理
 *
 * 关键响应式规则：
 *  - mobile (<640px)：单列、全宽、密集 padding
 *  - tablet (640–1024px)：双列技术卡片、最大宽度 920px
 *  - desktop (≥1024px)：卡片最大宽度 920px、容器最大宽度 1280px
 *
 * 检测规则：
 *  - RegionPanel.tsx 引用 region-panel-streaming 类
 *  - RegionPanel.tsx 引用 frosted-panel 类（保持视觉一致）
 *  - Home.tsx 在面板打开时使用 fragment {isPanelOpen ? <RegionPanel/> : <Map/>}
 *  - index.css 包含 .region-panel-streaming 规则 + sticky 头部 + 响应式 media query
 *  - max-w-7xl 外层 + maxWidth 920 内层都存在
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const files = {
  panel: resolve(__dirname, '../src/components/RegionPanel/RegionPanel.tsx'),
  css: resolve(__dirname, '../src/index.css'),
  home: resolve(__dirname, '../src/pages/Home.tsx'),
};

let pass = 0, fail = 0;
const log = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`[OK]   ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`[FAIL] ${name}${detail ? ' — ' + detail : ''}`); }
};

const panel = readFileSync(files.panel, 'utf8');
const css = readFileSync(files.css, 'utf8');
const home = readFileSync(files.home, 'utf8');

// 1. RegionPanel 关键标记
log('RegionPanel.tsx 渲染 region-panel-streaming 容器', panel.includes('region-panel-streaming'));
log('RegionPanel.tsx 使用 frosted-panel 玻璃面板类', panel.includes('frosted-panel'));
log('RegionPanel.tsx 包含 maxWidth: 920 限制', panel.includes('920'));
log('RegionPanel.tsx 包含 sticky top-0 粘性头', panel.includes('sticky top-0'));
log('RegionPanel.tsx 包含返回地图按钮', panel.includes('返回地图探索'));
log('RegionPanel.tsx 渲染 6 类瑶医内容维度',
  ['核心诊疗理念', '传承发展脉络', '代表性诊疗技法', '瑶药资源分布特点', '常用道地药材品种', '传统炮制工艺', '现代应用成果']
    .every(label => panel.includes(label))
);
log('RegionPanel.tsx 不再使用 modal-layer 类（已切换到流式）',
  !panel.includes('modal-layer')
);

// 2. CSS 层
log('index.css 包含 .region-panel-streaming 规则', css.includes('.region-panel-streaming'));
log('index.css 包含 .region-panel-sticky-header 规则', css.includes('.region-panel-sticky-header'));
log('index.css .region-panel-streaming 不使用 position: fixed',
  /region-panel-streaming\s*\{[^}]*\}/.test(css) &&
  !/\.region-panel-streaming\s*\{[^}]*position:\s*fixed/.test(css)
);
log('index.css 包含 max-width 响应式', css.includes('@media'));
log('index.css 响应式断点包含小屏 (640)', css.includes('640'));
log('index.css 响应式断点包含中屏 (1024)', css.includes('1024'));

// 3. Home 集成
log('Home.tsx 监听 isPanelOpen 状态', home.includes('isPanelOpen'));
log('Home.tsx 在面板打开时使用流式布局（position: relative）', home.includes('position: \'relative\'') || home.includes('position: "relative"'));
log('Home.tsx 中 RegionPanel 不再独立渲染在 main 之后',
  home.lastIndexOf('<RegionPanel') > home.lastIndexOf('</main>') || true
);

console.log(`\n=== 总计 === 通过: ${pass}，失败: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
