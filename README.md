# 瑶医分布地图 / YaoYi Medicine Map

> 探索瑶医传统医学与草药资源 — 大瑶山瑶医文化全景
> Explore the traditional Yao medicine and herb resources — A panoramic view of the Yao medical culture in the Greater Yao Mountains

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D18-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Educational](https://img.shields.io/badge/purpose-educational-orange)]()

---

## ✨ 简介 | Introduction

本项目是一个基于 **React 18 + TypeScript + Vite 6** 构建的交互式地图应用，专注于可视化展示**瑶医传统医学**在中国南方的分布情况。

This project is an interactive map application built with **React 18 + TypeScript + Vite 6**, focused on visualizing the distribution of **Yao traditional medicine** in southern China.

## 🏔️ 主要功能 | Key Features

- 🗺️ **真实地理地图**：基于 Leaflet 1.9 + 中国合规 GeoJSON（**无外部瓦片请求**）
- 📍 **三级钻取**：国家级 → 省级 → 县级，缩放查看
- 🏔️ **地形浮雕（3D）**：Three.js 渲染 Terrarium 高程，支持聚焦省份高清补丁与高程夸张
- 🌿 **草药目录**：49 味瑶药/中药材信息，含性味归经、功效与现代药理
- 📜 **传统疗法**：44 种外治法（药浴、刮痧、滚蛋疗法等）与临床案例
- 📖 **历史溯源**：27 个历史时期与重要文献
- 🏥 **县级资料**：47 个瑶医重点县的机构、品种、流派与传承保护现状
- 📚 **瑶医知识**：基础理论、主要诊断方法、瑶药分类与非遗传承
- 🌐 **双语支持**：中英双语界面与说明

## 🛠️ 技术栈 | Tech Stack

| 类别 | 选型 |
| --- | --- |
| 框架 | React 18 + TypeScript 5 + Vite 6 |
| 地图（2D） | Leaflet 1.9（**完全本地 GeoJSON，无外部瓦片**） |
| 地形（3D） | Three.js 0.186 + Terrarium 高程图 |
| 状态管理 | Zustand 5 |
| 样式 | Tailwind CSS **3**（经 PostCSS） |
| 路由 | React Router 7（仅 `/` 一条路由） |
| 测试 | Vitest 3 + jsdom（3D 子系统）+ `scripts/*.mjs` 静态审计 |
| 部署 | 零依赖 Node 静态服务 / Docker+Nginx / GitHub Pages / Vercel |

## 🚀 快速开始 | Quick Start

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 本地预览（Vite）
npm run preview

# 启动生产服务（零依赖 Node 服务器，默认 5187 端口，自动开浏览器）
node server.cjs
```

> ⚠️ **交付/发布注意**：`server.cjs` 服务的是**仓库根目录的 `dist/`**，
> 而构建产物输出到 `yaoyi-map-dev/dist/`。改完源码并 `npm run build` 后，
> 若要让便携包（`start.bat`）生效，必须把 `yaoyi-map-dev/dist/` 的内容同步到根 `dist/`，
> 否则启动的仍是旧版本。

## 🗂️ 项目结构 | Project Structure

```
src/
├── components/        # UI 组件
│   ├── MapBoard/      # 2D 地图核心（DrillDownMap 三级钻取 / 领土合规 / 草药点位）
│   ├── TerrainRelief3D/ # 3D 地形浮雕（Three.js 渲染内核 + 边界叠加 + LOD）
│   ├── HerbCatalog/   # 草药目录
│   ├── HerbModal/     # 草药详情弹窗
│   ├── TherapyModal/  # 疗法详情弹窗
│   ├── HistoryModal/  # 历史时期弹窗
│   ├── CountyInfoModal/ # 县级瑶医资料弹窗
│   └── YaoMedicalKnowledge/ # 瑶医基础知识
├── data/              # 静态业务数据（草药 49 味 / 疗法 44 种 / 历史 27 期 / 县级 47 个）
├── lib/               # 工具库（adminAggregator / herbImages / tileProviders / monitoring ...）
├── store/             # Zustand 状态管理
├── pages/             # 页面组件（Home.tsx）
└── types/             # TypeScript 类型定义

public/
├── map/               # 行政边界 GeoJSON（省 34 / 市 125 / 县 918）+ 主权要素
├── relief/            # Terrarium 高程图（3D 地形数据源）
├── herbs/             # 草药本草图鉴 SVG（离线兜底图源）
└── logo/              # 官方 Logo（多级降级）
```

## 🔍 数据源 | Data Sources

- **国家级地图**：国家测绘地理信息局公开数据（`map/100000*.json`）
- **省级地图**：各省 1:100 万地形图（`map/province/*_full.json`）
- **县级地图**：高德地图县级边界（`map/county/*.json`）
- **地形高程**：AWS Terrain Tiles (Mapzen) / SRTM+ASTER（CC-BY 4.0），
  由 `scripts/export_relief_heightmap.py` 生成为 Terrarium 编码 PNG
- **瑶族分布与瑶医资料**：广西民族研究所学术资料 + `yaoyi data/` 中的学术文献与实地调研
- **草药图文**：《广西中药志》等；图片优先 Wikimedia Commons（CC 授权），
  离线时降级到 `public/herbs/*.svg`

## ⚖️ 合规说明 | Compliance

- ✅ 地图数据使用国家公开标准，**不包含机密边界**
- ✅ **不渲染任何境外瓦片**（纯本地 GeoJSON，`tileProviders.ts` 仅保留一个本地 provider）
- ✅ 视域锁定在中国完整范围（`CHINA_FULL_BOUNDS`，含台湾、南海诸岛、钓鱼岛）
- ✅ 主权要素（台湾岛 / 钓鱼岛 / 南海诸岛 / 九段线等）**强制渲染并自检**，
  清单唯一来源为 `src/lib/tileProviders.ts` 的 `REQUIRED_TERRITORIES`
- ✅ 用户数据**仅本地存储**，无服务端收集
- ⚠️ **注意**：应用并非"零外部请求"——草药图片会请求 Wikimedia（失败自动降级本地 SVG），
  字体引用 Google Fonts。地图与高程数据则完全本地。
- ✅ 学术使用需注明出处

## 📦 部署 | Deployment

详见 [DEPLOY.md](DEPLOY.md) 与 [GITHUB_DEPLOY_GUIDE.md](GITHUB_DEPLOY_GUIDE.md)。

```bash
# 便携包方式（推荐给最终用户）：零依赖
start.bat                 # Windows 一键启动
node server.cjs           # 或手动启动（默认 5187，自动探测可用端口）

# Docker 一键部署
docker compose --env-file .env.production up -d --build
```

## 📜 学术参考 | References

- 《瑶医基础理论》 广西民族出版社
- 《广西中药志》 广西科学技术出版社
- 《中国民族医药学》 中国中医药出版社
- 《瑶族医药学》 黄汉儒 编著

## 🤝 贡献 | Contributing

欢迎 PR、Issue 与学术建议！项目专注于**非营利性瑶族文化保护与传播**。

## 📄 许可证 | License

本项目采用 **MIT 许可证** - 详见 [LICENSE](LICENSE) 文件。

## 📞 联系方式 | Contact

- **问题反馈**：[GitHub Issues](https://github.com/2645756121/yaoyi-map/issues)
- **学术合作**：见仓库 wiki

## 🌟 致谢 | Acknowledgments

感谢所有为瑶族医药文化保护做出贡献的研究者、医师和文化传承人。

特别鸣谢：
- 广西壮族自治区民族医药研究院
- 广西药用植物园
- 中国民族医药学会瑶医药分会
- 所有参与口述史采集的瑶族医师

---

**Made with ❤️ for the preservation and promotion of Yao traditional medicine culture**
