#!/usr/bin/env node
/**
 * 数据完整性修复脚本：补齐海南省缺失的县级 GeoJSON
 *
 * 背景：
 *   海南省使用特殊的"省直辖县级行政区划"（adcode 以 469 开头）。
 *   这些 features 在 460000_full.json 中以 level=city 形式出现，但没有 districts 数组。
 *   原 download-map-data.mjs 只迭代 districts 数组，导致 469xxx 直辖县被遗漏。
 *
 * 修复策略：
 *   1. 解析 460000_full.json，提取所有 469xxx features
 *   2. 检查每个 feature 是否已存在对应的 county/{adcode}.json
 *   3. 对于缺失的县区，从 460000_full.json 的 feature.geometry 提取，单独写为独立 GeoJSON
 *   4. 同步更新 county-manifest.json 与 yao_counties_real.json 聚合文件
 *
 * 输出：
 *   - public/map/county/{469030,469033,469002}.json
 *   - 更新 county-manifest.json
 *   - 更新 yao_counties_real.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_MAP = resolve(__dirname, '../public/map');

const HAINAN_PROVINCE_ADCODE = 460000;
const HAINAN_PROVINCE_ADCODE_PREFIX = '46';
const DIRECT_ADMIN_PREFIX = '469';

// yaoCountyData.ts 中声明的 3 个海南瑶族县
// ✅ 修复：保亭黎族苗族自治县官方 code 为 469029（之前误用 469033 已修正）
const TARGET_YAO_COUNTIES = ['469030', '469029', '469002'];

console.log('=== 海南省直辖县级 GeoJSON 修复脚本 ===\n');

// 1. 加载省级 _full.json
const provincePath = join(PUBLIC_MAP, 'province', `${HAINAN_PROVINCE_ADCODE}_full.json`);
if (!existsSync(provincePath)) {
  console.error(`✗ 省级文件不存在: ${provincePath}`);
  process.exit(1);
}
const provinceGeoJSON = JSON.parse(readFileSync(provincePath, 'utf8'));
console.log(`✓ 已加载省级 GeoJSON (${provinceGeoJSON.features.length} features)`);

// 2. 提取所有 469xxx 直辖县级 features
const directAdminFeatures = provinceGeoJSON.features.filter(f => {
  const adcode = String(f.properties?.adcode ?? '');
  return adcode.startsWith(DIRECT_ADMIN_PREFIX);
});
console.log(`✓ 找到 ${directAdminFeatures.length} 个直辖县级 features (adcode 以 469 开头)`);

// 3. 为每个目标县区写入 county/{adcode}.json
mkdirSync(join(PUBLIC_MAP, 'county'), { recursive: true });

let fixed = 0;
let skipped = 0;
const missingFeatures = [];

for (const code of TARGET_YAO_COUNTIES) {
  const outPath = join(PUBLIC_MAP, 'county', `${code}.json`);
  if (existsSync(outPath)) {
    console.log(`  ⊘ ${code} 已存在，跳过`);
    skipped++;
    continue;
  }

  const feature = directAdminFeatures.find(f => String(f.properties?.adcode) === code);
  if (!feature) {
    console.error(`  ✗ ${code} 在省级 GeoJSON 中找不到对应 feature`);
    missingFeatures.push(code);
    continue;
  }

  // 从省级 feature 中提取并构造独立 county GeoJSON
  const countyGeoJSON = {
    type: 'FeatureCollection',
    features: [feature],
  };

  // 添加父级信息以便聚合检索
  if (countyGeoJSON.features[0].properties) {
    countyGeoJSON.features[0].properties = {
      ...countyGeoJSON.features[0].properties,
      provinceAdcode: HAINAN_PROVINCE_ADCODE,
      provinceName: '海南省',
      cityAdcode: code,
      cityName: feature.properties?.name + '（直辖）',
    };
  }

  writeFileSync(outPath, JSON.stringify(countyGeoJSON), 'utf8');
  console.log(`  ✓ ${code} (${feature.properties?.name}) 已写入 ${outPath}`);
  fixed++;
}

// 4. 更新 county-manifest.json
const manifestPath = join(PUBLIC_MAP, 'county-manifest.json');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let addedToManifest = 0;
  for (const code of TARGET_YAO_COUNTIES) {
    if (!manifest.codes?.includes(code)) {
      manifest.codes = manifest.codes || [];
      manifest.codes.push(code);
      addedToManifest++;
    }
  }
  if (addedToManifest > 0) {
    manifest.totalCounty = manifest.codes.length;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`✓ 已更新 county-manifest.json (新增 ${addedToManifest} 个 county code)`);
  }
}

// 5. 更新 yao_counties_real.json 聚合
const realPath = join(PUBLIC_MAP, 'yao_counties_real.json');
if (existsSync(realPath)) {
  const real = JSON.parse(readFileSync(realPath, 'utf8'));
  let addedToReal = 0;
  for (const code of TARGET_YAO_COUNTIES) {
    const exists = real.features?.some(f => String(f.properties?.adcode) === code);
    if (!exists) {
      const feature = directAdminFeatures.find(f => String(f.properties?.adcode) === code);
      if (feature && real.features) {
        real.features.push(feature);
        addedToReal++;
      }
    }
  }
  if (addedToReal > 0) {
    writeFileSync(realPath, JSON.stringify(real), 'utf8');
    console.log(`✓ 已更新 yao_counties_real.json (新增 ${addedToReal} 个 feature)`);
  }
}

// 6. 同步到 dist/ 目录
const distMap = resolve(__dirname, '../dist/map');
if (existsSync(distMap)) {
  mkdirSync(join(distMap, 'county'), { recursive: true });
  for (const code of TARGET_YAO_COUNTIES) {
    const src = join(PUBLIC_MAP, 'county', `${code}.json`);
    const dst = join(distMap, 'county', `${code}.json`);
    if (existsSync(src) && !existsSync(dst)) {
      writeFileSync(dst, readFileSync(src, 'utf8'));
      console.log(`✓ 已同步 ${code}.json 到 dist/`);
    }
  }
}

console.log('\n=== 修复结果 ===');
console.log(`新增县区文件: ${fixed}`);
console.log(`跳过 (已存在): ${skipped}`);
console.log(`缺失 feature: ${missingFeatures.length}`);
if (missingFeatures.length > 0) {
  console.error(`  警告: 以下 code 在省级 GeoJSON 中找不到:`);
  missingFeatures.forEach(c => console.error(`    ${c}`));
  process.exit(1);
}
process.exit(0);