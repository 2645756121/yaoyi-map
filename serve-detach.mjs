#!/usr/bin/env node
/**
 * serve-detach.mjs - 持续运行的 Vite dev 服务器包装
 * 通过 spawn detached 模式启动 vite 进程，
 * 即使父进程退出也不会杀死 vite 服务器。
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const PORT = process.argv[2] || '3014';
const LOG = resolve(ROOT, `vite-detach-${PORT}.log`);

// detached spawn: 进程独立于父进程运行
const child = spawn(
  'C:\\Program Files\\nodejs\\node.exe',
  [
    'node_modules/vite/bin/vite.js',
    '--port', PORT,
    '--host', '127.0.0.1',
    '--strictPort',
    '--clearScreen=false',
  ],
  {
    cwd: ROOT,
    detached: true,    // 独立进程组
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }
);

child.unref();  // 父进程退出不影响子进程

child.stdout.on('data', d => process.stdout.write(`[vite stdout] ${d}`));
child.stderr.on('data', d => process.stdout.write(`[vite stderr] ${d}`));

writeFileSync(LOG, `vite started at ${new Date().toISOString()}\npid=${child.pid}\nport=${PORT}\n`, 'utf8');
console.log(`Vite dev server detached: pid=${child.pid} port=${PORT}`);
console.log(`Log file: ${LOG}`);

// 父进程保持短暂运行后退出，不影响 vite
setTimeout(() => process.exit(0), 3000);