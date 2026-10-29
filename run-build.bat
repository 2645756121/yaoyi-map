@echo off
cd /d c:\Users\26457\Downloads\trae文件夹\map
echo === START BUILD === > build_status.txt
npx vite build >> build_status.txt 2>&1
echo === END BUILD === >> build_status.txt
echo Exit code: %ERRORLEVEL% >> build_status.txt
dir dist\logo >> build_status.txt 2>&1