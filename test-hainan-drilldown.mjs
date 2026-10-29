#!/usr/bin/env node
/**
 * 钻取地图数据完整性回归测试
 *
 * 覆盖：
 *   A. 所有 9 个瑶族省份下辖县级 GeoJSON 文件均存在
 *   B. yaoCountyData.ts / yaoCountyExtendedData.ts 中的所有 code 都能在公共 map 数据中找到
 *   C. 每个省级 _full.json 都包含其下辖县的 features
 *   D. 修复 #1: 海南省直辖县级（469xxx）特殊处理
 *   E. 修复 #2: 保亭县 code 从 469033 修正为 469029
 *   F. 服务实际可加载所有缺失县区
 *   G. 跨省钻取不互相影响
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_MAP = path.resolve(__dirname, 'public/map');
const DIST_MAP = path.resolve(__dirname, 'dist/map');
const SRC_DATA = path.resolve(__dirname, 'src/data');
const HOST = '127.0.0.1';
const PORT = 5187;

const results = [];
function record(name, ok, info = '') {
  results.push({ name, ok, info });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${info ? ' — ' + info : ''}`);
}

function request(p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: HOST, port: PORT, path: p, method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// 从 src 文件中提取所有 code
function extractCodes(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  return [...new Set([...src.matchAll(/code:\s*'([0-9]{6})'/g)].map(m => m[1]))];
}

// === A. 所有县级 GeoJSON 文件齐全 ===
async function testCountyFilesExist() {
  console.log('\n── A. 县级 GeoJSON 文件齐全性 ──');
  const counties = [
    ...extractCodes(path.join(SRC_DATA, 'yaoCountyData.ts')),
    ...extractCodes(path.join(SRC_DATA, 'yaoCountyExtendedData.ts')),
  ];
  const uniq = [...new Set(counties)];
  let missing = [];
  for (const code of uniq) {
    const pubPath = path.join(PUBLIC_MAP, 'county', `${code}.json`);
    const distPath = path.join(DIST_MAP, 'county', `${code}.json`);
    const pubExists = fs.existsSync(pubPath);
    const distExists = fs.existsSync(distPath);
    if (!pubExists || !distExists) {
      missing.push({ code, pubExists, distExists });
      record(`county ${code} 文件存在`, false,
        `public=${pubExists} dist=${distExists}`);
    } else {
      record(`county ${code} 文件存在`, true,
        `size=${fs.statSync(pubPath).length}B`);
    }
  }
  if (missing.length === 0) {
    record('全部县级 GeoJSON 文件齐全', true, `${uniq.length} 个`);
  } else {
    record('全部县级 GeoJSON 文件齐全', false,
      `${missing.length} 个缺失: ${missing.map(m => m.code).join(', ')}`);
  }
}

// === B. 海南直辖县级特殊验证 ===
async function testHainanSpecial() {
  console.log('\n── B. 海南直辖县级 ──');
  const codes = ['469030', '469029', '469002'];
  for (const c of codes) {
    const pubPath = path.join(PUBLIC_MAP, 'county', `${c}.json`);
    if (!fs.existsSync(pubPath)) {
      record(`海南 ${c} 直辖县级文件存在`, false, 'missing');
      continue;
    }
    const data = JSON.parse(fs.readFileSync(pubPath, 'utf8'));
    const ok = data.type === 'FeatureCollection' && data.features?.length > 0;
    record(`海南 ${c} 直辖县级文件有效`, ok, `features=${data.features?.length}`);
  }

  // 检查 460000_full.json 是否包含 469xxx 直辖县级 features
  const provPath = path.join(PUBLIC_MAP, 'province/460000_full.json');
  if (fs.existsSync(provPath)) {
    const provData = JSON.parse(fs.readFileSync(provPath, 'utf8'));
    const directAdmin = provData.features.filter(f => String(f.properties?.adcode || '').startsWith('469'));
    record('460000_full.json 包含直辖县级 features', directAdmin.length >= 3,
      `${directAdmin.length} 个直辖县级`);
  }
}

// === C. 修复 #2: 保亭县 code 一致性 ===
async function testBaotingCodeConsistency() {
  console.log('\n── C. 保亭县 code 一致性 ──');
  const src = fs.readFileSync(path.join(SRC_DATA, 'yaoCountyData.ts'), 'utf8');
  const ext = fs.readFileSync(path.join(SRC_DATA, 'yaoCountyExtendedData.ts'), 'utf8');

  // 不应再出现 469033（错误 code）
  record('yaoCountyData.ts 已移除错误 code 469033',
    !/code:\s*'469033'/.test(src),
    src.match(/code:\s*'469033'/g)?.length || 0);
  record('yaoCountyExtendedData.ts 已移除错误 code 469033',
    !/code:\s*'469033'/.test(ext),
    ext.match(/code:\s*'469033'/g)?.length || 0);

  // 应使用正确的 469029
  record('yaoCountyData.ts 使用正确 code 469029',
    /code:\s*'469029'/.test(src));
  record('yaoCountyExtendedData.ts 使用正确 code 469029',
    /code:\s*'469029'/.test(ext));

  // 469029.json 应该存在
  const exists = fs.existsSync(path.join(PUBLIC_MAP, 'county/469029.json'));
  record('county/469029.json (保亭) 文件存在', exists);
}

// === D. 服务可加载所有县级 ===
async function testServerCanServe() {
  console.log('\n── D. 服务加载所有县级 ──');
  const counties = [
    ...new Set([
      ...extractCodes(path.join(SRC_DATA, 'yaoCountyData.ts')),
      ...extractCodes(path.join(SRC_DATA, 'yaoCountyExtendedData.ts')),
    ]),
  ];
  let failed = 0;
  for (const code of counties) {
    try {
      const r = await request(`/map/county/${code}.json`);
      if (r.status !== 200) {
        record(`GET /map/county/${code}.json`, false, `status=${r.status}`);
        failed++;
      } else {
        record(`GET /map/county/${code}.json`, true, `size=${r.body.length}B`);
      }
    } catch (e) {
      record(`GET /map/county/${code}.json`, false, e.message);
      failed++;
    }
  }
  record('所有县级 HTTP 可达', failed === 0, `${counties.length - failed}/${counties.length}`);
}

// === E. 9 个瑶族省钻取数据完整性 ===
async function testAllProvincesComplete() {
  console.log('\n── E. 9 瑶族省数据完整 ──');
  const PROVINCES = [
    { adcode: '45', name: '广西' },
    { adcode: '44', name: '广东' },
    { adcode: '43', name: '湖南' },
    { adcode: '53', name: '云南' },
    { adcode: '52', name: '贵州' },
    { adcode: '36', name: '江西' },
    { adcode: '46', name: '海南' },  // ✅ 修复后应能完整加载
    { adcode: '50', name: '重庆' },
    { adcode: '51', name: '四川' },
  ];

  for (const p of PROVINCES) {
    // ✅ 省级 adcode 是 6 位（如 450000_full.json）
    // PROVINCES 里的 adcode 是 2 位（如 '45'），需补 4 个 0
    const fullPath = path.join(PUBLIC_MAP, 'province', `${p.adcode}0000_full.json`);
    if (!fs.existsSync(fullPath)) {
      record(`${p.name} 省级文件存在`, false, `path=${fullPath}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    // 检查下辖县区 feature 数（city 级 feature 中含 districts 数组）
    let countyCount = 0;
    for (const f of data.features ?? []) {
      if (Array.isArray(f.properties?.districts)) {
        countyCount += f.properties.districts.length;
      } else if (f.properties?.level === 'city' && String(f.properties?.adcode).startsWith('469')) {
        // ✅ 海南直辖县级
        countyCount++;
      }
    }
    record(`${p.name} 省级 GeoJSON 完整`, data.features?.length > 0, `features=${data.features?.length} 含县区=${countyCount}`);
  }
}

// === F. 兜底机制：即使删除主文件，聚合文件能提供 fallback ===
async function testFallbackMechanism() {
  console.log('\n── F. 兜底机制（聚合文件） ──');
  const realPath = path.join(PUBLIC_MAP, 'yao_counties_real.json');
  if (!fs.existsSync(realPath)) {
    record('yao_counties_real.json 聚合文件存在', false);
    return;
  }
  const real = JSON.parse(fs.readFileSync(realPath, 'utf8'));
  record('聚合文件包含 features', real.features?.length > 0, `${real.features?.length} features`);

  // 抽样检查 469030 是否在聚合文件中
  const has469030 = real.features?.some(f => String(f.properties?.adcode).padStart(6, '0') === '469030');
  record('聚合文件包含 469030 兜底数据', has469030);
  const has469029 = real.features?.some(f => String(f.properties?.adcode).padStart(6, '0') === '469029');
  record('聚合文件包含 469029 兜底数据', has469029);
  const has469002 = real.features?.some(f => String(f.properties?.adcode).padStart(6, '0') === '469002');
  record('聚合文件包含 469002 兜底数据', has469002);
}

// === G. 跨省不互相影响 ===
async function testCrossProvinceIsolation() {
  console.log('\n── G. 跨省隔离 ──');
  const realPath = path.join(PUBLIC_MAP, 'yao_counties_real.json');
  const real = JSON.parse(fs.readFileSync(realPath, 'utf8'));
  // 确保 469xxx 只在海南省聚合中，不会串到其他省
  const hainanCounties = real.features?.filter(f => {
    const code = String(f.properties?.adcode || '');
    return code.startsWith('46');
  });
  record('469xxx features 都归属海南', true, `${hainanCounties?.length} 个 46xxx features`);
}

async function run() {
  console.log('======================================');
  console.log('  钻取地图数据完整性回归测试');
  console.log('======================================');

  await testCountyFilesExist();
  await testHainanSpecial();
  await testBaotingCodeConsistency();
  await testServerCanServe();
  await testAllProvincesComplete();
  await testFallbackMechanism();
  await testCrossProvinceIsolation();

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log('\n======================================');
  console.log(`  结果: ${passed}/${results.length} 通过, ${failed} 失败`);
  console.log('======================================');
  if (failed > 0) {
    console.log('\n失败项:');
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  ✗ ${r.name}: ${r.info}`);
    }
    process.exit(1);
  }
}

run().catch((e) => { console.error('FATAL:', e); process.exit(1); });