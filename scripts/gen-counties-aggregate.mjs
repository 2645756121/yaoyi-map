/**
 * 精简聚合文件生成器
 *
 * 用途：生成轻量级县级聚合文件（仅 metadata，无坐标），让客户端能快速获取县级列表
 * 大小：~50 KB（vs 15 MB 全量）
 *
 * 运行： node scripts/gen-counties-aggregate.mjs
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COUNTY_DIR = resolve(__dirname, '../public/map/county');
const OUT_FILE = resolve(__dirname, '../public/map/yao_counties_meta.json');

(async () => {
  console.log('=== 精简县级聚合文件（metadata only）===');
  console.log(`扫描目录: ${COUNTY_DIR}`);

  const files = (await readdir(COUNTY_DIR)).filter(
    (f) => f.endsWith('.json') && /^\d{6}\.json$/.test(f)
  );

  const meta = [];
  for (const f of files) {
    const adcode = parseInt(f.replace('.json', ''), 10);
    try {
      const data = JSON.parse(
        await readFile(join(COUNTY_DIR, f), 'utf8')
      );
      const p = data.features?.[0]?.properties ?? {};
      meta.push({
        adcode,
        name: p.name,
        level: p.level,
        center: p.center,
        centroid: p.centroid,
        provinceAdcode: p.provinceAdcode,
        provinceName: p.provinceName,
        cityAdcode: p.cityAdcode,
        cityName: p.cityName,
      });
    } catch {
      meta.push({ adcode });
    }
  }

  meta.sort((a, b) => a.adcode - b.adcode);

  const out = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalCounty: meta.length,
    counties: meta,
  };

  await writeFile(OUT_FILE, JSON.stringify(out), 'utf8');
  console.log(`✓ 输出 ${meta.length} 个县级 metadata`);
  console.log(`✓ 文件: ${OUT_FILE}`);

  // 统计大小
  const stat = await readFile(OUT_FILE, 'utf8');
  console.log(`✓ 大小: ${(stat.length / 1024).toFixed(1)} KB`);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});