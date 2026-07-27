/**
 * 地图事件注册中心（轻量级解耦）
 *
 * 解决：RegionQuickSelector（位于 MapBoard 内部）需要触发 DrillDownMap 的钻取动作，
 *       但 RegionQuickSelector 是受控组件，无法直接拿到 DrillDownController 引用。
 *
 * 设计：
 *   - MapBoard 在 useEffect 中注册 drillDownController
 *   - RegionQuickSelector 调用 dispatchZoomToRegion 触发
 *   - 清理时 unregister 防止内存泄漏
 */

import type { DrillDownController } from '../components/MapBoard/DrillDownMap';

let _drillDownController: DrillDownController | null = null;

/** 注册钻取控制器（由 MapBoard 在挂载时调用） */
export function registerDrillDownController(c: DrillDownController | null) {
  _drillDownController = c;
}

/** 获取当前注册的钻取控制器（仅供内部使用） */
export function getDrillDownController(): DrillDownController | null {
  return _drillDownController;
}

/** 区域 ID → 省级 adcode（前 2 位）映射 */
export const REGION_TO_ADCODE: Record<string, string> = {
  guangxi: '45',
  guangdong: '44',
  hunan: '43',
  yunnan: '53',
  guizhou: '52',
  jiangxi: '36',
  hainan: '46',
  chongqing: '50',
  sichuan: '51',
};

/**
 * 触发 Leaflet 地图钻取到对应省级（异步）
 * - 若钻取控制器未注册（地图未挂载），静默跳过
 * - 若 regionId 找不到对应 adcode，静默跳过
 */
export function dispatchZoomToRegion(regionId: string): void {
  const adcode = REGION_TO_ADCODE[regionId];
  if (!adcode) return;
  const c = _drillDownController;
  if (!c) return;
  void c.drillToProvince(adcode);
}

/** 触发返回上级视图（全国视图） */
export function dispatchZoomToNational(): void {
  const c = _drillDownController;
  if (!c) return;
  void c.zoomOut();
}