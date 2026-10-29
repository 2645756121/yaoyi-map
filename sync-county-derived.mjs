#!/usr/bin/env node
/**
 * sync-county-derived.mjs
 *
 * 把 src/data/yaoCountyData.ts 中的县级 code/name 同步到两个「派生产物」：
 *   1. public/map/county_yao.json          —— 近似多边形（本项目自维护，含 name/province/center）
 *   2. public/map/yao-counties-polygon.geojson —— 由 public/map/county/{code}.json 的真实边界合并而成
 *
 * 为什么需要：
 *   源码里的 adcode 曾被修正（如 469033→469029、451424→451123），但派生产物没跟着更新，
 *   导致 smoke-test 报 "code 在 yaoCounties 中未声明"。本脚本以源码为唯一真值重新生成。
 *
 * 用法：node sync-county-derived.mjs
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join('src', 'data', 'yaoCountyData.ts');
const COUNTY_DIR = path.join('public', 'map', 'county');
const OUT_APPROX = path.join('public', 'map', 'county_yao.json');
const OUT_REAL = path.join('public', 'map', 'yao-counties-polygon.geojson');

const HEIGHT = { core: 120000, production: 60000, development: 30000 };

/* ---------------- 1. 解析源码：以对象为单位抽取字段 ---------------- */
const text = fs.readFileSync(SRC, 'utf8');
// 逐个 "{"…"}" 顶层对象块（字段之间无嵌套花括号，正则足够）
const blocks = text.match(/\{[^{}]*code:\s*'\d{6}'[^{}]*\}/g) ?? [];

const records = [];
for (const b of blocks) {
  const code = (b.match(/code:\s*'(\d{6})'/) || [])[1];
  const name = (b.match(/name:\s*'([^']+)'/) || [])[1];
  const province = (b.match(/province:\s*'([^']+)'/) || [])[1];
  const category = (b.match(/category:\s*'(\w+)'/) || [])[1];
  const inst = (b.match(/institutionCount:\s*(\d+)/) || [])[1];
  const lng = (b.match(/centerLng:\s*([\d.]+)/) || [])[1];
  const lat = (b.match(/centerLat:\s*([\d.]+)/) || [])[1];
  if (code && name) {
    records.push({
      code,
      name,
      province: province ?? '',
      category: category ?? 'development',
      institutionCount: inst ? parseInt(inst, 10) : 0,
      centerLng: lng ? parseFloat(lng) : undefined,
      centerLat: lat ? parseFloat(lat) : undefined,
    });
  }
}
const byName = new Map(records.map((r) => [r.name, r]));
const byCode = new Map(records.map((r) => [r.code, r]));
console.log(`源码解析：${records.length} 条县级记录`);

/* ---------------- 2. 同步 county_yao.json ---------------- */
const approx = JSON.parse(fs.readFileSync(OUT_APPROX, 'utf8'));
let approxFixed = 0;
const approxOrphans = [];
for (const f of approx.features) {
  const p = f.properties;
  // 先按 code 命中；未命中再按 name 回退（正是失效 code 的场景）
  let rec = byCode.get(String(p.code));
  if (!rec) rec = byName.get(p.name);
  if (!rec) {
    approxOrphans.push(`${p.code}/${p.name}`);
    continue;
  }
  if (String(p.code) !== rec.code) {
    console.log(`  [approx] ${p.name}: code ${p.code} -> ${rec.code}`);
    p.code = rec.code;
    approxFixed++;
  }
  // name/category/center 也以源码为准，避免同类漂移
  if (p.name !== rec.name) p.name = rec.name;
  if (p.category !== rec.category) p.category = rec.category;
  if (rec.centerLng !== undefined) p.centerLng = rec.centerLng;
  if (rec.centerLat !== undefined) p.centerLat = rec.centerLat;
}
approx.metadata = {
  ...approx.metadata,
  generatedAt: new Date().toISOString(),
  count: approx.features.length,
  source: '本项目自维护（src/data/yaoCountyData.ts 经 sync-county-derived.mjs 同步）',
};
fs.writeFileSync(OUT_APPROX, JSON.stringify(approx));
console.log(`county_yao.json：修正 ${approxFixed} 个 code，features=${approx.features.length}`);
if (approxOrphans.length) console.log(`  未能匹配源码的 feature：${approxOrphans.join(', ')}`);

/* ---------------- 3. 重新合并真实边界 yao-counties-polygon.geojson ---------------- */
const features = [];
const missing = [];
for (const rec of records) {
  const fp = path.join(COUNTY_DIR, `${rec.code}.json`);
  if (!fs.existsSync(fp)) {
    missing.push(rec.code);
    continue;
  }
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (data.features && data.features.length > 0) {
      const f = data.features[0];
      const props = f.properties ?? (f.properties = {});
      props.adcode = Number(rec.code);
      props.name = rec.name;
      props.province = rec.province;
      props.category = rec.category;
      props.height = HEIGHT[rec.category] ?? 20000;
      props.institutionCount = rec.institutionCount;
      props.yaoName = rec.name;
      features.push(f);
    } else {
      missing.push(`${rec.code}(empty)`);
    }
  } catch (e) {
    missing.push(`${rec.code}(${e.message})`);
  }
}
fs.writeFileSync(OUT_REAL, JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`yao-counties-polygon.geojson：写入 ${features.length} 个真实边界 feature`);
if (missing.length) console.log(`  缺失：${missing.join(', ')}`);
