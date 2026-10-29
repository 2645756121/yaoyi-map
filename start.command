#!/usr/bin/env bash
# macOS 用户双击启动（Finder 中右键打开或直接双击）
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
chmod +x "$DIR/start.sh"
"$DIR/start.sh"
echo ""
echo "按任意键关闭窗口..."
read -n 1