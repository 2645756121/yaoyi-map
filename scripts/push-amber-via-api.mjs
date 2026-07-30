#!/usr/bin/env node
// push-amber-via-api.mjs - 通过 GitHub Contents API 推送蜜炙色 v2 替换
// 解决 PowerShell 422 错误（Node 原生 fetch + 正确的 JSON 序列化）
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TOKEN = process.env.GITHUB_TOKEN || 'ghp_REPLACE_ME';
const REPO = '2645756121/yaoyi-map';
const BRANCH = 'main';

const COMMIT_MSG = `refactor(design): 蜜炙色 v2 升级 #D4AC6A → #F0D1A1

原 #D4AC6A 蜜炙焦黄（中等明度琥珀）升级为 #F0D1A1 蜜炙桃黄（浅桃黄），
整体明度上调 17%，饱和度下降 22%，更柔和细腻。

配色体系（v2 完整色阶）：
- amber-50:  #FBF3E5 → #FFF7EC  (极浅桃黄)
- amber-100: #F4E2BD → #FCEEDA  (浅桃黄)
- amber-200: #E8CE94 → #F8E4C3  (中浅桃黄)
- amber-300: #DCBA75 → #F4DBB1  (中桃黄)
- amber-400: #D4AC6A → #F0D1A1  ★ 标准蜜炙桃黄
- amber-500: #C09454 → #DDBE8C  (中深桃黄)
- amber-600: #A87D40 → #C8A57E  (深桃黄)
- amber-700: #85642F → #A88A66  (深桃黄)

WCAG AA 对比度（v2 实测均高于预期）：
- #243B25 vs #F0D1A1 桃黄按钮 = 8.30:1 (AAA)  原 5.74:1
- #102514 vs #F0D1A1 桃黄按钮 = 11.06:1 (AAA)  原 6.69:1
- #587851 vs #F0D1A1 桃黄按钮 = 3.40:1 (AA 大文本)  原 2.35:1
- #243B25 vs #F7EADF 卡片 = 10.30:1 (AAA, 不变)
- #587851 vs #F7EADF 卡片 = 4.22:1 (AA 大文本, 不变)

渐变色组（保持视觉过渡协调）：
- 主按钮: #F0D1A1 → #DDBE8C (原 #D4AC6A → #C09454)
- 主按钮 hover: #DDBE8C → #C8A57E
- 强调按钮: #F0D1A1 → #C8A57E (原 #D4AC6A → #A87D40)
- 装饰顶条: #587851 → #F0D1A1 → #587851
- 渐变描边: #90A686 → #F0D1A1 → #587851
- 滚动条 hover: #F0D1A1 → #C8A57E

修改文件（8 个）：
- tailwind.config.js: amber 8 阶色值 + 文档注释
- src/index.css: 19 处颜色值（变量、按钮、SVG 纹理、装饰元素）
- src/components/common/Header.tsx: 1 处 inline style 渐变
- src/components/RegionPanel/RegionPanel.tsx: 1 处 inline style 渐变
- scripts/verify-wcag-contrast.mjs: 11 处常量 + WCAG 数字注释
- scripts/palette-demo.html: 81 处色值（脚本批量替换）
- scripts/replace-amber.mjs: 新增（替换工具脚本本身）
- PALETTE_USAGE.md: 完整重写为 v4 文档

合规保留：PALETTE_USAGE.md / verify-wcag-contrast.mjs 各保留 1 处
"#D4AC6A" 作为迁移说明文字（解释 v2 替代关系），非实际色值。`;

const FILES = [
  'tailwind.config.js',
  'src/index.css',
  'src/components/common/Header.tsx',
  'src/components/RegionPanel/RegionPanel.tsx',
  'scripts/verify-wcag-contrast.mjs',
  'scripts/palette-demo.html',
  'scripts/replace-amber.mjs',
  'PALETTE_USAGE.md',
];

async function getSha(path) {
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'yaoyi-deploy-script',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET ${path}: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.sha;
}

async function putFile(relPath) {
  const abs = resolve(ROOT, relPath);
  const content = readFileSync(abs, 'utf8');
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  const sha = await getSha(relPath);
  const body = {
    message: COMMIT_MSG,
    branch: BRANCH,
    content: b64,
  };
  if (sha) body.sha = sha;
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURI(relPath)}`;
  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'yaoyi-deploy-script',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`PUT ${relPath}: ${r.status}\n${t}`);
  }
  const j = await r.json();
  console.log(`✓ ${relPath} → ${j.commit.sha.slice(0, 10)}`);
}

console.log(`\n========== 推送蜜炙色 v2 替换到 ${REPO}@${BRANCH} ==========\n`);
let ok = 0, fail = 0;
for (const f of FILES) {
  try {
    await putFile(f);
    ok++;
  } catch (e) {
    console.error(`✗ ${f} : ${e.message}`);
    fail++;
  }
}
console.log(`\n${ok} / ${ok + fail} files pushed successfully`);
if (fail > 0) process.exit(1);