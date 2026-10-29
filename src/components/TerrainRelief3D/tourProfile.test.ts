import { describe, expect, it } from 'vitest';
import { createProjection } from './geoProjection';
import type { Heightmap } from './heightmap';
import { buildRouteProfile, haversineKm, nearestProfileIndex } from './tourProfile';
import { TOUR_NODES, TOUR_ROUTES } from './tourData';

/** 合成高程图：北低南高（100 → 1100 m），便于验证采样与极值 */
function makeHeightmap(size = 32): Heightmap {
  const data = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data[y * size + x] = 100 + (y / (size - 1)) * 1000;
    }
  }
  return {
    width: size,
    height: size,
    data,
    meta: {
      name: 'synthetic',
      encoding: 'terrarium',
      projection: 'mercator',
      bounds: [73, 17.5, 135.5, 54],
      width: size,
      height: size,
      aspect: 1,
      minElevation: 100,
      maxElevation: 1100,
      meanElevation: 600,
      seaPixelRatio: 0,
      source: 'test',
      generatedBy: 'test',
    },
  };
}

const projection = createProjection({ west: 73, south: 17.5, east: 135.5, north: 54 }, 100, 100);
const hm = makeHeightmap();

describe('tourProfile：沿线地形海拔剖面', () => {
  it('采样点数、里程单调递增，且总里程与站点里程一致', () => {
    const profile = buildRouteProfile(hm, projection, 120);
    expect(profile.points).toHaveLength(121);
    for (let i = 1; i < profile.points.length; i++) {
      expect(profile.points[i].distKm).toBeGreaterThanOrEqual(profile.points[i - 1].distKm);
    }
    expect(profile.totalKm).toBeGreaterThan(50);
    expect(profile.totalKm).toBeCloseTo(profile.points[profile.points.length - 1].distKm, 6);
    expect(profile.stationDistKm[profile.stationDistKm.length - 1]).toBeLessThanOrEqual(
      profile.totalKm + 1e-6,
    );
  });

  it('高程取自高程图真实值，极值落在数据范围内', () => {
    const profile = buildRouteProfile(hm, projection, 120);
    expect(profile.minElev).toBeGreaterThanOrEqual(100);
    expect(profile.maxElev).toBeLessThanOrEqual(1100);
    expect(profile.maxElev).toBeGreaterThan(profile.minElev);
    for (const p of profile.points) {
      expect(p.elev).toBeGreaterThanOrEqual(0);
    }
  });

  it('站点索引沿路线递增，且首站靠近起点、末站靠近终点', () => {
    const profile = buildRouteProfile(hm, projection, 160);
    expect(profile.stationIndices).toHaveLength(TOUR_ROUTES[0].nodeIds.length);
    for (let i = 1; i < profile.stationIndices.length; i++) {
      expect(profile.stationIndices[i]).toBeGreaterThan(profile.stationIndices[i - 1]);
      expect(profile.stationDistKm[i]).toBeGreaterThan(profile.stationDistKm[i - 1]);
    }
    const last = profile.points.length - 1;
    expect(profile.stationIndices[0]).toBeLessThan(last * 0.08);
    expect(profile.stationIndices[last === 0 ? 0 : profile.stationIndices.length - 1]).toBeGreaterThan(
      last * 0.92,
    );
  });

  it('最近采样点定位：站点自身经纬度能命中对应站点附近', () => {
    const profile = buildRouteProfile(hm, projection, 160);
    const first = TOUR_NODES[0];
    const idx = nearestProfileIndex(profile, first.lon, first.lat);
    expect(Math.abs(idx - profile.stationIndices[0])).toBeLessThanOrEqual(1);
    expect(nearestProfileIndex({ ...profile, points: [] }, 0, 0)).toBe(-1);
  });

  it('空路线返回空剖面，不抛错', () => {
    const profile = buildRouteProfile(hm, projection, 40, []);
    expect(profile.points).toEqual([]);
    expect(profile.stationIndices).toEqual([]);
    expect(profile.totalKm).toBe(0);
  });

  it('单节点路线（不足以构成曲线）返回空剖面，不产生 NaN', () => {
    // CatmullRomCurve3 需要 ≥2 个控制点；仅有 1 个时曾产生 NaN 剖面
    const profile = buildRouteProfile(hm, projection, 40, [TOUR_ROUTES[0].nodeIds[0]]);
    expect(profile.points).toEqual([]);
    expect(profile.stationIndices).toEqual([]);
    expect(profile.totalKm).toBe(0);
    expect(Number.isNaN(profile.minElev)).toBe(false);
    expect(Number.isNaN(profile.maxElev)).toBe(false);
  });

  it('全部为未知节点 id 时同样返回空剖面', () => {
    const profile = buildRouteProfile(hm, projection, 40, ['no-such-node', 'nope']);
    expect(profile.points).toEqual([]);
    expect(profile.totalKm).toBe(0);
  });

  it('球面距离：同点为 0，1 个纬度约 111 km', () => {
    expect(haversineKm(113, 24, 113, 24)).toBe(0);
    expect(haversineKm(113, 24, 113, 25)).toBeCloseTo(111.2, 0);
  });
});
