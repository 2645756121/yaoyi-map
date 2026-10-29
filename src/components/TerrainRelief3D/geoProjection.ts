/**
 * geoProjection.ts —— 经纬度 ⇄ 浮雕模型坐标 的投影工具
 *
 * 关键约束：必须与高程图使用**同一套 Web Mercator 投影**（见 scripts/export_relief_heightmap.py）。
 *   高程图各行/列按墨卡托等距分布，bounds 的 4 个边即对应模型的 4 条边：
 *     lon = west  → u = 0 → x = -modelWidth/2
 *     lon = east  → u = 1 → x = +modelWidth/2
 *     lat = north → v = 0 → z = -depth/2      （北边缘在 -Z 方向）
 *     lat = south → v = 1 → z = +depth/2
 *   只有严格遵守这一映射，边界线才能与地形表面精确贴合。
 *
 * 说明：GeoJSON 使用经纬度坐标；这里只做「投影 + 归一化」，不做任何地理坐标纠偏。
 */

const DEG = Math.PI / 180;

export interface ProjectionBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Projection {
  /** 投影覆盖的经纬范围（即高程图的四至） */
  bounds: ProjectionBounds;
  /** 经纬度 → 模型 XZ 平面坐标（世界单位） */
  toModel(lon: number, lat: number): { x: number; z: number };
  /** 模型 XZ 平面坐标 → 经纬度 */
  toLonLat(x: number, z: number): { lon: number; lat: number };
  /** 经纬度 → 归一化纹理坐标（u 东为正、v 南为正），与高程图采样一致 */
  toUV(lon: number, lat: number): { u: number; v: number };
  /** 归一化纹理坐标 → 经纬度（toUV 的逆运算） */
  uvToLonLat(u: number, v: number): { lon: number; lat: number };
}

/** 经度 → 全球 Web Mercator 归一化 X（0~1，0 = 180°W） */
function mercX(lon: number): number {
  return (lon + 180) / 360;
}

/** 纬度 → 全球 Web Mercator 归一化 Y（0~1，0 = 北极） */
function mercY(lat: number): number {
  const s = Math.sin(Math.min(Math.max(lat, -89.5), 89.5) * DEG);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}

function invMercX(x: number): number {
  return x * 360 - 180;
}

function invMercY(y: number): number {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / DEG;
}

/**
 * 创建投影器。depth 由高度图纵横比推导（modelWidth / aspect），保证模型不南北拉伸。
 */
export function createProjection(
  bounds: ProjectionBounds,
  modelWidth: number,
  depth: number,
): Projection {
  const mx0 = mercX(bounds.west);
  const mx1 = mercX(bounds.east);
  const my0 = mercY(bounds.north); // 北侧墨卡托 Y 较小
  const my1 = mercY(bounds.south);
  const spanX = mx1 - mx0 || 1e-9;
  const spanY = my1 - my0 || 1e-9;

  const toUV = (lon: number, lat: number) => ({
    u: (mercX(lon) - mx0) / spanX,
    v: (mercY(lat) - my0) / spanY,
  });

  return {
    bounds,
    toUV,
    toModel(lon, lat) {
      const { u, v } = toUV(lon, lat);
      return { x: (u - 0.5) * modelWidth, z: (v - 0.5) * depth };
    },
    toLonLat(x, z) {
      const u = x / modelWidth + 0.5;
      const v = z / depth + 0.5;
      return { lon: invMercX(mx0 + u * spanX), lat: invMercY(my0 + v * spanY) };
    },
    uvToLonLat(u, v) {
      return { lon: invMercX(mx0 + u * spanX), lat: invMercY(my0 + v * spanY) };
    },
  };
}

/**
 * 点在多边形环内判定（射线法 / even-odd）。
 * @param lon 经度
 * @param lat 纬度
 * @param ring 环坐标数组 [[lon, lat], ...]（首尾可不闭合）
 */
export function pointInRing(lon: number, lat: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
