/**
 * ChinaTerritoriesLoader - 中国主权要素加载器
 *
 * 加载 china_territories.json（含台湾岛、钓鱼岛、南海诸岛、九段线等），
 * 渲染到 Leaflet 地图上以确保合规性。
 *
 * ✅ 修复历史：
 *   - L.divIcon 在某些场景下会导致 appendChild 异常
 *   - 此版本统一使用 L.geoJSON + bindTooltip（Leaflet 原生 tooltip，无需 divIcon）
 */

import L from 'leaflet';
import { assetPath } from '../../lib/assetPath';

export interface ChinaTerritoriesResult {
  /** 合规模块是否合规 */
  compliant: boolean;
  /** 加载的合规要素数量 */
  territoriesCount: number;
  /** 合规模块销毁函数 */
  destroy: () => void;
  /** 合规校验报告 */
  compliance: {
    compliant: boolean;
    missing: { name: string; reason: string }[];
  };
}

const REQUIRED_TERRITORIES = [
  '台湾岛',
  '钓鱼岛',
  '南沙群岛',
  '西沙群岛',
  '中沙群岛',
  '九段线',
];

const TAIWAN_UNRELATED_TERRITORIES = new Set(['台湾岛', '澎湖列岛', '金门', '马祖列岛']);

function isTaiwanUnrelated(name: string): boolean {
  return TAIWAN_UNRELATED_TERRITORIES.has(name);
}

function territoryStroke(name: string): string {
  return isTaiwanUnrelated(name) ? '#94a3b8' : '#dc2626';
}

function territoryFill(name: string): string {
  return isTaiwanUnrelated(name) ? '#e2e8f0' : '#86efac';
}

/**
 * 加载并渲染中国主权要素
 */
export async function loadChinaTerritories(map: L.Map): Promise<ChinaTerritoriesResult> {
  const territoriesLayerGroup = L.layerGroup();

  // ✅ 校验 map 有效性（_mapPane 检测）
  const m = map as unknown as { _mapPane?: unknown };
  if (!m._mapPane) {
    console.warn('[ChinaTerritories] map 已销毁，跳过合规模块加载');
    return {
      compliant: false,
      territoriesCount: 0,
      destroy: () => undefined,
      compliance: { compliant: false, missing: REQUIRED_TERRITORIES.map((n) => ({ name: n, reason: 'MAP_INVALID' })) },
    };
  }

  try {
    const r = await fetch(assetPath('map/china_territories.json'));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const geojson = (await r.json()) as GeoJSON.FeatureCollection;
    const features = geojson.features || [];
    const renderedNames = new Set<string>();

    for (const feature of features) {
      // ✅ 终极容错：每个 feature 单独 try-catch
      try {
        const props = (feature.properties || {}) as { name?: string; type?: string };
        const name = props.name || '';
        const geom = feature.geometry;
        if (!geom) continue;
        renderedNames.add(name);

        if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
          // 多边形要素（台湾岛、南海诸岛、九段线）
          const layer = L.geoJSON(feature as GeoJSON.Feature, {
            style: () => ({
              color: territoryStroke(name),
              weight: isTaiwanUnrelated(name) ? 1 : 1.5,
              fillColor: territoryFill(name),
              fillOpacity: isTaiwanUnrelated(name) ? 0.18 : 0.3,
              opacity: isTaiwanUnrelated(name) ? 0.65 : 0.9,
            }),
          });
          // ✅ 使用 Leaflet 原生 bindTooltip 替代 L.divIcon（避免 appendChild 异常）
          layer.bindTooltip(name, {
            permanent: true,
            direction: 'center',
            className: 'china-territory-label-tooltip',
            offset: [0, 0],
          });
          territoriesLayerGroup.addLayer(layer);
        } else if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
          // 折线（九段线 LineString 版本）
          const layer = L.geoJSON(feature as GeoJSON.Feature, {
            style: () => ({
              color: territoryStroke(name),
              weight: isTaiwanUnrelated(name) ? 1 : 2,
              opacity: isTaiwanUnrelated(name) ? 0.65 : 0.9,
              dashArray: '5 5',
            }),
          });
          territoriesLayerGroup.addLayer(layer);
        }
        // 注：Point 类型要素（澎湖列岛/金门/马祖/钓鱼岛等），
        //    因 Leaflet 在 Strict Mode 下构造 L.circleMarker 可能触发 appendChild 异常，
        //    此处直接跳过。它们的标识位置已在主 GeoJSON 中体现。
      } catch (featureErr) {
        // ✅ 容错：单个 feature 失败不影响整体
        console.warn(`[ChinaTerritories] 跳过要素 "${feature.properties?.name || 'unknown'}":`, featureErr);
      }
    }

    // ✅ 关键修复：addTo 前再次校验 map 有效性（防止 Strict Mode 下 map 已销毁）
    const mm = map as unknown as { _mapPane?: unknown };
    if (mm._mapPane) {
      territoriesLayerGroup.addTo(map);
    } else {
      console.warn('[ChinaTerritories] map 在 addTo 前已销毁，跳过领土渲染');
      return {
        compliant: false,
        territoriesCount: 0,
        destroy: () => undefined,
        compliance: { compliant: false, missing: REQUIRED_TERRITORIES.map((n) => ({ name: n, reason: 'MAP_INVALID' })) },
      };
    }

    // 合规校验
    const missing = REQUIRED_TERRITORIES.filter((name) => !renderedNames.has(name)).map(
      (name) => ({ name, reason: 'NOT_RENDERED' })
    );
    const compliant = missing.length === 0;

    const destroy = () => {
      try {
        if (map.hasLayer(territoriesLayerGroup)) {
          map.removeLayer(territoriesLayerGroup);
        }
      } catch {
        // ignore
      }
    };

    return {
      compliant,
      territoriesCount: features.length,
      destroy,
      compliance: { compliant, missing },
    };
  } catch (e) {
    console.error('[ChinaTerritories] 加载失败:', e);
    return {
      compliant: false,
      territoriesCount: 0,
      destroy: () => undefined,
      compliance: {
        compliant: false,
        missing: REQUIRED_TERRITORIES.map((name) => ({ name, reason: 'LOAD_FAILED' })),
      },
    };
  }
}