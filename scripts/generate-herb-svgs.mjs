/**
 * 为每个草药生成 SVG 插画（无外部依赖，作为本地兜底图片）
 *
 * 这些插画：
 * - 展示草药的中文名 + 拉丁学名
 * - 抽象但优雅的"本草图鉴"风格
 * - 真实高分辨率矢量（任意放大不失真）
 * - 与草药形态特征相符的颜色与图样
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_HERBS = resolve(__dirname, '../public/herbs');
mkdirSync(PUBLIC_HERBS, { recursive: true });

/**
 * 草药插画规格（按 herb ID 索引）
 * - viewBox 固定为 400x300 (4:3)
 * - 颜色基于药材本色（根/茎/叶/花/果）
 * - 含中英文双语标注
 */
const HERB_ILLUSTRATIONS = {
  // ===== 主图（地图上的 4 个） =====
  jiegeng: {
    name: '桔梗',
    sciName: 'Platycodon grandiflorus',
    color: '#5B7DB1',
    bg: '#E8EFF7',
    shape: 'flower', // 球状花苞
  },
  lingzhi: {
    name: '灵芝',
    sciName: 'Ganoderma lucidum',
    color: '#A0432B',
    bg: '#F5E6DA',
    shape: 'mushroom', // 蘑菇
  },
  gancao: {
    name: '甘草',
    sciName: 'Glycyrrhiza uralensis',
    color: '#7B6F4C',
    bg: '#F0EBDF',
    shape: 'root', // 根茎
  },
  // ===== 主要中药材 =====
  huangqi: {
    name: '黄芪',
    sciName: 'Astragalus membranaceus',
    color: '#8B6B3D',
    bg: '#F5EBD8',
    shape: 'root',
  },
  dangshen: {
    name: '党参',
    sciName: 'Codonopsis pilosula',
    color: '#9C7B5E',
    bg: '#F2EBE2',
    shape: 'root',
  },
  baizhu: {
    name: '白术',
    sciName: 'Atractylodes macrocephala',
    color: '#A88E5C',
    bg: '#F4EDDF',
    shape: 'root',
  },
  shanyao: {
    name: '山药',
    sciName: 'Dioscorea polystachya',
    color: '#B5945F',
    bg: '#F5EDD8',
    shape: 'root',
  },
  danggui: {
    name: '当归',
    sciName: 'Angelica sinensis',
    color: '#7D5938',
    bg: '#F0E7DA',
    shape: 'root',
  },
  danshen: {
    name: '丹参',
    sciName: 'Salvia miltiorrhiza',
    color: '#8B3F2F',
    bg: '#F0DDD5',
    shape: 'root',
  },
  fuling: {
    name: '茯苓',
    sciName: 'Wolfiporia extensa',
    color: '#9B8B6E',
    bg: '#F0EBDD',
    shape: 'mushroom',
  },
  huangqin: {
    name: '黄芩',
    sciName: 'Scutellaria baicalensis',
    color: '#6B5D2D',
    bg: '#EEEAD6',
    shape: 'root',
  },
  duzhong: {
    name: '杜仲',
    sciName: 'Eucommia ulmoides',
    color: '#6E5839',
    bg: '#EDE5D2',
    shape: 'leaf',
  },
  baishao: {
    name: '白芍',
    sciName: 'Paeonia lactiflora',
    color: '#A37F8F',
    bg: '#F0E5E8',
    shape: 'flower',
  },
  chuanxiong: {
    name: '川芎',
    sciName: 'Ligusticum striatum',
    color: '#7B5C40',
    bg: '#EEE3D5',
    shape: 'root',
  },
  honghua: {
    name: '红花',
    sciName: 'Carthamus tinctorius',
    color: '#B83F35',
    bg: '#F5DDDA',
    shape: 'flower',
  },
  sanqi: {
    name: '三七',
    sciName: 'Panax notoginseng',
    color: '#8B6A4E',
    bg: '#F0E5D8',
    shape: 'root',
  },
  mudanpi: {
    name: '牡丹皮',
    sciName: 'Paeonia suffruticosa',
    color: '#A37F8F',
    bg: '#F0E5E8',
    shape: 'root',
  },
  // ===== 海南瑶药 =====
  yuzhu: {
    name: '玉竹',
    sciName: 'Polygonatum odoratum',
    color: '#7A8050',
    bg: '#EDEEDA',
    shape: 'leaf',
  },
  shihu: {
    name: '石斛',
    sciName: 'Dendrobium nobile',
    color: '#5B8A6A',
    bg: '#E5EEE5',
    shape: 'flower',
  },
  // ===== 其他常用瑶药 =====
  chenpi: {
    name: '陈皮',
    sciName: 'Citrus reticulata',
    color: '#B27E3D',
    bg: '#F5EBD8',
    shape: 'fruit',
  },
  houpo: {
    name: '厚朴',
    sciName: 'Magnolia officinalis',
    color: '#7C6E48',
    bg: '#EFEAD8',
    shape: 'leaf',
  },
  chaihu: {
    name: '柴胡',
    sciName: 'Bupleurum chinense',
    color: '#7A8B4A',
    bg: '#EDEEDA',
    shape: 'root',
  },
  yujin: {
    name: '郁金',
    sciName: 'Curcuma aromatica',
    color: '#B87935',
    bg: '#F4E5D0',
    shape: 'root',
  },
  xiangfu: {
    name: '香附',
    sciName: 'Cyperus rotundus',
    color: '#8E7B4A',
    bg: '#F0EBD8',
    shape: 'root',
  },
};

/** 生成不同形态的草药 SVG 插画 */
function generateHerbSVG({ name, sciName, color, bg, shape }, size = 400) {
  const h = size * 0.75;
  const cx = size / 2;
  const cy = h / 2;

  let shapeSvg = '';
  switch (shape) {
    case 'flower':
      shapeSvg = `
        <!-- 花 -->
        <g transform="translate(${cx}, ${cy - 20})">
          <circle cx="0" cy="0" r="55" fill="${color}" opacity="0.15"/>
          ${[0, 60, 120, 180, 240, 300].map((a) => `
            <ellipse cx="${Math.cos(a * Math.PI / 180) * 35}" cy="${Math.sin(a * Math.PI / 180) * 35}" rx="25" ry="20" fill="${color}" transform="rotate(${a})"/>
          `).join('')}
          <circle cx="0" cy="0" r="18" fill="#FCD34D" opacity="0.95"/>
        </g>`;
      break;
    case 'root':
      shapeSvg = `
        <!-- 根/根茎 -->
        <g transform="translate(${cx}, ${cy})">
          <path d="M 0,-60 Q -15,-30 -10,0 Q -15,30 0,60 Q -20,40 -25,0 Q -20,-40 0,-60"
                fill="${color}" stroke="${color}" stroke-width="2" opacity="0.85"/>
          <path d="M -8,-50 Q -8,-25 -8,0 Q -8,25 -8,50" stroke="#fff" stroke-width="1.5" fill="none" opacity="0.4"/>
          <circle cx="0" cy="0" r="3" fill="#FCD34D"/>
        </g>`;
      break;
    case 'leaf':
      shapeSvg = `
        <!-- 叶 -->
        <g transform="translate(${cx}, ${cy - 20}) rotate(-15)">
          <path d="M 0,-60 Q 40,-30 35,20 Q 30,55 0,60 Q -30,55 -35,20 Q -40,-30 0,-60"
                fill="${color}" opacity="0.85" stroke="${color}" stroke-width="2"/>
          <path d="M 0,-50 L 0,55" stroke="#fff" stroke-width="1.5" opacity="0.5"/>
          <path d="M 0,-30 Q 15,-20 25,-15" stroke="#fff" stroke-width="1" fill="none" opacity="0.4"/>
          <path d="M 0,-10 Q 15,0 28,5" stroke="#fff" stroke-width="1" fill="none" opacity="0.4"/>
          <path d="M 0,15 Q 15,25 25,30" stroke="#fff" stroke-width="1" fill="none" opacity="0.4"/>
        </g>`;
      break;
    case 'mushroom':
      shapeSvg = `
        <!-- 蘑菇 / 灵芝 -->
        <g transform="translate(${cx}, ${cy - 15})">
          <ellipse cx="0" cy="20" rx="55" ry="12" fill="${color}" opacity="0.2"/>
          <path d="M -45,5 Q -45,-30 0,-35 Q 45,-30 45,5 Z" fill="${color}" opacity="0.9" stroke="${color}" stroke-width="2"/>
          <ellipse cx="0" cy="-15" rx="35" ry="8" fill="#fff" opacity="0.3"/>
          <ellipse cx="-12" cy="-5" rx="6" ry="3" fill="#fff" opacity="0.4"/>
          <ellipse cx="10" cy="-8" rx="5" ry="2" fill="#fff" opacity="0.4"/>
          <path d="M -8,5 L -8,55 Q -8,65 0,65 Q 8,65 8,55 L 8,5" fill="${color}" opacity="0.85" stroke="${color}" stroke-width="1.5"/>
        </g>`;
      break;
    case 'fruit':
      shapeSvg = `
        <!-- 果实 -->
        <g transform="translate(${cx}, ${cy})">
          <circle cx="0" cy="0" r="45" fill="${color}" opacity="0.85" stroke="${color}" stroke-width="2"/>
          <circle cx="-12" cy="-15" r="6" fill="#fff" opacity="0.4"/>
          <circle cx="10" cy="-8" r="4" fill="#fff" opacity="0.4"/>
          <path d="M 0,-45 Q -8,-55 0,-65 Q 8,-55 0,-45" stroke="${color}" stroke-width="2.5" fill="${color}" opacity="0.9"/>
          <ellipse cx="0" cy="0" rx="40" ry="40" fill="none" stroke="#fff" stroke-width="1" opacity="0.2"/>
        </g>`;
      break;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${h}" width="${size}" height="${h}">
  <defs>
    <linearGradient id="bg-${name}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${bg}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0.6"/>
    </linearGradient>
    <pattern id="weave-${name}" patternUnits="userSpaceOnUse" width="20" height="20">
      <path d="M 0,10 L 20,10 M 10,0 L 10,20" stroke="${color}" stroke-width="0.3" opacity="0.15"/>
    </pattern>
  </defs>

  <!-- 背景渐变 -->
  <rect width="100%" height="100%" fill="url(#bg-${name})"/>

  <!-- 本草图鉴纹饰底纹 -->
  <rect width="100%" height="100%" fill="url(#weave-${name})"/>

  <!-- 边框（仿古医书风格） -->
  <rect x="6" y="6" width="${size - 12}" height="${h - 12}" fill="none" stroke="${color}" stroke-width="2" opacity="0.4"/>
  <rect x="10" y="10" width="${size - 20}" height="${h - 20}" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.3"/>

  <!-- 顶部装饰横线 -->
  <line x1="20" y1="22" x2="${size - 20}" y2="22" stroke="${color}" stroke-width="1" opacity="0.5"/>
  <text x="20" y="18" font-family="Noto Sans SC, serif" font-size="9" fill="${color}" opacity="0.7">本草图鉴</text>
  <text x="${size - 20}" y="18" text-anchor="end" font-family="serif" font-size="9" fill="${color}" opacity="0.7">HERBARIUM</text>

  ${shapeSvg}

  <!-- 名称 -->
  <g transform="translate(${cx}, ${h - 50})">
    <text text-anchor="middle" font-family="Noto Sans SC, serif" font-size="22" font-weight="700" fill="${color}">${name}</text>
    <text text-anchor="middle" y="22" font-family="serif" font-size="10" font-style="italic" fill="${color}" opacity="0.8">${sciName}</text>
    <line x1="-40" y1="32" x2="40" y2="32" stroke="${color}" stroke-width="0.5" opacity="0.5"/>
  </g>

  <!-- 角标 -->
  <text x="14" y="${h - 10}" font-family="serif" font-size="8" fill="${color}" opacity="0.5">Real · Plant · 2026</text>
  <text x="${size - 14}" y="${h - 10}" text-anchor="end" font-family="serif" font-size="8" fill="${color}" opacity="0.5">YaoYi · 瑶药</text>
</svg>`;
}

let generated = 0;
for (const [id, info] of Object.entries(HERB_ILLUSTRATIONS)) {
  const svg = generateHerbSVG(info);
  const destPath = resolve(PUBLIC_HERBS, `${id}.svg`);
  writeFileSync(destPath, svg, 'utf8');
  generated++;
}

console.log(`✓ Generated ${generated} SVG illustrations at public/herbs/`);