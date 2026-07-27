/**
 * 草药点位坐标转换工具
 *
 * 背景：
 * - 草药数据中的 mapPosition 是 ChinaMap 概念地图 SVG viewBox 内的像素位置（0-900 x 0-600）
 * - MapBoard (Leaflet) 使用真实地理坐标（经度/纬度）
 * - 此模块将历史 mapPosition 转换为 (lng, lat)，便于 MapBoard 直接使用
 *
 * 投影参数（与 chinaMap/src/lib/mapProjection.ts 保持一致）：
 *   viewBoxWidth: 900, viewBoxHeight: 600
 *   minLon: 73, maxLon: 135, minLat: 18, maxLat: 54
 *   padding: 20
 *   scale = min((900-40)/62, (600-40)/36) ≈ 13.87
 */
import type { Herb } from '../types';

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
 * 将 (lng, lat) 转换为概念地图 SVG 像素位置（x, y）
 */
export function lngLatToHerbMapPosition(lng: number, lat: number): {
  x: number;
  y: number;
} {
  const x = PADDING + (lng - MIN_LON) * SCALE;
  const y = PADDING + (MAX_LAT - lat) * SCALE;
  return { x, y };
}

/**
 * 获取草药的真实地理坐标 (lng, lat)
 * 优先使用 herb.lng/lat；如果没有则从 herb.mapPosition 转换
 * 都没有则返回 null
 */
export function getHerbLngLat(herb: Herb): { lng: number; lat: number } | null {
  if (typeof herb.lng === 'number' && typeof herb.lat === 'number') {
    return { lng: herb.lng, lat: herb.lat };
  }
  if (herb.mapPosition) {
    return herbMapPositionToLngLat(herb.mapPosition);
  }
  return null;
}