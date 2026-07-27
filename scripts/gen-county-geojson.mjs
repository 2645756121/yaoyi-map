/**
 * 生成县级多边形 GeoJSON
 *
 * 真实县级边界数据需要专业测绘数据源，本项目采用基于中心点的近似多边形：
 * - 核心区：8 边形（半径 0.65°，约 70km，覆盖较广）
 * - 发展区：6 边形（半径 0.45°，约 50km）
 * - 主产区：6 边形（半径 0.55°，约 60km）
 *
 * 多边形以 county 中心经纬度为锚点，使用 jitter 偏移避免视觉上完全对称。
 * 输出文件： public/map/county_yao.json
 *
 * 运行方式： node scripts/gen-county-geojson.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  resolve(__dirname, '../src/data/yaoCountyData.ts'),
  'utf8'
);

// 简易 TS 解析：抓取 { ... } 内的 code/name/category/centerLng/centerLat
const blockRe = /\{[\s\S]*?\}/g;
const blocks = src.match(blockRe) ?? [];

const records = [];
for (const b of blocks) {
  if (!/centerLng/.test(b)) continue;
  const code = b.match(/code:\s*'([^']+)'/)?.[1];
  const name = b.match(/name:\s*'([^']+)'/)?.[1];
  const province = b.match(/province:\s*'([^']+)'/)?.[1];
  const category = b.match(/category:\s*'([^']+)'/)?.[1];
  const centerLng = parseFloat(b.match(/centerLng:\s*([\d.]+)/)?.[1] ?? '0');
  const centerLat = parseFloat(b.match(/centerLat:\s*([\d.]+)/)?.[1] ?? '0');
  if (!code || !name || !category) continue;
  records.push({ code, name, province, category, centerLng, centerLat });
}

// 同一县可能多次出现（防重）
const seen = new Set();
const dedup = records.filter((r) => {
  if (seen.has(r.code)) return false;
  seen.add(r.code);
  return true;
});

console.log(`Parsed ${dedup.length} unique county records`);

/**
 * 生成以 (lng, lat) 为中心、给定半径（经纬度单位）的正 N 边形。
 * 引入确定性微抖动（基于 code 哈希），保证视觉上的非对称性。
 */
function makePolygon(lng, lat, sides, radius, code) {
  const seed = [...code].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const pts = [];
  for (let i = 0; i < sides; i++) {
    // 0..2π 平均分布，每点增加 ±8% 的确定性扰动
    const baseAngle = (i / sides) * 2 * Math.PI - Math.PI / 2; // 从顶部起
    const jitter = (((seed * 31 + i * 17) % 100) / 100 - 0.5) * 0.16;
    const angle = baseAngle + jitter;
    const rJitter = 1 + (((seed + i * 7) % 100) / 100 - 0.5) * 0.12;
    const dx = Math.cos(angle) * radius * rJitter;
    // 纬度方向按 cos(lat) 修正，避免高纬度多边形被拉伸
    const dy = Math.sin(angle) * radius * rJitter * Math.cos((lat * Math.PI) / 180);
    pts.push([
      Number((lng + dx).toFixed(5)),
      Number((lat + dy).toFixed(5)),
    ]);
  }
  // GeoJSON Polygon 必须首尾闭合
  pts.push(pts[0]);
  return pts;
}

const RADIUS_BY_CATEGORY = {
  core: 0.65,
  development: 0.45,
  production: 0.55,
};

const features = dedup.map((r) => {
  const radius = RADIUS_BY_CATEGORY[r.category] ?? 0.5;
  const sides = r.category === 'core' ? 8 : 6;
  const polygon = [makePolygon(r.centerLng, r.centerLat, sides, radius, r.code)];
  return {
    type: 'Feature',
    properties: {
      code: r.code,
      name: r.name,
      province: r.province,
      category: r.category,
      centerLng: r.centerLng,
      centerLat: r.centerLat,
    },
    geometry: {
      type: 'Polygon',
      coordinates: polygon,
    },
  };
});

const geojson = {
  type: 'FeatureCollection',
  metadata: {
    generatedAt: new Date().toISOString(),
    description:
      '全国瑶医瑶药重点县级近似多边形，中心点为县级政府所在地；多边形大小按分类调整。',
    note:
      '实际县级行政边界请参考官方测绘数据；本数据用于瑶医瑶药分布可视化。',
    source: '本项目自维护（src/data/yaoCountyData.ts）',
    count: features.length,
  },
  features,
};

const outDir = resolve(__dirname, '../public/map');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'county_yao.json');
writeFileSync(outPath, JSON.stringify(geojson));
console.log(`Written ${features.length} features to ${outPath}`);

// 分类计数
const counts = features.reduce((acc, f) => {
  acc[f.properties.category] = (acc[f.properties.category] ?? 0) + 1;
  return acc;
}, {});
console.log('Category distribution:', counts);