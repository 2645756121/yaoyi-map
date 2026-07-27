/**
 * 边界准确性测试：验证 county_yao.json 中每个县多边形的边界标注是否合理
 *
 * 校验项：
 *   1. 属性完整性（所有 feature 含必需字段）
 *   2. centerLng/Lat 是否在多边形 bbox 内（或 bbox 中心附近 0.2° 容差内）
 *   3. bbox 大小合理性（宽度 0.1°-2°，高度 0.1°-2°）
 *
 * 运行方式： node scripts/boundary-test.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const geo = JSON.parse(
  readFileSync(resolve(__dirname, '../public/map/county_yao.json'), 'utf8')
);

const REQUIRED_PROPS = ['code', 'name', 'category', 'province', 'centerLng', 'centerLat'];

let issues = {
  missing: 0,
  bboxInvalid: 0,
  centerOffset: 0,
};

console.log('=== 边界准确性校验 ===');
console.log('');

for (const feature of geo.features) {
  const props = feature.properties;
  const ring = feature.geometry.coordinates[0];

  // 1. 属性完整性
  const missing = REQUIRED_PROPS.filter((p) => !(p in props));
  if (missing.length > 0) {
    console.log(`属性缺失 [${props.code}] ${props.name}: ${missing.join(', ')}`);
    issues.missing++;
  }

  // 2. bbox 计算
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const width = maxLng - minLng;
  const height = maxLat - minLat;

  // 3. bbox 大小合理性
  if (width > 2 || height > 2 || width < 0.05 || height < 0.05) {
    console.log(
      `bbox 异常 [${props.code}] ${props.name}: ${width.toFixed(2)}° × ${height.toFixed(2)}°`
    );
    issues.bboxInvalid++;
  }

  // 4. centerLng/Lat 是否在 bbox 附近（容差 0.2°）
  const { centerLng, centerLat } = props;
  const dx = centerLng - (minLng + maxLng) / 2;
  const dy = centerLat - (minLat + maxLat) / 2;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 0.2) {
    console.log(
      `中心偏移 [${props.code}] ${props.name}: ${dist.toFixed(3)}° (容差 0.2°)`
    );
    issues.centerOffset++;
  }
}

console.log('');
console.log('=== 校验结果 ===');
console.log(`总要素数:        ${geo.features.length}`);
console.log(`属性缺失:        ${issues.missing}`);
console.log(`bbox 异常:        ${issues.bboxInvalid}`);
console.log(`中心点偏移 >0.2°: ${issues.centerOffset}`);
const total = issues.missing + issues.bboxInvalid + issues.centerOffset;
console.log('---');
console.log(`最终: ${total === 0 ? '✓ 全部通过' : `✗ ${total} 处异常`}`);

if (total > 0) process.exit(1);