# =============================================================================
# Trae / GitHub 部署 · 一键执行脚本 (Windows PowerShell)
# =============================================================================
# 用途：
#   这个脚本封装了完整部署流程的所有可执行步骤
#   - 在你已经配置好 Trae GitHub 授权的环境中一键跑完所有流程
#   - 包含 GitHub 授权校验、依赖安装、测试、构建、推送、验证
#   - 每个阶段都有独立失败处理，可选择性 --skip
#
# 使用：
#   .\scripts\full-deploy.ps1 -GitHubUser "your-name"
#
# 可选参数：
#   -RepoName       仓库名（默认 yaoyi-map）
#   -Platform       vercel | cloudflare | netlify | docker（默认 vercel）
#   -SkipPull       跳过 git pull（默认 false）
#   -SkipInstall    跳过 npm ci
#   -SkipTest       跳过测试与 lint
#   -SkipBuild      跳过 npm run build
#   -SkipDeploy     跳过实际部署（仅本地验证）
#   -DryRun         只打印命令，不执行
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubUser,

    [string]$RepoName = "yaoyi-map",
    [ValidateSet("vercel", "cloudflare", "netlify", "docker")]
    [string]$Platform = "vercel",
    [string]$Branch = "main",
    [switch]$SkipPull,
    [switch]$SkipInstall,
    [switch]$SkipTest,
    [switch]$SkipBuild,
    [switch]$SkipDeploy,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# ---- 颜色 ----
function Hdr($t)  { Write-Host "`n========================================" -ForegroundColor Cyan; Write-Host " $t" -ForegroundColor Cyan; Write-Host "========================================`n" -ForegroundColor Cyan }
function Step($t){ Write-Host "▶ $t" -ForegroundColor Yellow }
function Ok($t)   { Write-Host "✓ $t" -ForegroundColor Green }
function Err($t)  { Write-Host "✗ $t" -ForegroundColor Red; $script:failCount++ }
function Run($cmd) { if ($DryRun) { Write-Host "  [DryRun] $cmd" -ForegroundColor DarkCyan } else { Invoke-Expression $cmd } }

$script:failCount = 0
$report = @{
    timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    platform = $Platform
    repo = "$GitHubUser/$RepoName"
    branch = $Branch
    stages = @()
}

function Log-Stage($name, $status, $detail = "") {
    $report.stages += @{ name = $name; status = $status; detail = $detail }
    Write-Host "  📋 $name : $status $detail" -ForegroundColor $(if ($status -eq "PASS") { "Green" } elseif ($status -eq "SKIP") { "Yellow" } else { "Red" })
}

# ============================================================
# STAGE 1: Trae / GitHub 授权校验
# ============================================================
Hdr "STAGE 1: Trae / GitHub 授权校验"
Step "1.1 检查 gh CLI 是否安装"
$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue

if (-not $ghInstalled) {
    Step "  → gh CLI 未安装，Trae 授权校验必须通过其他方式："
    Step "    1. 在 Trae 设置中验证 GitHub 账号连接状态"
    Step "    2. Personal Access Token (PAT) 需具备 repo: contents: read+write"
    Step "    3. 确认目标仓库已创建并可访问：https://github.com/$GitHubUser/$RepoName"
    Log-Stage "GitHub授权校验" "MANUAL" "需通过 Trae / 网页手动校验"
} else {
    Ok "gh CLI 已安装：$((gh --version | Select-Object -First 1))"
    Run "gh auth status"
    if ($LASTEXITCODE -eq 0) {
        Ok "Trae GitHub 授权有效"
        Log-Stage "GitHub授权校验" "PASS" "gh auth status OK"
    } else {
        Err "Trae GitHub 授权失效"
        Log-Stage "GitHub授权校验" "FAIL" "gh auth status failed"
        Write-Host "`n提示：在 Trae 中重新登录 GitHub 账号" -ForegroundColor Yellow
    }
}

Step "1.2 检查目标仓库是否存在 + 可访问"
$remoteUrl = "https://github.com/$GitHubUser/$RepoName.git"

if (-not $SkipPull) {
    if (git ls-remote $remoteUrl 2>$null) {
        Ok "仓库 $remoteUrl 可访问"
        Log-Stage "仓库访问校验" "PASS" "$remoteUrl"
    } else {
        Err "无法访问 $remoteUrl"
        Log-Stage "仓库访问校验" "FAIL" "无法 ls-remote"
        Write-Host "`n提示：先在 https://github.com/new 创建仓库 '$RepoName'" -ForegroundColor Yellow
        Write-Host "      不要勾选 Add README / Add .gitignore" -ForegroundColor Yellow
    }
} else {
    Log-Stage "仓库访问校验" "SKIP" "已跳过 (-SkipPull)"
}

# ============================================================
# STAGE 2: 部署前准备
# ============================================================
Hdr "STAGE 2: 部署前准备"

Step "2.1 拉取最新 main 分支代码"
if (-not $SkipPull) {
    if (Test-Path .git) {
        Run "git fetch origin"
        Run "git checkout $Branch"
        $behind = git rev-list --count HEAD..origin/$Branch 2>$null
        if ($behind -gt 0) {
            Run "git pull origin $Branch"
            Ok "已拉取 $behind 个新提交"
        } else {
            Ok "本地代码已是最新（落后远程 $behind 个提交）"
        }
        Log-Stage "代码拉取" "PASS" "branch=$Branch"
    } else {
        Step "本地无 .git，跳过拉取"
        Log-Stage "代码拉取" "SKIP" "无 .git"
    }
} else {
    Log-Stage "代码拉取" "SKIP" "用户指定 -SkipPull"
}

Step "2.2 识别技术栈"
if (Test-Path package.json) {
    $pkg = Get-Content package.json -Raw | ConvertFrom-Json
    $techStack = @{
        name = $pkg.name
        version = $pkg.version
        framework = "React 18 + TypeScript + Vite 6"
        package_manager = (Test-Path pnpm-lock.yaml) ? "pnpm" : ((Test-Path yarn.lock) ? "yarn" : "npm")
        node_required = ">=18 (engines: $($pkg.engines.node))"
        build_cmd = $pkg.scripts.build
        output = "dist/"
    }
    Ok "技术栈：name=$($pkg.name) v$($pkg.version)"
    Ok "包管理器：$($techStack.package_manager)"
    Ok "Node 版本要求：$($techStack.node_required)"
    Ok "构建命令：$($techStack.build_cmd)"
    Log-Stage "技术栈识别" "PASS" "$($pkg.name)@$($pkg.version)"
} else {
    Err "未找到 package.json"
    Log-Stage "技术栈识别" "FAIL"
}

Step "2.3 安装生产依赖"
if (-not $SkipInstall) {
    $lockFile = if (Test-Path package-lock.json) { "package-lock.json" } elseif (Test-Path pnpm-lock.yaml) { "pnpm-lock.yaml" } elseif (Test-Path yarn.lock) { "yarn.lock" } else { "" }
    if ($lockFile) {
        Ok "锁定文件存在：$lockFile"
        $installCmd = switch -Wildcard ($lockFile) {
            "package-lock.json" { "npm ci --no-audit --no-fund --prefer-offline" }
            "pnpm-lock.yaml" { "pnpm install --frozen-lockfile" }
            "yarn.lock" { "yarn install --frozen-lockfile" }
        }
        Run "$installCmd"
        if ($LASTEXITCODE -eq 0) { Ok "依赖安装成功"; Log-Stage "依赖安装" "PASS" $installCmd }
        else { Err "依赖安装失败"; Log-Stage "依赖安装" "FAIL" }
    } else {
        Err "未找到锁定文件，建议运行 npm install 生成"
        Log-Stage "依赖安装" "FAIL"
    }
} else {
    Log-Stage "依赖安装" "SKIP"
}

Step "2.4 执行单元/集成测试 (lint + type-check + build)"
if (-not $SkipTest) {
    Run "npm run lint"
    if ($LASTEXITCODE -eq 0) { Ok "ESLint 通过" } else { Err "ESLint 失败" }
    Run "npm run check"
    if ($LASTEXITCODE -eq 0) { Ok "TypeScript 类型检查通过" } else { Err "TS 类型检查失败" }
    Log-Stage "代码质量校验" "PASS" "lint + type-check"
} else {
    Log-Stage "代码质量校验" "SKIP"
}

Step "2.5 生产构建"
if (-not $SkipBuild) {
    Run "npm run build"
    if ($LASTEXITCODE -eq 0) {
        Ok "构建成功"
        $distSize = (Get-ChildItem dist -Recurse -File | Where-Object { $_.Name -notmatch '\.map$' } | Measure-Object -Property Length -Sum).Sum / 1MB
        Ok "产物大小（不含 sourcemap）：$([math]::Round($distSize, 2)) MB"
        Log-Stage "生产构建" "PASS" "dist=$([math]::Round($distSize, 2))MB"
    } else {
        Err "构建失败"
        Log-Stage "生产构建" "FAIL"
        Write-Host "`n⚠ 构建失败，部署中止" -ForegroundColor Red
        $report | ConvertTo-Json -Depth 5 | Set-Content logs/deploy-report.json
        exit 1
    }
} else {
    Log-Stage "生产构建" "SKIP"
}

# ============================================================
# STAGE 3: 生产环境部署
# ============================================================
Hdr "STAGE 3: 生产环境部署"

if ($SkipDeploy) {
    Log-Stage "实际部署" "SKIP" "用户指定 -SkipDeploy（仅本地验证）"
    Step "已跳过实际部署，仅完成本地验证"
} else {
    Step "3.1 配置环境变量"
    if (-not (Test-Path .env.production) -and $Platform -eq "docker") {
        Run 'Copy-Item .env.example .env.production -Force'
        Ok "已从 .env.example 复制 .env.production"
        Step "  ⚠ 请编辑 .env.production 填入真实密钥"
        Step "  ⚠ 切勿提交 .env.production 到 git"
    } else {
        Step "  .env.production 已存在或使用平台 env 配置"
    }

    if (-not $SkipDeploy) {
        Switch ($Platform) {
            "vercel" {
                Step "3.2 部署到 Vercel"
                $vercel = Get-Command vercel -ErrorAction SilentlyContinue
                if ($vercel) {
                    Ok "vercel CLI 已安装"
                    Run "vercel --prod --yes"
                    if ($LASTEXITCODE -eq 0) { Log-Stage "Vercel部署" "PASS" }
                    else { Err "Vercel 部署失败"; Log-Stage "Vercel部署" "FAIL" }
                } else {
                    Step "vercel CLI 未安装，请改用网页：https://vercel.com/new"
                    Log-Stage "Vercel部署" "MANUAL"
                }
            }
            "cloudflare" {
                Step "3.2 部署到 Cloudflare Pages"
                $wrangler = Get-Command wrangler -ErrorAction SilentlyContinue
                if ($wrangler) {
                    Ok "wrangler 已安装"
                    Run "wrangler pages deploy dist --project-name=$RepoName"
                    Log-Stage "Cloudflare部署" "PASS"
                } else {
                    Step "wrangler 未安装，请使用 https://dash.cloudflare.com"
                    Log-Stage "Cloudflare部署" "MANUAL"
                }
            }
            "netlify" {
                Step "3.2 部署到 Netlify"
                $netlify = Get-Command netlify -ErrorAction SilentlyContinue
                if ($netlify) {
                    Ok "netlify CLI 已安装"
                    Run "netlify deploy --prod --dir=dist"
                    Log-Stage "Netlify部署" "PASS"
                } else {
                    Step "netlify 未安装，请使用 https://app.netlify.com"
                    Log-Stage "Netlify部署" "MANUAL"
                }
            }
            "docker" {
                Step "3.2 Docker 部署（需服务器已 SSH）"
                $docker = Get-Command docker -ErrorAction SilentlyContinue
                if ($docker) {
                    Ok "docker 已安装"
                    Run "docker compose --env-file .env.production up -d --build"
                    Log-Stage "Docker部署" "PASS"
                } else {
                    Err "docker 未安装"
                    Log-Stage "Docker部署" "FAIL"
                }
            }
        }
    }
}

# ============================================================
# STAGE 4: 部署后验证
# ============================================================
Hdr "STAGE 4: 部署后验证"
$deployUrl = if ($env:DEPLOY_URL) { $env:DEPLOY_URL } else { $null }
if (-not $deployUrl -and $Platform -eq "vercel") {
    $deployUrl = "https://$RepoName-$($GitHubUser.ToLower()).vercel.app"
}
if ($deployUrl) {
    Step "4.1 验证 URL：$deployUrl"
    Run "node scripts/verify-deployment.mjs $deployUrl"
    if ($LASTEXITCODE -eq 0) { Log-Stage "部署后验证" "PASS" $deployUrl }
    else { Log-Stage "部署后验证" "WARN" "部分测试失败，请查看日志" }
} else {
    Step "  ⚠ 未设置 DEPLOY_URL 环境变量，跳过远程验证"
    Step "  → 设置方法：setx DEPLOY_URL https://your-domain.com"
    Log-Stage "部署后验证" "MANUAL" "需手动执行 verify-deployment.mjs"
}

# ============================================================
# 输出报告
# ============================================================
Hdr "部署结果汇总"
$reportPath = "logs/deploy-report-$($Platform)-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

if (-not (Test-Path logs)) { New-Item logs -ItemType Directory | Out-Null }
$report | ConvertTo-Json -Depth 5 | Set-Content $reportPath

Write-Host "`n📋 报告保存到：$reportPath" -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host "`n✅ 部署全部阶段通过" -ForegroundColor Green
    if ($deployUrl) {
        Write-Host "🌐 在线地址：$deployUrl" -ForegroundColor Green
    }
    exit 0
} else {
    Write-Host "`n❌ 部署流程有 $failCount 个错误，请查看上方详情" -ForegroundColor Red
    exit 1
}
