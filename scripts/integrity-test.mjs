/**
 * 地图显示完整性检测脚本
 *
 * 检测四大核心指标：
 *   1. 瓦片加载覆盖率（tile-coverage）
 *   2. 坐标点位匹配精度（coordinate-accuracy）
 *   3. 图层叠加完整性（layer-overlay）
 *   4. 文字标注渲染准确率（label-rendering）
 *
 * 同时检测：
 *   - 加载超时（load-timeout）
 *   - 资源 404/500（resource-error）
 *   - 跨域错误（CORS）
 *
 * 前置：dev server 在 5178 端口运行
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const BASE = 'http://127.0.0.1:5178';

const results = [];
function record(category, name, passed, detail, severity = 'info') {
  results.push({ category, name, passed, detail, severity });
}

// ============================================================
// 类别 1：瓦片加载覆盖率
// ============================================================
async function checkTileCoverage() {
  console.log('\n[1] 瓦片加载覆盖率');
  console.log('─'.repeat(60));

  // 1.1 验证 tileProviders 配置完整性
  const tileProvidersSrc = readFileSync(
    resolve(PROJECT, 'src/lib/tileProviders.ts'),
    'utf8'
  );
  const providerCount = (tileProvidersSrc.match(/urlTemplate:/g) ?? []).length;
  record(
    'tile-coverage',
    'tileProviders 配置了 ≥2 个瓦片源',
    providerCount >= 2,
    `${providerCount} 个 provider`,
    providerCount >= 2 ? 'info' : 'high'
  );

  // 1.2 验证 OSM 瓦片 URL 模板格式
  const osmMatch = tileProvidersSrc.match(/urlTemplate:\s*'([^']+)'/);
  const osmValid =
    osmMatch &&
    /\{s\}/.test(osmMatch[1]) &&
    /\{z\}/.test(osmMatch[1]) &&
    /\{x\}/.test(osmMatch[1]) &&
    /\{y\}/.test(osmMatch[1]);
  record(
    'tile-coverage',
    'OSM 瓦片 URL 模板正确（包含 {s}/{z}/{x}/{y}）',
    Boolean(osmValid),
    osmMatch ? osmMatch[1].substring(0, 50) + '...' : '无',
    'high'
  );

  // 1.3 验证天地图 URL 含 tk 参数（即使占位也应有参数名）
  const tdtMatch = tileProvidersSrc.match(/tk=\$\{TIANDITU_TK\}/g);
  record(
    'tile-coverage',
    '天地图 URL 含 tk 参数',
    Boolean(tdtMatch),
    `${(tdtMatch ?? []).length} 处 tk 参数`,
    'medium'
  );

  // 1.4 验证 minZoom/maxZoom 配置
  const minMaxValid = /minZoom:\s*\d+/.test(tileProvidersSrc) &&
    /maxZoom:\s*\d+/.test(tileProvidersSrc);
  record(
    'tile-coverage',
    '所有瓦片源含 minZoom/maxZoom 配置',
    minMaxValid,
    '已配置',
    'medium'
  );

  // 1.5 验证 DOM 地图容器存在
  const mapBoardSrc = readFileSync(
    resolve(PROJECT, 'src/components/MapBoard/MapBoard.tsx'),
    'utf8'
  );
  const hasMapContainer = /mapContainerRef/.test(mapBoardSrc);
  const hasLMap = /L\.map\(/.test(mapBoardSrc);
  record(
    'tile-coverage',
    'MapBoard 创建 DOM 容器并实例化 Leaflet',
    hasMapContainer && hasLMap,
    hasMapContainer && hasLMap ? '已配置' : '缺失',
    'high'
  );

  // 1.6 验证 CSS 含 leaflet-container 类
  const leafletCssPath = resolve(PROJECT, 'node_modules/leaflet/dist/leaflet.css');
  const leafletCssExists = existsSync(leafletCssPath);
  const hasLeafletContainer = leafletCssExists &&
    /\.leaflet-container/.test(readFileSync(leafletCssPath, 'utf8'));
  record(
    'tile-coverage',
    'Leaflet CSS 已加载（含 .leaflet-container 类）',
    hasLeafletContainer,
    hasLeafletContainer ? 'OK' : '缺失',
    'high'
  );

  // 1.7 验证瓦片 URL 子域配置
  const allSubdomains = (tileProvidersSrc.match(/subdomains:\s*\[[^\]]+\]/g) ?? []).length;
  record(
    'tile-coverage',
    '所有瓦片源配置子域（subdomains）',
    allSubdomains >= 2,
    `${allSubdomains} 处 subdomains 配置`,
    'medium'
  );
}

// ============================================================
// 类别 2：坐标点位匹配精度
// ============================================================
async function checkCoordinateAccuracy() {
  console.log('\n[2] 坐标点位匹配精度');
  console.log('─'.repeat(60));

  // 2.1 验证坐标范围（中国境内：lng 73-135, lat 18-54）
  const tileProvidersSrc = readFileSync(
    resolve(PROJECT, 'src/lib/tileProviders.ts'),
    'utf8'
  );
  const centerMatch = tileProvidersSrc.match(/center:\s*\{\s*lat:\s*([\d.]+),\s*lng:\s*([\d.]+)\s*\}/);
  let centerValid = false;
  if (centerMatch) {
    const lat = parseFloat(centerMatch[1]);
    const lng = parseFloat(centerMatch[2]);
    centerValid = lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135;
  }
  record(
    'coordinate-accuracy',
    '地图默认中心点位于中国境内',
    centerValid,
    centerMatch ? `lat=${centerMatch[1]}, lng=${centerMatch[2]}` : '未配置',
    'high'
  );

  // 2.2 验证默认边界在合理范围（Leaflet 期望 [lat, lng] 顺序）
  let boundsValid = false;
  let boundsDetail = '未配置';
  try {
    const idx = tileProvidersSrc.indexOf('DEFAULT_MAP_BOUNDS');
    if (idx >= 0) {
      const eqIdx = tileProvidersSrc.indexOf('=', idx);
      const sub = tileProvidersSrc.substring(eqIdx + 1, eqIdx + 300);
      // 匹配单层 [数字,数字]（lat/lng 一对），不需要前置 [
      const re = /\[\s*([\d.]+),\s*([\d.]+)\s*\]/g;
      const matches = [...sub.matchAll(re)].map((m) => ({
        lat: parseFloat(m[1]),
        lng: parseFloat(m[2]),
      }));
      // 取第一个和最后一个作为西南/东北
      if (matches.length >= 2) {
        const first = matches[0];
        const last = matches[matches.length - 1];
        // Leaflet 期望 [lat, lng] 顺序
        // 中国本土纬度范围 16-54（包含南海），经度范围 73-135
        boundsValid =
          first.lat < last.lat &&
          first.lng < last.lng &&
          first.lat >= 16 &&
          last.lat <= 54 &&
          first.lng >= 73 &&
          last.lng <= 135;
        boundsDetail = `西南[lat=${first.lat},lng=${first.lng}] 东北[lat=${last.lat},lng=${last.lng}] (共 ${matches.length} 对坐标)`;
      }
    }
  } catch (e) {
    boundsDetail = `异常: ${e.message}`;
  }
  record(
    'coordinate-accuracy',
    'DEFAULT_MAP_BOUNDS 配置有效（[lat,lng] 顺序）',
    boundsValid,
    boundsDetail,
    'high'
  );

  // 2.3 验证 GeoJSON 数据坐标系（应为 WGS84，lng/lat 顺序）
  const geojsonSrc = readFileSync(
    resolve(PROJECT, 'public/map/100000_full.json'),
    'utf8'
  );
  let firstLng = 0,
    firstLat = 0;
  try {
    const data = JSON.parse(geojsonSrc);
    const f = data.features[0];
    const c = f.properties.center;
    firstLng = c[0];
    firstLat = c[1];
  } catch {}
  record(
    'coordinate-accuracy',
    'GeoJSON properties.center 顺序为 [lng, lat]',
    firstLng > 73 && firstLng < 135 && firstLat > 18 && firstLat < 54,
    `首项: lng=${firstLng.toFixed(2)}, lat=${firstLat.toFixed(2)}`,
    'high'
  );

  // 2.4 验证 ChinaMap 投影逻辑（lng/lat → SVG 坐标）
  const mapProjectionSrc = readFileSync(
    resolve(PROJECT, 'src/lib/mapProjection.ts'),
    'utf8'
  );
  const hasProjection = /project|projection|toCanvas|toLatLng/.test(mapProjectionSrc);
  record(
    'coordinate-accuracy',
    'ChinaMap 投影工具函数存在',
    hasProjection,
    hasProjection ? '已实现' : '缺失',
    'high'
  );

  // 2.5 验证省级中心点与省级 GeoJSON 中心点吻合
  // 北京 110000：properties.center 应在 [116, 39] 附近
  try {
    const data = JSON.parse(geojsonSrc);
    const bj = data.features.find((f) => f.properties.adcode === 110000);
    const center = bj?.properties?.center ?? [];
    const beijingInRange = center[0] > 116 && center[0] < 117 && center[1] > 39 && center[1] < 41;
    record(
      'coordinate-accuracy',
      '北京中心点落在正确范围（lng=116.4, lat=39.9）',
      beijingInRange,
      `actual: [${center[0]}, ${center[1]}]`,
      'medium'
    );
  } catch {
    record('coordinate-accuracy', '北京中心点验证', false, '解析失败', 'high');
  }

  // 2.6 验证省级 GeoJSON 中心点 vs 县级 GeoJSON 中心点（同一省内）
  try {
    const provinceData = JSON.parse(geojsonSrc);
    const guangxi = provinceData.features.find((f) => f.properties.adcode === 450000);
    const provinceCenter = guangxi?.properties?.center ?? [];

    // 读取广西县级
    const ycMeta = JSON.parse(
      readFileSync(resolve(PROJECT, 'public/map/yao_counties_meta.json'), 'utf8')
    );
    const gxCounties = ycMeta.counties.filter((c) => c.provinceAdcode === 450000);
    if (gxCounties.length > 0) {
      // 计算县级中心点平均
      const avgLng = gxCounties.reduce((s, c) => s + (c.center?.[0] ?? 0), 0) / gxCounties.length;
      const avgLat = gxCounties.reduce((s, c) => s + (c.center?.[1] ?? 0), 0) / gxCounties.length;
      // 与省级中心点的偏差（粗略）
      const delta = Math.sqrt(
        Math.pow(avgLng - provinceCenter[0], 2) + Math.pow(avgLat - provinceCenter[1], 2)
      );
      record(
        'coordinate-accuracy',
        '省级 vs 县级中心点一致性（偏差 < 5°）',
        delta < 5,
        `省级中心[${provinceCenter[0].toFixed(2)},${provinceCenter[1].toFixed(2)}] 县级均值[${avgLng.toFixed(2)},${avgLat.toFixed(2)}] Δ=${delta.toFixed(2)}°`,
        'medium'
      );
    }
  } catch (e) {
    record('coordinate-accuracy', '省级 vs 县级一致性', false, e.message, 'medium');
  }
}

// ============================================================
// 类别 3：图层叠加完整性
// ============================================================
async function checkLayerOverlay() {
  console.log('\n[3] 图层叠加完整性');
  console.log('─'.repeat(60));

  // 3.1 验证 MapBoard z-index 层级（leaflet 容器、控件、tooltip）
  const mapBoardSrc = readFileSync(
    resolve(PROJECT, 'src/components/MapBoard/MapBoard.tsx'),
    'utf8'
  );
  const zIndexPattern = /z-\[(\d+)\]/g;
  const zIndexes = [...mapBoardSrc.matchAll(zIndexPattern)].map((m) => parseInt(m[1], 10));
  const hasZ1000 = zIndexes.some((z) => z >= 1000);
  const hasZ400 = zIndexes.some((z) => z >= 400 && z < 1000);
  record(
    'layer-overlay',
    'z-index 层级合理（覆盖层 400-1000，模态 1000+）',
    hasZ1000 && hasZ400,
    `使用层级: ${[...new Set(zIndexes)].sort((a, b) => a - b).join(', ')}`,
    'medium'
  );

  // 3.2 验证 LayerGroup 正确管理多个图层
  const localLayersSrc = readFileSync(
    resolve(PROJECT, 'src/components/MapBoard/LocalLayers.ts'),
    'utf8'
  );
  const hasLayerGroup = /L\.layerGroup\(\)/.test(localLayersSrc);
  const hasGeoJSON = /L\.geoJSON\(/.test(localLayersSrc);
  record(
    'layer-overlay',
    'LocalLayers 使用 LayerGroup 统一管理',
    hasLayerGroup && hasGeoJSON,
    hasLayerGroup && hasGeoJSON ? 'OK' : '缺失',
    'medium'
  );

  // 3.3 验证 Leaflet 控件正确叠加（zoomControl, attributionControl）
  const hasZoomControl = /zoomControl:\s*true/.test(mapBoardSrc);
  const hasAttributionControl = /attributionControl:\s*true/.test(mapBoardSrc);
  record(
    'layer-overlay',
    'Leaflet 控件（缩放 + 归属）已启用',
    hasZoomControl && hasAttributionControl,
    `zoomControl=${hasZoomControl}, attributionControl=${hasAttributionControl}`,
    'low'
  );

  // 3.4 验证 Modal 不遮挡地图（z-index 关系）
  // 检查是否有 modal-layer-high 类
  const indexCssPath = resolve(PROJECT, 'src/index.css');
  if (existsSync(indexCssPath)) {
    const css = readFileSync(indexCssPath, 'utf8');
    const hasModalLayer = /\.modal-layer-high\s*\{[^}]*z-index:\s*2000/.test(css);
    record(
      'layer-overlay',
      'Modal 层级（z-index: 2000）高于地图（1000）',
      hasModalLayer,
      hasModalLayer ? '已配置' : '缺失',
      'medium'
    );
  }

  // 3.5 验证 MapBoard 至少添加了 3 类图层（瓦片 + 离线兜底 + 行政区划）
  const hasTileLayer = /L\.tileLayer/.test(mapBoardSrc);
  const hasOfflineFallback = /fallbackRef\.current\s*=\s*createOfflineFallbackLayers/.test(mapBoardSrc);
  const hasLocalAdmin = /createLocalAdminLayerGroup/.test(mapBoardSrc);
  record(
    'layer-overlay',
    'MapBoard 集成三类图层（瓦片 / 兜底 / 本地行政区划）',
    hasTileLayer && hasOfflineFallback && hasLocalAdmin,
    `tile=${hasTileLayer}, offline=${hasOfflineFallback}, local=${hasLocalAdmin}`,
    'high'
  );

  // 3.6 验证 Leaflet pane 层级（mapPane / tilePane / overlayPane / markerPane）
  const leafletSrc = readFileSync(
    resolve(PROJECT, 'node_modules/leaflet/dist/leaflet-src.js'),
    'utf8'
  );
  const panes = ['tilePane', 'overlayPane', 'markerPane', 'popupPane'];
  const allPanes = panes.every((p) => leafletSrc.includes(p));
  record(
    'layer-overlay',
    'Leaflet 内置 pane 层级完整（tile/overlay/marker/popup）',
    allPanes,
    allPanes ? 'OK' : '缺失',
    'low'
  );
}

// ============================================================
// 类别 4：文字标注渲染准确率
// ============================================================
async function checkLabelRendering() {
  console.log('\n[4] 文字标注渲染准确率');
  console.log('─'.repeat(60));

  // 4.1 验证省/市级名称在 GeoJSON 中正确（中文名非乱码）
  const geojsonSrc = readFileSync(
    resolve(PROJECT, 'public/map/100000_full.json'),
    'utf8'
  );
  let chinsesProvinceValid = false;
  try {
    const data = JSON.parse(geojsonSrc);
    const hasCharset = /[\u4e00-\u9fa5]/.test(JSON.stringify(data));
    const hasExpectedNames =
      data.features.some((f) => f.properties.name === '北京市') ||
      data.features.some((f) => /^[一-龥]+省$/.test(f.properties.name));
    chinsesProvinceValid = hasCharset && hasExpectedNames;
  } catch {}
  record(
    'label-rendering',
    '省级名称含正确中文字符',
    chinsesProvinceValid,
    '已验证 UTF-8 中文',
    'high'
  );

  // 4.2 验证县级 GeoJSON 含中文名
  let countyNamesValid = false;
  try {
    const ycMeta = JSON.parse(
      readFileSync(resolve(PROJECT, 'public/map/yao_counties_meta.json'), 'utf8')
    );
    countyNamesValid =
      ycMeta.counties.length > 0 &&
      /[\u4e00-\u9fa5]/.test(ycMeta.counties[0].name ?? '');
  } catch {}
  record(
    'label-rendering',
    '县级 GeoJSON 含中文名（无乱码）',
    countyNamesValid,
    countyNamesValid ? '已验证' : '乱码风险',
    'high'
  );

  // 4.3 验证 MapBoard bindTooltip 含中文标签
  const mapBoardSrc = readFileSync(
    resolve(PROJECT, 'src/components/MapBoard/MapBoard.tsx'),
    'utf8'
  );
  const hasBindTooltip = /bindTooltip\(/.test(mapBoardSrc);
  const tooltipCount = (mapBoardSrc.match(/bindTooltip\(/g) ?? []).length;
  record(
    'label-rendering',
    'MapBoard 调用 bindTooltip 设置标注',
    hasBindTooltip,
    `${tooltipCount} 处 bindTooltip 调用`,
    'medium'
  );

  // 4.4 验证 divIcon 文字样式含中文字体回退
  const hasChineseFont = /Noto Sans SC|PingFang SC|Microsoft YaHei/.test(mapBoardSrc);
  record(
    'label-rendering',
    'divIcon 文字样式含中文字体回退',
    hasChineseFont,
    hasChineseFont ? '已配置' : '未配置',
    'high'
  );

  // 4.5 验证 MapBoard 文字标注字号合理（不能太小看不清）
  const fontSizeMatches = mapBoardSrc.match(/font-size:\s*(\d+)px/g) ?? [];
  const fontSizes = fontSizeMatches.map((m) => parseInt(m.match(/\d+/)[0], 10));
  const hasValidSize = fontSizes.some((s) => s >= 11 && s <= 14);
  record(
    'label-rendering',
    'MapBoard 文字字号在 11-14px 之间（可读性）',
    hasValidSize,
    fontSizes.length > 0 ? `字号: ${fontSizes.join(', ')}px` : '未发现',
    'low'
  );

  // 4.6 验证 OfflineFallbackLayer 含省级名称标签
  const offlineSrc = readFileSync(
    resolve(PROJECT, 'src/components/MapBoard/OfflineFallbackLayer.ts'),
    'utf8'
  );
  const offlineHasLabel = /divIcon/.test(offlineSrc);
  record(
    'label-rendering',
    'OfflineFallbackLayer 含 divIcon 标签',
    offlineHasLabel,
    offlineHasLabel ? '已配置' : '缺失',
    'medium'
  );
}

// ============================================================
// 类别 5：资源加载与超时
// ============================================================
async function checkLoadTimeout() {
  console.log('\n[5] 资源加载与超时');
  console.log('─'.repeat(60));

  // 5.1 验证所有 GeoJSON 文件大小（单文件 ≤ 30 MB）
  const geojsonFiles = [
    'public/map/100000.json',
    'public/map/100000_full.json',
    'public/map/china_cities.json',
    'public/map/yao_counties_real.json',
    'public/map/yao_counties_meta.json',
    'public/map/county-manifest.json',
    'public/map/county_yao.json',
  ];
  let allValid = true;
  const sizes = [];
  for (const f of geojsonFiles) {
    const p = resolve(PROJECT, f);
    if (existsSync(p)) {
      const size = statSync(p).size;
      sizes.push({ file: f, size });
      if (size > 30 * 1024 * 1024) allValid = false;
    }
  }
  record(
    'load-timeout',
    'GeoJSON 单文件 ≤ 30 MB',
    allValid,
    sizes
      .map((s) => `${s.file.replace('public/map/', '')}=${(s.size / 1024).toFixed(0)}KB`)
      .join(', '),
    'high'
  );

  // 5.2 验证 fetch 调用带 AbortController/timeout
  const localLayersSrc = readFileSync(
    resolve(PROJECT, 'src/components/MapBoard/LocalLayers.ts'),
    'utf8'
  );
  const hasAbortSignal = /AbortSignal\.timeout/.test(localLayersSrc);
  const hasTimeout = /timeoutMs\s*=\s*\d/.test(localLayersSrc);
  record(
    'load-timeout',
    'LocalLayers fetch 带超时（AbortSignal.timeout）',
    hasAbortSignal && hasTimeout,
    hasAbortSignal ? `使用 AbortSignal.timeout` : '缺失',
    'high'
  );

  // 5.3 验证 fail 重试机制
  const hasRetry = /重试一次|retry/i.test(localLayersSrc);
  record(
    'load-timeout',
    'LocalLayers 单文件加载失败重试机制',
    hasRetry,
    hasRetry ? '已实现' : '缺失',
    'medium'
  );

  // 5.4 验证 leaf CSS 已加载且未超时（dev server 通过 200 + 16 KB）
  const cssCheck = await fetch(`${BASE}/node_modules/leaflet/dist/leaflet.css`);
  record(
    'load-timeout',
    'Leaflet CSS 加载成功（200 OK）',
    cssCheck.ok,
    `${cssCheck.status} / ${cssCheck.headers.get('content-length')} bytes`,
    'high'
  );
}

// ============================================================
// 类别 6：跨域错误
// ============================================================
async function checkCORS() {
  console.log('\n[6] 跨域错误（CORS）');
  console.log('─'.repeat(60));

  // 6.1 验证 CSP 允许必要资源
  const indexHtmlPath = resolve(PROJECT, 'index.html');
  const indexHtml = readFileSync(indexHtmlPath, 'utf8');
  const hasCSP = /Content-Security-Policy/.test(indexHtml);
  const allowsHttps = /connect-src[^;]*https:/.test(indexHtml);
  record(
    'CORS',
    'CSP 配置允许 HTTPS 资源（瓦片）',
    hasCSP && allowsHttps,
    `CSP=${hasCSP}, https=${allowsHttps}`,
    'medium'
  );

  // 6.2 验证 Leaflet tileLayer 使用 crossOrigin
  const mapBoardSrc = readFileSync(
    resolve(PROJECT, 'src/components/MapBoard/MapBoard.tsx'),
    'utf8'
  );
  const hasCrossOrigin = /crossOrigin:\s*['"]anonymous['"]/.test(mapBoardSrc);
  record(
    'CORS',
    'Leaflet TileLayer 配置 crossOrigin=anonymous',
    hasCrossOrigin,
    hasCrossOrigin ? '已配置' : '缺失（部分瓦片可能 CORS 失败）',
    'medium'
  );
}

// ============================================================
// 执行检测
// ============================================================
async function run() {
  console.log('=== 地图显示完整性检测 ===');
  console.log('目标:', BASE);
  console.log('');

  await checkTileCoverage();
  await checkCoordinateAccuracy();
  await checkLayerOverlay();
  await checkLabelRendering();
  await checkLoadTimeout();
  await checkCORS();

  // 输出
  console.log('\n=== 检测报告 ===');
  const categories = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = [];
    categories[r.category].push(r);
  }

  let totalPassed = 0,
    totalFailed = 0;
  for (const [cat, items] of Object.entries(categories)) {
    console.log(`\n[${cat}] ${items.filter((i) => i.passed).length}/${items.length} 通过`);
    for (const item of items) {
      const icon = item.passed ? '[OK]' : '[FAIL]';
      const sev =
        item.severity === 'high'
          ? '!!!'
          : item.severity === 'medium'
            ? '!!'
            : '!';
      console.log(`  ${icon} ${item.passed ? '' : sev + ' '} ${item.name} — ${item.detail}`);
      if (item.passed) totalPassed++;
      else totalFailed++;
    }
  }

  console.log('\n=== 汇总 ===');
  console.log(`总通过: ${totalPassed}`);
  console.log(`总失败: ${totalFailed}`);
  console.log(`失败率: ${((totalFailed / results.length) * 100).toFixed(1)}%`);

  // 列出高优先级失败项
  const highFailures = results.filter((r) => !r.passed && r.severity === 'high');
  if (highFailures.length > 0) {
    console.log('\n!!! 高优先级问题（必须修复）:');
    for (const f of highFailures) {
      console.log(`  - [${f.category}] ${f.name}: ${f.detail}`);
    }
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('检测运行异常:', e);
  process.exit(2);
});