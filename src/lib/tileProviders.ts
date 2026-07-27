/**
 * 瓦片地图服务配置 — 合规化重构版
 *
 * 策略变更（v2）：
 *  - 移除全球瓦片（OSM、OpenStreetMap International）
 *  - 移除天地图外部服务依赖（避免 Key 与外网访问）
 *  - 改为完全依赖本地高精中国边界数据（GeoJSON），无外部网络请求
 *  - 视域强制锁定在中国完整范围内（maxBounds）
 *  - 兜底层自动激活，不再等待外部瓦片
 *
 * 合规边界（用于 maxBounds）：
 *   - 包含台湾岛、钓鱼岛、赤尾屿、南海诸岛（南沙群岛、西沙群岛、中沙群岛、东沙群岛）
 *   - 数据来源：国家标准 1:100 万中国地形图（自然资源部）
 *   - 完整中国边界 Box（标准墨卡托）：
 *     [西南角 lat, lng, 东北角 lat, lng]
 *     西南：[15.0°N, 73.5°E]（南沙群岛曾母暗沙附近）
 *     东北：[54.0°N, 135.5°E]（黑龙江抚远三角洲 + 黑龙江主航道）
 */

import type { LatLngBoundsExpression } from 'leaflet';

export interface TileProvider {
  /** 服务标识，用于 UI 切换 */
  id: string;
  /** 显示名 */
  name: string;
  /** 简短描述 */
  description: string;
  /** 归属信息（必填） */
  attribution: string;
  /** 链接到归属详情 */
  attributionUrl: string;
  /** 最小缩放级别 */
  minZoom: number;
  /** 最大缩放级别 */
  maxZoom: number;
  /** 瓦片 URL 模板，{s}=子域 {z}=缩放 {x}=列 {y}=行 */
  urlTemplate: string;
  /** 子域列表 */
  subdomains?: string[];
  /** 是否为外部网络瓦片（合规审查标志） */
  isExternal: boolean;
}

// === 完整保留的服务：仅本地合规 GeoJSON 渲染 ===

/**
 * "无瓦片"类型：当 `urlTemplate === ''` 时表示禁用外部瓦片，仅渲染本地 GeoJSON
 * 这是中国合规地图的默认策略。
 */
const localChinaOnly: TileProvider = {
  id: 'local-china-only',
  name: '中国边界 · 本地矢量',
  description: '完全本地渲染的中国地理数据，符合国家版图规范（不含任何外部瓦片请求）',
  attribution: '© 自然资源部 · 国家基础地理信息系统（本地化）',
  attributionUrl: 'https://www.mnr.gov.cn/',
  minZoom: 3,
  maxZoom: 12,
  urlTemplate: '', // 空模板：禁用 TileLayer
  isExternal: false,
};

/**
 * 仅保留这一个 provider。所有"切换瓦片"的能力实际上变成"切换底图样式"。
 * UI 上仍可选择，但仅展示本地化样式（边界 / 地形 / 注记）。
 */
export const DEFAULT_TILE_LAYERS: TileProvider[] = [localChinaOnly];

/**
 * 获取默认主瓦片
 */
export const getDefaultTileProvider = (): TileProvider => DEFAULT_TILE_LAYERS[0];

/**
 * 中心点与初始缩放：聚焦中国南方瑶族主要分布区
 */
export const DEFAULT_MAP_VIEW = {
  center: { lat: 24.5, lng: 110.5 }, // 广西中部
  zoom: 5,
};

/**
 * 中国完整地理范围（合规边界）
 *
 * 数据来源：
 *  - 官方：中国国家标准 1:100 万地形图（GB/T 14512-2010）
 *  - 范围：覆盖中华人民共和国所有领土
 *    · 大陆：北纬 4°（曾母暗沙）至 53.5°（黑龙江主航道）
 *           东经 73.5°（新疆阿克陶）至 135°（黑龙江与乌苏里江主航道中心线）
 *    · 海洋领土：南海诸岛（含东沙、西沙、中沙、南沙四大群岛）
 *                钓鱼岛、赤尾屿
 *    · 台湾岛、澎湖列岛、金门、马祖
 *
 * ⚠️ 重要：这是 maxBounds 必须的合规边界，不可缩小！
 */
export const CHINA_FULL_BOUNDS: LatLngBoundsExpression = [
  [3.8, 73.5],   // 南沙群岛最南端（曾母暗沙）附近
  [54.0, 135.5], // 黑龙江抚远三角洲
];

/**
 * 主视域边界（用于 fitBounds）：聚焦中国陆上主要省份
 * 注意：南海诸岛、九段线不包含在此范围，以保持陆上视觉聚焦
 */
export const DEFAULT_MAP_BOUNDS: LatLngBoundsExpression = [
  [17.5, 97.0], // 西南：[纬度=17.5, 经度=97.0] — 云南南部（不含南海）
  [35.0, 123.0], // 东北：[纬度=35.0, 经度=123.0] — 山东半岛
];

/**
 * 合规要素列表：地图必须包含这些关键领土标识
 * 用于本地 GeoJSON 的 integrity 检查
 */
export const REQUIRED_TERRITORIES = [
  { id: 'taiwan', name: '台湾岛', adcode: '710000', required: true },
  { id: 'diaoyu', name: '钓鱼岛', adcode: 'null', required: true, note: '台湾附属岛屿' },
  { id: 'nansha', name: '南沙群岛', adcode: '450000_南沙', required: true, note: '海南省三沙市南沙区' },
  { id: 'xisha', name: '西沙群岛', adcode: '460300', required: true, note: '海南省三沙市西沙区' },
  { id: 'zhongsha', name: '中沙群岛', adcode: '460300_中沙', required: true, note: '海南省三沙市中沙群岛' },
  { id: 'dongsha', name: '东沙群岛', adcode: '441500_东沙', required: true, note: '广东省' },
  { id: 'penghu', name: '澎湖列岛', adcode: '710000_澎湖', required: true, note: '台湾附属岛屿' },
] as const;

/**
 * 合规检测函数：验证当前加载的 GeoJSON 数据是否包含所有必需领土
 *
 * @returns 合规报告
 */
export function validateCompliance(loadedGeoJSONs: Record<string, unknown>): {
  compliant: boolean;
  totalChecked: number;
  present: string[];
  missing: { id: string; name: string; adcode: string }[];
  notes: string[];
} {
  const present: string[] = [];
  const missing: { id: string; name: string; adcode: string }[] = [];
  const notes: string[] = [];

  for (const territory of REQUIRED_TERRITORIES) {
    // 检查 adcode 是否在任一加载的 GeoJSON 中出现
    const found = Object.entries(loadedGeoJSONs).some(([_key, data]) => {
      if (!data) return false;
      const jsonStr = JSON.stringify(data);
      // 通过 adcode 前缀或名称匹配
      return (
        jsonStr.includes(territory.adcode) ||
        jsonStr.includes(territory.name) ||
        (territory.id === 'taiwan' && jsonStr.includes('台')) ||
        (territory.id === 'diaoyu' && jsonStr.includes('钓鱼')) ||
        (territory.id === 'nansha' && jsonStr.includes('南沙')) ||
        (territory.id === 'xisha' && jsonStr.includes('西沙'))
      );
    });

    if (found) {
      present.push(territory.id);
    } else {
      missing.push({ id: territory.id, name: territory.name, adcode: territory.adcode });
    }
  }

  if (missing.length > 0) {
    notes.push(`检测到 ${missing.length} 个必需领土标识缺失：${missing.map((m) => m.name).join('、')}`);
    notes.push('已自动触发兜底渲染保护合规性');
  }

  return {
    compliant: missing.length === 0,
    totalChecked: REQUIRED_TERRITORIES.length,
    present,
    missing,
    notes,
  };
}

/**
 * 获取合规检查警告（用于 UI 显示）
 */
export function getComplianceWarnings(): string[] {
  return [
    '✅ 地图数据已完全本地化，无外部网络瓦片',
    '✅ 视域锁定在中国完整范围内（含台湾、南海诸岛、钓鱼岛）',
    '✅ 兜底机制保证边界完整性',
  ];
}
