#!/usr/bin/env pwsh
# push-amber-replace.ps1 - 推送蜜炙色 v2 替换到 GitHub
$token = $env:GITHUB_TOKEN
if (-not $token) { $token = "ghp_REPLACE_ME" }
$headers = @{
    Authorization = "Bearer $token"
    "User-Agent" = "yaoyi-deploy-script"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

# 从外部文件读取 commit message（明确 UTF-8 编码避免 422）
$commitMsg = [System.IO.File]::ReadAllText("scripts/commit-msg-amber.txt", [System.Text.Encoding]::UTF8)

function Push-File($p) {
    try {
        $existing = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/2645756121/yaoyi-map/contents/$p" -Headers $headers
        $sha = $existing.sha
    } catch {
        $sha = $null
    }
    $body = @{
        message = $commitMsg
        branch = "main"
        content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content -Raw $p)))
    }
    if ($sha) { $body.sha = $sha }
    $url = "https://api.github.com/repos/2645756121/yaoyi-map/contents/$p"
    try {
        $r = Invoke-RestMethod -Method Put -Uri $url -Headers $headers -Body ($body | ConvertTo-Json)
        if ($r.commit) {
            Write-Host "✓ $p → $($r.commit.sha.Substring(0,10))"
        }
    } catch {
        Write-Host "✗ $p : $($_.Exception.Message)"
    }
}

$files = @(
    "tailwind.config.js",
    "src/index.css",
    "src/components/common/Header.tsx",
    "src/components/RegionPanel/RegionPanel.tsx",
    "scripts/verify-wcag-contrast.mjs",
    "scripts/palette-demo.html",
    "scripts/replace-amber.mjs",
    "scripts/commit-msg-amber.txt",
    "PALETTE_USAGE.md"
)
foreach ($f in $files) { Push-File $f }