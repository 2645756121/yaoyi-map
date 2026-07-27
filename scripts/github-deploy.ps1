# =============================================================================
# GitHub 仓库初始化与首次推送自动化脚本 (Windows PowerShell)
# =============================================================================
# 使用：
#   1. 在项目根目录打开 PowerShell
#   2. 执行：Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   3. 执行：.\scripts\github-deploy.ps1 -GitHubUser "your-username" -RepoName "yaoyi-map"
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubUser,

    [Parameter(Mandatory = $false)]
    [string]$RepoName = "yaoyi-map",

    [Parameter(Mandatory = $false)]
    [ValidateSet("public", "private")]
    [string]$Visibility = "public",

    [Parameter(Mandatory = $false)]
    [string]$Branch = "main",

    [Parameter(Mandatory = $false)]
    [switch]$SkipInstall,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# ---- 颜色输出 ----
function Write-Header($text) { Write-Host "`n========================================" -ForegroundColor Cyan; Write-Host " $text" -ForegroundColor Cyan; Write-Host "========================================`n" -ForegroundColor Cyan }
function Write-Step($text)   { Write-Host "▶ $text" -ForegroundColor Yellow }
function Write-OK($text)     { Write-Host "✓ $text" -ForegroundColor Green }
function Write-Err($text)    { Write-Host "✗ $text" -ForegroundColor Red }

# ---- 0. 前置检查 ----
Write-Header "0. 前置检查"

if (-not $SkipInstall) {
    # 检查 git
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Err "Git 未安装！请先安装 Git for Windows："
        Write-Host "  https://git-scm.com/download/win" -ForegroundColor Yellow
        Write-Host "  或使用：winget install Git.Git" -ForegroundColor Yellow
        exit 1
    }
    Write-OK "Git 已安装：$(git --version)"

    # 检查 gh CLI（可选）
    $hasGh = $false
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        $hasGh = $true
        Write-OK "GitHub CLI 已安装：$(gh --version | Select-Object -First 1)"
    } else {
        Write-Host "  ⚠ GitHub CLI (gh) 未检测到，将使用 SSH/HTTPS 推送" -ForegroundColor Yellow
    }
}

# ---- 1. 项目基础信息检查 ----
Write-Header "1. 项目基础信息"

if (-not (Test-Path package.json)) {
    Write-Err "当前目录没有 package.json，请进入项目根目录"
    exit 1
}
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
Write-OK "package.json 名称：$($pkg.name)"
Write-OK "package.json 版本：$($pkg.version)"
Write-OK "构建脚本：$($pkg.scripts.build)"
Write-OK "开发脚本：$($pkg.scripts.dev)"

# 检查 .gitignore
if (-not (Test-Path .gitignore)) {
    Write-Err "缺少 .gitignore 文件"
    exit 1
}
Write-OK ".gitignore 已存在"

# 检查 Dockerfile 与 DEPLOY.md
foreach ($f in @("Dockerfile", "DEPLOY.md", "docker-compose.yml", ".env.example")) {
    if (Test-Path $f) {
        Write-OK "$f 已就绪"
    } else {
        Write-Step "  ⚠ $f 缺失（建议补充）"
    }
}

# ---- 2. Git 仓库初始化 ----
Write-Header "2. Git 仓库初始化"

if (Test-Path .git) {
    Write-Step ".git 目录已存在，跳过初始化"
} else {
    Write-Step "执行 git init"
    if ($DryRun) { Write-Host "(DryRun) git init" } else { git init }
    Write-OK "Git 仓库初始化完成"
}

Write-Step "配置本地用户信息（如未配置）"
if ($DryRun) {
    Write-Host "(DryRun) git config user.email / user.name"
} else {
    $currentEmail = git config user.email
    $currentName  = git config user.name
    if ([string]::IsNullOrWhiteSpace($currentEmail)) {
        git config user.email "${GitHubUser}@users.noreply.github.com"
        Write-OK "设置 user.email = ${GitHubUser}@users.noreply.github.com"
    }
    if ([string]::IsNullOrWhiteSpace($currentName)) {
        git config user.name  "$GitHubUser"
        Write-OK "设置 user.name = $GitHubUser"
    }
}

# 默认分支
Write-Step "切换到默认分支：$Branch"
if ($DryRun) {
    Write-Host "(DryRun) git checkout -B $Branch"
} else {
    git checkout -B $Branch 2>$null
    Write-OK "当前分支：$(git branch --show-current)"
}

# ---- 3. 处理敏感文件 ----
Write-Header "3. 敏感文件检查"

if (Test-Path .env) {
    Write-Step "发现 .env 文件，自动移出追踪（如已追踪）"
    if ($DryRun) { Write-Host "(DryRun) git rm --cached .env" } else {
        git rm --cached .env 2>$null
        Write-OK ".env 已从 git 索引移除"
    }
} else {
    Write-OK ".env 不存在（安全）"
}

if (Test-Path .env.production) {
    Write-Step "发现 .env.production（生产配置），自动移出追踪"
    if ($DryRun) { Write-Host "(DryRun) git rm --cached .env.production" } else {
        git rm --cached .env.production 2>$null
    }
}

# ---- 4. 文件统计 ----
Write-Header "4. 待提交文件统计"
Write-Step "统计 src/ 与配置文件"
$trackedExts = @("ts", "tsx", "js", "jsx", "json", "css", "html", "md", "yml", "yaml", "Dockerfile", "conf", "svg")

# ---- 5. 首次提交 ----
Write-Header "5. 创建首次提交"

if ($DryRun) {
    Write-Host "(DryRun) git add -A"
    Write-Host "(DryRun) git commit -m '...'"
    Write-Host "(DryRun) git remote add origin ..."
    Write-Host "(DryRun) git push -u origin $Branch"
    exit 0
}

Write-Step "git add -A"
git add -A
$status = git status --short
$stagedCount = ($status | Measure-Object).Count
Write-OK "已暂存 $stagedCount 个文件变更"

if ($stagedCount -eq 0) {
    Write-Step "无新文件可提交，跳过 commit"
} else {
    Write-Step "创建首次提交"
    $commitMsg = @"
feat: initial release v$($pkg.version)

- React 18 + TypeScript + Vite 6 瑶医分布地图
- Leaflet 地图 + 9 省份交互
- 草药目录 + 搜索 + 关于瑶医 modal
- Docker 多阶段构建 + nginx 配置
- GitHub Actions CI/CD + GHCR 发布
- 完整 DEPLOY.md 与 .env.example
"@
    git commit -m $commitMsg
    Write-OK "首次提交完成"
}

# ---- 6. 远程仓库 ----
Write-Header "6. GitHub 远程仓库绑定"

$remoteUrl = "https://github.com/$GitHubUser/$RepoName.git"
$existingRemote = git remote get-url origin 2>$null

if ($existingRemote -eq $remoteUrl) {
    Write-OK "远程 origin 已正确绑定：$remoteUrl"
} elseif ($existingRemote) {
    Write-Step "更新现有远程：$existingRemote → $remoteUrl"
    git remote set-url origin $remoteUrl
    Write-OK "已更新"
} else {
    Write-Step "添加远程 origin：$remoteUrl"
    git remote add origin $remoteUrl
    Write-OK "已添加"
}

# ---- 7. 推送 ----
Write-Header "7. 推送到 GitHub"

Write-Step "执行：git push -u origin $Branch"
Write-Host "  ⚠ 如果推送失败：可能是因为 GitHub 仓库尚未创建、或认证失败" -ForegroundColor Yellow
Write-Host "  → 请先在 https://github.com/new 创建仓库 '$RepoName'" -ForegroundColor Yellow
Write-Host "  → 并选择：$Visibility / 不要勾选 'Add a README file'（避免冲突）" -ForegroundColor Yellow
Write-Host ""

$pushResult = git push -u origin $Branch 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-OK "推送成功！"
    Write-Host "`n🎉 项目已推送到 https://github.com/$GitHubUser/$RepoName`n" -ForegroundColor Green
} else {
    Write-Err "推送失败："
    Write-Host $pushResult
    Write-Host "`n补救步骤：" -ForegroundColor Yellow
    Write-Host "  1. 在 GitHub 上创建仓库：https://github.com/new"
    Write-Host "     名称: $RepoName"
    Write-Host "     可见性: $Visibility"
    Write-Host "     不要勾选 Add README / Add .gitignore / Add license"
    Write-Host "  2. 创建后再重新执行：.\scripts\github-deploy.ps1 -GitHubUser $GitHubUser -RepoName $RepoName"
}

# ---- 8. 后续步骤指南 ----
Write-Header "8. 推送完成后下一步"

Write-Host "✅ 在 GitHub 上检查：https://github.com/$GitHubUser/$RepoName" -ForegroundColor Cyan
Write-Host ""
Write-Host "接下来选择部署平台：" -ForegroundColor Yellow
Write-Host "  方案 A (推荐演示)：Vercel"
Write-Host "    → https://vercel.com/new"
Write-Host "    → Import GitHub Repo → 选择 $RepoName"
Write-Host "    → Framework: Vite"
Write-Host "    → Build: npm run build"
Write-Host "    → Output: dist"
Write-Host "    → Deploy！"
Write-Host ""
Write-Host "  方案 B (生产环境)：Docker / 云厂商"
Write-Host "    → SSH 到服务器，执行："
Write-Host "       git clone https://github.com/$GitHubUser/$RepoName.git"
Write-Host "       cd $RepoName"
Write-Host "       cp .env.example .env.production"
Write-Host "       docker compose --env-file .env.production up -d -d --build"
Write-Host ""
Write-Host "环境变量配置（无论哪种方案）：" -ForegroundColor Yellow
Write-Host "  ⚠ 真实密钥绝不提交到仓库"
Write-Host "  → Vercel：Dashboard → Settings → Environment Variables"
Write-Host "  → Docker：写入 .env.production（已在 .gitignore 中）"
Write-Host "  → GitHub Actions：Settings → Secrets and variables → Actions"
Write-Host ""
Write-Host "下一步：配置自动部署（CI/CD）" -ForegroundColor Yellow
Write-Host "  ✅ 已就绪：.github/workflows/deploy.yml"
Write-Host "  → 在 GitHub Repo → Settings → Secrets 添加："
Write-Host "     - PROD_HOST：服务器 IP / 域名"
Write-Host "     - PROD_USER：SSH 用户名"
Write-Host "     - PROD_SSH_KEY：SSH 私钥"
Write-Host ""
Write-Host "🎯 完整指南：详见 DEPLOY.md"
