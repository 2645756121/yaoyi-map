/**
 * 生成县级 manifest 文件（county-manifest.json）
 *
 * 用途：
 *  - 客户端运行时通过此 manifest 知道有哪些县级文件可用
 *  - 即使聚合文件 /map/yao_counties_real.json 加载失败，也能正确加载县级
 *
 * 运行： node scripts/gen-county-manifest.mjs
 */

import { readdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COUNTY_DIR = resolve(__dirname, '../public/map/county');
const OUT_FILE = resolve(__dirname, '../public/map/county-manifest.json');

(async () => {
  console.log('=== 生成 county-manifest.json ===');
  console.log(`扫描目录: ${COUNTY_DIR}`);

  const files = (await readdir(COUNTY_DIR)).filter(
    (f) => f.endsWith('.json') && /^\d{6}\.json$/.test(f)
  );

  const codes = files
    .map((f) => parseInt(f.replace('.json', ''), 10))
    .filter((c) => !isNaN(c) && c > 0)
    .sort((a, b) => a - b);

  // 同样统计市级
  const CITY_DIR = resolve(__dirname, '../public/map/city');
  const cityFiles = (await readdir(CITY_DIR)).filter(
    (f) => f.endsWith('.json') && /^\d{6}\.json$/.test(f)
  );
  const cityCodes = cityFiles
    .map((f) => parseInt(f.replace('.json', ''), 10))
    .filter((c) => !isNaN(c) && c > 0)
    .sort((a, b) => a - b);

  // 省级（含市级子区）
  const PROVINCE_DIR = resolve(__dirname, '../public/map/province');
  let provinceFiles = [];
  try {
    provinceFiles = (await readdir(PROVINCE_DIR)).filter((f) => f.endsWith('.json'));
  } catch {}

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalCounty: codes.length,
    totalCity: cityCodes.length,
    totalProvince: provinceFiles.length,
    codes,
    cityCodes,
    provinceFiles,
  };

  await writeFile(OUT_FILE, JSON.stringify(manifest), 'utf8');

  console.log(`✓ 县级: ${codes.length}`);
  console.log(`✓ 市级: ${cityCodes.length}`);
  console.log(`✓ 省级: ${provinceFiles.length}`);
  console.log(`✓ 输出: ${OUT_FILE}`);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});