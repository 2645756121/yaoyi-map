/**
 * 草药点位坐标转换工具
 *
 * 背景：
 * - 草药数据中的 mapPosition 是早期概念地图 SVG viewBox 内的像素位置（0-900 x 0-600）
 * - 地形浮雕地图使用真实地理坐标（经度/纬度）
 * - 此模块将历史 mapPosition 转换为 (lng, lat)，供地形浮雕的点位层直接使用
 *
 * 投影参数（与 chinaMap/src/lib/mapProjection.ts 保持一致）：
 *   viewBoxWidth: 900, viewBoxHeight: 600
 *   minLon: 73, maxLon: 135, minLat: 18, maxLat: 54
 *   padding: 20
 *   scale = min((900-40)/62, (600-40)/36) ≈ 13.87
 */
import type { Herb } from '../types';
import { yaoCounties } from '../data/yaoCountyData';

const VIEWBOX_WIDTH = 900;
const VIEWBOX_HEIGHT = 600;
const PADDING = 20;
const MIN_LON = 73;
const MAX_LON = 135;
const MIN_LAT = 18;
const MAX_LAT = 54;

const LON_RANGE = MAX_LON - MIN_LON; // 62
const LAT_RANGE = MAX_LAT - MIN_LAT; // 36
const SCALE_X = (VIEWBOX_WIDTH - PADDING * 2) / LON_RANGE;
const SCALE_Y = (VIEWBOX_HEIGHT - PADDING * 2) / LAT_RANGE;
const SCALE = Math.min(SCALE_X, SCALE_Y);

/**
 * 将草药 mapPosition (x, y) 转换为 (lng, lat)
 */
export function herbMapPositionToLngLat(mapPosition: { x: number; y: number }): {
  lng: number;
  lat: number;
} {
  const lng = MIN_LON + (mapPosition.x - PADDING) / SCALE;
  const lat = MAX_LAT - (mapPosition.y - PADDING) / SCALE;
  return { lng, lat };
}

/**
 * 获取草药的真实地理坐标 (lng, lat)
 * 优先使用 herb.lng/lat；如果没有则从 herb.mapPosition 转换
 * 再退化到「关联瑶区县中心」/「区域省份中心」的推导坐标
 * 都没有则返回 null
 */

/* 注：原有一个反向函数 lngLatToHerbMapPosition()（lng/lat → 概念地图像素），
 * 全项目无消费者，且"概念地图 SVG"已被 Leaflet 2D 地图取代，
 * 故于 2026 清理中删除。本条注释保留以便追溯。 */

/** regionId（拼音省名）→ 瑶族聚居方向的省份兜底坐标（省会之外，偏向瑶区） */
const REGION_FALLBACK: Record<string, { lng: number; lat: number }> = {
  guangxi: { lng: 110.0, lat: 23.6 }, // 大瑶山方向
  guangdong: { lng: 113.1, lat: 24.6 }, // 清远/韶关瑶族聚居区
  hunan: { lng: 111.9, lat: 25.8 }, // 永州/怀化方向
  yunnan: { lng: 103.6, lat: 23.3 }, // 红河/文山方向
  guizhou: { lng: 108.0, lat: 26.4 }, // 黔东南方向
  jiangxi: { lng: 114.95, lat: 25.85 }, // 赣州方向
  hainan: { lng: 109.7, lat: 18.85 }, // 五指山方向
  chongqing: { lng: 108.8, lat: 29.2 }, // 黔江方向
  sichuan: { lng: 103.0, lat: 30.6 }, // 凉山/阿坝之间
};

/** 由字符串生成稳定的伪随机角度（0-360） */
function hashAngle(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (h % 360) * (Math.PI / 180);
}

/**
 * 基于瑶区县 herbVarieties 关联推导草药坐标。
 * 同县多味药时，按其在县 herbVarieties 列表中的槽位环绕错开，避免点位完全重叠。
 */
function resolveFromCounty(herb: Herb): { lng: number; lat: number } | null {
  for (const county of yaoCounties) {
    const varieties = county.herbVarieties ?? [];
    const slot = varieties.indexOf(herb.id);
    if (slot === -1) continue;
    // 第一味药放在县中心，其余在半径 0.2° 的圆环上等角错开
    if (slot === 0) {
      return { lng: county.centerLng, lat: county.centerLat };
    }
    const angle = (slot * 2 * Math.PI) / Math.max(varieties.length, 1) + hashAngle(herb.id) * 0.15;
    const RADIUS = 0.2;
    return {
      lng: county.centerLng + Math.cos(angle) * RADIUS,
      lat: county.centerLat + Math.sin(angle) * RADIUS * 0.8,
    };
  }
  return null;
}

export function getHerbLngLat(herb: Herb): { lng: number; lat: number } | null {
  if (typeof herb.lng === 'number' && typeof herb.lat === 'number') {
    return { lng: herb.lng, lat: herb.lat };
  }
  if (herb.mapPosition) {
    return herbMapPositionToLngLat(herb.mapPosition);
  }
  const fromCounty = resolveFromCounty(herb);
  if (fromCounty) return fromCounty;
  const fallback = REGION_FALLBACK[herb.regionId];
  if (fallback) {
    // 同区域多个未关联县的草药时，用稳定散列错开 0.5° 半径圆环
    const angle = hashAngle(herb.id);
    return {
      lng: fallback.lng + Math.cos(angle) * 0.5,
      lat: fallback.lat + Math.sin(angle) * 0.4,
    };
  }
  return null;
}