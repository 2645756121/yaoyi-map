import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_DIR = resolve(ROOT, 'releases');
mkdirSync(RELEASE_DIR, { recursive: true });

const VERSION = '1.0.0';
const PACKAGE_NAME = 'yaoyi-map-v' + VERSION;
const STAGING_DIR = resolve(RELEASE_DIR, PACKAGE_NAME);

function safeCopyFile(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, readFileSync(src));
}

function safeCopyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) safeCopyDir(srcPath, destPath);
    else if (entry.isFile()) safeCopyFile(srcPath, destPath);
  }
}

function main() {
  console.log('Packaging v' + VERSION);
  if (existsSync(STAGING_DIR)) {
    if (process.platform === 'win32') {
      try { execSync('cmd /c rmdir /s /q "' + STAGING_DIR + '"', { stdio: 'pipe' }); } catch (e) {}
    }
  }
  mkdirSync(STAGING_DIR, { recursive: true });
  safeCopyDir(resolve(ROOT, 'dist'), resolve(STAGING_DIR, 'dist'));
  safeCopyFile(resolve(ROOT, 'server.cjs'), resolve(STAGING_DIR, 'server.cjs'));
  safeCopyFile(resolve(ROOT, 'start.bat'), resolve(STAGING_DIR, 'start.bat'));
  safeCopyFile(resolve(ROOT, 'start.sh'), resolve(STAGING_DIR, 'start.sh'));
  safeCopyFile(resolve(ROOT, 'start.command'), resolve(STAGING_DIR, 'start.command'));
  for (const doc of ['README.md', 'QUICKSTART.md', 'DEPLOY.md', 'LICENSE']) {
    if (existsSync(resolve(ROOT, doc))) safeCopyFile(resolve(ROOT, doc), resolve(STAGING_DIR, doc));
  }
  writeFileSync(resolve(STAGING_DIR, 'VERSION'), 'v' + VERSION);
  writeFileSync(resolve(STAGING_DIR, 'CHANGES.md'), 'v' + VERSION);
  writeFileSync(resolve(STAGING_DIR, 'HERB_IMAGE_ATTRIBUTIONS.md'), 'See src/lib/herbImages.ts');
  writeFileSync(resolve(STAGING_DIR, 'package.json'), JSON.stringify({ name: 'yaoyi-map', version: VERSION, private: true, scripts: { start: 'node server.cjs' }, engines: { node: '>=18' } }));
  const zipPath = resolve(RELEASE_DIR, PACKAGE_NAME + '.zip');
  if (process.platform === 'win32') {
    try {
      if (existsSync(zipPath)) { try { execSync('cmd /c del /f /q "' + zipPath + '"', { stdio: 'pipe' }); } catch (e) {} }
      const psCmd = "Compress-Archive -Path '" + STAGING_DIR + "\\*' -DestinationPath '" + zipPath + "' -Force";
      execSync('powershell -NoProfile -Command "' + psCmd + '"', { stdio: 'pipe' });
      console.log('ZIP OK');
    } catch (e) { console.error('ZIP failed: ' + e.message); }
  }
  console.log('Done');
}

main();