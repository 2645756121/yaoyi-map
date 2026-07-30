#!/usr/bin/env node
// build-and-serve.mjs - 构建并启动本地预览
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const log = (msg) => {
  process.stdout.write(msg + '\n');
};

log('=== Step 1: Build ===');
const build = spawn(
  'C:\\Program Files\\nodejs\\node.exe',
  ['node_modules/vite/bin/vite.js', 'build'],
  { cwd: ROOT, shell: false }
);
build.stdout.on('data', d => log('[build] ' + d.toString().trim()));
build.stderr.on('data', d => log('[build ERR] ' + d.toString().trim()));

await new Promise(r => build.on('close', code => { log('Build exit: ' + code); r(); }));

log('=== Step 2: Start preview server ===');
const preview = spawn(
  'C:\\Program Files\\nodejs\\node.exe',
  ['node_modules/vite/bin/vite.js', 'preview', '--port', '3010', '--host', '127.0.0.1', '--strictPort'],
  { cwd: ROOT, shell: false }
);
preview.stdout.on('data', d => log('[preview] ' + d.toString().trim()));
preview.stderr.on('data', d => log('[preview ERR] ' + d.toString().trim()));
preview.on('close', code => log('Preview exit: ' + code));

// Write status file
writeFileSync(resolve(ROOT, 'preview-status.txt'), 'preview started on 3010\n', 'utf8');
log('Status written to preview-status.txt');

setTimeout(() => process.exit(0), 30000);