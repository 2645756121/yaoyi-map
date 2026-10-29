/**
 * regionAdcode.ts —— 业务「地区 id」到省级行政区划代码的映射
 *
 * 历史背景：早期 2D Leaflet 地图用 `regionId`（如 'guangxi'）表示省份，
 * 而 3D 地形与行政边界数据统一使用国标 adcode 前两位（如 '45'）。
 *
 * 现在项目只有 3D 地形一种地图，本模块只承担这一层 id 转换：
 * `TerrainRelief3D/poiData.ts` 用它把草药按省份分桶。
 */

/** 区域 ID → 省级 adcode（前 2 位） */
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
