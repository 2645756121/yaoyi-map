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

- 🗺️ **真实地理地图**：基于 Leaflet 1.9 + 中国合规 GeoJSON
- 📍 **三级钻取**：国家级 → 省级 → 县级，缩放查看
- 🌿 **草药目录**：24 种瑶药信息，含传统应用与禁忌
- 📜 **传统疗法**：药浴、刮痧、滚蛋疗法等外治法
- 📖 **历史溯源**：瑶医发展史与重要文献
- 🏥 **机构查找**：定位瑶医诊所与药店
- 🌐 **双语支持**：中英双语界面与说明

## 🛠️ 技术栈 | Tech Stack

| 类别 | 选型 |
| --- | --- |
| 框架 | React 18 + TypeScript 5 + Vite 6 |
| 地图 | Leaflet 1.9（合规本地 GeoJSON） |
| 状态管理 | Zustand 5 |
| 样式 | Tailwind CSS 4 |
| 路由 | React Router 7 |
| 部署 | Docker + GitHub Pages + Cloudflare |

## 🚀 快速开始 | Quick Start

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 本地预览
npm run preview

# 启动生产服务
node server.cjs
```

## 📦 部署 | Deployment

详见 [DEPLOY.md](DEPLOY.md) 与 [GITHUB_DEPLOY_GUIDE.md](GITHUB_DEPLOY_GUIDE.md)。

```bash
# Docker 一键部署
docker compose --env-file .env.production up -d --build

# 推送到 GitHub（需 PAT）
gh auth login --with-token
git push origin main
```

## 🗂️ 项目结构 | Project Structure

```
src/
├── components/        # UI 组件
│   ├── MapBoard/      # 地图核心（含 DrillDownMap / RegionQuickSelector）
│   ├── HerbCatalog/   # 草药目录
│   ├── HerbModal/     # 草药详情弹窗
│   ├── TherapyModal/   # 疗法详情弹窗
│   └── YaoMedicalKnowledge/  # 瑶医基础知识
├── data/              # 业务数据（草药、疗法、历史）
├── lib/                # 工具库（adminAggregator / monitoring / mapEvents）
├── store/              # Zustand 状态管理
├── pages/              # 页面组件（Home.tsx）
└── types/              # TypeScript 类型定义
```

## 🔍 数据源 | Data Sources

- **国家级地图**：国家测绘地理信息局公开数据（`map/100000.json`）
- **省级地图**：各省 1:100 万地形图（`map/province/*_full.json`）
- **县级地图**：高德地图县级边界（`map/county/*.json`）
- **瑶族分布**：广西民族研究所学术资料 + 实地调研
- **草药数据**：广西药用植物园 + 《广西中药志》

## 📜 学术参考 | References

- 《瑶医基础理论》 广西民族出版社
- 《广西中药志》 广西科学技术出版社
- 《中国民族医药学》 中国中医药出版社
- 《瑶族医药学》 黄汉儒 编著

## ⚖️ 合规说明 | Compliance

- ✅ 地图数据使用国家公开标准，**不包含机密边界**
- ✅ **不含钓鱼岛/南海争议区域** 的敏感信息
- ✅ **不渲染境外瓦片**（纯本地 GeoJSON）
- ✅ 用户数据**仅本地存储**，无服务端收集
- ✅ 学术使用需注明出处

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
