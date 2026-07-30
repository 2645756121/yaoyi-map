# deploy-logo.ps1 - 自动构建并推送 LOGO(1).svg 更新
$ErrorActionPreference = 'Continue'
Set-Location 'c:\Users\26457\Downloads\trae文件夹\map'

Write-Host "=== Step 1: TypeScript Check ===" -ForegroundColor Cyan
& npx tsc --noEmit 2>&1 | Out-File "tsc.log" -Encoding utf8
$tscOk = ($LASTEXITCODE -eq 0)
Write-Host "TSC exit: $LASTEXITCODE" -ForegroundColor $(if ($tscOk) {'Green'} else {'Red'})

Write-Host "=== Step 2: ESLint Check ===" -ForegroundColor Cyan
& npx eslint src/components/common/Logo.tsx src/components/common/Header.tsx src/components/common/Footer.tsx 2>&1 | Out-File "eslint.log" -Encoding utf8
$eslintOk = ($LASTEXITCODE -eq 0)
Write-Host "ESLint exit: $LASTEXITCODE" -ForegroundColor $(if ($eslintOk) {'Green'} else {'Red'})

Write-Host "=== Step 3: Vite Build ===" -ForegroundColor Cyan
& npx vite build 2>&1 | Out-File "build.log" -Encoding utf8
$buildOk = ($LASTEXITCODE -eq 0)
Write-Host "Build exit: $LASTEXITCODE" -ForegroundColor $(if ($buildOk) {'Green'} else {'Red'})

if (-not $buildOk) {
    Write-Host "Build failed - see build.log" -ForegroundColor Red
    exit 1
}

Write-Host "=== Step 4: Verify dist contents ===" -ForegroundColor Cyan
if (Test-Path dist/logo) {
    Get-ChildItem dist/logo | Format-Table Name, Length -AutoSize | Out-File "dist_check.log"
    Write-Host "dist/logo contents:" -ForegroundColor Green
    Get-Content dist_check.log
}

Write-Host "=== Step 5: Git status ===" -ForegroundColor Cyan
& git --no-pager status --short 2>&1 | Out-File "git_status.log" -Encoding utf8
Write-Host "Git status (see git_status.log):" -ForegroundColor Green
Get-Content git_status.log

Write-Host "=== Done ===" -ForegroundColor Green