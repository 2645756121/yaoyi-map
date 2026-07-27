#!/usr/bin/env bash
# =============================================================================
# GitHub 仓库初始化与首次推送自动化脚本 (macOS / Linux)
# =============================================================================
# 使用：
#   chmod +x scripts/github-deploy.sh
#   ./scripts/github-deploy.sh your-github-username [repo-name] [public|private]
#
# 示例：
#   ./scripts/github-deploy.sh zhangsan
#   ./scripts/github-deploy.sh zhangsan yaoyi-map private
# =============================================================================

set -euo pipefail

# ---- 参数解析 ----
GITHUB_USER="${1:-}"
REPO_NAME="${2:-yaoyi-map}"
VISIBILITY="${3:-public}"
BRANCH="main"
DRY_RUN="${DRY_RUN:-false}"

if [ -z "$GITHUB_USER" ]; then
    echo "❌ 用法: $0 <github-username> [repo-name=yaoyi-map] [visibility=public|private]"
    echo "   示例: $0 zhangsan yaoyi-map public"
    exit 1
fi

# ---- 颜色 ----
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

header()  { echo -e "${CYAN}\n========================================\n $1\n========================================${NC}"; }
step()    { echo -e "${YELLOW}▶ $1${NC}"; }
ok()      { echo -e "${GREEN}✓ $1${NC}"; }
err()     { echo -e "${RED}✗ $1${NC}"; }

run() {
    if [ "$DRY_RUN" = "true" ]; then
        echo "(DryRun) $*"
    else
        "$@"
    fi
}

# ---- 0. 前置检查 ----
header "0. 前置检查"
if ! command -v git >/dev/null 2>&1; then
    err "Git 未安装！"
    echo "  macOS:   brew install git"
    echo "  Linux:   sudo apt install git  /  sudo yum install git"
    exit 1
fi
ok "Git 已安装：$(git --version)"

if command -v gh >/dev/null 2>&1; then
    ok "GitHub CLI：$(gh --version | head -n1)"
fi

# ---- 1. 项目基础信息 ----
header "1. 项目基础信息"
if [ ! -f package.json ]; then
    err "当前目录没有 package.json，请进入项目根目录"
    exit 1
fi

PKG_NAME=$(node -p "require('./package.json').name")
PKG_VER=$(node -p "require('./package.json').version")
ok "package.json 名称：$PKG_NAME"
ok "package.json 版本：$PKG_VER"

for f in Dockerfile DEPLOY.md docker-compose.yml .env.example .gitignore; do
    [ -f "$f" ] && ok "$f 已就绪" || step "⚠ $f 缺失"
done

# ---- 2. Git 初始化 ----
header "2. Git 仓库初始化"

if [ -d .git ]; then
    step ".git 已存在"
else
    step "git init"
    run git init
    ok "Git 仓库初始化完成"
fi

step "配置本地用户（如未配置）"
CURRENT_EMAIL=$(git config user.email || true)
CURRENT_NAME=$(git config user.name || true)
if [ -z "$CURRENT_EMAIL" ]; then
    run git config user.email "${GITHUB_USER}@users.noreply.github.com"
    ok "user.email = ${GITHUB_USER}@users.noreply.github.com"
fi
if [ -z "$CURRENT_NAME" ]; then
    run git config user.name  "$GITHUB_USER"
    ok "user.name = $GITHUB_USER"
fi

step "切换到默认分支：$BRANCH"
run git checkout -B "$BRANCH" 2>/dev/null || true
ok "当前分支：$(git branch --show-current)"

# ---- 3. 敏感文件 ----
header "3. 敏感文件检查"

if [ -f .env ]; then
    step "发现 .env，移出追踪"
    run git rm --cached .env 2>/dev/null || true
    ok ".env 已从索引移除"
else
    ok ".env 不存在（安全）"
fi

[ -f .env.production ] && run git rm --cached .env.production 2>/dev/null || true

# ---- 4. 首次提交 ----
header "4. 首次提交"

run git add -A
STAGED=$(git status --short | wc -l)
ok "已暂存 $STAGED 个文件变更"

if [ "$STAGED" -eq 0 ]; then
    step "无新变更可提交"
else
    step "创建首次提交"
    COMMIT_MSG="feat: initial release v${PKG_VER}

- React 18 + TypeScript + Vite 6 瑶医分布地图
- Leaflet 地图 + 9 省份交互
- 草药目录 + 搜索 + 关于瑶医 modal
- Docker 多阶段构建 + nginx 配置
- GitHub Actions CI/CD + GHCR 发布
- 完整 DEPLOY.md 与 .env.example"
    run git commit -m "$COMMIT_MSG"
    ok "提交完成"
fi

# ---- 5. 远程仓库 ----
header "5. 远程仓库绑定"

REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
EXISTING_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ "$EXISTING_REMOTE" = "$REMOTE_URL" ]; then
    ok "origin 已绑定: $REMOTE_URL"
elif [ -n "$EXISTING_REMOTE" ]; then
    step "更新 origin: $EXISTING_REMOTE → $REMOTE_URL"
    run git remote set-url origin "$REMOTE_URL"
else
    step "添加 origin: $REMOTE_URL"
    run git remote add origin "$REMOTE_URL"
fi

# ---- 6. 推送 ----
header "6. 推送"

step "git push -u origin $BRANCH"
echo -e "${YELLOW}⚠ 如推送失败：可能因为 GitHub 仓库尚未创建，或认证失败${NC}"
echo -e "${YELLOW}  → 请先在 https://github.com/new 创建仓库 '$REPO_NAME'${NC}"
echo -e "${YELLOW}  → 可见性: $VISIBILITY${NC}"
echo ""

if [ "$DRY_RUN" = "true" ]; then
    echo "(DryRun) git push -u origin $BRANCH"
    exit 0
fi

set +e
PUSH_OUT=$(git push -u origin "$BRANCH" 2>&1)
PUSH_RC=$?
set -e

if [ $PUSH_RC -eq 0 ]; then
    ok "推送成功！"
    echo -e "${GREEN}\n🎉 项目已推送到 https://github.com/${GITHUB_USER}/${REPO_NAME}${NC}\n"
else
    err "推送失败："
    echo "$PUSH_OUT"
    echo -e "${YELLOW}补救步骤：${NC}"
    echo "  1. 在 GitHub 上创建仓库：https://github.com/new"
    echo "     名称: $REPO_NAME / $VISIBILITY"
    echo "     不要勾选 Add README / Add .gitignore"
    echo "  2. 重新执行：$0 $GITHUB_USER $REPO_NAME $VISIBILITY"
    exit 1
fi

# ---- 7. 后续步骤 ----
header "7. 后续部署步骤"

echo -e "${CYAN}✅ GitHub 仓库就绪：https://github.com/${GITHUB_USER}/${REPO_NAME}${NC}"
echo ""
echo -e "${YELLOW}接下来选择部署平台：${NC}"

cat <<EOF

  方案 A (推荐演示)：Vercel
    → https://vercel.com/new
    → Import GitHub Repo → 选择 ${REPO_NAME}
    → Framework: Vite
    → Build Command: npm run build
    → Output: dist
    → Deploy!

  方案 B (生产环境)：Docker / 云厂商
    → SSH 到服务器，执行：
       git clone https://github.com/${GITHUB_USER}/${REPO_NAME}.git
       cd ${REPO_NAME}
       cp .env.example .env.production
       docker compose --env-file .env.production up -d --build

环境变量配置：
  ⚠ 真实密钥绝不提交到仓库
  → Vercel：Dashboard → Settings → Environment Variables
  → Docker：写入 .env.production（已被 .gitignore 排除）
  → GitHub Actions：Settings → Secrets and variables → Actions

自动部署（CI/CD）：
  ✅ 已就绪：.github/workflows/deploy.yml
  → 配置 GitHub Secrets：
     - PROD_HOST：服务器 IP / 域名
     - PROD_USER：SSH 用户名
     - PROD_SSH_KEY：SSH 私钥
     - VITE_APP_VERSION：（自动注入）

🎯 完整指南：详见 DEPLOY.md
EOF
