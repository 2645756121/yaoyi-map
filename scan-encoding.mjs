#!/usr/bin/env node
// scan-encoding.mjs - 扫描源码中的乱码字符并写入报告
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const REPL = '\uFFFD';
const lines = [];

function walk(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some(e => name.endsWith(e))) out.push(p);
  }
  return out;
}

const files = [
  ...walk(join(ROOT, 'src'), ['.ts', '.tsx', '.css']),
  join(ROOT, 'index.html'),
];

const badFiles = [];
for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch (e) { continue; }
  const count = (text.match(/\uFFFD/g) || []).length;
  if (count > 0) {
    const idx = text.indexOf(REPL);
    const before = text.substring(Math.max(0, idx - 30), idx);
    const after = text.substring(idx + 1, Math.min(text.length, idx + 30));
    badFiles.push({ path: relative(ROOT, f), count, before, after });
  }
}

if (badFiles.length === 0) {
  lines.push('OK: All source files are clean (no \\uFFFD)');
} else {
  lines.push(`BAD: ${badFiles.length} files contain \\uFFFD:`);
  for (const bf of badFiles) {
    lines.push(`  ${bf.path}  count=${bf.count}`);
    lines.push(`    before: ${JSON.stringify(bf.before)}`);
    lines.push(`    after:  ${JSON.stringify(bf.after)}`);
  }
}

// Also check deployed bundle
lines.push('');
lines.push('=== Deployed Bundle Check ===');
try {
  const idxResp = await fetch('https://2645756121.github.io/yaoyi-map/', {
    signal: AbortSignal.timeout(10000),
  });
  const idxText = await idxResp.text();
  lines.push(`Deployed index: HTTP ${idxResp.status}, ${idxText.length} bytes`);
  const jsMatch = idxText.match(/\/assets\/[\w-]+\.js/);
  if (jsMatch) {
    const jsUrl = `https://2645756121.github.io/yaoyi-map${jsMatch[0]}`;
    const jsResp = await fetch(jsUrl, { signal: AbortSignal.timeout(10000) });
    const jsText = await jsResp.text();
    lines.push(`Bundle: ${jsMatch[0]} -> ${jsText.length} bytes`);
    const bundleBad = (jsText.match(/\uFFFD/g) || []).length;
    lines.push(`  Bundle \\uFFFD count: ${bundleBad}`);
    // Search for "关于瑶医"
    const idx1 = jsText.indexOf('关于瑶医');
    if (idx1 >= 0) {
      lines.push(`  "关于瑶医" found at offset ${idx1} in bundle (GOOD)`);
    } else {
      lines.push(`  "关于瑶医" NOT found in bundle`);
      // Try to find replacement pattern
      const idx2 = jsText.indexOf('\uFFFD');
      if (idx2 >= 0) {
        const ctx = jsText.substring(Math.max(0, idx2 - 50), Math.min(jsText.length, idx2 + 50));
        lines.push(`  Found \\uFFFD at offset ${idx2}, context: ${JSON.stringify(ctx)}`);
      }
    }
  }
} catch (e) {
  lines.push(`Fetch error: ${e.message}`);
}

const out = lines.join('\n');
console.log(out);
writeFileSync(join(ROOT, 'scan_report.txt'), out, 'utf8');