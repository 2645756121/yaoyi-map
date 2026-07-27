#!/usr/bin/env node
/**
 * YaoYi Medicine Map - Portable Static File Server
 * Features: auto-open browser, port fallback, zero deps, SPA fallback, gzip
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { exec } = require('node:child_process');
const net = require('node:net');

const DIST_DIR = path.join(__dirname, 'dist');

const args = process.argv.slice(2);
const NO_BROWSER = args.includes('--no-browser');
const explicitPort = args.find(a => /^\d+$/.test(a));
const DEFAULT_PORT = parseInt(explicitPort || process.env.PORT, 10) || 5187;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_PORT_TRIES = 10;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.txt':   'text/plain; charset=utf-8',
  '.map':   'application/json; charset=utf-8',
};

const COMPRESSIBLE = new Set([
  'text/html', 'text/css', 'text/plain', 'text/javascript',
  'application/javascript', 'application/json', 'image/svg+xml',
]);

function safeResolve(rootDir, urlPath) {
  // L1: 拒绝包含 NUL 字节的 URL——fs 在该情况下会同步抛出 TypeError 进而崩溃进程
  if (urlPath.indexOf('\0') !== -1) return { error: 'null-byte' };
  const cleanPath = urlPath.split('?')[0].split('#')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(cleanPath);
  } catch (e) {
    // 编码异常的 URL（如 %FF%FE 等非法 UTF-8 序列）
    return { error: 'bad-encoding' };
  }
  // L1b: 同样校验解码后的路径
  if (decoded.indexOf('\0') !== -1) return { error: 'null-byte' };
  const resolved = path.normalize(path.join(rootDir, decoded));
  if (!resolved.startsWith(rootDir)) return { error: 'escape' };
  return { path: resolved };
}

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function isCompressible(mimeType) {
  const main = mimeType.split(';')[0];
  return COMPRESSIBLE.has(main);
}

function shouldUseCache(filePath) {
  const baseName = path.basename(filePath);
  // Vite 产物哈希形如 `index-3qyYGH64.js`、`index-BVSwXjP_.js`，
  // 字符集包含大小写字母与 `_`，不能用 [a-f0-9] 限定
  return /[\.\-_][\w-]{6,}\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg)$/i.test(baseName);
}

// 结构化请求日志：便于运维追踪异常 URL / 攻击模式
function logRequest(req, res, startMs, status, tag) {
  const duration = Date.now() - startMs;
  const ip = req.socket.remoteAddress || 'unknown';
  // 安全类请求以 warn 级别记录，普通请求以 log 记录
  const prefix = (status >= 400) ? '[Req]' : '[Req]';
  const line = `${prefix} ${status} ${(req.method || 'GET').padEnd(6)} ${req.url} ip=${ip} t=${duration}ms tag=${tag}`;
  if (status >= 500) console.error(line);
  else if (status >= 400) console.warn(line);
  else console.log(line);
}

function openBrowser(url) {
  try {
    const platform = process.platform;
    let cmd, args;
    if (platform === 'win32') {
      cmd = 'cmd';
      args = ['/c', 'start', '""', url];
    } else if (platform === 'darwin') {
      cmd = 'open';
      args = [url];
    } else {
      cmd = 'xdg-open';
      args = [url];
    }
    const child = exec(cmd + ' ' + args.map(a => '"' + a + '"').join(' '), (err) => {
      if (err) console.log('[Browser] Could not auto-open. Please visit: ' + url);
    });
    child.unref();
    return true;
  } catch (e) {
    return false;
  }
}

function isPortInUse(port, host) {
  return new Promise((resolveP) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') resolveP(true);
        else resolveP(false);
      })
      .once('listening', () => tester.close(() => resolveP(false)))
      .listen(port, host);
  });
}

function createAppServer() {
  return http.createServer((req, res) => {
    const start = Date.now();
    const clientIp = req.socket.remoteAddress || 'unknown';
    const rawUrl = req.url || '/';

    // 安全网：在请求处理最外层包裹 try/catch，捕获任何 fs 同步抛错
    try {
      if (!DIST_DIR || !fs.existsSync(DIST_DIR)) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 - dist/ directory not found.\n');
        logRequest(req, res, start, 500, 'dist-missing');
        return;
      }

      const resolved = safeResolve(DIST_DIR, rawUrl);

      if (resolved.error === 'null-byte') {
        // L1: 含 NUL 字节的 URL——Node fs 在该情况下会同步抛出导致进程崩溃
        // 直接 400 拒绝并记录日志
        console.warn(`[Security] Rejected URL with null byte from ${clientIp}: ${JSON.stringify(rawUrl)}`);
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('400 - Bad Request (null byte in URL)\n');
        logRequest(req, res, start, 400, 'null-byte');
        return;
      }

      if (resolved.error === 'bad-encoding') {
        console.warn(`[Security] Rejected URL with bad encoding from ${clientIp}: ${JSON.stringify(rawUrl)}`);
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('400 - Bad Request (invalid URL encoding)\n');
        logRequest(req, res, start, 400, 'bad-encoding');
        return;
      }

      if (resolved.error === 'escape') {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 - Forbidden');
        logRequest(req, res, start, 403, 'path-escape');
        return;
      }

      const targetPath = resolved.path;

      // L2: 即使 L1 失效，fs 调用也由 try/catch 兜底（保护 async 同步抛错路径）
      try {
        fs.stat(targetPath, (statErr, stats) => {
          let finalPath = targetPath;
          if (statErr || !stats.isFile()) {
            finalPath = path.join(DIST_DIR, 'index.html');
          }

          fs.readFile(finalPath, (readErr, content) => {
            if (readErr) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('404 - Not Found');
              logRequest(req, res, start, 404, 'read-failed');
              return;
            }

            const mimeType = getMimeType(finalPath);
            const headers = {
              'Content-Type': mimeType,
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'SAMEORIGIN',
              'Referrer-Policy': 'strict-origin-when-cross-origin',
            };

            if (finalPath === path.join(DIST_DIR, 'index.html')) {
              headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
              headers['Pragma'] = 'no-cache';
              headers['Expires'] = '0';
            } else if (shouldUseCache(finalPath)) {
              headers['Cache-Control'] = 'public, max-age=31536000, immutable';
            } else {
              headers['Cache-Control'] = 'public, max-age=3600';
            }

            if (mimeType.startsWith('text/html')) {
              headers['Content-Security-Policy'] = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob: https:",
                "font-src 'self' data:",
                "connect-src 'self' https:",
                "frame-ancestors 'none'",
              ].join('; ');
            }

            const acceptEncoding = (req.headers['accept-encoding'] || '').toLowerCase();

            try {
              if (isCompressible(mimeType) && content.length > 1024 && acceptEncoding.includes('gzip')) {
                zlib.gzip(content, (gzipErr, compressed) => {
                  if (gzipErr) {
                    console.error('[Server] gzip failed for ' + finalPath + ':', gzipErr);
                    res.writeHead(500); res.end(); return;
                  }
                  headers['Content-Encoding'] = 'gzip';
                  headers['Vary'] = 'Accept-Encoding';
                  headers['Content-Length'] = compressed.length;
                  res.writeHead(200, headers);
                  res.end(compressed);
                  logRequest(req, res, start, 200, 'ok');
                });
              } else {
                headers['Content-Length'] = content.length;
                res.writeHead(200, headers);
                res.end(content);
                logRequest(req, res, start, 200, 'ok');
              }
            } catch (e) {
              console.error('[Server] Response write failed:', e);
              logRequest(req, res, start, 500, 'response-error');
            }
          });
        });
      } catch (e) {
        // L2: 捕获 fs.stat/readFile 同步抛错（例如残留的 null byte）
        console.error('[Server] Sync FS error caught:', e.code || e.name, e.message);
        try {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('500 - Internal Server Error\n');
          }
        } catch (_) {}
        logRequest(req, res, start, 500, 'fs-sync-error');
      }
    } catch (e) {
      // L3（请求级）：请求处理过程中任何未预期错误都不应让进程崩溃
      console.error('[Server] Unhandled request error:', e);
      try {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('500 - Internal Server Error\n');
        }
      } catch (_) {}
      logRequest(req, res, start, 500, 'unhandled');
    }
  });
}

async function findAvailablePort(startPort, host, maxTries) {
  for (let i = 0; i < maxTries; i++) {
    const port = startPort + i;
    const inUse = await isPortInUse(port, host);
    if (!inUse) return port;
  }
  return null;
}

async function main() {
  console.log('==================================================');
  console.log('  YaoYi Medicine Map');
  console.log('==================================================');
  console.log('[Server] Searching for available port starting at ' + DEFAULT_PORT + '...');

  // L3（进程级）：任何逃逸的同步异常都不应让进程退出
  // 仅记录日志，让服务继续运行
  process.on('uncaughtException', (err) => {
    console.error('[Server] FATAL uncaughtException caught (server kept alive):', err);
    if (err && err.code === 'EADDRINUSE') {
      // 端口冲突仍然致命
      console.error('[Server] Port already in use, exiting.');
      process.exit(1);
    }
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled promise rejection (server kept alive):', reason);
  });

  const port = await findAvailablePort(DEFAULT_PORT, HOST, MAX_PORT_TRIES);
  if (!port) {
    console.error('[Server] ERROR: No available port in range ' + DEFAULT_PORT + '-' + (DEFAULT_PORT + MAX_PORT_TRIES - 1));
    console.error('[Server] Close other apps or specify port: node server.cjs <port>');
    process.exit(1);
  }
  if (port !== DEFAULT_PORT) {
    console.log('[Server] Port ' + DEFAULT_PORT + ' busy, using ' + port);
  }

  const server = createAppServer();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('[Server] ERROR: Port ' + port + ' in use (race).');
      console.error('[Server] Specify port: node server.cjs <port>');
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    const url = 'http://' + displayHost + ':' + port;
    console.log('[Server] Listening at ' + url);
    console.log('[Server] Serving from: ' + DIST_DIR);
    console.log('[Server] Press Ctrl+C to stop');
    console.log('==================================================');

    if (!NO_BROWSER) {
      setTimeout(() => {
        const ok = openBrowser(url);
        if (ok) console.log('[Browser] Auto-opened: ' + url);
        else console.log('[Browser] Cannot auto-open. Visit: ' + url);
      }, 800);
    } else {
      console.log('[Browser] Disabled (--no-browser). Visit: ' + url);
    }
  });

  function gracefulShutdown() {
    console.log('\n[Server] Shutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  }

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

main().catch((e) => { console.error('[Server] FATAL:', e); process.exit(1); });