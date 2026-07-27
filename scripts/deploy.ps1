# =============================================================================
# deploy.ps1 - 瑶医分布地图 生产级一键部署脚本（Windows PowerShell）
# =============================================================================
#
# 功能：
#   - 一键执行：环境检查 → 代码拉取 → 依赖安装 → 构建 → 部署 → 验证 → 报告
#   - 全流程日志（写入 logs/deploy/deploy-YYYYMMDD-HHmmss.log）
#   - 用户交互确认（部署前需 y/N 确认）
#   - 自动回滚（任何阶段失败即撤销已执行的操作）
#   - 异常捕获（Try/Catch + Trap，全局错误处理）
#   - 部署报告（JSON + Markdown，自动输出到 logs/deploy/）
#
# 使用示例：
#   .\scripts\deploy.ps1                          # 使用 deploy.config.json 默认配置
#   .\scripts\deploy.ps1 -Target staging         # 部署到 staging 环境
#   .\scripts\deploy.ps1 -ConfigFile prod.json   # 指定配置文件
#   .\scripts\deploy.ps1 -SkipPrompts            # CI/CD 模式，跳过交互
#   .\scripts\deploy.ps1 -DryRun                # 演练模式，不实际部署
#
# 作者：Trae DevOps
# 版本：v1.0.0
# 兼容性：PowerShell 5.1+ / PowerShell Core 7+
# =============================================================================

[CmdletBinding()]
param(
    [string]$ConfigFile = "deploy.config.json",
    [ValidateSet("production", "staging", "preview")]
    [string]$Target = "production",
    [string]$Version = "",
    [switch]$SkipPrompts,
    [switch]$DryRun,
    [int]$HealthCheckRetries = 5,
    [int]$HealthCheckIntervalSec = 10
)

# 抑制 ProgressPreference 噪声
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

# =============================================================================
# 全局状态
# =============================================================================
$script:State = @{
    StartTime        = Get-Date
    Target           = $Target
    Version          = $Version
    ConfigFile       = $ConfigFile
    Config           = $null
    LogFile          = $null
    LogEntries       = New-Object System.Collections.Generic.List[object]
    RollbackStack    = New-Object System.Collections.Generic.Stack[object]
    Phase            = 'init'
    FailedPhase      = $null
    ErrorMessage     = $null
    Endpoints        = @{}
    BuildArtifacts   = $null
    NotifyChannels   = @()
    GitCommit        = $null
    HealthCheckOk    = $false
}

# 严重错误时立即终止
trap {
    $script:State.FailedPhase = $script:State.Phase
    $script:State.ErrorMessage = $_.ToString()
    Write-Log "[FATAL] 未捕获异常: $_" "ERROR"
    Invoke-Rollback -Reason $_.ToString()
    Generate-Report -Success $false
    exit 1
}

# =============================================================================
# 颜色与日志
# =============================================================================
$script:Colors = @{
    INFO    = 'Cyan'
    OK      = 'Green'
    WARN    = 'Yellow'
    ERROR   = 'Red'
    STEP    = 'Magenta'
    HEADER  = 'Blue'
}

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet('INFO','OK','WARN','ERROR','STEP','HEADER')]
        [string]$Level = 'INFO',
        [switch]$NoConsole
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $color = $script:Colors[$Level]
    $prefix = "[$timestamp] [$Level]"
    $line = "$prefix $Message"
    if (-not $NoConsole) {
        Write-Host $line -ForegroundColor $color
    }
    if ($script:State.LogFile) {
        Add-Content -Path $script:State.LogFile -Value $line -Encoding UTF8
    }
    $script:State.LogEntries.Add(@{
        ts = $timestamp
        level = $Level
        msg = $Message
    }) | Out-Null
}

function Write-Step { param([string]$msg) Write-Log "▶ $msg" "STEP" }
function Write-OK   { param([string]$msg) Write-Log "✓ $msg" "OK" }
function Write-Warn { param([string]$msg) Write-Log "⚠ $msg" "WARN" }
function Write-Err  { param([string]$msg) Write-Log "✗ $msg" "ERROR" }
function Write-Hdr  { param([string]$msg) Write-Log "═══ $msg ═══" "HEADER" }

# =============================================================================
# 环境检查模块
# =============================================================================
function Test-Environment {
    Write-Hdr "STAGE 1: 环境检查"
    $results = @{
        Passed = @()
        Failed = @()
        Warnings = @()
    }

    # 1.1 PowerShell 版本
    $psv = $PSVersionTable.PSVersion
    if ($psv.Major -ge 5) {
        $results.Passed += "PowerShell $psv (>= 5.0)"
    } else {
        $results.Failed += "PowerShell 版本过低: $psv（需要 >= 5.0）"
    }

    # 1.2 Node.js
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $nodeVer = (& node --version) 2>$null
        $nodeVer = ($nodeVer -replace 'v','') -replace '\s',''
        $requiredNode = "18.0.0"
        if ([version]$nodeVer -ge [version]$requiredNode) {
            $results.Passed += "Node.js $nodeVer (>= $requiredNode)"
        } else {
            $results.Failed += "Node.js $nodeVer 过旧（需要 >= $requiredNode）"
        }
    } else {
        $results.Failed += "Node.js 未安装。请安装 Node.js 18+ LTS：https://nodejs.org/"
    }

    # 1.3 npm
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if ($npm) {
        $npmVer = (& npm --version) 2>$null
        $results.Passed += "npm