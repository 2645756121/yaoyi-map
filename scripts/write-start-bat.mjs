import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TARGETS = [
  resolve(ROOT, 'start.bat'),
  resolve(ROOT, 'releases/yaoyi-map-v1.0.0/start.bat'),
];

const CONTENT = `@echo off
setlocal
cd /d "%~dp0"
set "EXE=node.exe"
set "PORT=5187"
cls
echo ============================================================
echo.
echo     YaoYi Medicine Map (YaoYi Distribution Map)
echo.
echo ============================================================
echo.
echo [Step 1/4] Checking Node.js...
where %EXE% >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js not detected!
  echo.
  echo Please install Node.js 18 or later:
  echo   - Download: https://nodejs.org/
  echo   - Choose "LTS" version, run installer
  echo   - Make sure "Add to PATH" is checked
  echo.
  echo After install, RE-OPEN Command Prompt and try again.
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('%EXE% --version') do set "NODE_VER=%%v"
echo   Detected: %NODE_VER%
echo   OK
echo.
echo [Step 2/4] Verifying build artifacts...
if not exist "dist\\index.html" (
  echo.
  echo [ERROR] dist\\index.html not found!
  echo.
  echo The build artifacts are missing. This may happen if:
  echo   1. The package was extracted incompletely
  echo   2. Antivirus quarantined files
  echo   3. The dist folder was deleted
  echo.
  echo Please re-extract the package from the original ZIP.
  echo.
  pause
  exit /b 1
)
echo   dist\\index.html OK
echo.
echo [Step 3/4] Verifying server script...
if not exist "server.cjs" (
  echo.
  echo [ERROR] server.cjs not found!
  echo.
  echo Please re-extract the package from the original ZIP.
  echo.
  pause
  exit /b 1
)
echo   server.cjs OK
echo.
echo [Step 4/4] Starting server...
echo.
echo ============================================================
echo   The server will auto-open your default browser.
echo   If browser does not open, visit: http://localhost:%PORT%
echo   Port will auto-fallback if %PORT% is in use.
echo   Press Ctrl+C to stop
echo ============================================================
echo.
%EXE% server.cjs %PORT%
echo.
echo ============================================================
echo   Server stopped (exit code: %errorlevel%)
echo ============================================================
echo.
pause
endlocal
`;

function writeGBK(targetPath, content) {
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  const psCmd = "$bytes = [System.Text.Encoding]::Convert([System.Text.Encoding]::UTF8, [System.Text.Encoding]::GetEncoding('GBK'), [System.Convert]::FromBase64String('" + b64 + "')); [System.IO.File]::WriteAllBytes('" + targetPath.replace(/\\/g, '\\\\') + "', $bytes)";
  execSync('powershell -NoProfile -Command "' + psCmd + '"', { stdio: 'pipe' });
  console.log('  Written (GBK): ' + targetPath);
}

console.log('Generating start.bat in GBK encoding...');
for (const target of TARGETS) {
  writeGBK(target, CONTENT);
}
console.log('Done.');