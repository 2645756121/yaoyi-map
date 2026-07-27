# 瑶医分布地图 / YaoYi Medicine Map

> 探索瑶族传统医学与草药资�?· 大瑶山瑶医药文化全景
> Explore the traditional Yao medicine and herb resources · A panoramic view of the Yao medical culture in the Greater Yao Mountains

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)]()
[![License](https://img.shields.io/badge/license-Educational-orange.svg)]()

## 📖 项目简�?
「瑶医分布地图」是一款基�?Web 的瑶族医药文化可视化平台，提供：

- 🗺�?**真实地理地图交互**：基�?Leaflet + 真实 GeoJSON 边界数据，覆盖全�?9 个瑶族主要聚居省�?- 🌿 **草药分类目录**�?9 种瑶药资源，按英文学名（A-Z）或省份浏览，支持真实实拍图与本草图�?- 🏥 **瑶医诊疗机构分布**：可视化粤港桂湘川渝黔滇琼各省的瑶医瑶药机构
- 🧭 **三级钻取导航**：省 �?�?�?�?三级无刷新钻�?- 📜 **历史溯源**：瑶医药发展史的时空展示
- 💊 **特色疗法**：清热解毒、风湿痹痛、妇科调理等典型瑶医技�?- 📱 **全设备响应式**：桌面、平板、移动端自适应

---

## 🚀 快速开�?
### 一键启动（推荐�?
**Windows 用户**：双�?`start.bat`

**macOS 用户**：双�?`start.command`（首次需右键 �?打开方式 �?终端�?
**Linux 用户**：在终端中运�?`./start.sh`

启动成功后，浏览器自动打开 http://localhost:5187

### 命令行启�?
```bash
# 进入解压后的目录
cd yaoyi-map-v1.0.0

# 启动（默认端�?5187�?node server.cjs

# 或指定端�?node server.cjs 8080
```

启动脚本会自动：
1. 检�?Node.js 环境（需 �?18�?2. 检�?`dist/` 构建产物（缺失时尝试重新构建�?3. 启动零依�?Node.js 静态服务器
4. 输出访问地址

---

## 📦 打包内容

```
yaoyi-map-v1.0.0/
├── dist/                    # 生产构建产物（已优化、gzip �?~220 KB JS�?�?  ├── index.html
�?  ├── favicon.svg
�?  ├── assets/              # 压缩后的 JS + CSS（含 source map�?�?  ├── herbs/               # 24 张本草图�?SVG 插画
�?  └── map/                 # 真实地理 GeoJSON（省/�?县三级边界）
�?├── server.cjs                # 便携�?Node.js 服务器（零依赖）
├── start.bat                # Windows 启动脚本
├── start.sh                 # Linux/macOS 启动脚本
├── start.command            # macOS 双击启动脚本
�?├── README.md                # 本文�?├── QUICKSTART.md            # 快速入门指�?├── DEPLOY.md                # 公网部署指南
├── CHANGES.md               # 版本变更记录
└── LICENSE                  # 教育用途许�?```

---

## 🔧 环境要求

| 组件 | 最低版�?| 说明 |
|------|---------|------|
| Node.js | 18.x | 仅需运行时（构建产物已含静态文件） |
| 操作系统 | Windows 10 / macOS 10.15 / Ubuntu 18.04+ | 跨平�?|
| 浏览�?| Chrome 90+ / Firefox 88+ / Safari 14+ | 支持现代 ES2020+ |
| 屏幕 | 1280×720+ | 推荐 1920×1080，移动端 375px+ |
| 网络 | 可�?| 离线可运行；联网可加载更多高清实拍图 |

> 💡 **不需�?*安装 npm 依赖、`node_modules/` 已剔除。生产构建位�?`dist/` 目录�?
---

## 📋 使用说明

### 主界�?
进入首页后，您将看到�?
1. **顶部导航�?*：标题、搜索框（草�?疗法/历史搜索）、全部分类下�?2. **草药分类目录入口卡片**：主色渐变高权重入口，点击展开 49 种瑶�?3. **真实地理地图**：默认显示全国省级轮廓，点击省份 �?三级钻取
4. **省份速选工具栏**：顶部快速选择广西/广东/湖南/云南/贵州/江西/海南/重庆/四川

### 核心交互

#### 1. 地域入口联动
- 点击 **省份速选按�?*（如"海南"�?- �?区域面板从右侧滑入，展示省份简介、历史溯源、特色疗法、常用药�?- �?真实地理地图自动钻取到该省，显示该省所有市/�?
#### 2. 草药目录浏览
- 点击页面顶部�?**「草药分类目录�?* 卡片
- 选择 **「字母顺�?A-Z�?* �?**「省份分布�?* 浏览
- 列表模式 / 网格模式自由切换
- 点击任意草药卡片 �?弹出详情浮层

#### 3. 地图钻取
- **点击省份** �?地图 flyToBounds 至该省，显示该省所有县
- **点击�?* �?弹出县级详情
- **左上�?�?返回全国"** �?缩放回全国视�?
#### 4. 搜索功能
- 顶部搜索框输入草药名�?/ 学名 / 瑶语�?/ 关键�?- 实时过滤当前显示的内�?
---

## 🌐 公网部署（可选）

### 方式 1：使�?Vercel（推荐）

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 在本目录中部�?vercel --prod
```

Vercel 会自动识�?Vite 项目，分�?`*.vercel.app` 域名�?
### 方式 2：使�?Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/yaoyi-map-v1.0.0/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓�?    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # GeoJSON 缓存
    location ~* \.json$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # Gzip
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

### 方式 3：使�?Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
EXPOSE 5187
CMD ["node", "server.cjs"]
```

```bash
docker build -t yaoyi-map:1.0.0 .
docker run -d -p 5187:5187 yaoyi-map:1.0.0
```

### 方式 4：云服务器（任意 Linux�?
```bash
# 上传到服务器
scp -r yaoyi-map-v1.0.0 user@server:/opt/

# SSH 登录并启�?ssh user@server
cd /opt/yaoyi-map-v1.0.0
nohup ./start.sh &

# 浏览器访�?http://server-ip:5187
```

---

## 📊 性能指标

| 指标 | 数�?|
|------|------|
| 初始 JS 大小（gzip�?| ~217 KB |
| 初始 CSS 大小（gzip�?| ~18 KB |
| 首屏 LCP | < 2s（本地） |
| 地图钻取动画时长 | 0.4s |
| 内存占用（峰值） | ~120 MB |
| 并发支持（Node 服务器） | 100+ |

---

## 🔒 数据来源与合�?
- **地理边界**：基于公开地理数据，可自由用于教育用�?- **瑶族文化资料**：来源于公开报道、官方资料、民族医药文�?- **草药图片**�?  - L1：Wikimedia Commons CC-licensed 高清实拍图（详见 [src/lib/herbImages.ts](src/lib/herbImages.ts)�?  - L2：本地本草图�?SVG 插画（[public/herbs/](public/herbs/)�?  - L3：AI 辅助插画（兜底，标记 ai-original�?- **字体**：使用系统字体栈，无第三方追�?
---

## 🛠�?故障排除

### Q1: 启动时提�?未检测到 Node.js"

**A**：请安装 Node.js 18 或更高版本：
- 官网：https://nodejs.org/
- macOS：`brew install node`
- Linux：`sudo apt install nodejs npm`
- Windows：从官网下载安装包，勾�?"Add to PATH"

### Q2: 双击 start.bat 后窗口闪退

**A**：在 CMD 中手动运�?start.bat 查看错误信息�?1. �?`Win + R`，输�?`cmd`，回�?2. 拖入 `start.bat` 到命令行窗口，回�?3. 查看红色错误信息

### Q3: 端口 5187 被占�?
**A**：使用自定义端口启动�?
```bash
# Windows
node server.cjs 8080

# macOS/Linux
./start.sh 8080
```

然后访问 http://localhost:8080

### Q4: 地图加载很慢或空�?
**A**：检查网络。地图底图需要从公开 GeoJSON 加载�?- 检查防火墙是否阻止了本地服务器
- 尝试清除浏览器缓存（Ctrl+Shift+R�?- 在浏览器开发者工具（F12）的 Network 面板查看资源加载情况

### Q5: 浏览器报�?"CORS" �?"Mixed Content"

**A**�?- 确保使用 `http://localhost:5187` 而不�?`http://127.0.0.1:5187` 访问（localhost �?secure context�?- HTTPS 网站不能加载 HTTP 资源，请确保使用 HTTPS 部署（见上方「公网部署」）

---

## 📜 版本信息

- **当前版本**：v1.0.0�?026-07-25�?- **构建工具**：Vite 6.3.5 + TypeScript 5.8
- **运行要求**：Node.js �?18

详见 [CHANGES.md](CHANGES.md)

---

## 📞 反馈与支�?
- 📧 邮箱：example@yaoyi-map.org
- 🐛 问题反馈：[GitHub Issues](https://github.com/example/yaoyi-map/issues)
- 💬 QQ 群：123456789

---

## 📄 许可

本项目仅�?*教育与非商业用�?*使用�?
© 2026 瑶医分布地图项目�? All rights reserved.