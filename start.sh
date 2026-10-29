#!/usr/bin/env bash
# 瑶医分布地图 - macOS / Linux 启动脚本
# 使用�?/start.sh [端口]

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PORT="${1:-${PORT:-5187}}"

echo ""
echo "============================================================"
echo "       瑶医分布地图 / YaoYi Medicine Map"
echo "============================================================"
echo ""

# 检�?Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js�?
  echo ""
  echo "请先安装 Node.js（建�?v18 或更高版本）�?
  echo "  官网下载: https://nodejs.org/"
  echo "  macOS 可使�? brew install node"
  echo "  Linux 可使�? sudo apt install nodejs npm"
  echo ""
  exit 1
fi

NODE_VER="$(node --version)"
echo "[信息] 检测到 Node.js $NODE_VER"
echo ""

# 检�?dist/ 目录
if [ ! -f "dist/index.html" ]; then
  echo "[警告] 未找�?dist/index.html�?
  echo "正在尝试构建生产版本..."
  echo ""
  npm run build
  if [ $? -ne 0 ]; then
    echo "[错误] 构建失败！请手动运行 'npm run build' 查看错误�?
    exit 1
  fi
fi

# 启动服务�?echo "[信息] 启动本地服务器（端口 $PORT�?.."
echo ""
echo "浏览器访问地址:"
echo "  http://localhost:$PORT"
echo ""
echo "�?Ctrl+C 停止服务�?
echo "============================================================"
echo ""

exec node server.cjs "$PORT"