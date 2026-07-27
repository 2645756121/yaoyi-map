# 🚀 GitHub 部署完整指南 · 瑶医分布地图 v1.0.0

> **适用版本**：1.0.0  
> **最后更新**：2026-07-27  
> **预计完成时间**：首次部署 15-30 分钟  
> **目标读者**：开发者 / DevOps / 项目管理者

本指南将引导你**从本地项目到 GitHub 仓库，再到生产环境部署**完成全链路。每一步都配有可直接复制运行的命令。

---

## 📑 目录

0. [前置准备](#0-前置准备)
1. [项目仓库基础配置](#1-项目仓库基础配置)
2. [GitHub 仓库初始化与首次推送](#2-github-仓库初始化与首次推送)
3. [部署平台选择与绑定](#3-部署平台选择与绑定)
4. [环境变量配置](#4-环境变量配置)
5. [首次部署执行](#5-首次部署执行)
6. [部署后功能验证](#6-部署后功能验证)
7. [自动化部署规则配置](#7-自动化部署规则配置)
8. [故障告警与通知机制](#8-故障告警与通知机制)
9. [部署文档维护](#9-部署文档维护)

---

## 0. 前置准备

### 0.1 工具清单

请确认本机或执行机器已安装：

| 工具 | 必需 | 安装方式 |
| ---- | ---- | -------- |
| **Git** | ✅ 必需 | [git-scm.com](https://git-scm.com/) 或 `winget install Git.Git` |
| **Node.js** | ✅ 本地构建需要 18+ | [nodejs.org](https://nodejs.org/) |
| **npm** | ✅ 随 Node 一起 | `npm install -g npm@latest` |
| **GitHub CLI (gh)** | 推荐 | `winget install GitHub.cli`（可选，但能大幅简化流程） |

### 0.2 GitHub 账号与权限

- 注册/登录 [github.com](https://github.com/)
- 拥有 `Repository creation` 权限（默认所有用户都有）
- 创建 Personal Access Token（PAT）：Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token，勾选 `Contents: Read and write`
- 复制 token 备用（只显示一次）

### 0.3 部署平台账号（至少一个）

| 平台 | 注册链接 | 推荐场景 |
| ---- | -------- | -------- |
| **Vercel** | [vercel.com/signup](https://vercel.com/signup) | 演示 / 个人项目（推荐 ⭐） |
| **Netlify** | [netlify.com](https://www.netlify.com/) | 静态站点 |
| **Cloudflare Pages** | [cloudflare.com](https://www.cloudflare.com/) | 全球 CDN |
| **Render / Railway** | render.com / railway.app | Docker 部署 |

---

## 1. 项目仓库基础配置

### 1.1 确认技术栈

**已确认**（自动检测，无需修改）：

| 类别 | 版本 |
| ---- | ---- |
| React | 18.3 |
| TypeScript | ~5.8 |
| Vite | 6.x |
| Tailwind CSS | 3.4 |
| Leaflet | 1.9 |
| Zustand | 5.0 |
| React Router | 7.x |

### 1.2 确认 package.json 部署脚本

✅ **已就绪**：[package.json](file:///c:/Users/26457/Downloads/trae%E6%96%87%E4%BB%B6%E5%A4%B9/map/package.json) 中已有完整脚本：

```json
{
  "name": "yaoyi-map",
  "version": "1.0.0",
  "engines": {
    "node": ">=18.0.0 <21.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 4173",
    "check": "tsc -b --noEmit",
    "lint": "eslint .",
    "serve": "node server.cjs",
    "start": "node server.cjs",
    "docker:build": "docker build -t yaoyi-map:1.0.0 .",
    "docker:run": "docker run -d -p 5187:5187 --name yaoyi-map --restart unless-stopped yaoyi-map:1.0.0",
    "deploy:vercel": "vercel --prod"
  }
}
```

**关键字段**：
- ✅ `build` 命令：`tsc -b && vite build`
- ✅ `engines` 声明：Node 18-20
- ✅ `output`：Vite 默认输出到 `dist/`

### 1.3 验证 .gitignore

✅ **已就绪**：[.gitignore](file:///c:/Users/26457/Downloads/trae%E6%96%87%E4%BB%B6%E5%A4%B9/map/.gitignore)（138 行，含 `node_modules/`、`dist/`、`.env*` 等所有应排除项）

### 1.4 验证生产构建可成功

```bash
# 在项目根目录
npm ci --prefer-offline       # 安装依赖
npm run check                 # TypeScript 类型检查（应通过）
npm run lint                  # ESLint（应通过）
npm run build                 # 生产构建（应成功，输出 dist/）
ls -la dist/                  # 确认产物
```

**预期结果**：
- `dist/index.html` (~1.4 KB)
- `dist/assets/` (~ 50 MB total)
- `dist/map/` (GeoJSON 数据)
- `dist/herbs/` (24 个 SVG 图标)

---

## 2. GitHub 仓库初始化与首次推送

### 2.1 在 GitHub 创建空仓库

**先登录 GitHub → 创建空仓库**：

1. 打开 [github.com/new](https://github.com/new)
2. 填写：
   - **Repository name**：`yaoyi-map`
   - **Description**：`瑶医分布交互式地图 - 探索瑶族传统医学与草药资源的可视化平台`
   - **Visibility**：Public（公开）或 Private（私有）
   - ⚠ **不要勾选**：`Add a README file` / `Add .gitignore` / `Choose a license`
3. 点击 **Create repository**

### 2.2 一键推送（推荐）

#### 方式 A：Windows PowerShell

```powershell
# 在项目根目录打开 PowerShell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 执行推送脚本（替换 your-username 为你的 GitHub 用户名）
.\scripts\github-deploy.ps1 -GitHubUser "your-username" -RepoName "yaoyi-map"
```

#### 方式 B：macOS / Linux bash

```bash
chmod +x scripts/github-deploy.sh
./scripts/github-deploy.sh your-username yaoyi-map public
```

#### 方式 C：手动命令（无脚本）

```bash
cd c:/Users/26457/Downloads/trae文件夹/map  # 项目根目录

# 1. 初始化（如果还没有 .git/）
git init

# 2. 配置用户
git config user.email "your-email@example.com"
git config user.name  "Your Name"

# 3. 创建 main 分支
git checkout -b main

# 4. 加入并提交所有文件
git add -A
git commit -m "feat: initial release v1.0.0

- React 18 + TypeScript + Vite 6 瑶医分布地图
- Leaflet 地图 + 9 省份交互
- 草药目录 + 搜索 + 关于瑶医 modal
- Docker 多阶段构建 + nginx 配置
- GitHub Actions CI/CD + GHCR 发布
- 完整 DEPLOY.md 与 .env.example"

# 5. 绑定远程（替换 your-username）
git remote add origin https://github.com/your-username/yaoyi-map.git

# 6. 推送（首次需要认证）
git push -u origin main
```

**首次推送认证方式**：
- HTTPS：会弹出登录框，使用 GitHub 用户名 + PAT
- SSH：需先配置 SSH key（`ssh-keygen` + 添加到 GitHub Settings）

### 2.3 验证推送成功

推送成功后，到 GitHub 仓库页面 [github.com/your-username/yaoyi-map](https://github.com/your-username/yaoyi-map) 应看到：

- ✅ ~30+ 文件已上传
- ✅ 排除 `node_modules/`、`dist/`、`.env` 等
- ✅ 包含 `Dockerfile`、`.env.example`、`DEPLOY.md`
- ✅ `.github/workflows/deploy.yml` 存在

**如推送失败**：
- **403 Forbidden**：仓库名称冲突或权限不足
- **Repository not found**：GitHub 端仓库尚未创建
- **Authentication failed**：PAT 未设置或过期，需重新生成

---

## 3. 部署平台选择与绑定

### 3.1 平台决策树

```
是否生产级高并发？
├─ 是 → Docker + Cloud Server / ACK / ECS（详见 DEPLOY.md §3.2）
└─ 否
    │
    想要全球 CDN？
    ├─ 是 → Cloudflare Pages（一键）
    └─ 否
        │
        主要在 Vercel 生态？
        ├─ 是 → Vercel（一键 ⭐）
        └─ 否 → Netlify
```

### 3.2 方案 A：Vercel（推荐 ⭐ 演示）

1. 打开 [vercel.com/new](https://vercel.com/new)
2. 点击 **"Import Git Repository"**
3. 选择 GitHub 账号授权（首次需要）
4. 选择 **your-username/yaoyi-map** 仓库 → **Import**
5. **配置项目设置**（Vercel 通常自动识别）：

| 字段 | 值 |
| ---- | -- |
| Framework Preset | **Vite** |
| Root Directory | `./` |
| Build Command | `npm run build`（自动） |
| Output Directory | `dist`（自动） |
| Install Command | `npm ci` |

6. **环境变量**（暂时留空，先点 Deploy，部署完成后配置）
7. 点击 **Deploy**
8. 等待 1-3 分钟构建完成
9. 部署成功后访问 `https://yaoyi-map-xxx.vercel.app`

### 3.3 方案 B：Cloudflare Pages

1. 登录 [dash.cloudflare.com](https://dash.cloudflare.com)
2. 选择 **Workers & Pages** → Create application → Pages → Connect to Git
3. 选择 GitHub → 选 **yaoyi-map**
4. 配置：
   - **Framework preset**：Vite
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
5. 点击 **Save and Deploy**

### 3.4 方案 C：Docker（生产环境）

```bash
# 在生产服务器上（需先 SSH 连接）
git clone https://github.com/your-username/yaoyi-map.git
cd yaoyi-map
cp .env.example .env.production
# 编辑 .env.production 填入真实密钥
nano .env.production  # 或 vim / VSCode Remote

# 启动
docker compose --env-file .env.production up -d --build

# 验证
curl -fsS http://localhost/healthz
```

### 3.5 平台绑定后的回调配置

部署平台会请求 GitHub 仓库的 **webhook**（自动）：
- Vercel、Netlify、Cloudflare：连接到 GitHub OAuth，在仓库 Settings → Webhooks 添加
- 此后 `git push` 自动触发部署

---

## 4. 环境变量配置

### 4.1 必需配置（按部署平台）

#### Vercel / Cloudflare Pages

到 Dashboard → 项目 Settings → Environment Variables，添加：

| Key | Value 示例 | 必需 | 备注 |
| --- | --- | --- | --- |
| `VITE_MONITOR_ENDPOINT` | `https://sentry.io/api/<your-dsn>/store/` | 否 | 错误上报 |
| `VITE_MONITOR_SAMPLE` | `1.0` | 否 | 上报采样率 |
| `VITE_API_BASE_URL` | `https://api.yaoyi.com` | 否 | 后端 API |

⚠ **不要在 Vercel 设置 `NODE_ENV`**，平台会自动设置。

#### Docker / 生产服务器

写入 `/.env.production`（**不要 commit**）：

```bash
# 复制模板
cp .env.example .env.production

# 编辑真实值（使用 nano/vim）
nano .env.production

# 至少修改以下项：
# VITE_MONITOR_ENDPOINT=https://your-sentry-endpoint
# VITE_MONITOR_SAMPLE=1.0

# 启动
docker compose --env-file .env.production up -d --build
```

### 4.2 GitHub Secrets（CI/CD 用）

到 **GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret**：

| Secret 名称 | 示例值 | 用途 |
| ----------- | ------ | ---- |
| `PROD_HOST` | `8.8.8.8` 或 `yaoyi.example.com` | 生产服务器地址 |
| `PROD_USER` | `root` 或 `ubuntu` | SSH 用户名 |
| `PROD_SSH_KEY` | （完整 SSH 私钥内容） | SSH 私钥，用于部署脚本登录 |
| `GHCR_TOKEN` | （自动由 `${{ secrets.GITHUB_TOKEN }}` 提供） | Docker 镜像推送 GHCR |

⚠ **PROD_SSH_KEY 生成方式**：
```bash
# 在本地生成专用部署密钥
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy
# 复制私钥到 GitHub Secret
cat ~/.ssh/github_deploy
# 复制公钥到生产服务器的 ~/.ssh/authorized_keys
ssh-copy-id -i ~/.ssh/github_deploy.pub user@server
```

### 4.3 验证 GitHub Actions secrets

部署一次失败后查看 Settings → Actions → Run history → 点击运行 → 错误信息会提示缺失的 secret 名。

---

## 5. 首次部署执行

### 5.1 Vercel 首次部署示例

部署触发后，会进入 "Building" 状态：

```
✓ Cloning repository
✓ Installing dependencies (npm ci)
✓ Running build (npm run build)
  → tsc -b
  → vite v6.4.3 building for production
  → 1682 modules transformed
  → dist/index.html (1.39 KB)
  → dist/assets/index-*.css (76 KB)
  → dist/assets/index-*.js (961 KB)
✓ Uploading build outputs
✓ Deployment in progress
✓ Live at https://yaoyi-map-xxx.vercel.app
```

**预计耗时**：2-5 分钟

### 5.2 监控部署日志

#### Vercel Dashboard
- 进入 Vercel Dashboard → 项目 → Deployments
- 点击当前部署 → 查看 "Build Logs" 和 "Function Logs"

#### GitHub Actions
- 仓库 → Actions → 选择运行的工作流
- 展开 "build" / "docker" / "deploy-prod" job 查看日志

### 5.3 常见构建错误与修复

| 错误信息 | 原因 | 解决方案 |
| -------- | ---- | -------- |
| `npm ERR! peer dep missing` | 依赖冲突 | `npm install --legacy-peer-deps` 或更新 lockfile |
| `tsc: error TS####` | 类型错误 | `npm run check` 本地修复后再 push |
| `vite build: out of memory` | 构建内存不足 | 升级 Node 内存 `NODE_OPTIONS='--max-old-space-size=4096'` |
| `EACCES permission denied` | 文件权限 | `chmod +x scripts/*.sh` |
| `Cannot find module '@/...'` | 路径别名未生效 | 确保 `tsconfig.json` 中 `paths: { "@/*": ["src/*"] }` |
| `Error: Cannot find package '@vitejs/plugin-react'` | 依赖未安装 | `npm ci` 而非 `npm install` |
| GitHub Actions: `Cannot connect to the Docker daemon` | Runner 无 docker | 使用 `docker/build-push-action@v5` 而非本地 docker |
| Vercel: `Build failed: No output directory found` | 构建未产出 dist | 检查 `npm run build` 是否成功 |

### 5.4 部署成功后立即验证

```bash
# 替换为你的部署 URL
URL="https://yaoyi-map-xxx.vercel.app"

# 基础健康检查
curl -fsS -o /dev/null -w "Status: %{http_code}\n" $URL/

# HTML 内容检查
curl -fsS $URL/ | grep "id=\"root\""

# GeoJSON 端点
curl -fsS -o /dev/null -w "Map: %{http_code}\n" $URL/map/100000.json

# 健康/监控端点（仅 Docker 部署）
curl -fsS $URL/healthz  # → "ok"
curl -fsS $URL/metrics  # → "yaoyi_map_build_info{...} 1"
```

---

## 6. 部署后功能验证

### 6.1 自动化测试脚本

**推荐**：复用项目自带的自动化验证脚本 [scripts/verify-fixes-2026-07-27.mjs](file:///c:/Users/26457/Downloads/trae%E6%96%87%E4%BB%B6%E5%A4%B9/map/scripts/verify-fixes-2026-07-27.mjs)。

修改脚本顶部的 URL 常量：

```javascript
// scripts/verify-fixes-2026-07-27.mjs 第 32 行
const URL = 'https://yaoyi-map-xxx.vercel.app/';  // 改为你部署的 URL
```

然后运行：

```bash
node scripts/verify-fixes-2026-07-27.mjs
```

**期望结果**：16/17 通过（剩余 1 个为 dev 模式 Strict Mode 行为，生产环境无影响）。

### 6.2 手动验证清单

部署成功后，手动打开浏览器访问生产 URL：

| 测试项 | 操作 | 期望 |
| ------ | ---- | ---- |
| ✅ 主界面加载 | 直接访问 | 9 秒内显示主界面，无 JS 错误 |
| ✅ 省份选择 | 点击顶部的"广西"按钮 | 地图飞到广西，显示下辖县 |
| ✅ 关于瑶医 | 点击右上角按钮 | 弹出瑶医基础知识模态框 |
| ✅ 草药搜索 | 在搜索框输入"丹参" | 显示丹参详情 |
| ✅ 移动端访问 | 用手机访问或 DevTools 模拟 390x844 | 布局自适应 |
| ✅ 网络状态 | 打开 DevTools → Network | 所有资源加载状态 200 |
| ✅ 控制台错误 | DevTools → Console | 无 error |
| ✅ CSP 头 | 查看 Network → Response Headers | 应包含 CSP / X-Frame-Options 等 |

### 6.3 跨域与资源加载验证

```bash
# 测试 CSP 设置（应该看到 x-frame-options 等）
curl -fsSI https://yaoyi-map-xxx.vercel.app/

# 期望的安全头：
# x-content-type-options: nosniff
# x-frame-options: SAMEORIGIN  
# referrer-policy: strict-origin-when-cross-origin
```

### 6.4 性能验证（Lighthouse）

```bash
# 全局安装（一次性）
npm install -g lighthouse

# 运行测试
lighthouse https://yaoyi-map-xxx.vercel.app \
  --output=json --output-path=./lighthouse.json \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo
```

**期望指标**：

| 指标 | 期望值 | 阈值 |
| ---- | ------ | ---- |
| Performance | > 85 | ≥ 90 更优 |
| FCP | < 1.5s | < 1.0s 更优 |
| LCP | < 2.5s | < 2.0s 更优 |
| TTI | < 3.0s | < 2.5s 更优 |
| CLS | < 0.1 | < 0.05 更优 |
| Accessibility | > 90 | ≥ 95 更优 |

---

## 7. 自动化部署规则配置

### 7.1 已就绪的 GitHub Actions

✅ 项目已包含 [.github/workflows/deploy.yml](file:///c:/Users/26457/Downloads/trae%E6%96%87%E4%BB%B6%E5%A4%B9/map/.github/workflows/deploy.yml)（169 行）。

**已配置的触发规则**：

| 事件 | 触发 | 行为 |
| ---- | ---- | ---- |
| `push` to `main` | main 分支推送 | CI → Docker 构建 → 推 GHCR |
| `push` tag `v*` | 标签推送 | 同上（可用于灰度发布） |
| `pull_request` to `main` | PR | 仅跑 CI（lint + build） |

### 7.2 启用部署到生产服务器

#### 7.2.1 添加 GitHub Secrets

到仓库 **Settings → Secrets and variables → Actions → New repository secret**：

| Name | Value |
| ---- | ----- |
| `PROD_HOST` | `8.8.8.8` 或 `yaoyi.example.com`（生产服务器 IP / 域名） |
| `PROD_USER` | 服务器 SSH 用户名（如 `root` 或 `ubuntu`） |
| `PROD_SSH_KEY` | 完整 SSH 私钥（见 4.2 章节生成方式） |

#### 7.2.2 触发部署

```bash
# 修改代码后
git add -A
git commit -m "feat: 新增某某功能"
git push origin main

# GitHub Actions 自动：
# 1. 跑 CI（lint + type-check + build）→ 约 1-2 分钟
# 2. 构建 Docker 镜像 → 约 2-3 分钟
# 3. 推送到 GHCR → 约 30 秒
# 4. SSH 部署到生产服务器 → 约 1 分钟
# 合计：约 5-7 分钟从 push 到线上
```

### 7.3 分支策略（推荐）

```
main         ←  生产环境（自动部署）
dev          ←  预发环境（可选）
feature/*    ←  功能开发
hotfix/*     ←  紧急修复
```

如需要 `dev` 自动部署到 staging 服务器，可添加并行 workflow：

```yaml
# .github/workflows/deploy-staging.yml
on:
  push:
    branches: [dev]
jobs:
  deploy:
    # 类似 deploy.yml，但部署到不同的服务器
```

### 7.4 灰度发布（Tag 触发）

```bash
git tag v1.0.1-rc.1    # Release Candidate
git push origin v1.0.1-rc.1

# GitHub Actions 自动构建 + GHCR 标记
# 部署到 staging 验证
```

---

## 8. 故障告警与通知机制

### 8.1 GitHub Actions 告警（内置）

✅ **工作流运行失败时自动发送邮件**给仓库的 watchers 与 collaborators。

**配置额外通知**（Slack / Discord / 钉钉）：

到仓库 **Settings → Integrations**：
- **Slack**：安装 GitHub App，配置 channel
- **Discord**：Webhook URL 接收
- **钉钉 / 飞书**：通过 GitHub Action 配置

示例（[.github/workflows/deploy.yml](file:///c:/Users/26457/Downloads/trae%E6%96%87%E4%BB%B6%E5%A4%B9/map/.github/workflows/deploy.yml) 末尾追加）：

```yaml
- name: Notify on failure
  if: failure()
  uses: slackapi/slack-github-action@v1.27.0
  with:
    payload: |
      {
        "text": ":x: Deployment failed for ${{ github.repository }}@${{ github.sha }}\nCheck: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
      }
    env:
      SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 8.2 应用层监控（生产环境）

✅ 已通过 [src/lib/monitoring.ts](file:///c:/Users/26457/Downloads/trae%E6%96%87%E4%BB%B6%E5%A4%B9/map/src/lib/monitoring.ts) 实现：

#### 启用 Sentry 集成

```bash
# 1. 注册 Sentry.io 并创建 React 项目，获取 DSN
# 2. 在 Vercel Dashboard → Environment Variables 添加：
VITE_MONITOR_ENDPOINT=https://o123456.ingest.sentry.io/api/123/envelope/
VITE_MONITOR_SAMPLE=1.0
```

应用启动时会自动：
- 捕获 `window.onerror`（JS 异常）
- 捕获 `unhandledrejection`（Promise 拒绝）
- 上报 navigation timing（性能指标）

#### 自建日志服务

如果有自建的 ELK / Loki：

```javascript
// 在 index.html 中
<script>
  window.__YAOYI_MONITOR_ENDPOINT__ = 'https://logs.your-domain.com/api/ingest';
  window.__YAOYI_MONITOR_SAMPLE__ = '1.0';
</script>
```

### 8.3 Uptime 监控（推荐第三方）

| 服务 | URL | 免费配额 |
| ---- | --- | -------- |
| UptimeRobot | uptimerobot.com | 50 monitors / 5 min 间隔 |
| Better Uptime | betteruptime.com | 10 monitors |
| Cronitor | cronitor.com | 5 monitors |

**添加监控**：
- URL: `https://yaoyi-map-xxx.vercel.app/healthz`
- 期望：返回 `200 + "ok"`
- 检查频率：1-5 分钟
- 告警渠道：邮件 / Slack

---

## 9. 部署文档维护

### 9.1 文档清单（项目根目录）

| 文档 | 用途 | 何时更新 |
| ---- | ---- | -------- |
| [README.md](README.md) | 项目介绍 | 添加新功能时 |
| [QUICKSTART.md](QUICKSTART.md) | 快速启动 | 新增 npm scripts 时 |
| [DEPLOY.md](DEPLOY.md) | 完整部署指南 | 部署流程变更时 |
| [GITHUB_DEPLOY_GUIDE.md](GITHUB_DEPLOY_GUIDE.md) | 本文档 | 部署平台或 CI/CD 变更时 |
| [.github/workflows/deploy.yml](.github/workflows/deploy.yml) | CI/CD | 新增 job 时 |
| [CHANGES.md](CHANGES.md)（如有） | 变更日志 | 每次发版 |

### 9.2 部署后必须更新的文档

✅ **本项目已交付的所有文档**：
- `DEPLOY.md` (536 行) - 通用部署（Docker / Vercel / Cloudflare）
- `GITHUB_DEPLOY_GUIDE.md` (本文) - GitHub 完整流程
- `logs/deployment-2026-07-27/DEPLOYMENT_REPORT.md` - 本次交付报告

### 9.3 常见问题排查（FAQ）

#### Q1: 推送后 GitHub Actions 显示红色叉（failed）

**排查步骤**：
1. GitHub 仓库 → Actions → 点击失败的工作流
2. 展开失败 step 查看日志
3. 常见原因：
   - `npm ci` 失败：网络问题，配置 `.npmrc` 用镜像
   - `npm run build` 失败：本地 `npm run check` 修复 TS 错误
   - Docker build 超时：网络问题，重试

#### Q2: Vercel 部署成功但页面 404

- 排查：`vercel.json` 已配置 SPA fallback：`{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`
- 如果没有，确认 Vercel 框架识别为 Vite（Output 应该是 `dist`）

#### Q3: 部署后地图显示空白

- 检查 Network 控制台：`/map/100000.json` 是否 200
- CSP 头可能阻止外部资源：调整 `docker/conf.d/yaoyi.conf` CSP 策略

#### Q4: 容器健康检查失败

```bash
docker ps                              # 查容器状态
docker logs yaoyi-map                 # 查应用日志
docker exec yaoyi-map curl -fsS http://localhost/healthz
# 常见问题：HEALTHCHECK 间隔太短 / nginx 配置有误
```

#### Q5: Git push 认证失败

```bash
# 推荐使用 Personal Access Token (PAT)
git remote set-url origin https://<TOKEN>@github.com/your-username/yaoyi-map.git

# 或使用 SSH
ssh-keygen -t ed25519 -C "your-email"
# 把 ~/.ssh/id_ed25519.pub 添加到 GitHub Settings → SSH Keys
git remote set-url origin git@github.com:your-username/yaoyi-map.git
```

### 9.4 版本回滚 SOP

#### Vercel
1. Dashboard → Deployments
2. 找到正常的历史部署 → 点击三点菜单 → **"Promote to Production"**

#### Docker / GitHub Actions
```bash
# 在 GitHub 上找到上一个工作的 commit SHA
# 仓库 → Commits → 点击复制 SHA
git revert <bad-commit-sha>   # 或 git revert HEAD
git push origin main            # 触发自动部署到上一个版本
```

#### GitHub Container Registry (GHCR)
```bash
# 拉取上一个版本的镜像
docker pull ghcr.io/your-username/yaoyi-map:sha-abc1234

# 在服务器上重新打 tag 并启动
docker tag ghcr.io/your-username/yaoyi-map:sha-abc1234 yaoyi-map:current
docker compose up -d
```

---

## 🎯 完整部署流程 Checklist

- [ ] **Step 0**：本机安装 Git、Node 18+、可选 gh CLI
- [ ] **Step 1**：注册 GitHub 账号，创建空仓库 `yaoyi-map`
- [ ] **Step 2**：运行 `.\scripts\github-deploy.ps1 -GitHubUser "your-name"` 或 `bash github-deploy.sh your-name`
- [ ] **Step 3**：到 GitHub 验证所有文件已 push，排除 `node_modules/` 等
- [ ] **Step 4**：选择部署平台（推荐 Vercel 一键）
- [ ] **Step 5**：导入仓库，平台自动识别为 Vite 项目
- [ ] **Step 6**：配置环境变量（如 `VITE_MONITOR_ENDPOINT`）
- [ ] **Step 7**：点击 Deploy，等待 2-5 分钟
- [ ] **Step 8**：访问分配的 URL，验证主界面加载
- [ ] **Step 9**：跑 `node scripts/verify-fixes-2026-07-27.mjs` 自动化测试
- [ ] **Step 10**：（可选）配置 GitHub Secrets 启用自动部署到生产服务器
- [ ] **Step 11**：（可选）添加 Uptime 监控 + Sentry 集成
- [ ] **Step 12**：在 README 中更新线上 URL 链接

---

## 📚 延伸阅读

- [DEPLOY.md](DEPLOY.md) - 详细的 4 种部署方案
- [Vercel 官方文档](https://vercel.com/docs)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Docker 部署最佳实践](https://docs.docker.com/develop/dev-best-practices/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

---

**文档版本**：v1.0.0 (2026-07-27)  
**维护责任人**：DevOps Team  
**审核周期**：每次发版前
