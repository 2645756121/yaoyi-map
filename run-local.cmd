@echo off
REM ---------------------------------------------------------------------------
REM run-local.cmd - 在受限环境下运行 vite / vitest
REM
REM 背景：esbuild 需要在临时目录创建并删除辅助文件。若 %TEMP% 不可写，
REM       vite build 与 vitest 会以 "spawn EPERM" 或 "Access is denied" 失败。
REM       本脚本把 TEMP/TMP 指向仓库内的 .tmp-build 后执行传入的命令。
REM
REM 用法：  run-local.cmd vite build
REM         run-local.cmd vitest run
REM ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"
set "TEMP=%~dp0..\.tmp-build"
set "TMP=%~dp0..\.tmp-build"
if not exist "%TEMP%" mkdir "%TEMP%"
call npx %*
endlocal
