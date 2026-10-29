/**
 * poiData.ts —— 点位数据构建（纯函数，与渲染框架无关，便于单元测试）
 *
 * 地图只有"地形浮雕"一种形态（2D Leaflet 地图已移除），这里构建的即是其全部点位：
 *   - 草药点位：`data/mockData.herbs` + `lib/herbPositions.getHerbLngLat`，
 *     按 `herb.regionId → REGION_TO_ADCODE` 分桶到省级 adcode（点击某省只显示该省的草药）
 *   - 瑶族县点位：`data/yaoCountyData.yaoCounties` 聚合后按省取，按 category 配色
 *
 * 两个构建函数都接受"数据源 + 坐标解析器"作为可选参数（默认用真实数据），
 * 这样异常分支（缺坐标、未知 regionId、空数据）可以在单测里直接注入，
 * 而不需要改动生产调用方。
 */

import { herbs as allHerbs, yaoCounties as allCounties } from '../../data/mockData';
import type { AdminHierarchy } from '../../lib/adminAggregator';
import { getHerbLngLat } from '../../lib/herbPositions';
import { REGION_TO_ADCODE } from '../../lib/regionAdcode';
import type { Herb, YaoCounty } from '../../types';
import type { PoiItem } from './boundaryOverlay';

/** 县分类 → 渐变色（与 2D 地图的县级药丸标记完全一致） */
export const COUNTY_CATEGORY_COLORS: Record<string, [string, string]> = {
  core: ['#166534', '#22c55e'],
  development: ['#22c55e', '#84cc16'],
  production: ['#f59e0b', '#fbbf24'],
};

/** 草药点位主题色（与 2D 的绿色圆点一致） */
export const HERB_ACCENT = '#16a34a';
export const HERB_ACCENT2 = '#22c55e';

/** 悬停信息卡里功效摘要的最大长度 */
export const HERB_EFFICACY_MAX = 42;

export type LonLatResolver = (herb: Herb) => { lng: number; lat: number } | null;

export interface HerbPoiBuckets {
  /** 2 位省级 adcode → 该省草药点位（顺序与数据源一致） */
  byProvince: Map<string, PoiItem[]>;
  /** 点位 id → 草药对象（点击时打开详情弹窗） */
  byId: Map<string, Herb>;
}

/**
 * 构造草药点位并按"所属省份"分桶。
 *
 * 归属判定用草药自带的 `regionId`（业务归属）而不是屏幕位置，
 * 因此不会出现"某省的草药因为坐标偏移被算到邻省"的问题。
 * 无坐标 / regionId 无法映射的点位会被跳过（不进入任何桶）。
 */
/* ------------------------------------------------------- 草药点位的省域归属校正 */

/** 某省瑶族县的空间包络（用县中心点求，比省界略小，因此比较时要留余量） */
interface ProvinceExtent {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  counties: YaoCounty[];
}

/** 允许点位超出"县包络"的度数：县中心到省界的平均余量 */
const PROVINCE_PAD_DEG = 0.85;

function buildProvinceExtents(counties: YaoCounty[]): Map<string, ProvinceExtent> {
  const map = new Map<string, ProvinceExtent>();
  for (const c of counties) {
    const key = String(c.code ?? '').substring(0, 2);
    if (!key || !Number.isFinite(c.centerLng) || !Number.isFinite(c.centerLat)) continue;
    const e = map.get(key);
    if (!e) {
      map.set(key, {
        minLon: c.centerLng,
        maxLon: c.centerLng,
        minLat: c.centerLat,
        maxLat: c.centerLat,
        counties: [c],
      });
    } else {
      e.minLon = Math.min(e.minLon, c.centerLng);
      e.maxLon = Math.max(e.maxLon, c.centerLng);
      e.minLat = Math.min(e.minLat, c.centerLat);
      e.maxLat = Math.max(e.maxLat, c.centerLat);
      e.counties.push(c);
    }
  }
  return map;
}

/**
 * 把"归属本省、坐标却落到邻省"的草药拉回本省境内。
 *
 * 背景：草药坐标来自早期概念地图的像素位置（`mapPosition`），换算成经纬度后与真实地理存在
 * 系统性偏移——实测聚焦广东时，广东的草药会画到广西境内，看起来像"串省了"。
 *
 * 处理策略（保守，尽量不动已经正确的点位）：
 *   1. 点位若落在本省"县包络 + 余量"之内 → 原样保留；
 *   2. 越界 → 优先吸附到"收录了这味药的同省瑶族县"中心（县数据里的 herbVarieties 就是这层归属）；
 *   3. 该药没有被任何县收录 → 吸附到最近的同省县中心。
 * 之后的 `spreadCoincidentPoints` 会把吸附到同一点的点位再散开。
 */
function containToProvince(
  lon: number,
  lat: number,
  adcode2: string,
  extents: Map<string, ProvinceExtent>,
  herbId: string,
): { lon: number; lat: number } {
  const ext = extents.get(adcode2);
  if (!ext) return { lon, lat };

  const inside =
    lon >= ext.minLon - PROVINCE_PAD_DEG &&
    lon <= ext.maxLon + PROVINCE_PAD_DEG &&
    lat >= ext.minLat - PROVINCE_PAD_DEG &&
    lat <= ext.maxLat + PROVINCE_PAD_DEG;
  if (inside) return { lon, lat };

  const owner = ext.counties.find((c) => (c.herbVarieties ?? []).includes(herbId));
  if (owner) return offsetAround(owner.centerLng, owner.centerLat, herbId);

  let best = ext.counties[0];
  let bestD = Infinity;
  for (const c of ext.counties) {
    const d = (c.centerLng - lon) ** 2 + (c.centerLat - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return offsetAround(best.centerLng, best.centerLat, herbId);
}

/** 吸附半径（度）：约 20px（省级缩放），既贴着本县又不被县名药丸压住 */
const SNAP_RADIUS_DEG = 0.24;

/**
 * 围绕县中心做一个小角度偏移。
 * 若直接落在县中心，草药图标会被县名药丸（渲染层级更高）整个盖住；
 * 用 id 哈希取角度，同一县内多味药也会自然散成一小圈，而不是完全重叠。
 */
function offsetAround(lon: number, lat: number, herbId: string): { lon: number; lat: number } {
  let h = 0;
  for (let i = 0; i < herbId.length; i++) h = (h * 31 + herbId.charCodeAt(i)) % 100000;
  const ang = (h % 360) * (Math.PI / 180);
  return {
    lon: lon + Math.cos(ang) * SNAP_RADIUS_DEG,
    lat: lat + Math.sin(ang) * SNAP_RADIUS_DEG * 0.85,
  };
}

export function buildHerbPoisByProvince(
  herbList: Herb[] = allHerbs,
  resolve: LonLatResolver = getHerbLngLat,
  regionToAdcode: Record<string, string> = REGION_TO_ADCODE,
  countyList: YaoCounty[] = allCounties,
): HerbPoiBuckets {
  const byProvince = new Map<string, PoiItem[]>();
  const byId = new Map<string, Herb>();
  const extents = buildProvinceExtents(countyList);

  for (const herb of herbList) {
    if (!herb) continue;
    const pos = resolve(herb);
    if (!pos || !Number.isFinite(pos.lng) || !Number.isFinite(pos.lat)) continue;

    // 必须先算出归属省：这决定点位要不要"拉回本省"。
    // 注意：未知 regionId 的药草仍然要进 byId（历史行为，单测有约束），只是不进任何省份桶。
    const adcode2 = regionToAdcode[herb.regionId ?? ''] ?? '';
    const fixed = adcode2
      ? containToProvince(pos.lng, pos.lat, adcode2, extents, herb.id)
      : { lon: pos.lng, lat: pos.lat };

    const info: string[] = [];
    if (herb.nameYao) info.push(herb.nameYao);
    if (herb.scientificName) info.push(`<i>${herb.scientificName}</i>`);
    const efficacy = herb.efficacy ?? '';
    if (efficacy) {
      info.push(efficacy.length > HERB_EFFICACY_MAX ? `${efficacy.slice(0, HERB_EFFICACY_MAX)}…` : efficacy);
    }
    info.push(`<span style="color:${HERB_ACCENT}">点击查看详情</span>`);

    const id = `herb-${herb.id}`;
    const item: PoiItem = {
      id,
      kind: 'herb',
      name: herb.name,
      lon: fixed.lon,
      lat: fixed.lat,
      info,
      accent: HERB_ACCENT,
      accent2: HERB_ACCENT2,
      pill: false,
    };
    byId.set(id, herb);

    if (!adcode2) continue;
    const bucket = byProvince.get(adcode2);
    if (bucket) bucket.push(item);
    else byProvince.set(adcode2, [item]);
  }

  // 同一省内多个草药常共用概念地图上的近似坐标，叠在一起就"糊成一团、看不见"。
  // 这里对过近的点做很小的螺旋偏移把它们散开（<0.2°，省内尺度几像素~几十像素，不影响归属判断）。
  for (const bucket of byProvince.values()) spreadCoincidentPoints(bucket);

  return { byProvince, byId };
}

/** 视为"重合"的最小间距（经/纬度差，单位：度） */
const SPREAD_MIN_DEG = 0.42;/** 每次向外推的距离（度） */
const SPREAD_STEP_DEG = 0.16;
/** 黄金角：相邻偏移方向差 137.5°，避免散开后排成一条直线 */
const GOLDEN_ANGLE = 2.39996;

/**
 * 把同一省内彼此过近的点位沿螺旋方向散开。
 * 只在"显示层"调整坐标，不修改业务数据的归属关系（regionId）。
 */
function spreadCoincidentPoints(items: PoiItem[]): void {
  if (items.length < 2) return;
  const placed: Array<{ lon: number; lat: number }> = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let lon = it.lon;
    let lat = it.lat;
    for (let attempt = 1; attempt <= 12; attempt++) {
      const tooClose = placed.some(
        (p) => Math.abs(p.lon - lon) < SPREAD_MIN_DEG && Math.abs(p.lat - lat) < SPREAD_MIN_DEG,
      );
      if (!tooClose) break;
      const ang = attempt * GOLDEN_ANGLE + i * 0.6;
      const rad = SPREAD_STEP_DEG * Math.ceil(attempt / 2);
      lon = it.lon + Math.cos(ang) * rad;
      lat = it.lat + Math.sin(ang) * rad * 0.82; // 纬度方向压缩，视觉上更接近圆形分布
    }
    it.lon = lon;
    it.lat = lat;
    placed.push({ lon, lat });
  }
}

export interface CountyPois {
  items: PoiItem[];
  byId: Map<string, YaoCounty>;
}

/**
 * 取指定省（2 位 adcode）下辖的瑶族县点位；省份没有数据时返回空集合（不抛异常）。
 */
export function buildCountyPois(
  provinceAdcode2: string,
  hierarchy: AdminHierarchy,
  countyList: YaoCounty[] = allCounties,
): CountyPois {
  const items: PoiItem[] = [];
  const byId = new Map<string, YaoCounty>();
  const agg = hierarchy?.byProvinceAdcode?.get(provinceAdcode2);
  const counties = agg?.counties ?? [];
  // 以聚合结果为权威来源；countyList 仅用于兜底（聚合缺失时按 provinceCode 前缀过滤）
  const source = counties.length
    ? counties
    : countyList.filter((c) => (c?.provinceCode ?? '').startsWith(provinceAdcode2));

  for (const county of source) {
    if (!county) continue;
    const [a, b] = COUNTY_CATEGORY_COLORS[county.category] ?? COUNTY_CATEGORY_COLORS.development;
    const id = `county-${county.code}`;
    items.push({
      id,
      kind: 'county',
      name: county.name,
      lon: county.centerLng,
      lat: county.centerLat,
      info: [
        `瑶族机构：${county.institutionCount} 家`,
        `瑶药：${county.herbVarieties?.length ?? 0} 种`,
        '<span style="color:#059669">点击查看县详情</span>',
      ],
      accent: a,
      accent2: b,
      pill: true,
      // 药丸右侧直接显示机构数：省内视图点少，靠 hover 读信息会让画面显得空
      badge: String(county.institutionCount ?? 0),
    });
    byId.set(id, county);
  }

  return { items, byId };
}
