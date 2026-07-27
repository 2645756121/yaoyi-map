# =============================================================================
# 瑶医分布地图 - 生产环境 Docker 镜像
# =============================================================================
# 多阶段构建：
#   1) deps    - 安装生产依赖
#   2) builder - 类型检查 + Vite 构建
#   3) runtime - 基于 nginx:alpine 提供静态服务
# 目标镜像大小：< 25 MB
# 启动时间：< 1 秒
# =============================================================================

# =============================================================================
# Stage 1: deps - 安装生产依赖
# =============================================================================
FROM node:20-alpine AS deps

# 国内构建加速（取消注释启用）
# RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories

WORKDIR /app

# 复制依赖清单先行缓存
COPY package.json package-lock.json* ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm ci --no-audit --no-fund --prefer-offline \
    || npm install --no-audit --no-fund --prefer-offline

# =============================================================================
# Stage 2: builder - 类型检查 + 生产构建
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# 复用 Stage 1 的 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 仅复制构建所需文件，提升缓存粒度
COPY package.json package-lock.json* tsconfig.json vite.config.ts ./
COPY index.html ./
COPY src ./src
COPY public ./public

# 构建参数与构建期环境变量
ARG VITE_APP_VERSION=1.0.0
ARG VITE_BUILD_TIME
ENV CI=true \
    NODE_ENV=production \
    VITE_APP_VERSION=${VITE_APP_VERSION} \
    VITE_BUILD_TIME=${VITE_BUILD_TIME}

# 构建（先 check 类型，再 build）
RUN npm run build

# 构建后验证
RUN test -f dist/index.html \
    && test -d dist/assets \
    && echo "✓ Build OK, dist size: $(du -sh dist | cut -f1)"

# =============================================================================
# Stage 3: runtime - 生产级 nginx 服务
# =============================================================================
FROM nginx:1.27-alpine AS runtime

# 安装基础工具（用于健康检查与维护）
RUN apk add --no-cache curl tini

# nginx 主配置
COPY docker/nginx.conf /etc/nginx/nginx.conf

# 站点配置（应用层）
COPY docker/conf.d/yaoyi.conf /etc/nginx/conf.d/yaoyi.conf

# 健康检查：ALB / K8s 探针
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost/healthz || exit 1

# 复制构建产物到 nginx 静态目录
COPY --from=builder /app/dist/ /usr/share/nginx/html/

# 自定义入口脚本：nginx 前台运行（容器主进程）
# 使用 tini 作为 PID 1 处理僵尸进程
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["nginx", "-g", "daemon off;"]

# 默认端口
EXPOSE 80 443

# 元数据
LABEL maintainer="yaoyi-map-team" \
      version="1.0.0" \
      description="瑶医分布交互式地图 - 生产环境 Docker 镜像" \
      org.opencontainers.image.source="https://github.com/your-org/yaoyi-map" \
      org.opencontainers.image.licenses="MIT"
