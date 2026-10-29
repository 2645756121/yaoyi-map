/**
 * tourProfile.ts —— 旅游路线的**沿线地形海拔剖面**（纯函数，便于单测）
 *
 * 与 tourOverlay 采用同一套采样规则：
 *   · 在 UV 空间用 Catmull-Rom 平滑（centripetal），保证剖面与地图上的丝带是**同一条线**；
 *   · 每个采样点用 sampleElevation 读取 Terrarium 高程图（真实地形数据，不做平滑或补造）；
 *   · 相邻点用球面距离累加，得到"距起点公里数"作为剖面横轴。
 *
 * 输出同时给出每个站点的最近采样索引与里程，供 UI 画站点刻度、点击跳转。
 */
import * as THREE from 'three';
import { sampleElevation, type Heightmap } from './heightmap';
import type { Projection } from './geoProjection';
import { TOUR_NODE_BY_ID, TOUR_ROUTES } from './tourData';

/** 默认采样点数（10 站 × 22 段 ≈ 200 点，足以还原粤北山地起伏） */
export const DEFAULT_PROFILE_SAMPLES = 200;

const EARTH_RADIUS_KM = 6371.0088;

export interface RouteProfilePoint {
  /** 归一化纹理坐标（与海拔采样同源） */
  u: number;
  v: number;
  lon: number;
  lat: number;
  /** 地形海拔（米，≥0） */
  elev: number;
  /** 距路线起点的球面距离（公里） */
  distKm: number;
}

export interface RouteProfile {
  points: RouteProfilePoint[];
  minElev: number;
  maxElev: number;
  totalKm: number;
  /** 每个站点的最近采样点下标（与 nodeIds 顺序一致） */
  stationIndices: number[];
  /** 每个站点的里程（公里），与 stationIndices 一一对应 */
  stationDistKm: number[];
}

/** 两点球面距离（公里） */
export function haversineKm(
  aLon: number,
  aLat: number,
  bLon: number,
  bLat: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(Math.sqrt(s), 1));
}

/**
 * 沿路线采样地形高程。
 * @param hm 高程图
 * @param projection 与浮雕同一套墨卡托投影
 * @param sampleCount 采样段数（返回 sampleCount + 1 个点）
 * @param nodeIds 路线节点顺序（默认取唯一一条旅游路线）
 */
export function buildRouteProfile(
  hm: Heightmap,
  projection: Projection,
  sampleCount: number = DEFAULT_PROFILE_SAMPLES,
  nodeIds: string[] = TOUR_ROUTES[0]?.nodeIds ?? [],
): RouteProfile {
  const uvPts: THREE.Vector3[] = [];
  const nodes = [];
  for (const id of nodeIds) {
    const node = TOUR_NODE_BY_ID.get(id);
    if (!node) continue;
    const uv = projection.toUV(node.lon, node.lat);
    uvPts.push(new THREE.Vector3(uv.u, 0, uv.v));
    nodes.push(node);
  }

  if (uvPts.length < 2) {
    // CatmullRomCurve3 至少需要 2 个控制点；只有 1 个时 getPoints() 会产生
    // NaN 坐标，进而让 elev / distKm 全是 NaN 并污染剖面图。此处一并兜底。
    return {
      points: [],
      minElev: 0,
      maxElev: 0,
      totalKm: 0,
      stationIndices: [],
      stationDistKm: [],
    };
  }

  const curve = new THREE.CatmullRomCurve3(uvPts, false, 'centripetal', 0.5);
  const count = Math.max(8, Math.round(sampleCount));
  const raw = curve.getPoints(count);

  const points: RouteProfilePoint[] = [];
  let distKm = 0;
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    const { lon, lat } = projection.uvToLonLat(p.x, p.z);
    const elev = Math.max(0, sampleElevation(hm, p.x, p.z));
    if (i > 0) {
      const prev = points[i - 1];
      distKm += haversineKm(prev.lon, prev.lat, lon, lat);
    }
    points.push({ u: p.x, v: p.z, lon, lat, elev, distKm });
  }

  let minElev = Infinity;
  let maxElev = -Infinity;
  for (const p of points) {
    if (p.elev < minElev) minElev = p.elev;
    if (p.elev > maxElev) maxElev = p.elev;
  }
  if (!Number.isFinite(minElev)) minElev = 0;
  if (!Number.isFinite(maxElev)) maxElev = 0;

  // 站点 → 最近采样点（UV 空间比较即可：曲线就是在 UV 空间生成的）
  const stationIndices: number[] = [];
  const stationDistKm: number[] = [];
  for (const node of nodes) {
    const uv = projection.toUV(node.lon, node.lat);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const du = points[i].u - uv.u;
      const dv = points[i].v - uv.v;
      const d = du * du + dv * dv;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    stationIndices.push(best);
    stationDistKm.push(points[best].distKm);
  }

  return {
    points,
    minElev,
    maxElev,
    totalKm: points[points.length - 1].distKm,
    stationIndices,
    stationDistKm,
  };
}

/** 找到离给定经纬度最近的剖面采样点下标（用于外部定位/联动） */
export function nearestProfileIndex(profile: RouteProfile, lon: number, lat: number): number {
  if (profile.points.length === 0) return -1;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < profile.points.length; i++) {
    const p = profile.points[i];
    const dLon = p.lon - lon;
    const dLat = p.lat - lat;
    const d = dLon * dLon + dLat * dLat;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
