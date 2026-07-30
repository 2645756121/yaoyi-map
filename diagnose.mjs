#!/usr/bin/env node
/**
 * diagnose.mjs - 编码与乱码排查脚本
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const report = [];

// 1. 检查关键文件 BOM
report.push('===== 1. 关键源文件 UTF-8 BOM 检查 =====');
const criticalFiles = [
  'src/components/common/Header.tsx',
  'src/components/common/Footer.tsx',
  'src/components/common/Logo.tsx',
  'src/components/SearchBar/SearchBar.tsx',
  'src/components/HerbCatalog/HerbCatalog.tsx',
  'src/components/RegionPanel/RegionPanel.tsx',
  'src/pages/Home.tsx',
  'src/App.tsx',
  'index.html',
  'src/index.css',
];
for (const rel of criticalFiles) {
  try {
    const buf = readFileSync(join(ROOT, rel));
    const hasBOM = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    report.push(`${rel.padEnd(50)} | Size: ${String(buf.length).padStart(8)} bytes | BOM: ${hasBOM}`);
  } catch (e) {
    report.push(`MISSING: ${rel}`);
  }
}

// 2. 扫描所有源码文件是否含有 \uFFFD
report.push('');
report.push('===== 2. 替换字符 (U+FFFD) 扫描 =====');
function walk(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
      out.push(...walk(p, exts));
    } else {
      if (exts.some(e => name.endsWith(e))) out.push(p);
    }
  }
  return out;
}
const files = [
  ...walk(join(ROOT, 'src'), ['.ts', '.tsx', '.css']),
  join(ROOT, 'index.html'),
];
let badTotal = 0;
for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  const m = txt.match(/\uFFFD/g);
  if (m) {
    badTotal += m.length;
    report.push(`BAD: ${relative(ROOT, f)} -> ${m.length} 个 \\uFFFD`);
  }
}
report.push(badTotal === 0 ? 'GOOD: 所有源文件均无 \\uFFFD' : `TOTAL: ${badTotal} 个 \\uFFFD`);

// 3. 关键中文短语完整性
report.push('');
report.push('===== 3. 关键中文短语完整性 =====');
const phrases = ['关于瑶医', '搜索草药', '草药分类目录', '瑶医分布地图', '探索瑶族传统医学与草药资源', '关于本站', '湖南省', '广西壮族自治区', '关于'];
for (const ph of phrases) {
  let hits = 0;
  for (const f of files) {
    const txt = readFileSync(f, 'utf8');
    if (txt.includes(ph)) hits++;
  }
  report.push(`${hits > 0 ? 'OK   ' : 'MISS '} "${ph}" -> ${hits} 个文件`);
}

// 4. 已部署页面 / bundle 校验
report.push('');
report.push('===== 4. GitHub Pages 部署校验 =====');
try {
  const idxResp = await fetch('https://2645756121.github.io/yaoyi-map/', {
    signal: AbortSignal.timeout(10000),
  });
  const idxText = await idxResp.text();
  report.push(`deployed index: HTTP ${idxResp.status}, ${idxText.length} bytes`);
  const jsMatch = idxText.match(/\/assets\/[\w-]+\.js/);
  if (jsMatch) {
    const jsUrl = `https://2645756121.github.io/yaoyi-map${jsMatch[0]}`;
    const jsResp = await fetch(jsUrl, { signal: AbortSignal.timeout(10000) });
    const jsText = await jsResp.text();
    report.push(`main JS bundle: ${jsMatch[0]} -> HTTP ${jsResp.status}, ${jsText.length} bytes`);
    // 在 bundle 中查替换字符
    const bundleBad = (jsText.match(/\uFFFD/g) || []).length;
    report.push(`  bundle \\uFFFD count: ${bundleBad}`);
    // 关键短语在 bundle 中的命中
    for (const ph of ['关于瑶医', '搜索草药', '草药分类', '瑶医分布地图']) {
      const c = jsText.split(ph).length - 1;
      report.push(`  bundle "${ph}": ${c} occurrences`);
    }
    // 检查关字的字节
    const findGuanBytes = (jsText.match(/[�]于瑶医/g) || []).length;
    if (findGuanBytes > 0) {
      report.push(`  ⚠️ bundle 中存在乱码 [�于瑶医]: ${findGuanBytes} 处`);
    }
  }
} catch (e) {
  report.push(`ERROR fetching deployed: ${e.message}`);
}

const out = report.join('\n');
console.log(out);
writeFileSync(join(ROOT, 'encoding_report.txt'), out, 'utf8');