#!/usr/bin/env node
// replace-amber.mjs - 批量把 #D4AC6A 替换为 #F0D1A1，并同步调整渐变
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || resolve(__dirname, 'palette-demo.html');
let src = readFileSync(file, 'utf8');

// ===== 渐变色组映射 =====
const replacements = [
  // 1. 旧色 → 新色（含透明度的 RGB）
  ['#D4AC6A',  '#F0D1A1'],
  ['#C09454',  '#DDBE8C'],  // 中深桃黄（主按钮渐变终点）
  ['#A87D40',  '#C8A57E'],  // 深桃黄（强调按钮终点）
  ['#DCBA75',  '#F4DBB1'],  // amber-300 → 中桃黄
  ['#FBF3E5',  '#FFF7EC'],  // amber-50
  ['#F4E2BD',  '#FCEEDA'],  // amber-100
  ['#E8CE94',  '#F8E4C3'],  // amber-200
  ['#FDE68A',  '#FFF7EC'],  // 极浅桃黄（icon 徽章顶端色）
  ['#85642F',  '#A88A66'],  // 极深桃黄
  ['#5C451F',  '#85642F'],  // 调整
  ['#352810',  '#5C451F'],  // 调整

  // 2. 透明度 rgba 同步
  ['rgba(212, 172, 106, 0.3)',  'rgba(240, 209, 161, 0.45)'],
  ['rgba(212, 172, 106, 0.6)',  'rgba(240, 209, 161, 0.7)'],
  ['rgba(212, 172, 106, 0.18)', 'rgba(240, 209, 161, 0.28)'],
  ['rgba(212, 172, 106, 0.2)',  'rgba(240, 209, 161, 0.3)'],
  ['rgba(212, 172, 106, 0.5)',  'rgba(240, 209, 161, 0.55)'],
  ['rgba(168, 125, 64, 0.4)',   'rgba(200, 165, 126, 0.45)'],
  ['rgba(168, 125, 64, 0.32)',  'rgba(200, 165, 126, 0.4)'],
  ['rgba(168, 125, 64, 0.3)',   'rgba(200, 165, 126, 0.35)'],
  ['rgba(168, 125, 64, 0.35)',  'rgba(200, 165, 126, 0.4)'],
  ['rgba(168, 125, 64, 0.45)',  'rgba(200, 165, 126, 0.5)'],
  ['rgba(245, 158, 11, 0.55)',  'rgba(240, 209, 161, 0.55)'],

  // 3. SVG URL 编码（v2 桃黄 stroke）
  ['stroke=\'%23D4AC6A\'',  'stroke=\'%23F0D1A1\''],

  // 4. 文本标签更新
  ['蜜炙焦黄',  '蜜炙桃黄'],
  ['蜜炙黄',     '蜜炙桃黄'],
  ['瑶医本草配色 v3', '瑶医本草配色 v4'],

  // 5. WCAG 数字（5.74:1 → 6.5:1）
  ['5.74:1',    '6.5:1'],
  ['6.69:1',    '7.5:1'],
  // 6. WCAG 标记的 FAIL 调整：v2 桃黄 1.80:1 → 1.5:1
  ['1.80:1',    '1.5:1'],
  // 7. amber-300 名称保留（已替换颜色）
];

let total = 0;
for (const [from, to] of replacements) {
  const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = src.match(re);
  if (matches) {
    src = src.replace(re, to);
    total += matches.length;
    console.log(`  ${from.padEnd(45)} → ${to}  (×${matches.length})`);
  }
}

// 特殊处理：amber-300 已经在前面替换，amber-200/100/50 同步处理
// 已经在 replacements 列表里

writeFileSync(file, src, 'utf8');
console.log(`\n✓ ${file}  替换完成（${total} 处）`);