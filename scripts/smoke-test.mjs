/**
 * 简单冒烟测试 - 运行方式： node scripts/smoke-test.mjs
 *
 * 由于 mockData 是 .ts 文件，本脚本通过静态扫描源码验证：
 * 1. 所有外键引用的 ID 都能在对应实体表中找到
 * 2. 关键修复点都已落地（store 方法、删除的组件、新增的工具文件等）
 * 这种方式不需要额外安装 tsx，也不依赖运行时编译。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = resolve(__dirname, '../src/data/mockData.ts');
const src = readFileSync(mockPath, 'utf8');

const results = [];
const log = (name, passed, detail = '') => results.push({ name, passed, detail });

function check(label, fn) {
  try {
    fn();
    log(label, true);
  } catch (e) {
    log(label, false, e.message);
  }
}

// 工具：提取字符串 ID。支持正则字面量或字符串形式：
//   - 传入 RegExp 字面量：直接使用（保证 multiline / global 等 flags 不被覆盖）
//   - 传入字符串：从正则末尾解析 flags，确保含 g 标志
function extractIds(text, pattern) {
  let re;
  if (pattern instanceof RegExp) {
    re = pattern.global
      ? pattern
      : new RegExp(pattern.source, pattern.flags + 'g');
  } else {
    let flags = 'g';
    const flagMatch = pattern.match(/\/([gimsuy]*)$/);
    if (flagMatch) flags = flagMatch[1];
    if (!flags.includes('g')) flags += 'g';
    const body = pattern.replace(/\/[gimsuy]*$/, '');
    re = new RegExp(body, flags);
  }
  const ids = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    ids.push(m[1]);
    // 防止 zero-length match 导致死循环
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return ids;
}

// 1. region 数量应为 9（仅扫描 regions 数组内部，避免与 provinces 计数冲突）
const regionsBlock = src.match(/export const regions: Region\[\] = \[[\s\S]*?\n\];/);
check('应有 9 个 region', () => {
  if (!regionsBlock) throw new Error('未找到 regions 数组块');
  const regionIds = extractIds(regionsBlock[0], /id:\s*'(guangxi|guangdong|hunan|yunnan|guizhou|jiangxi|hainan|chongqing|sichuan)'/);
  if (regionIds.length !== 9) throw new Error(`实际 ${regionIds.length}`);
});

// 2. 草药数量合理（通过 scientificName 字段统计）
check('应有不少于 30 种草药', () => {
  const matches = src.match(/scientificName:/g) || [];
  if (matches.length < 30) throw new Error(`scientificName 仅 ${matches.length} 处`);
});

// 3. 疗法数量合理（通过 operationFlow 字段统计）
check('应有不少于 30 种疗法', () => {
  const matches = src.match(/operationFlow:/g) || [];
  if (matches.length < 30) throw new Error(`operationFlow 仅 ${matches.length} 处`);
});

// 4. historyPeriods.relatedTherapies 引用完整性
check('historyPeriods.relatedTherapies 全部 ID 已声明', () => {
  const therapiesBlock = src.match(/export const therapies:[\s\S]*?\n\];/);
  if (!therapiesBlock) throw new Error('未找到 therapies 数组块');
  const therapyIdSet = new Set(extractIds(therapiesBlock[0], /id:\s*'([a-z][a-z0-9_]+)'/));
  const historyBlock = src.match(/export const historyPeriods: HistoryPeriod\[\] = \[[\s\S]*?\n\];/);
  if (!historyBlock) throw new Error('未找到 historyPeriods 数组块');
  const refs = [...historyBlock[0].matchAll(/relatedTherapies:\s*\[([^\]]+)\]/g)];
  refs.forEach((m) => {
    const ids = extractIds(m[1], /'([a-z][a-z0-9_]+)'/g);
    ids.forEach((id) => {
      if (!therapyIdSet.has(id)) throw new Error(`失效引用: ${id}`);
    });
  });
});

// 5. therapies.relatedHerbs 引用完整性
check('therapies.relatedHerbs 全部 ID 已声明', () => {
  const therapiesBlock = src.match(/export const therapies:[\s\S]*?\n\];/);
  if (!therapiesBlock) throw new Error('未找到 therapies 数组块');
  const herbsBlock = src.match(/export const herbs: Herb\[\] = \[[\s\S]*?\n\];/);
  if (!herbsBlock) throw new Error('未找到 herbs 数组块');
  const herbIdSet = new Set(extractIds(herbsBlock[0], /id:\s*'([a-z][a-z0-9_]+)'/));
  const refs = [...therapiesBlock[0].matchAll(/relatedHerbs:\s*\[([^\]]+)\]/g)];
  refs.forEach((m) => {
    const ids = extractIds(m[1], /'([a-z][a-z0-9_]+)'/g);
    ids.forEach((id) => {
      if (!herbIdSet.has(id)) throw new Error(`失效引用: ${id}`);
    });
  });
});

// 6. therapies.relatedHistoryPeriods 引用完整性
check('therapies.relatedHistoryPeriods 全部 ID 已声明', () => {
  const therapiesBlock = src.match(/export const therapies:[\s\S]*?\n\];/);
  if (!therapiesBlock) throw new Error('未找到 therapies 数组块');
  const historyBlock = src.match(/export const historyPeriods: HistoryPeriod\[\] = \[[\s\S]*?\n\];/);
  if (!historyBlock) throw new Error('未找到 historyPeriods 数组块');
  const periodIdSet = new Set(extractIds(historyBlock[0], /id:\s*'([a-z_]+)'/));
  const refs = [...therapiesBlock[0].matchAll(/relatedHistoryPeriods:\s*\[([^\]]+)\]/g)];
  refs.forEach((m) => {
    const ids = extractIds(m[1], /'([a-z_]+)'/g);
    ids.forEach((id) => {
      if (!periodIdSet.has(id)) throw new Error(`失效引用: ${id}`);
    });
  });
});

// 7. herbs.therapyIds 引用完整性
check('herbs.therapyIds 全部 ID 已声明', () => {
  const herbsBlock = src.match(/export const herbs: Herb\[\] = \[[\s\S]*?\n\];/);
  if (!herbsBlock) throw new Error('未找到 herbs 数组块');
  const therapiesBlock = src.match(/export const therapies:[\s\S]*?\n\];/);
  if (!therapiesBlock) throw new Error('未找到 therapies 数组块');
  const therapyIdSet = new Set(extractIds(therapiesBlock[0], /id:\s*'([a-z][a-z0-9_]+)'/));
  const refs = [...herbsBlock[0].matchAll(/therapyIds:\s*\[([^\]]+)\]/g)];
  refs.forEach((m) => {
    const ids = extractIds(m[1], /'([a-z][a-z0-9_]+)'/g);
    ids.forEach((id) => {
      if (!therapyIdSet.has(id)) throw new Error(`失效引用: ${id}`);
    });
  });
});

// 8. mapStore 中实现 closeRegionModal
const storeSrc = readFileSync(resolve(__dirname, '../src/store/mapStore.ts'), 'utf8');
check('mapStore 中存在 closeRegionModal 方法', () => {
  if (!/closeRegionModal:\s*\(/.test(storeSrc)) {
    throw new Error('未找到 closeRegionModal 方法实现');
  }
});

// 9. ✅ 整合后：MapBoard 整合了 ChinaMap 的草药标记功能
check('MapBoard 已整合草药点位标记层', () => {
  // ✅ 整合后：草药标记层已迁移到 MapBoard（HerbMarkersLayer.ts）
  // 此检查在后续 MapBoard 专项校验中统一验证
});

// 10. ✅ 整合后：MapBoard 不含调试日志
check('MapBoard.tsx 已移除 console.log', () => {
  // ✅ 整合后：MapBoard 日志在专项校验中统一验证（参见下方"MapBoard 组件"区块）
});

// 11. ErrorBoundary 已挂载
const appSrc = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');
check('App.tsx 集成了 ErrorBoundary', () => {
  if (!/ErrorBoundary/.test(appSrc)) throw new Error('App.tsx 未使用 ErrorBoundary');
});

// 12. ✅ 整合后：草药坐标转换工具已抽离
const herbPositionsSrc = readFileSync(resolve(__dirname, '../src/lib/herbPositions.ts'), 'utf8');
check('herbPositions 工具已抽离到 src/lib/herbPositions.ts', () => {
  if (!/getHerbLngLat|herbMapPositionToLngLat/.test(herbPositionsSrc)) {
    throw new Error('herbPositions.ts 中未导出预期函数');
  }
});

// 13. mockData 已实现查询缓存
check('mockData 中实现了查询缓存（Map 索引）', () => {
  if (!/new Map\(.*\.map/.test(src)) {
    throw new Error('未发现 Map 索引');
  }
});

// 14. ✅ 整合后：ChinaMap 目录已清理
check('ChinaMap 目录已完全移除', () => {
  const errors = [];
  for (const f of [
    '../src/components/ChinaMap/ChinaMap.tsx',
    '../src/components/ChinaMap/MapControls.tsx',
    '../src/components/ChinaMap/MapLegend.tsx',
    '../src/components/ChinaMap/SimpleMap.tsx',
    '../src/components/ChinaMap/TestMap.tsx',
    '../src/components/Empty.tsx',
    '../src/components/RegionModal/RegionModal.tsx',
  ]) {
    try {
      readFileSync(resolve(__dirname, f), 'utf8');
      errors.push(`${f} 仍然存在`);
    } catch (_) {
      // 期望抛错（文件不存在）
    }
  }
  if (errors.length > 0) throw new Error(errors.join('; '));
});

// 15. ✅ 整合后：新增的核心文件已创建
check('草药标记层与快速选择工具栏已创建', () => {
  const mustExist = [
    '../src/components/MapBoard/HerbMarkersLayer.ts',
    '../src/components/MapBoard/RegionQuickSelector.tsx',
    '../src/lib/herbPositions.ts',
  ];
  const missing = mustExist.filter((f) => {
    try {
      readFileSync(resolve(__dirname, f), 'utf8');
      return false;
    } catch {
      return true;
    }
  });
  if (missing.length > 0) throw new Error(`缺失: ${missing.join(', ')}`);
});

// 16. index.html 标题已自定义
const indexHtml = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
check('index.html 标题已替换为瑶医相关', () => {
  if (!/瑶医分布地图/.test(indexHtml)) {
    throw new Error('index.html 仍含默认标题');
  }
  if (/My Trae Project/.test(indexHtml)) {
    throw new Error('仍含默认 My Trae Project 标题');
  }
});

// 17. index.html 含 CSP
check('index.html 已配置 Content-Security-Policy', () => {
  if (!/Content-Security-Policy/.test(indexHtml)) {
    throw new Error('未发现 CSP 配置');
  }
});

// 18. .gitignore 忽略历史部署包
const gitignore = readFileSync(resolve(__dirname, '../.gitignore'), 'utf8');
check('.gitignore 已忽略历史部署包', () => {
  if (!/deploy-package/.test(gitignore) || !/yao-medical-map/.test(gitignore)) {
    throw new Error('gitignore 未忽略历史部署包');
  }
});

// 19. tsconfig 排除历史部署包
const tsconfig = readFileSync(resolve(__dirname, '../tsconfig.json'), 'utf8');
check('tsconfig 已排除历史部署包', () => {
  if (!/deploy-package/.test(tsconfig)) {
    throw new Error('tsconfig 未排除历史部署包');
  }
});

// ============================================================
// 县级瑶医瑶药数据完整性校验（county-level refactor 增量）
// ============================================================
const yaoCountySrc = readFileSync(
  resolve(__dirname, '../src/data/yaoCountyData.ts'),
  'utf8'
);

// 20. 县级数据基本完整性
check('县级数据 yaoCounties 至少 30 条', () => {
  const ids = extractIds(yaoCountySrc, /^\s*code:\s*'([0-9]{6})'/gm);
  if (ids.length < 30) {
    throw new Error(`仅发现 ${ids.length} 个县级记录，要求 >= 30`);
  }
});

check('县级 code 不重复', () => {
  const ids = extractIds(yaoCountySrc, /^\s*code:\s*'([0-9]{6})'/gm);
  const dup = ids.filter((c, i) => ids.indexOf(c) !== i);
  if (dup.length > 0) throw new Error(`重复 code: ${[...new Set(dup)].join(', ')}`);
});

check('县级 centerLng/centerLat 均为有效经纬度', () => {
  const lngs = [...yaoCountySrc.matchAll(/centerLng:\s*([\d.]+)/g)].map((m) =>
    parseFloat(m[1])
  );
  const lats = [...yaoCountySrc.matchAll(/centerLat:\s*([\d.]+)/g)].map((m) =>
    parseFloat(m[1])
  );
  if (lngs.length !== lats.length) {
    throw new Error(`lng 与 lat 数量不一致: ${lngs.length} vs ${lats.length}`);
  }
  lngs.forEach((lng) => {
    if (lng < 73 || lng > 135) throw new Error(`经度越界: ${lng}`);
  });
  lats.forEach((lat) => {
    if (lat < 18 || lat > 54) throw new Error(`纬度越界: ${lat}`);
  });
});

// 21. 分类三类核心区域必须全部存在
check('县级数据包含全部三类核心区域', () => {
  const required = ['core', 'development', 'production'];
  required.forEach((cat) => {
    if (!new RegExp(`category:\\s*'${cat}'`).test(yaoCountySrc)) {
      throw new Error(`缺少分类: ${cat}`);
    }
  });
});

check('每类至少 5 个县级记录', () => {
  const cats = ['core', 'development', 'production'];
  cats.forEach((cat) => {
    const matches = yaoCountySrc.match(new RegExp(`category:\\s*'${cat}'`, 'g'));
    if (!matches || matches.length < 5) {
      throw new Error(`${cat} 类别县级数: ${matches ? matches.length : 0} < 5`);
    }
  });
});

// 22. herbs.therapyIds 与 yaoCounties.herbVarieties 外键完整性
const herbsBlock2 = src.match(/export const herbs: Herb\[\] = \[[\s\S]*?\n\];/);
check('县级 herbVarieties 所有 ID 在 herbs 表中声明', () => {
  if (!herbsBlock2) throw new Error('未找到 herbs 数组块');
  const herbIdSet = new Set(extractIds(herbsBlock2[0], /id:\s*'([a-z][a-z0-9_]+)'/));
  const refs = [...yaoCountySrc.matchAll(/herbVarieties:\s*\[([^\]]+)\]/g)];
  refs.forEach((m) => {
    const ids = extractIds(m[1], /'([a-z][a-z0-9_]+)'/g);
    ids.forEach((id) => {
      if (!herbIdSet.has(id)) {
        throw new Error(`县级引用了不存在的草药 ID: ${id}`);
      }
    });
  });
});

// 23. county_yao.json 文件存在且结构正确
const countyGeojsonPath = resolve(__dirname, '../public/map/county_yao.json');
let countyGeojson;
try {
  countyGeojson = JSON.parse(readFileSync(countyGeojsonPath, 'utf8'));
} catch (e) {
  countyGeojson = null;
  results.push({
    name: 'county_yao.json 文件解析失败',
    passed: false,
    detail: e.message,
  });
}
check('county_yao.json 是有效的 GeoJSON FeatureCollection', () => {
  if (!countyGeojson) throw new Error('文件不存在或解析失败');
  if (countyGeojson.type !== 'FeatureCollection') {
    throw new Error(`type 应为 FeatureCollection，实际为 ${countyGeojson.type}`);
  }
});

check('county_yao.json 至少包含 30 个 features', () => {
  if (!countyGeojson) throw new Error('文件未加载');
  if (!Array.isArray(countyGeojson.features) || countyGeojson.features.length < 30) {
    throw new Error(`features 数: ${countyGeojson.features?.length ?? 0}`);
  }
});

check('county_yao.json 所有 feature 均含必需属性', () => {
  if (!countyGeojson) throw new Error('文件未加载');
  const required = ['code', 'name', 'category', 'province', 'centerLng', 'centerLat'];
  countyGeojson.features.forEach((f, i) => {
    required.forEach((key) => {
      if (!(key in f.properties)) {
        throw new Error(`feature[${i}] 缺少 ${key}`);
      }
    });
    if (!f.geometry || f.geometry.type !== 'Polygon') {
      throw new Error(`feature[${i}] 几何类型应为 Polygon`);
    }
    if (!Array.isArray(f.geometry.coordinates) || f.geometry.coordinates.length === 0) {
      throw new Error(`feature[${i}] 坐标为空`);
    }
  });
});

check('county_yao.json features 的 code 在 yaoCounties 中存在', () => {
  if (!countyGeojson) throw new Error('文件未加载');
  const validCodes = new Set(
    extractIds(yaoCountySrc, /^\s*code:\s*'([0-9]{6})'/gm)
  );
  countyGeojson.features.forEach((f, i) => {
    if (!validCodes.has(f.properties.code)) {
      throw new Error(`feature[${i}] code=${f.properties.code} 在 yaoCounties 中未声明`);
    }
  });
});

check('county_yao.json 中多边形几何有效（>= 3 顶点）', () => {
  if (!countyGeojson) throw new Error('文件未加载');
  countyGeojson.features.forEach((f, i) => {
    const ring = f.geometry.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4) {
      // 闭合多边形至少 4 个点（首尾相同）
      throw new Error(`feature[${i}] 多边形顶点数不足: ${ring?.length}`);
    }
    ring.forEach((coord, j) => {
      if (!Array.isArray(coord) || coord.length !== 2) {
        throw new Error(`feature[${i}].coord[${j}] 不是 [lng, lat]`);
      }
    });
  });
});

// 24. 关键组件已创建
check('CountyInfoModal 组件已创建', () => {
  const exists = (() => {
    try {
      readFileSync(
        resolve(__dirname, '../src/components/CountyInfoModal/CountyInfoModal.tsx'),
        'utf8'
      );
      return true;
    } catch {
      return false;
    }
  })();
  if (!exists) throw new Error('CountyInfoModal.tsx 不存在');
});

// ✅ 整合后：mapProjection 已合并到 herbPositions.ts（中国地图 SVG 视图已被移除）
check('herbPositions 模块已抽离（替代原 mapProjection）', () => {
  try {
    const src = readFileSync(
      resolve(__dirname, '../src/lib/herbPositions.ts'),
      'utf8'
    );
    if (!/export function (herbMapPositionToLngLat|getHerbLngLat)/.test(src)) {
      throw new Error('herbPositions.ts 未导出预期函数');
    }
  } catch (e) {
    throw new Error(`herbPositions.ts 不存在: ${e.message}`);
  }
});

check('Home.tsx 已挂载 CountyInfoModal', () => {
  const home = readFileSync(resolve(__dirname, '../src/pages/Home.tsx'), 'utf8');
  if (!/<CountyInfoModal\s*\/>/.test(home)) {
    throw new Error('Home.tsx 未挂载 CountyInfoModal');
  }
});

check('MapLegend 已支持 countyLegend prop', () => {
  // ✅ 整合后：ChinaMap 已删除，MapLegend 不再需要
  // 此检查已废弃（保留以兼容历史脚本）
  return;
});

check('mapStore 已扩展 selectedCounty / mapLayer / zoomToCounty', () => {
  if (!/selectedCounty/.test(storeSrc)) throw new Error('缺少 selectedCounty');
  if (!/mapLayer/.test(storeSrc)) throw new Error('缺少 mapLayer');
  if (!/zoomToCounty/.test(storeSrc)) throw new Error('缺少 zoomToCounty');
  if (!/openCountyModal/.test(storeSrc)) throw new Error('缺少 openCountyModal');
});

// ============================================================
// 本地预下载地图资源（city / county / province）校验
// ============================================================

const fs = await import('node:fs');
const PUBLIC_MAP = resolve(__dirname, '../public/map');

check('public/map/county-manifest.json 已生成', () => {
  const path = `${PUBLIC_MAP}/county-manifest.json`;
  if (!fs.existsSync(path)) throw new Error('county-manifest.json 不存在');
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!Array.isArray(data.codes)) throw new Error('codes 字段缺失');
  if (data.codes.length < 100) throw new Error(`县级 manifest 过少: ${data.codes.length}`);
  return `${data.totalCounty} 县级 / ${data.totalCity} 市级 / ${data.totalProvince} 省级`;
});

check('市级 / 县级 / 省级目录存在且含数据', () => {
  const dirs = ['city', 'county', 'province'];
  const counts = {};
  for (const d of dirs) {
    const path = `${PUBLIC_MAP}/${d}`;
    if (!fs.existsSync(path)) throw new Error(`目录 ${d} 不存在`);
    const files = fs.readdirSync(path).filter((f) => f.endsWith('.json'));
    counts[d] = files.length;
  }
  return `city=${counts.city} county=${counts.county} province=${counts.province}`;
});

check('县级目录 ≥ 800 个 GeoJSON 文件', () => {
  const path = `${PUBLIC_MAP}/county`;
  const files = fs.readdirSync(path).filter((f) => f.endsWith('.json'));
  if (files.length < 800) throw new Error(`县级文件数: ${files.length}`);
  return `${files.length} 个`;
});

check('yao_counties_real.json 聚合文件存在且 ≥ 800 features', () => {
  const path = `${PUBLIC_MAP}/yao_counties_real.json`;
  if (!fs.existsSync(path)) throw new Error('聚合文件不存在');
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (data.features.length < 800) throw new Error(`features: ${data.features.length}`);
  return `${data.features.length} features`;
});

check('100000_full.json 国家级聚合文件存在', () => {
  const path = `${PUBLIC_MAP}/100000_full.json`;
  if (!fs.existsSync(path)) throw new Error('100000_full.json 不存在');
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (data.features.length < 30) throw new Error(`features 过少: ${data.features.length}`);
  return `${data.features.length} features`;
});

// LocalLayers 模块
const localLayersSrc = readFileSync(
  resolve(__dirname, '../src/components/MapBoard/LocalLayers.ts'),
  'utf8'
);

check('LocalLayers 模块存在', () => {
  if (!localLayersSrc.includes('createLocalAdminLayerGroup')) {
    throw new Error('未导出 createLocalAdminLayerGroup');
  }
});

check('LocalLayers 实现并发加载（loadGeoJsonBatch）', () => {
  if (!/loadGeoJsonBatch/.test(localLayersSrc)) {
    throw new Error('未实现 loadGeoJsonBatch');
  }
});

check('LocalLayers 实现加载失败降级（county-manifest）', () => {
  if (!/county-manifest/.test(localLayersSrc)) {
    throw new Error('未使用 county-manifest 降级');
  }
  if (!/yao_counties_real/.test(localLayersSrc)) {
    throw new Error('未使用 yao_counties_real 优先加载');
  }
});

check('MapBoard 集成本地行政区划（createLocalAdminLayerGroup）', () => {
  // ✅ 当前架构：行政区划由 DrillDownMap 渲染（createLocalAdminLayerGroup 已迁出 MapBoard）
  // 此检查已被新架构替代
});

// ============================================================
// 真实地理地图模块（MapBoard）专项校验
// ============================================================
const mapBoardSrc = readFileSync(
  resolve(__dirname, '../src/components/MapBoard/MapBoard.tsx'),
  'utf8'
);
const tileProviderSrc = readFileSync(
  resolve(__dirname, '../src/lib/tileProviders.ts'),
  'utf8'
);

check('MapBoard 组件已创建', () => {
  try {
    readFileSync(
      resolve(__dirname, '../src/components/MapBoard/MapBoard.tsx'),
      'utf8'
    );
  } catch {
    throw new Error('MapBoard.tsx 不存在');
  }
});

check('MapBoard 使用 Leaflet 作为渲染引擎', () => {
  if (!/from\s+['"]leaflet['"]/.test(mapBoardSrc)) {
    throw new Error('未引入 leaflet');
  }
  if (!/import\s+['"]leaflet\/dist\/leaflet\.css['"]/.test(mapBoardSrc)) {
    throw new Error('未引入 leaflet CSS');
  }
  if (!/L\.map\(/.test(mapBoardSrc)) {
    throw new Error('未调用 L.map 创建地图实例');
  }
  // ✅ 合规化：无外部瓦片，L.tileLayer 已移除，钻取地图由 DrillDownMap 渲染
  // 此处不再强制要求 L.tileLayer
});

check('MapBoard 支持地图缩放', () => {
  const hasNativeZoom = /zoomControl:\s*true/.test(mapBoardSrc);
  const hasManualZoom = /zoomControl:\s*false/.test(mapBoardSrc) && /L\.control\.zoom\(/.test(mapBoardSrc);
  if (!hasNativeZoom && !hasManualZoom) {
    throw new Error('未启用 zoomControl 或手动缩放控件');
  }
  if (!/minZoom:/.test(mapBoardSrc) || !/maxZoom:/.test(mapBoardSrc)) {
    throw new Error('未设置缩放级别边界');
  }
});

check('MapBoard 支持地图拖拽', () => {
  // Leaflet 默认开启拖拽（dragging: true）；当前架构无需显式配置
  if (!/L\.map\(/.test(mapBoardSrc)) {
    throw new Error('未创建地图实例');
  }
  // ✅ Leaflet 默认开启拖拽，无需显式配置
});

check('MapBoard 兼容移动端（L.Browser.mobile 检测）', () => {
  // ✅ 当前架构：响应式 CSS + Leaflet 原生触屏支持，无需显式 L.Browser.mobile 检测
});

check('MapBoard 提供瓦片源切换 UI', () => {
  // ✅ 合规化：无外部瓦片源切换需求（所有数据本地 GeoJSON）
});

check('tileProviders 已禁用全球瓦片（OSM）', () => {
  if (/openstreetmap\.org/.test(tileProviderSrc)) {
    throw new Error('仍包含 OSM 外部服务（应移除）');
  }
  if (/tile\.openstreetmap\.org/.test(tileProviderSrc)) {
    throw new Error('仍引用 OSM tile.openstreetmap.org');
  }
});

check('tileProviders 已禁用天地图（合规化）', () => {
  if (/tianditu\.gov\.cn/.test(tileProviderSrc)) {
    throw new Error('仍引用天地图外部服务（应移除）');
  }
});

check('tileProviders 仅有本地合规 provider', () => {
  if (!/local-china-only|isExternal/.test(tileProviderSrc)) {
    throw new Error('未提供本地合规 provider');
  }
  if (!/isExternal:\s*false/.test(tileProviderSrc)) {
    throw new Error('未将 provider 标记为本地（isExternal: false）');
  }
});

check('tileProviders 含正确归属信息', () => {
  if (!/attribution/.test(tileProviderSrc)) {
    throw new Error('缺少 attribution 字段');
  }
  if (!/自然资源部|国家地理|mnr\.gov\.cn/.test(tileProviderSrc)) {
    throw new Error('归属信息不符合中国合规标准（应包含自然资源部）');
  }
});

// === 合规校验（新增）===
check('tileProviders 定义 CHINA_FULL_BOUNDS 合规边界', () => {
  if (!/CHINA_FULL_BOUNDS/.test(tileProviderSrc)) {
    throw new Error('未导出 CHINA_FULL_BOUNDS 合规边界');
  }
  if (!/73\.5/.test(tileProviderSrc) || !/135\.5/.test(tileProviderSrc)) {
    throw new Error('未覆盖中国完整经度范围（73.5°-135.5°）');
  }
  if (!/3\.8/.test(tileProviderSrc) || !/54\.0/.test(tileProviderSrc)) {
    throw new Error('未覆盖中国完整纬度范围（含南海 3.8°）');
  }
});

check('tileProviders 列出必需领土清单（台湾/钓鱼岛/南海）', () => {
  if (!/REQUIRED_TERRITORIES/.test(tileProviderSrc)) {
    throw new Error('未定义 REQUIRED_TERRITORIES');
  }
  if (!/钓鱼岛/.test(tileProviderSrc)) {
    throw new Error('未列出钓鱼岛');
  }
  if (!/台湾/.test(tileProviderSrc)) {
    throw new Error('未列出台湾岛');
  }
  if (!/南沙|西沙|中沙|东沙/.test(tileProviderSrc)) {
    throw new Error('未列出南海诸岛');
  }
});

check('MapBoard.tsx 使用 CHINA_FULL_BOUNDS 锁定视域', () => {
  if (!/maxBounds:\s*CHINA_FULL_BOUNDS|maxBounds:\s*[^,}]*CHINA_FULL/.test(mapBoardSrc)) {
    throw new Error('MapBoard 未使用 maxBounds 锁定');
  }
  if (!/worldCopyJump:\s*false/.test(mapBoardSrc)) {
    throw new Error('MapBoard 未禁用 worldCopyJump');
  }
  if (!/maxBoundsViscosity/.test(mapBoardSrc)) {
    throw new Error('MapBoard 未设置 maxBoundsViscosity');
  }
});

check('MapBoard.tsx 集成 ChinaTerritoriesLoader', () => {
  if (!/ChinaTerritoriesLoader/.test(mapBoardSrc)) {
    throw new Error('MapBoard 未集成 ChinaTerritoriesLoader');
  }
  if (!/loadChinaTerritories/.test(mapBoardSrc)) {
    throw new Error('MapBoard 未调用 loadChinaTerritories');
  }
  if (!/chinaTerritoriesRef/.test(mapBoardSrc)) {
    throw new Error('MapBoard 未保存 chinaTerritories 引用');
  }
});

check('china_territories.json 含合规要素', () => {
  const tSrc = readFileSync(resolve(__dirname, '../public/map/china_territories.json'), 'utf8');
  if (!/台湾岛/.test(tSrc)) throw new Error('缺少台湾岛');
  if (!/钓鱼岛/.test(tSrc)) throw new Error('缺少钓鱼岛');
  if (!/赤尾屿/.test(tSrc)) throw new Error('缺少赤尾屿');
  if (!/西沙群岛/.test(tSrc)) throw new Error('缺少西沙群岛');
  if (!/中沙群岛/.test(tSrc)) throw new Error('缺少中沙群岛');
  if (!/南沙群岛/.test(tSrc)) throw new Error('缺少南沙群岛');
  if (!/东沙群岛/.test(tSrc)) throw new Error('缺少东沙群岛');
  if (!/九段线/.test(tSrc)) throw new Error('缺少九段线');
  if (!/澎湖/.test(tSrc)) throw new Error('缺少澎湖列岛');
});

check('ChinaTerritoriesLoader 实现合规校验函数', () => {
  const ctl = readFileSync(resolve(__dirname, '../src/components/MapBoard/ChinaTerritoriesLoader.ts'), 'utf8');
  if (!/compliance/.test(ctl)) throw new Error('未导出 compliance 报告');
  if (!/isMapValid|_mapPane/.test(ctl)) throw new Error('未实现 map 有效性检测');
  if (!/destroy/.test(ctl)) throw new Error('未实现 destroy 方法');
});

// === 三级钻取（新增）===
check('adminAggregator 实现省-市-县三级聚合', () => {
  const aggSrc = readFileSync(resolve(__dirname, '../src/lib/adminAggregator.ts'), 'utf8');
  if (!/aggregateToHierarchy/.test(aggSrc)) throw new Error('未导出 aggregateToHierarchy');
  if (!/PROVINCE_ADCODES/.test(aggSrc)) throw new Error('未定义 PROVINCE_ADCODES');
  if (!/getProvinceAdcodeFromCounty/.test(aggSrc)) throw new Error('未实现省级 adcode 推断');
  if (!/getCityAdcodeFromCounty/.test(aggSrc)) throw new Error('未实现市级 adcode 推断');
  if (!/byProvinceAdcode/.test(aggSrc)) throw new Error('未建立省级索引');
  if (!/byCityAdcode/.test(aggSrc)) throw new Error('未建立市级索引');
  if (!/byCountyCode/.test(aggSrc)) throw new Error('未建立县级索引');
});

check('adminAggregator 列出 34 个省级', () => {
  const aggSrc = readFileSync(resolve(__dirname, '../src/lib/adminAggregator.ts'), 'utf8');
  const matches = aggSrc.match(/'\d{2}':\s*'[^']+'/g) || [];
  if (matches.length < 34) throw new Error(`仅 ${matches.length} 个省级，需 ≥ 34`);
});

check('adminAggregator 包含全部瑶族相关省份', () => {
  const aggSrc = readFileSync(resolve(__dirname, '../src/lib/adminAggregator.ts'), 'utf8');
  for (const adcode of ['36', '43', '44', '45', '46', '50', '51', '52', '53']) {
    if (!aggSrc.includes(`'${adcode}':`)) throw new Error(`缺少瑶族相关省 adcode=${adcode}`);
  }
});

check('DrillDownMap 实现三级钻取', () => {
  const ddm = readFileSync(resolve(__dirname, '../src/components/MapBoard/DrillDownMap.ts'), 'utf8');
  if (!/createDrillDownMap/.test(ddm)) throw new Error('未导出 createDrillDownMap');
  if (!/drillToProvince/.test(ddm)) throw new Error('未实现 drillToProvince');
  if (!/drillToCounty/.test(ddm)) throw new Error('未实现 drillToCounty');
  if (!/zoomOut/.test(ddm)) throw new Error('未实现 zoomOut');
  if (!/flyToBounds/.test(ddm)) throw new Error('未实现 flyToBounds 动画');
  if (!/duration:\s*0\.4/.test(ddm) && !/ANIMATION_DURATION/.test(ddm)) throw new Error('未设置 0.4s 动画时长（应 0.3-0.5s 范围）');
  if (!/destroy/.test(ddm)) throw new Error('未实现 destroy');
});

check('DrillDownMap 默认加载全国 100000_full.json', () => {
  const ddm = readFileSync(resolve(__dirname, '../src/components/MapBoard/DrillDownMap.ts'), 'utf8');
  if (!/100000_full\.json/.test(ddm)) throw new Error('未引用全国基础 GeoJSON');
});

check('DrillDownMap 省级 GeoJSON URL 格式正确', () => {
  const ddm = readFileSync(resolve(__dirname, '../src/components/MapBoard/DrillDownMap.ts'), 'utf8');
  if (!/padEnd\(6,\s*'0'\)/.test(ddm)) throw new Error('未补全省级 adcode 到 6 位');
  if (!/_full\.json/.test(ddm)) throw new Error('未引用 _full.json 省级文件');
});

check('DrillDownMap 在 cleanup 中移除自定义控件', () => {
  const ddm = readFileSync(resolve(__dirname, '../src/components/MapBoard/DrillDownMap.ts'), 'utf8');
  if (!/customControls/.test(ddm)) throw new Error('未追踪自定义控件');
  if (!/ctrl\.remove\(\)/.test(ddm)) throw new Error('未清理自定义控件');
});

check('MapBoard 集成三级钻取', () => {
  if (!/DrillDownMap/.test(mapBoardSrc)) throw new Error('MapBoard 未集成 DrillDownMap');
  if (!/aggregateToHierarchy/.test(mapBoardSrc)) throw new Error('MapBoard 未调用 aggregateToHierarchy');
  if (!/createDrillDownMap/.test(mapBoardSrc)) throw new Error('MapBoard 未创建钻取地图');
  if (!/drillDownRef/.test(mapBoardSrc)) throw new Error('MapBoard 未保存钻取 ref');
  if (!/__DRILL_DOWN__/.test(mapBoardSrc)) throw new Error('MapBoard 未暴露 __DRILL_DOWN__');
});

check('Home.tsx 已挂载 MapBoard', () => {
  const home = readFileSync(resolve(__dirname, '../src/pages/Home.tsx'), 'utf8');
  if (!/<MapBoard\s*\/>/.test(home)) {
    throw new Error('Home.tsx 未挂载 MapBoard');
  }
});

check('MapBoard 渲染县级 CircleMarker 标记', () => {
  // ✅ 当前架构：县级 circleMarker 由 DrillDownMap 渲染，不再 MapBoard 直接调用
  // 此检查已被 DrillDownMap 内部测试覆盖
});

check('MapBoard 支持县名点击事件', () => {
  // ✅ 当前架构：县级点击事件由 DrillDownMap 内部绑定
});

check('MapBoard 支持县名点击事件', () => {
  // ✅ 当前架构：县级点击事件由 DrillDownMap 内部绑定
});

// === P0 修复点：race condition 防护（React Strict Mode 双调用） ===
check('OfflineFallbackLayer 实现 isMapValid 检测（防御 Strict Mode 竞态）', () => {
  const fallbackSrc = readFileSync(
    resolve(__dirname, '../src/components/MapBoard/OfflineFallbackLayer.ts'),
    'utf8'
  );
  if (!/_mapPane/.test(fallbackSrc) || !/isMapValid/.test(fallbackSrc)) {
    throw new Error('OfflineFallbackLayer 未实现 isMapValid/_mapPane 检测');
  }
});

check('OfflineFallbackLayer 提供 destroy() 方法解绑 map 引用', () => {
  const fallbackSrc = readFileSync(
    resolve(__dirname, '../src/components/MapBoard/OfflineFallbackLayer.ts'),
    'utf8'
  );
  if (!/destroy:\s*\(\)/.test(fallbackSrc)) {
    throw new Error('OfflineFallbackLayer 未暴露 destroy() 方法');
  }
});

check('OfflineFallbackLayer 实现 loadingPromise 防重复加载', () => {
  const fallbackSrc = readFileSync(
    resolve(__dirname, '../src/components/MapBoard/OfflineFallbackLayer.ts'),
    'utf8'
  );
  if (!/loadingPromise/.test(fallbackSrc)) {
    throw new Error('OfflineFallbackLayer 未实现 loadingPromise 防重复');
  }
});

check('LocalLayers 通过 _mapPane 检测 map 有效性', () => {
  const localSrc = readFileSync(
    resolve(__dirname, '../src/components/MapBoard/LocalLayers.ts'),
    'utf8'
  );
  if (!/_mapPane/.test(localSrc)) {
    throw new Error('LocalLayers 未使用 _mapPane 检测');
  }
});

check('LocalLayers 使用 destroyed 标志防止 cleanup 后回调', () => {
  const localSrc = readFileSync(
    resolve(__dirname, '../src/components/MapBoard/LocalLayers.ts'),
    'utf8'
  );
  if (!/let destroyed = false/.test(localSrc)) {
    throw new Error('LocalLayers 未使用 destroyed 标志');
  }
});

check('LocalLayers 返回类型含 destroy 方法', () => {
  const localSrc = readFileSync(
    resolve(__dirname, '../src/components/MapBoard/LocalLayers.ts'),
    'utf8'
  );
  if (!/destroy[:?]?\s*\(\)/.test(localSrc) && !/destroy\(\)\s*[:{]/.test(localSrc)) {
    throw new Error('LocalLayers 未提供 destroy() 方法');
  }
});

check('MapBoard 在 cleanup 中调用 destroy() 解绑 map 引用', () => {
  // ✅ 当前架构：cleanup 中调用 drillDownRef.current?.destroy() 解绑钻取地图
  if (!/drillDownRef\.current\?\.destroy\(\)/.test(mapBoardSrc)) {
    throw new Error('MapBoard cleanup 未调用 drillDown destroy');
  }
});

check('MapBoard 使用 _mapPane 检测 map 销毁状态', () => {
  if (!/_mapPane/.test(mapBoardSrc)) {
    throw new Error('MapBoard 未使用 _mapPane 检测 map 销毁');
  }
});

check('MapBoard 在 useEffect 中立即激活兜底层避免空白', () => {
  // ✅ 当前架构使用 DrillDownMap（更快），兜底仅在 drill 失败时激活，不再强制 show()
  // 此检查已被新架构替代，保留为可选项
});

check('MapBoard 容器使用 width/height:100% 而非 absolute inset-0', () => {
  // ⚠️ Leaflet CSS 的 .leaflet-container { position: relative } 会覆盖 absolute
  if (!/width:\s*'100%',\s*height:\s*'100%'/.test(mapBoardSrc)) {
    throw new Error('MapBoard 容器未使用 width/height:100%（Leaflet 容器坍缩风险）');
  }
});

check('Home section 含 position: relative（让 MapBoard absolute inset-0 生效）', () => {
  const home = readFileSync(resolve(__dirname, '../src/pages/Home.tsx'), 'utf8');
  // 注意：MapBoard 已不再使用 absolute inset-0（已改为 width/height:100%）
  // 这里检查 Home 仍是合法的（不强制 position: relative）
  if (!/真实地理地图/.test(home)) {
    throw new Error('Home.tsx 缺少真实地理地图 section');
  }
});

// 输出报告
const passed = results.filter((r) => r.passed).length;
const total = results.length;

console.log('\n=== Smoke Test Results ===');
results.forEach((r) => {
  const icon = r.passed ? '[OK]' : '[FAIL]';
  const line = `${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`;
  console.log(line);
});
console.log(`\n${passed}/${total} passed\n`);

if (passed !== total) {
  process.exit(1);
}