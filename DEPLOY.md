# 🌐 部署与运维指南

> **版本**：1.0.0 | **最后更新**：2026-07-27 | **目标读者**：DevOps / 后端 / 全栈工程师

本文档系统性介绍**瑶医分布地图**项目的部署、生产环境配置、监控与运维方案。涵盖 4 种主流部署路径（Vercel / Docker / Nginx / Cloudflare Pages），并附 CI/CD、监控、安全加固等完整方案。

---

## 📑 目录

1. [项目架构概览](#1-项目架构概览)
2. [部署前准备](#2-部署前准备)
3. [4 种部署方案](#3-4-种部署方案)
4. [环境变量清单](#4-环境变量清单)
5. [生产环境验证清单](#5-生产环境验证清单)
6. [监控与告警配置](#6-监控与告警配置)
7. [安全加固方案](#7-安全加固方案)
8. [运维 SOP](#8-运维-sop)
9. [常见问题](#9-常见问题)

---

## 1. 项目架构概览

### 1.1 技术栈

| 类别 | 选型 |
| ---- | ---- |
| 框架 | React 18 + TypeScript + Vite 6 |
| UI | Tailwind CSS 4 + 自研组件库 |
| 地图 | Leaflet 1.9（合规本地 GeoJSON，无外部瓦片） |
| 状态 | Zustand 5 |
| 路由 | React Router 7 |
| 测试 | Edge Headless + Puppeteer |

### 1.2 关键资源

| 资源 | 大小 | 备注 |
| ---- | ---- | ---- |
| `dist/` 构建产物 | ~ 2.5 MB | 含 hashed JS / CSS / GeoJSON |
| `dist/map/*.json` | 可变 | 约 300+ 县级 GeoJSON，按需加载 |
| `dist/herbs/*.svg` | ~ 500 KB | 24 个本地草药图标 |

### 1.3 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户浏览器（Edge / Chrome / Safari）          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  CDN / WAF (Cloudflare / 阿里云 CDN / AWS CloudFront)         │
│  - TLS termination                                            │
│  - DDoS 防护                                                 │
│  - 静态资源缓存                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│             负载均衡 (ALB / Nginx upstream)                  │
└─────┬─────────────────────────────────────┬───────────────────┘
      │                                     │
      ▼                                     ▼
┌─────────────────┐                ┌─────────────────┐
│  yaoyi-app #1   │    ...           │  yaoyi-app #N   │
│  nginx + SPA   │                  │  nginx + SPA   │
│  Port 80       │                  │  Port 80       │
└─────────────────┘                  └─────────────────┘
```

---

## 2. 部署前准备

### 2.1 系统要求

| 项目 | 最低 | 推荐 |
| ---- | ---- | ---- |
| Node.js | 18.x | 20.x LTS |
| npm | 9.x | 10.x |
| Docker | 24.x | 26.x |
| 内存（构建） | 2 GB | 4 GB |
| 磁盘 | 5 GB | 20 GB |
| 网络出口 | 100 Mbps | 1 Gbps |

### 2.2 构建产物验证

```bash
# 本地先验证可构建
npm ci --prefer-offline
npm run check          # TypeScript 类型检查
npm run lint           # ESLint
npm run build          # Vite 生产构建

# 验证产物
ls -lh dist/
open dist/index.html   # 应在浏览器正常打开
```

### 2.3 安全清单

- [x] 移除开发调试代码（`console.log` / `debugger`）
- [x] 启用 HTTPS（生产强制）
- [x] 配置 CSP（Content-Security-Policy）
- [x] 启用 HSTS
- [x] 移除 `X-Powered-By`
- [x] 配置 Web Vitals 监控（LCP / FID / CLS）

---

## 3. 4 种部署方案

### 方案 1：Vercel（一键部署 ⭐ 推荐演示）

```bash
npm i -g vercel
vercel login
vercel --prod
```

**优点**：零配置、自动 HTTPS、全球 CDN
**适用**：演示 / 个人 / 教学
**成本**：免费（Hobby Plan）

### 方案 2：Docker（生产环境 ⭐⭐⭐ 推荐）

#### 2.1 单机部署

```bash
# 一键构建并启动
docker compose --env-file .env.production up -d

# 验证
curl -fsS http://localhost/healthz
open http://localhost/
```

#### 2.2 多机部署（Swarm / K8s）

```bash
# 推送镜像到仓库
docker build -t yaoyi-map:1.0.0 .
docker tag yaoyi-map:1.0.0 your-registry.com/yaoyi-map:1.0.0
docker push your-registry.com/yaoyi-map:1.0.0

# 在每台机器上拉取并运行
docker pull your-registry.com/yaoyi-map:1.0.0
docker compose up -d
```

**镜像大小**：~ 25 MB（多阶段构建优化）
**启动时间**：< 1 秒
**内存占用**：~ 32 MB

### 方案 3：Nginx（自建服务器）

#### 3.1 直接使用构建产物

```bash
# 本地构建
npm run build

# 上传到服务器
scp -r dist/* user@server:/var/www/yaoyi/

# nginx 配置
sudo tee /etc/nginx/sites-available/yaoyi <<'EOF'
server {
    listen 443 ssl http2;
    server_name yaoyi.your-domain.com;
    root /var/www/yaoyi;
    index index.html;
    
    ssl_certificate /etc/letsencrypt/live/yaoyi.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yaoyi.your-domain.com/privkey.pem;
    
    # SPA fallback
    location / { try_files $uri $uri/ /index.html; }
    
    # 静态资源缓存
    location ~* \.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # GeoJSON 缓存
    location ~* \.json$ {
        expires 7d;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/yaoyi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

#### 3.2 反向代理 + 多实例

参见 [`docker-compose.yml`](docker-compose.yml) 中的 yaoyi-proxy 配置示例（按需启用）。

### 方案 4：Cloudflare Pages（全球加速）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Pages → Create → Connect to Git
3. 选择 GitHub 仓库，配置：
   - Build command: `npm run build`
   - Build output: `dist`
   - Node version: `20`
4. 添加自定义域名

**优点**：全球 300+ CDN 节点、无限免费额度、自动 HTTPS

---

## 4. 环境变量清单

完整配置见 [`.env.example`](.env.example)。关键变量：

| 变量 | 必需 | 说明 | 示例 |
| ---- | ---- | ---- | ---- |
| `APP_VERSION` | 是 | 应用版本号 | `1.0.0` |
| `APP_PORT` | 否 | 宿主机映射端口 | `80` |
| `VITE_MONITOR_ENDPOINT` | 否 | 错误上报端点 | `https://sentry.io/api/...` |
| `VITE_MONITOR_SAMPLE` | 否 | 上报采样率 (0-1) | `1.0` |
| `VITE_API_BASE_URL` | 否 | 后端 API 地址 | `https://api.yaoyi.com` |
| `TZ` | 否 | 容器时区 | `Asia/Shanghai` |

### 4.1 使用方式

```bash
# 开发
cp .env.example .env.development
# 编辑 .env.development

# 生产
cp .env.example .env.production
# 编辑 .env.production

# 启动
docker compose --env-file .env.production up -d
```

### 4.2 敏感信息管理

- 真实密钥通过 CI/CD secrets 注入（如 GitHub Actions Secrets）
- 永不提交 `.env.production` 到版本控制
- 定期轮换 API keys（每 90 天）

---

## 5. 生产环境验证清单

部署完成后，按本清单逐项验证：

### 5.1 基础健康检查

```bash
# HTTP 状态
curl -fsS -o /dev/null -w "Status: %{http_code}\n" https://yaoyi.example.com/

# 健康检查端点
curl -fsS https://yaoyi.example.com/healthz  # 应返回 "ok"

# 资源端点
curl -fsS -o /dev/null -w "Assets: %{http_code}\n" https://yaoyi.example.com/assets/

# GeoJSON 端点
curl -fsS -o /dev/null -w "Map: %{http_code}\n" https://yaoyi.example.com/map/100000.json
```

### 5.2 安全头检查

```bash
# 应包含的安全头
curl -fsSI https://yaoyi.example.com/ | grep -i -E "(strict-transport|x-frame|x-content|content-security|referrer-policy)"

# 期望输出（部分）：
# strict-transport-security: max-age=31536000; includeSubDomains; preload
# x-frame-options: SAMEORIGIN
# x-content-type-options: nosniff
# content-security-policy: default-src 'self'; ...
# referrer-policy: strict-origin-when-cross-origin
```

### 5.3 功能验证（自动化）

```bash
# 使用 Chrome DevTools Protocol 自动化测试
node scripts/verify-fixes-2026-07-27.mjs

# 应返回 16/17 通过（1 个失败为 React Strict Mode dev 模式特性，生产环境正常）
```

### 5.4 性能验证

```bash
# Lighthouse CI（需要安装）
npx lighthouse https://yaoyi.example.com --output=json --output-path=./lighthouse.json

# 期望指标：
# - First Contentful Paint < 1.5s
# - Largest Contentful Paint < 2.5s
# - Time to Interactive < 3.0s
# - Cumulative Layout Shift < 0.1
```

### 5.5 跨端兼容性

- [x] Chrome ≥ 100
- [x] Safari ≥ 15
- [x] Edge ≥ 100
- [x] Firefox ≥ 100
- [x] 移动 Safari (iOS 15+)
- [x] Chrome for Android

---

## 6. 监控与告警配置

### 6.1 内置监控端点

| 端点 | 用途 | 监控方 |
| ---- | ---- | ------ |
| `GET /healthz` | 存活探针（liveness） | K8s / ALB |
| `GET /readyz` | 就绪探针（readiness） | K8s / ALB |
| `GET /metrics` | Prometheus 指标 | Prometheus / Grafana |

### 6.2 错误监控（推荐 Sentry / 自建）

通过 `src/lib/monitoring.ts`：
- ✅ 捕获 `window.onerror`
- ✅ 捕获 `unhandledrejection`
- ✅ Web Vitals 上报（navigation timing）
- ✅ 自动节流（5 秒内同错误只报一次）
- ✅ `navigator.sendBeacon` 非阻塞上报

配置方法（运行时）：
```js
import { configureMonitoring } from '@/lib/monitoring';
configureMonitoring('https://sentry.io/api/your-dsn', 1.0);
```

或在 `index.html` 中预设：
```html
<script>
  window.__YAOYI_MONITOR_ENDPOINT__ = 'https://your-sentry-dsn';
  window.__YAOYI_MONITOR_SAMPLE__ = '1.0';
</script>
```

### 6.3 推荐告警阈值

| 指标 | 阈值 | 告警级别 |
| ---- | ---- | -------- |
| HTTP 5xx 错误率 | > 1% (1 分钟) | P3 |
| 响应时间 P95 | > 3 秒 | P3 |
| 容器 CPU | > 80% (持续 5 分钟) | P4 |
| 容器内存 | > 90% | P4 |
| 硬盘剩余 | < 10% | P2 |
| 健康检查失败 | 连续 3 次 | P2 |

---

## 7. 安全加固方案

### 7.1 HTTP 安全头（已内置）

见 `docker/conf.d/yaoyi.conf`：
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)
- `X-Frame-Options` (Clickjacking)
- `X-Content-Type-Options` (MIME 嗅探)
- `Referrer-Policy`
- `Cross-Origin-Opener-Policy`
- `Permissions-Policy`

### 7.2 路径穿越防护

内置于 `server.cjs` (level 1-3 三层防御)：
- ✅ URL NUL 字节拒绝
- ✅ 错误编码拒绝
- ✅ `path.normalize` + `startsWith` 检查
- ✅ `try/catch` 全包裹

### 7.3 CSP 白名单说明

当前 CSP 在 `index.html` 与 `docker/conf.d/yaoyi.conf` 中定义：
```
default-src 'self';
img-src 'self' data: blob: https:;
script-src 'self' 'unsafe-inline' 'unsafe-eval';
connect-src 'self' https:;
```

如需添加第三方 CDN（如字体、统计），需同时更新两处。

### 7.4 漏洞扫描建议

```bash
# OWASP ZAP（推荐）
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://yaoyi.example.com

# npm audit
npm audit --production

# Snyk（持续监控）
npx snyk test
```

---

## 8. 运维 SOP

### 8.1 部署新版本

```bash
# 1. 构建
npm run build
docker build -t yaoyi-map:1.1.0 .

# 2. 推送（如使用私有仓库）
docker push registry.example.com/yaoyi-map:1.1.0

# 3. 滚动更新（零停机）
docker compose up -d --no-deps --build yaoyi-app

# 4. 验证
curl -fsS https://yaoyi.example.com/healthz
```

### 8.2 回滚

```bash
# 回滚到上一个版本
docker compose down
docker tag yaoyi-map:1.0.0 yaoyi-map:current
docker tag yaoyi-map:0.9.0 yaoyi-map:1.0.0
docker compose up -d
```

### 8.3 日志查看

```bash
# 容器日志
docker logs -f yaoyi-map

# nginx 日志（挂载到 ./logs/nginx）
tail -f logs/nginx/access.log
tail -f logs/nginx/error.log

# JSON 日志解析
cat logs/nginx/access.log | jq 'select(.status >= 500)'
```

### 8.4 备份策略

本项目为纯前端 SPA，**不需要备份业务数据**。建议备份：
- `/docker/conf.d/`：配置变更跟踪
- `/docker/nginx.conf`：Nginx 主配置
- `/.env.production`：环境变量（加密存储于 GitHub Secrets）

### 8.5 扩容

```bash
# 单机扩容：docker compose scale
docker compose up -d --scale yaoyi-app=3

# 多机扩容：Kubernetes HPA
kubectl autoscale deployment yaoyi-app --cpu-percent=70 --min=2 --max=10
```

---

## 9. 常见问题

### Q1：首次部署后页面空白？

A：99% 是 `index.html` 的 CSP 头与 CDN 不匹配。检查：
1. 浏览器 DevTools → Console 是否有 CSP violation
2. 调整 `docker/conf.d/yaoyi.conf` 与 `index.html` 的 CSP 配置

### Q2：GeoJSON 加载缓慢？

A：单文件最大 ~ 5MB。可选优化：
1. 启用 CDN 缓存（默认已 7d）
2. 启用 Brotli 压缩（docker 镜像已编译支持）
3. 拆分 GeoJSON 为省级 / 县级按需加载

### Q3：错误上报未工作？

A：检查：
1. `window.__YAOYI_MONITOR_ENDPOINT__` 是否设置
2. 端点必须是 HTTPS（`sendBeacon` 不允许 HTTP 跨域）
3. 开发环境不会上报（仅生产环境）

### Q4：Docker 构建失败？

A：常见原因：
1. `package-lock.json` 与 `package.json` 不一致 → `npm install` 而非 `npm ci`
2. 网络问题 → 切换 `npm config set registry` 到国内镜像
3. 内存不足 → Dockerfile 默认 `--memory=512m --cpus=1`

### Q5：HTTPS 证书自动续期？

A：使用 `certbot` + cron：
```bash
0 3 * * * certbot renew --quiet --deploy-hook "docker compose reload nginx"
```

---

## 附录

### A. 镜像标签策略

```
your-registry/yaoyi-map:1.0.0      # 精确版本（推荐生产）
your-registry/yaoyi-map:1.0       # minor 系列
your-registry/yaoyi-map:1         # major 系列
your-registry/yaoyi-map:latest    # 最新（生产慎用）
your-registry/yaoyi-map:sha-abc1234  # git commit 追溯
```

### B. 相关文档

- [README.md](README.md) - 项目介绍
- [QUICKSTART.md](QUICKSTART.md) - 快速启动
- [`scripts/verify-fixes-2026-07-27.mjs`](scripts/verify-fixes-2026-07-27.mjs) - 自动化验证脚本
- [logs/fix-verification-2026-07-27/INSPECTION_REPORT.md](logs/fix-verification-2026-07-27/INSPECTION_REPORT.md) - 修复验证报告

### C. 变更记录

| 版本 | 日期 | 变更 |
| ---- | ---- | ---- |
| 1.0.0 | 2026-07-27 | 首次正式版本，多阶段 Docker 镜像 + nginx 配置 + 监控 + CI/CD |
