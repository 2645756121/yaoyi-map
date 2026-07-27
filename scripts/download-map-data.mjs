/**
 * 中国行政区划地图数据预下载脚本
 *
 * 数据源：阿里云 DataV.GeoAtlas (https://datav.aliyun.com/portal/school/atlas/area_selector)
 * 数据基于高德开放平台（更新于 2021.5），仅供学习交流使用
 *
 * 下载策略：
 *   1. 全国（不含子区域） - 已存在 100000.json（保留）
 *   2. 全国（含省级子区域） - 新下载 100000_full.json，含 35 个省级要素 + 中心点
 *   3. 全国 9 个瑶族省份的 _full.json - 含省级 + 市级子区域
 *   4. 9 省下辖所有市的 .json（不含县级） - 市级边界
 *   5. 全国市级聚合到一个 china_cities.json - 备用
 *   6. 9 个瑶族省份的所有县级 - 聚合到 yao_counties_real.json
 *
 * 输出目录：public/map/
 *   - 100000.json         (国家级，已有)
 *   - 100000_full.json    (国家级，含省级子区域)
 *   - province/{adcode}.json    (34 个省级，备用)
 *   - province_yao/{adcode}_full.json (9 瑶族省含市级)
 *   - city/{adcode}.json   (~109 个市级)
 *   - china_cities.json   (聚合全国市级，备用)
 *   - county/{adcode}.json (9 省下辖所有县级，约 700+)
 *   - yao_counties_real.json (聚合 9 省县级，与 yaoCounties 对照)
 *
 * 运行： node scripts/download-map-data.mjs
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_MAP = resolve(__dirname, '../public/map');

const BASE_URL = 'https://geo.datav.aliyun.com/areas_v3/bound';

/**
 * 瑶族相关 9 省 adcode
 */
const YAO_PROVINCE_ADCODES = [
  450000, // 广西壮族自治区
  440000, // 广东省
  430000, // 湖南省
  530000, // 云南省
  520000, // 贵州省
  360000, // 江西省
  460000, // 海南省
  500000, // 重庆市
  510000, // 四川省
];

/**
 * HTTP GET with timeout & retry
 */
async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data;
    } catch (e) {
      if (i === retries - 1) {
        console.error(`  ✗ Failed ${url}: ${e.message}`);
        throw e;
      }
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

/**
 * Write JSON file
 */
async function writeJson(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data), 'utf8');
}

/**
 * 进度格式化
 */
function fmtSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

(async () => {
  console.log('=== 中国行政区划地图数据预下载 ===');
  console.log(`数据源: ${BASE_URL}`);
  console.log(`输出目录: ${PUBLIC_MAP}`);
  console.log('');

  const stats = {
    downloaded: 0,
    totalBytes: 0,
    skipped: 0,
    failed: 0,
  };

  // ================== Step 1: 全国（含省级子区域） ==================
  console.log('【Step 1】下载全国（含省级子区域） 100000_full.json');
  try {
    const data = await fetchJson(`${BASE_URL}/100000_full.json`);
    const json = JSON.stringify(data);
    await writeJson(join(PUBLIC_MAP, '100000_full.json'), data);
    stats.downloaded++;
    stats.totalBytes += json.length;
    console.log(`  ✓ 35 个省级要素 (含中心点) | ${fmtSize(json.length)}`);
  } catch (e) {
    stats.failed++;
    console.error(`  ✗ ${e.message}`);
  }

  // ================== Step 2: 9 瑶族省份（含市级子区域） ==================
  console.log('');
  console.log('【Step 2】下载 9 个瑶族省份（含市级子区域）');
  await mkdir(join(PUBLIC_MAP, 'province'), { recursive: true });

  const provinceMap = new Map(); // adcode -> name
  for (const adcode of YAO_PROVINCE_ADCODES) {
    try {
      const data = await fetchJson(`${BASE_URL}/${adcode}_full.json`);
      const json = JSON.stringify(data);
      await writeJson(
        join(PUBLIC_MAP, 'province', `${adcode}_full.json`),
        data
      );
      const name = data.features?.[0]?.properties?.name ?? '?';
      const cityCount = data.features?.length ?? 0;
      provinceMap.set(adcode, name);
      stats.downloaded++;
      stats.totalBytes += json.length;
      console.log(`  ✓ ${adcode} ${name} (含 ${cityCount} 个市级子区域) | ${fmtSize(json.length)}`);
    } catch (e) {
      stats.failed++;
      console.error(`  ✗ ${adcode}: ${e.message}`);
    }
  }

  // ================== Step 3: 收集所有市级 adcode ==================
  console.log('');
  console.log('【Step 3】收集所有市级 adcode');

  const allCities = []; // { adcode, name, provinceAdcode, provinceName }
  for (const [provinceAdcode, provinceName] of provinceMap) {
    try {
      const data = await fetchJson(`${BASE_URL}/${provinceAdcode}_full.json`);
      for (const f of data.features ?? []) {
        if (f.properties?.level === 'city') {
          allCities.push({
            adcode: f.properties.adcode,
            name: f.properties.name,
            provinceAdcode,
            provinceName,
          });
        }
      }
    } catch {}
  }
  console.log(`  共 ${allCities.length} 个市级`);

  // ================== Step 4: 下载所有市级（无子区） ==================
  console.log('');
  console.log('【Step 4】下载所有市级（无子区，约 100 个）');
  await mkdir(join(PUBLIC_MAP, 'city'), { recursive: true });

  const cityAggregate = { type: 'FeatureCollection', features: [] };

  let cityOk = 0;
  for (const city of allCities) {
    try {
      const data = await fetchJson(`${BASE_URL}/${city.adcode}.json`);
      const json = JSON.stringify(data);
      await writeJson(join(PUBLIC_MAP, 'city', `${city.adcode}.json`), data);
      cityAggregate.features.push(...(data.features ?? []));
      stats.downloaded++;
      stats.totalBytes += json.length;
      cityOk++;
    } catch (e) {
      stats.failed++;
      console.error(`  ✗ ${city.adcode} ${city.name}: ${e.message}`);
    }
  }
  console.log(`  ✓ ${cityOk}/${allCities.length} 个市级下载完成`);

  // 聚合全国市级（备用）
  await writeJson(join(PUBLIC_MAP, 'china_cities.json'), cityAggregate);
  console.log(`  ✓ 聚合 china_cities.json (${fmtSize(JSON.stringify(cityAggregate).length)})`);

  // ================== Step 5: 下载 9 省所有县级 ==================
  console.log('');
  console.log('【Step 5】下载 9 瑶族省份所有县级');

  // 从省级 _full.json 获取县级
  //   - 普通省：市级 features → 市级.districts 数组（即下辖县区）
  //   - 海南省特殊处理：469xxx 直辖县级 features 自身即为终级节点（没有 districts）
  const allCounties = []; // { adcode, name, cityAdcode, cityName, provinceAdcode, provinceName }
  for (const [provinceAdcode, provinceName] of provinceMap) {
    try {
      const data = await fetchJson(`${BASE_URL}/${provinceAdcode}_full.json`);
      for (const cf of data.features ?? []) {
        const cfLevel = cf.properties?.level;
        const cfAdcode = cf.properties?.adcode;
        // 普通省：city 级 features 包含 districts 数组（即下辖县区）
        if (cfLevel === 'city' && Array.isArray(cf.properties?.districts)) {
          for (const district of cf.properties.districts) {
            allCounties.push({
              adcode: district.adcode,
              name: district.name,
              cityAdcode: cfAdcode,
              cityName: cf.properties.name,
              provinceAdcode,
              provinceName,
            });
          }
        }
        // ✅ 修复：海南省特殊处理（460000_full.json 中 city 级 features 的 adcode 以 469 开头的即为直辖县级）
        // 这些 features 没有 districts，本身就是终级县区，必须直接收集
        else if (cfLevel === 'city' && cfAdcode && String(cfAdcode).startsWith('469')) {
          allCounties.push({
            adcode: cfAdcode,
            name: cf.properties.name,
            cityAdcode: cfAdcode, // 直辖县：市级 adcode 与县级相同
            cityName: cf.properties.name + '（直辖）',
            provinceAdcode,
            provinceName,
          });
        }
      }
    } catch {}
  }
  console.log(`  共 ${allCounties.length} 个县级（9 瑶族省份，含海南直辖县）`);

  await mkdir(join(PUBLIC_MAP, 'county'), { recursive: true });
  const countyAggregate = { type: 'FeatureCollection', features: [] };
  let countyOk = 0;
  let countyFailed = 0;
  const failedCounties = [];
  for (const c of allCounties) {
    try {
      const data = await fetchJson(`${BASE_URL}/${c.adcode}.json`);
      const json = JSON.stringify(data);
      await writeJson(join(PUBLIC_MAP, 'county', `${c.adcode}.json`), data);
      // 给 feature 加父级信息以便聚合检索
      for (const f of data.features ?? []) {
        f.properties = {
          ...(f.properties ?? {}),
          provinceAdcode: c.provinceAdcode,
          provinceName: c.provinceName,
          cityAdcode: c.cityAdcode,
          cityName: c.cityName,
        };
      }
      countyAggregate.features.push(...(data.features ?? []));
      stats.downloaded++;
      stats.totalBytes += json.length;
      countyOk++;
    } catch (e) {
      countyFailed++;
      failedCounties.push(c);
      stats.failed++;
    }
  }
  console.log(`  ✓ ${countyOk}/${allCounties.length} 个县级下载完成 (失败 ${countyFailed})`);

  // 聚合县级（与 yaoCounties 对照用）
  await writeJson(join(PUBLIC_MAP, 'yao_counties_real.json'), countyAggregate);
  console.log(`  ✓ 聚合 yao_counties_real.json (${fmtSize(JSON.stringify(countyAggregate).length)})`);

  if (failedCounties.length > 0) {
    console.log('');
    console.log(`  ⚠ 失败的县级 (${failedCounties.length}):`);
    for (const c of failedCounties.slice(0, 10)) {
      console.log(`    ${c.adcode} ${c.name}`);
    }
    if (failedCounties.length > 10) console.log(`    ... 还有 ${failedCounties.length - 10} 个`);
  }

  // ================== 汇总 ==================
  console.log('');
  console.log('=== 汇总 ===');
  console.log(`成功下载: ${stats.downloaded} 个文件`);
  console.log(`失败: ${stats.failed}`);
  console.log(`总字节数: ${fmtSize(stats.totalBytes)} (${(stats.totalBytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log('');
  console.log('输出目录结构:');
  console.log('  public/map/');
  console.log('    100000.json           (国家级，已有)');
  console.log('    100000_full.json      (国家级含省级子区，新增)');
  console.log('    province/             (9 瑶族省，含市级子区)');
  console.log('      {adcode}_full.json');
  console.log('    city/                 (~109 个市级)');
  console.log('      {adcode}.json');
  console.log('    china_cities.json     (聚合全国市级，备用)');
  console.log('    county/               (~700+ 个县级)');
  console.log('      {adcode}.json');
  console.log('    yao_counties_real.json (聚合 9 省县级，与 yaoCounties 对照)');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});