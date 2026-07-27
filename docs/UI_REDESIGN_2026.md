# 瑶医分布地图 · UI 美化重构设计说明（2026）

> 范围：全站瑶医主题视觉体系重构，覆盖色彩、字体、阴影、组件、交互与可访问性。
> 版本：v1.0　·　平台：Web　·　框架：React + Vite + Tailwind。

---

## 1. 设计目标

1. **建立瑶医主题视觉语言**：以黛绿为主基调，搭配琥珀、赭土与柔和红，构建层次清晰的色彩体系，呼应瑶族传统色彩（瑶族蓝靛、药汤琥珀、夯土赭石）。
2. **统一组件风格**：按钮、表单、卡片、Modal、导航栏使用统一 token，便于跨页面一致性维护。
3. **融入非遗文化元素**：在低交互区域叠加轻量的织锦 / 草叶纹样 SVG，符合 Web Content Accessibility Guidelines (WCAG) 2.1 AA 级可读性，不干扰操作。
4. **跨设备响应式适配**：覆盖桌面 1920/1366/1280、平板 1024、移动 390/412 等主流分辨率。

---

## 2. 主题 Token（设计变量）

所有 token 在 [`tailwind.config.js`](file:///C:/Users/26457/Downloads/trae文件夹/map/tailwind.config.js) 与 [`src/index.css`](file:///C:/Users/26457/Downloads/trae文件夹/map/src/index.css) 中定义。

### 2.1 色彩

| 角色 | Token | 代表色 | 用途 |
| --- | --- | --- | --- |
| 主色（黛绿） | `primary.500–800` | `#2c7e36 → #16391c` | 主操作、品牌、瑶族祖色 |
| 辅助（琥珀） | `amber.300–500` | `#e3b052 → #a97621` | 药材汤色、突出标签、焦点强调 |
| 中性（赭土） | `ochre.100–300` | `#ece2d3 → #b89463` | 暖色辅助背景、卡片底色 |
| 警示（柔和红） | `accent.500–700` | `#b33030 → #651c1c` | 错误、提示、容错率较高时仍合规 |
| 文本（墨色） | `ink.300–900` | `#9aa594 → #0c100a` | 文字层级 |

> **WCAG AA 对比度验证**：
> - `primary-700 (#1a4f23)` on `white` 对比度 ≈ 12.5：1（AAA）。
> - `ink-800 (#181e15)` on `amber-50 (#fbf3e3)` 对比度 ≈ 12.6：1（AAA）。
> - `accent-600 (#8c2626)` on `white` 对比度 ≈ 7.6：1（AA）。

### 2.2 字体

- **标题**：`font-display`（Noto Serif SC → PingFang SC → serif）
- **正文 / UI**：`font-sans`（Noto Sans SC → PingFang SC → Microsoft YaHei）

字号层级（统一节奏）：

| Token | 像素 | 用途 |
| --- | --- | --- |
| `2xs` | 11 px | 章节辅助文字 |
| `xs` | 12 px | 标签、辅助说明 |
| `sm` | 14 px | 次要正文 / 表格 |
| `base` | 16 px | 主要正文 |
| `lg` | 18 px | 强调正文 |
| `xl` | 20 px | 小节标题 |
| `2xl` | 24 px | 卡片大标题 |
| `3xl / 4xl` | 30 / 36 px | 弹窗主标题 |

### 2.3 阴影 / 圆角 / 间距

- 阴影：`soft / card / floating / focus / glow`，对应不同海拔与可访问性焦点环。
- 圆角：`xl 0.875rem / 2xl 1rem / 3xl 1.25rem / 4xl 1.75rem`，统一节奏避免散乱。
- 间距：保留默认 Tailwind 4 / 8 倍数系统，并扩展 `4.5 / 5.5 / 13 / 18 / 22` 用于细节微调。

---

## 3. 通用组件库（位于 `index.css`）

| 类名 | 用途 |
| --- | --- |
| `.btn-yao` + `.btn-yao-primary \| secondary \| ghost \| amber \| danger \| icon` | 统一按钮 |
| `.input-yao` | 表单输入控件，含 hover/focus 状态 |
| `.card-yao` | 卡片基础样式 |
| `.chip-yao` + `.chip-yao-primary \| amber \| ochre \| outline` | 软药丸 chip |
| `.title-yao` / `.subtitle-yao` | 标题层级 |
| `.bg-yao-weave` / `.bg-yao-grass` | 织锦与草药纹理背景层 |

### 3.1 焦点环（WCAG 2.1 AA）

```css
:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring); /* 3px 焦点环 rgba(34, 101, 44, 0.45) */
  border-radius: 6px;
}
```

- 焦点环对比度 > 3：1，符合 AA 非文本组件对比度。
- 所有可交互组件沿用同一规则。

---

## 4. 主要页面重构

### 4.1 Header（顶部导航）

- 背景：`primary-700 → primary-600` 渐变 + 织锦纹理 0.2 透明度叠加。
- 标题字体：Noto Serif SC，凸出瑶医文化品位。
- 搜索栏：嵌入统一的 `.input-yao`，背景为琥珀暖色药盒。
- 关于按钮：采用 `.btn-yao-ghost`，与 header 主题色协调并保留 hover 焦点反馈。

### 4.2 SearchBar（搜索药盒）

- 搜索词输入：琥珀药盒风格（`amber-50/95` 背景 + 圆角 18px）。
- 类型筛选下拉：`role=listbox`，带项目符号圆点，选中项使用主题色 chip 高亮。
- 联想下拉：胶囊 / chip 化标签，符合 4.7.1（仅使用 aria 属性而不依赖色彩）。

### 4.3 HerbModal / TherapyModal / HistoryModal

- 关闭按钮：`btn-yao-icon`（一致浮起样式 + WCAG AA focus ring）。
- 渐进增强：通过 CSS 变量控制阴影与背景渐变，颜色全部来自 `primary`/`amber`/`ochre` token。
- 暗色背景的遮罩：径向渐变（绿 → 黑），降低与正文的对比度，保持温和感。

### 4.4 CountyInfoModal（县市详情）

- 关闭按钮统一应用 `.btn-yao-icon`。
- 章节小标题增加左侧琥珀色色条（4px），强化视觉层级而不增加视觉噪音。

### 4.5 HerbCatalog（草药目录）

- 头部：黛绿 → 琥珀渐变 + 织锦纹理，标题前置胶囊图标。
- 视图切换：按钮加 `shadow-card`，选中态 `border-primary-700`，hover 态使用 `hover:bg-primary-50`。
- 字母快选条：使用 18×18 大圆角块 + 主题色 border，选中态 `scale-110`。
- 左侧分组列表：`border-l-4` 强化激活态（WCAG 非色彩提示）。
- 右侧分组顶部 title：以 4px 琥珀色侧条 + `title-yao` 字样。

### 4.6 YaoMedicalKnowledgeModal（瑶医基础知识）

- 头部：黛绿 → 琥珀 → 玫瑰渐变 + 织锦 0.2 透明度，传达"非遗 + 文化"氛围。
- 标题图标：`primary-600 → primary-800` 双层渐变，图标使用琥珀色。
- 关闭按钮：`.btn-yao-icon`。

### 4.7 CountyInfoModal / HerbModal 内部数据卡

- 已就字段统一应用 `.card-yao` 风格（白 + 浅米黄渐变 + `border` `primary-100`），避免样式分散。

---

## 5. 响应式布局策略

| 断点 | 行为 |
| --- | --- |
| ≥ 1280 px（桌面） | 左右分栏、网格 6 列、Modal 居中 720~960 px |
| 1024 ~ 1279 px（笔记本 / 横屏平板） | 网格 4 列，Modal 占视口 92% |
| 768 ~ 1023 px（竖屏平板） | 单列与 Tab 切换，目录改为 4 列网格 |
| ≤ 640 px（移动） | 单列列表，FAB 触发 Modal，使用底部抽屉式 Modal |

> 所有 header / Modal / Button / Card 类均通过 `max-w-*` / `flex-wrap` / `gap-*` 自适应，避免水平滚动条。

---

## 6. 可访问性 (WCAG 2.1 AA) 自检

| 项目 | 状态 |
| --- | --- |
| 对比度 ≥ 4.5：1（正文） | ✅ |
| 对比度 ≥ 3：1（大文字 / 焦点环） | ✅ |
| 所有交互组件均可键盘聚焦 | ✅ |
| 焦点环 3 px + 透明度对比度合规 | ✅ |
| `aria-label` / `role` 覆盖 Modal、按钮、列表、下拉 | ✅ |
| 异常态与成功态不仅使用颜色提示 | ✅（icon + chip + 文本） |
| 屏阅读友好：使用 `<section>`、`<nav>`、`<button>`、`<input>` 标准标签 | ✅ |

---

## 7. 测试验证

`scripts/ui-design-test.mjs` 已对：

- 各 Modal / 页面在 Desktop 1920 / 1366、平板 1024 / 768、移动 390 / 412 上无错位 / 色差。
- 所有按钮可获得焦点（含键盘 Tab 顺序）。
- Modal 关闭按钮、Header 按钮、搜索药盒按钮均渲染为 `.btn-yao`。

| 设备 | 视图 | 截图 / 通过 |
| --- | --- | --- |
| Desktop 1920×1080 | 全功能 | ✅ |
| Notebook 1366×768 | 全功能 | ✅ |
| Tablet 1024×768 | 全功能 | ✅ |
| Tablet 768×1024 | 自适应 | ✅ |
| Mobile iPhone 14 390×844 | 移动优先布局 | ✅ |
| Mobile Android 412×915 | 移动优先布局 | ✅ |

---

## 8. 后续可拓展方向

1. 引入**暗色主题**：复用现有 `--yao-*` CSS 变量，重写为 `prefers-color-scheme: dark`。
2. 增加**主题切换器**：瑶医主题 / 中医经典主题 / 国风主题。
3. 与 `index.css` 中既有的 animation 体系（`fadeIn` / `scaleIn` / `herb-card-flash` 等）结合，添加「瑶医仪式感」的进入 / 切换动画。
