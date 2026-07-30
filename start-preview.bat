@echo off
cd /d "c:\Users\26457\Downloads\trae文件夹\map"
echo Starting Vite dev server on port 3006...
start "" /B "C:\Program Files\nodejs\node.exe" "node_modules\vite\bin\vite.js" --port 3006 --host 127.0.0.1 > dev.log 2>&1
timeout /t 8 /nobreak > nul
echo Dev server status:
curl -s -o nul -w "HTTP_STATUS=%%{http_code}\n" http://127.0.0.1:3006/ >> dev.log
echo Done.
type dev.log