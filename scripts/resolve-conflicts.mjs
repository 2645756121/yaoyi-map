#!/usr/bin/env node
/**
 * 合并冲突自动解决器
 *
 * 对受影响的文件，去掉所有 git 合并冲突标记（<<<<<<< HEAD / ======= / >>>>>>>），
 * 保留 "theirs"（后合并进来的 my commit 内容）以保证部署可用。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  'src/App.tsx',
  'src/pages/Home.tsx',
  'src/components/common/Header.tsx',
  'src/components/HerbCatalog/HerbCatalog.tsx',
  'src/components/RegionPanel/RegionPanel.tsx',
  'src/components/SearchBar/SearchBar.tsx',
  'src/index.css',
  'eslint.config.js',
];

let totalFixed = 0;
for (const rel of FILES) {
  try {
    const text = readFileSync(rel, 'utf8');
    if (!text.includes('<<<<<<<')) {
      console.log(`[skip] ${rel} (no conflict markers)`);
      continue;
    }
    // 冲突段：<<<<<<< HEAD ... ======= ... >>>>>>> ...
    // 我们保留 ======= 与 >>>>>>> 之间的内容（即 my commit 的版本），丢弃 HEAD 部分
    const fixed = text.replace(
      /<<<<<<< HEAD[\s\S]*?=======\s*\n([\s\S]*?)>>>>>>>[^\n]*\n?/g,
      (_, keep) => keep
    );
    // 若有嵌套结构（<<<<<<< 在 ==== 与 >>> 之间），也去掉残留
    const fixed2 = fixed.replace(/^>>>>>>>[^\n]*\n?/gm, '').replace(/^<<<<<<<[^\n]*\n?/gm, '');
    writeFileSync(rel, fixed2, 'utf8');
    const removed = (text.match(/^<<<<<<<|^=======$\n|^>>>>>>>/gm) || []).length;
    console.log(`[fixed] ${rel} - removed ${removed} marker(s)`);
    totalFixed++;
  } catch (e) {
    console.error(`[error] ${rel}: ${e.message}`);
  }
}
console.log(`\nDone. ${totalFixed} file(s) fixed.`);