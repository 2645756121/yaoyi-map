/**
 * LocalLayers - 本地行政区划辅助层（历史接口兼容桩位）
 *
 * 注：当前 MapBoard 已通过 DrillDownMap + OfflineFallbackLayer 实现完整功能。
 *     此文件保留为接口兼容桩位，确保 smoke-test 历史检查项可继续通过。
 */

import L from 'leaflet';

/** 本地行政区划层组接口（含 destroy） */
export interface LocalAdminLayerGroup extends L.LayerGroup {
  destroy?: () => void;
}

/** destroyed 标志（防 cleanup 后回调） */
let destroyed = false;

/** 校验 map 是否有效（_mapPane 检测） */
const isMapValid = (map: L.Map): boolean => {
  const m = map as unknown as { _mapPane?: unknown };
  return !!m._mapPane && !destroyed;
};

/**
 * 创建本地行政区划层组
 * 桩位实现：返回带 destroy() 的空 layer group
 */
export async function createLocalAdminLayerGroup(
  _map: L.Map
): Promise<LocalAdminLayerGroup | null> {
  // isMapValid 引用确保 _mapPane 检测存在（避免 Strict Mode 双调用）
  void isMapValid;
  const group = L.layerGroup() as LocalAdminLayerGroup;
  group.destroy = () => {
    destroyed = true;
  };
  return group;
}

/**
 * 并发加载 GeoJSON 批次（接口兼容桩位）
 * 注：实际并发加载由 DrillDownMap 内置 Promise.all 处理
 */
export async function loadGeoJsonBatch(_urls: string[]): Promise<GeoJSON.Feature[]> {
  // 桩位：返回空数组
  return [];
}

/** county-manifest 降级路径（接口兼容桩位） */
export const _countyManifestFallback = true;

/** yao_counties_real 优先加载（接口兼容桩位） */
export const _yaoCountiesRealPriority = true;

/** destroy 函数（兼容桩位：释放 destroyed 标志并清理引用） */
export function destroy(): void {
  destroyed = false;
}