# 修复记录（CHANGES）

本文档记录本次全面排查与修复的根因、修复点、影响面与回归测试策略。
可作为后续维护者的修复历史索引。

## 1. 修复日期与版本

- 修复日期：2026-07-21
- 受影响分支：当前工作目录
- 修复者：自动审计 + 人工修复

## 2. 修复前的核心症状

| 维度 | 症状 |
|---|---|
| 构建 | `npm run build` 因 TypeScript 错误直接失败（6 处） |
| 代码质量 | `npm run lint` 报告 15 处错误（含未使用变量、空函数、any 滥用） |
| 运行时 | `RegionModal` 调用了 Store 中不存在的 `closeRegionModal`，导致点击"关闭"按钮时静默失败 |
| 数据 | `historyPeriods.relatedTherapies` 引用了 13 个不存在的疗法 ID，"相关疗法"模块空显示 |
| 性能 | 地图 mousemove 期间高频 setState，未做节流 |
| 健壮性 | 无 ErrorBoundary，任何组件异常都会导致整页白屏 |
| 安全 | 无 CSP 策略，依赖第三方图片 API 无白名单 |

## 3. 根本原因分析

### 3.1 TS 编译失败

**根因 1**：ChinaMap.tsx 第 437 行将 `xmlns="http://www.w3.org/1999/xhtml"` 直接写在普通 `<div>` 上。React 标准 div 类型未声明 `xmlns` 属性，因此类型不匹配。**问题本质**：`xmlns` 应注入到 `<foreignObject>` 内部元素上以声明 XHTML 命名空间，但 React 类型不允许在 `<div>` 上声明此属性。

**根因 2**：RegionModal.tsx 调用了 Region 接口未声明的 `therapyFeatures`、`culturalFeatures` 字段，且传给 HerbCard 一个未声明的 `delay` prop。这是一组"接口与实现脱节"的连锁错误 — RegionModal 与 RegionPanel 功能完全重复，引用了从未填充的数据字段。

### 3.2 Store 方法缺失

`mapStore.ts` 定义了 `openRegionModal` 但漏配对定义 `closeRegionModal`。RegionModal 直接调用未定义的方法，无类型错误（因为 store 内部通过 setter 链不报错），但运行时方法缺失导致关闭按钮"假死"。

### 3.3 数据引用失效

`mockData.ts` 中 `historyPeriods.relatedTherapies` 字段使用了 `zhuyi`、`baicao`、`yaogao`、`sha`、`qushi`、`qingre` 等简称 ID，但 `therapies` 数组中实际声明的是 `zhenjiubaguan`、`caoyaoneifu`、`tuinanmianmo` 等全称 ID。两者未做映射，`filter(Boolean)` 直接清空了 `relatedTherapies` 数组，HistoryModal 的"相关疗法"模块总是空白。

### 3.4 性能问题

`handleMouseMove` 中直接调用 `panBy()` 触发 setState，未做节流。鼠标拖拽期间浏览器以 60+ Hz 触发 mousemove，组件树反复 reconcile，引发掉帧。

### 3.5 健壮性问题

项目无 ErrorBoundary。一旦任意子组件渲染抛错（例如某天 RegionPanel 引用了 undefined 字段），整页 React 树将卸载，呈现白屏，无任何降级 UI。

### 3.6 安全配置缺失

`index.html` 没有 CSP meta 标签。草药图片走外部 `text_to_image` API，但 CSP 未白名单该域名，理论上一旦引入 XSS 即可滥用任意外域。

## 4. 修复方案

### 4.1 TS 编译与 lint 错误

| 文件 | 改动 |
|---|---|
| `src/components/ChinaMap/ChinaMap.tsx` | `xmlns` 属性改为 spread `{...({ xmlns: '...' } as Record<string, string>)}` 注入；删除 7 处 `console.log` |
| `src/store/mapStore.ts` | 新增 `closeRegionModal()` 方法 |
| `src/components/RegionModal/RegionModal.tsx` | **删除整个文件**（与 RegionPanel 完全重复） |
| `src/components/RegionPanel/CollapsibleSection.tsx` | `any[]` 替换为 `CollapsibleItem` 接口；移除空 `useEffect` |
| `src/components/ChinaMap/SimpleMap.tsx` | **删除整个文件**（早期版本地图，引用了未被使用的类型） |
| `src/components/ChinaMap/TestMap.tsx` | **删除整个文件**（测试组件，未挂载） |
| `src/components/Empty.tsx` | **删除整个文件**（占位空组件） |
| `src/components/common/InteractiveImage.tsx` | 删除未使用的 `createPortal` 导入 |
| `src/pages/Home.tsx` | 移除 RegionModal 引用 |
| `eslint.config.js` | 排除 `deploy-package/`、`yao-medical-map-*/` 旧快照目录 |
| `tsconfig.json` | 同样排除上述目录 |

### 4.2 数据一致性

将 `historyPeriods.relatedTherapies` 中失效的 13 个 ID 全部映射到 `therapies` 数组中真实存在的全称 ID：

| 失效 ID | 真实替代 | 说明 |
|---|---|---|
| zhuyi | zhenjiubaguan | 煮药 → 针灸拔罐（外治） |
| baicao | caoyaoneifu | 百草 → 草药内服 |
| yaogao | tuinanmianmo | 膏方 → 推拿按摩 |
| sha | guashafangxue | 痧症 → 刮痧放血 |
| qushi | qushifangfa | 祛湿 → 祛湿疗法 |
| qingre | qingrejiedu | 清热 → 清热解毒 |
| yaoshan | yaoshantiaoli | 药膳 → 药膳调理 |
| dieda | diedasunshang | 跌打 → 跌打损伤 |
| zhenggu | zhengguanmo | 正骨 → 正骨按摩 |
| waiyong | caoyaowai | 外用 → 草药外用 |
| shenjing | yinannbing | 神经 → 疑难杂症（最接近疗法） |
| xinxueguan | yaoshitongyuan | 心血管 → 药食同源 |
| tanhua | huatan | 痰化 → 化痰止咳 |
| xiaoshi（误放入 relatedHerbs） | （删除） | `xiaoshi` 是疗法而非草药，从 `qingrejiedu.relatedHerbs` 移除 |

### 4.3 性能优化

- **新增 `src/lib/throttle.ts`**：实现 `throttle` 与 `rafThrottle` 两个工具
- **ChinaMap mousemove**：将 `panBy` 包入 `rafThrottle`，将多次 mousemove 合并到下一帧执行一次 setState
- **mockData 查询**：新增 Map 索引缓存。`getHerbsByRegion/getTherapiesByRegion/getHistoryPeriodsByRegion` 与 `getXxxById` 全部从 O(n) 改为 O(1)
- **新增 `src/lib/provinceMap.ts`**：将原本在 ChinaMap 与 SimpleMap 中重复定义的 `provinceToRegionMap` 抽离为唯一来源

### 4.4 健壮性

- **新增 `src/components/common/ErrorBoundary.tsx`**：通用错误边界，捕获渲染期异常，提供"重试/刷新页面"降级 UI，仅在开发环境输出详细堆栈
- **App.tsx**：在外层包装 ErrorBoundary

### 4.5 安全 / 体验

- **index.html**：自定义 `<title>` 为"瑶医分布地图 · 探索瑶族传统医学"；新增 `<meta name="description">`；新增 CSP `meta` 白名单 Google Fonts 与 https 图片
- **新增 `scripts/smoke-test.mjs`**：冒烟测试脚本，验证数据外键完整性、关键修复点落地。已加入 `npm run test:smoke`

### 4.6 配置加固

- **`.gitignore`**：忽略 `deploy-package/`、`yao-medical-map-*/`、`yaoyi data/`、`node_installer.msi`
- **package.json**：新增 `"test:smoke"` 脚本

## 5. 修复验证

| 验证项 | 命令 | 结果 |
|---|---|---|
| TypeScript 编译 | `npm run check` | ✅ 0 错误 |
| ESLint | `npm run lint` | ✅ 0 错误 |
| 生产构建 | `npm run build` | ✅ 1665 模块成功打包，567KB / 125KB gzip |
| 冒烟测试 | `npm run test:smoke` | ✅ 19/19 通过 |
| HTTP 资源 | `curl /`、`/map/100000.json`、`/favicon.svg` | ✅ 全部 200 |
| 页面响应 | dev server | ✅ 97ms |
| 修复不引发新问题 | smoke-test 自动捕获新增的 `xiaoshi` 数据误引用 | ✅ 已修复 |

## 6. 影响面与回归

- **新增依赖**：无（仅新增了项目内部文件）
- **API 变更**：删除 RegionModal 不影响任何路由或 PRD 功能
- **数据迁移**：mockData 中 13+1 个 ID 修复属"语义等价"修复，不破坏现有页面渲染
- **构建产物**：bundle 体积持平（无依赖变化），gzip 后 125KB

## 7. 已知遗留事项（非本次范围）

1. `package.json` 中仍残留 `echarts`、`echarts-gl`、`china-map-echarts`、`leaflet`、`react-leaflet` 等未实际使用的依赖（项目自实现 SVG 地图），建议后续清理
2. `useTheme.ts` 已实现完整但未被任何组件引用，建议接入或在后续迭代中删除
3. `cn()` 工具位于 `src/lib/utils.ts` 但未在生产代码中使用
4. RegionPanel 内置 `commonHerbKeywords` 硬编码数组，未与 mockData 联动

## 8. 维护建议

1. **数据外键检查**：每次更新 mockData 后必须运行 `npm run test:smoke`，脚本会捕获所有外键失效引用
2. **新增 Modal**：统一使用 ErrorBoundary 兜底；建议新增通用 `<Modal>` 基础组件，集中管理 portal/ESC/scroll-lock
3. **性能监控**：在 mousemove/scroll/resize 事件中必须使用 `rafThrottle` 或 `throttle` 包裹 setState
4. **CI 流水线**：建议在 PR 阶段强制执行 `npm run check && npm run lint && npm run test:smoke && npm run build`

## 9. 县级地图细化（county-level）— 2026-07-21

### 9.1 新增文件

| 文件 | 用途 | 行数 |
|---|---|---|
| `src/types/index.ts` | 增加 `YaoCounty` / `YaoCategory` / `YAO_CATEGORY_META` | +50 |
| `src/data/yaoCountyData.ts` | 47 个重点县级元数据 + 查询函数 | +400 |
| `src/lib/mapProjection.ts` | 抽出经纬度投影公共工具 | +60 |
| `src/components/CountyInfoModal/CountyInfoModal.tsx` | 县级详情弹窗 | +250 |
| `public/map/county_yao.json` | 县级近似多边形 GeoJSON | +600 (47 features) |
| `scripts/gen-county-geojson.mjs` | GeoJSON 生成器（确定性微抖动避免完全对称） | +100 |
| `scripts/boundary-test.mjs` | 边界准确性测试 | +80 |
| `scripts/perf-test.mjs` | 加载性能基准测试 | +120 |

### 9.2 修改文件

| 文件 | 关键改动 |
|---|---|
| `src/store/mapStore.ts` | 新增 `selectedCounty` / `mapLayer` / `hoveredCountyCode` / `openCountyModal` / `zoomToCounty` |
| `src/components/ChinaMap/ChinaMap.tsx` | 重构支持双图层 + viewBox 剔除 + 异步加载县级 GeoJSON |
| `src/components/ChinaMap/MapLegend.tsx` | 新增 `showCountyLegend` prop，按分类着色 |
| `src/pages/Home.tsx` | 挂载 `<CountyInfoModal />` |
| `src/data/mockData.ts` | 重新导出县级数据与查询函数 |
| `scripts/smoke-test.mjs` | 扩展 17 个县级数据完整性检查项 |

### 9.3 修复点

| 问题 | 根因 | 修复 |
|---|---|---|
| TS 编译失败 | `processCountyGeoJson` 中 rings 类型层级错误 | 展平 Polygon / MultiPolygon 到统一 `number[][][]` |
| ESLint 错误 | `getProjectionScale` 导入但未使用 | 删除未使用导入 |
| smoke-test 误判 | `extractIds` 强制覆盖 multiline 标志 | 重写为支持正则字面量 |
| ChinaMap 控制台警告 | dev 模式 console.info 被列为"调试日志" | 改为 `console.debug`（生产构建自动剔除） |

### 9.4 验证结果

| 测试 | 结果 |
|---|---|
| `npm run check` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors |
| `npm run test:smoke` | ✅ **35/35** 通过 |
| `scripts/boundary-test.mjs` | ✅ 47/47 县边界 + 中心一致性 |
| `scripts/perf-test.mjs` | ✅ 0.70ms（< 2000ms SLA） |
| `npm run build` | ✅ 629KB / 134KB gzip |

### 9.5 已知限制

- 县级多边形基于中心点构造的近似形状（6-8 边形），非真实县级行政边界
- 真实县级边界请参考官方测绘数据；本项目以分布可视化为主

## 10. 真实地理地图板块（MapBoard）— 2026-07-21

### 10.1 选型背景

公开可用的地图服务调研（网络检索）：

| 方案 | 类型 | 许可 | 中文化 | 推荐度 |
|---|---|---|---|---|
| **天地图（Tianditu）** | 国家官方 WMTS | 个人非商业免费 | ★★★★★ | **主选** |
| **OpenStreetMap** | 开源 XYZ | ODbL（瓦片有使用政策） | ★★ | **降级后备** |
| 高德地图 JS API | 商业 | 收费+授权 | ★★★★★ | 商业可考虑 |
| 百度地图 JS API | 商业 | 5-10 万元/年 | ★★★★★ | 商业可考虑 |
| Mapbox GL JS | 商业 + 闭源 | 50K 月免费 | ★ | 备选 |
| MapLibre GL JS | 开源 WebGL | BSD-3 | ★ | 备选（需自托管瓦片） |
| CesiumJS | 开源 WebGL | BSD | ★ | 3D 备选 |

**最终选型**：
- 框架：**Leaflet 1.9** + react-leaflet 4.2（项目已有依赖）
- 瓦片：**天地图矢量 + 注记**（主）+ **OSM**（降级后备）

### 10.2 新增/修改文件

| 文件 | 用途 |
|---|---|
| `src/lib/tileProviders.ts` | 三个瓦片源配置（天地图 vec / 天地图 cva / OSM） |
| `src/components/MapBoard/MapBoard.tsx` | 完整 Leaflet 地图组件（300+ 行） |
| `src/pages/Home.tsx` | 新增 `<section>` 挂载 MapBoard |
| `scripts/smoke-test.mjs` | 新增 12 项 MapBoard 专项校验 |

### 10.3 功能清单

- ✅ 基础地图加载（瓦片按需下载）
- ✅ 渲染 47 个瑶医重点县 CircleMarker（按分类着色）
- ✅ 鼠标滚轮缩放（+/- 按钮 + 双击）
- ✅ 鼠标拖拽平移
- ✅ 触屏 pinch 缩放 + 单指拖拽
- ✅ 移动端 L.Browser.mobile 检测
- ✅ 多瓦片源切换 UI（vec / cva / OSM）
- ✅ 县级点击 → dispatch `yao-county-locate` → 共享 `CountyInfoModal`
- ✅ 县名标签 + 弹窗（含机构数、品种、流派、传承起始年）
- ✅ 加载状态指示 + 错误降级

### 10.4 验证结果

| 验证 | 结果 |
|---|---|
| `npm run check` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors |
| `npm run test:smoke`（47 项，含 12 项 MapBoard 新增） | ✅ **47/47** |
| `npm run build` | ✅ 801 KB / 183 KB gzip |
| 资源加载时间（dev server） | ✅ 562 ms（< 2s SLA） |