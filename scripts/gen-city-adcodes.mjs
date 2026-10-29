#!/usr/bin/env node
/**
 * gen-city-adcodes.mjs
 *
 * 由 public/map/china_cities.json 生成 src/lib/cityAdcodes.ts。
 *
 * 背景：adminAggregator 在把县级数据聚合到「市」层级时，原先缺少
 *       adcode→市名 对照表，只能合成形如 `广西壮族自治区·4513` 的占位名；
 *       引入本表后可直接得到真实地名 `来宾市`。
 *
 * 何时需要重新运行：行政区划调整（撤地设市、市改名等）之后。
 *
 * 用法：node scripts/gen-city-adcodes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'map', 'china_cities.json');
const OUT = path.join(ROOT, 'src', 'lib', 'cityAdcodes.ts');

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const pairs = (data.features ?? [])
  .map((f) => [String(f.properties?.adcode ?? ''), f.properties?.name])
  .filter(([ad, nm]) => /^\d{6}$/.test(ad) && typeof nm === 'string' && nm.length > 0)
  .sort((a, b) => a[0].localeCompare(b[0]));

if (pairs.length === 0) {
  console.error(`[gen-city-adcodes] 未能从 ${SRC} 解析出任何 adcode/name`);
  process.exit(1);
}

const seen = new Set();
const unique = [];
for (const [ad, nm] of pairs) {
  if (seen.has(ad)) continue;
  seen.add(ad);
  unique.push([ad, nm]);
}

const lines = [
  '/**',
  ' * 市级 adcode → 市名映射（GB/T 2260）',
  ' *',
  ` * 数据来源：public/map/china_cities.json（随项目分发的公开行政区划数据，共 ${unique.length} 个市级单元）。`,
  ' * 生成脚本：`node scripts/gen-city-adcodes.mjs`（行政区划调整后需重新运行）。',
  ' *',
  ' * 用途：adminAggregator 在把县级数据聚合到「市」层级时，',
  ' *      原先只能合成形如 `广西壮族自治区·4513` 的占位名称（因为缺少 adcode→市名对照表），',
  ' *      既不可读也无法与真实地名对应。引入本表后可直接得到 `来宾市`。',
  ' */',
  'export const CITY_ADCODES: Record<string, string> = {',
  ...unique.map(([ad, nm]) => `  '${ad}': '${nm}',`),
  '};',
  '',
  '/** 取市名；未收录时返回 undefined（调用方应回退到 adcode 展示） */',
  'export function getCityName(cityAdcode: string): string | undefined {',
  '  return CITY_ADCODES[cityAdcode];',
  '}',
  '',
];

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(
  `[gen-city-adcodes] 已写入 ${path.relative(ROOT, OUT)}（${unique.length} 个市级 adcode）`
);
