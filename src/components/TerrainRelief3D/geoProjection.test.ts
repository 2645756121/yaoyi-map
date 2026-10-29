/**
 * geoProjection.test.ts —— 经纬度 ⇄ 模型坐标投影的单元测试
 * 覆盖：边界角点映射、UV 边界值、投影往返、纬度钳制、点在多边形内判定（射线法）。
 */
import { describe, it, expect } from 'vitest';
import { createProjection, pointInRing } from './geoProjection';

const BOUNDS = { west: 73, south: 17.5, east: 135.5, north: 54 };
const MODEL_WIDTH = 100;
const ASPECT = 1.340282;
const DEPTH = MODEL_WIDTH / ASPECT;

const proj = createProjection(BOUNDS, MODEL_WIDTH, DEPTH);
const HALF_W = MODEL_WIDTH / 2;
const HALF_D = DEPTH / 2;

function close(a: number, b: number, tol = 1e-6) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
}

describe('createProjection.toModel', () => {
  it('把四至角点映射到模型外框（±宽/2、±深/2）', () => {
    // 西北角：lon=west, lat=north → x=-W/2, z=-D/2
    const nw = proj.toModel(BOUNDS.west, BOUNDS.north);
    close(nw.x, -HALF_W);
    close(nw.z, -HALF_D);

    // 东南角：lon=east, lat=south → x=+W/2, z=+D/2
    const se = proj.toModel(BOUNDS.east, BOUNDS.south);
    close(se.x, HALF_W);
    close(se.z, HALF_D);

    // 西南角 / 东北角
    const sw = proj.toModel(BOUNDS.west, BOUNDS.south);
    close(sw.x, -HALF_W);
    close(sw.z, HALF_D);
    const ne = proj.toModel(BOUNDS.east, BOUNDS.north);
    close(ne.x, HALF_W);
    close(ne.z, -HALF_D);
  });
});

describe('createProjection.toUV', () => {
  it('u 在 west=0 / east=1，v 在 north=0 / south=1', () => {
    close(proj.toUV(BOUNDS.west, 30).u, 0);
    close(proj.toUV(BOUNDS.east, 30).u, 1);
    close(proj.toUV(100, BOUNDS.north).v, 0);
    close(proj.toUV(100, BOUNDS.south).v, 1);
  });

  it('u 随经度增大而增大；v 随纬度增大而减小（北边缘 v=0）', () => {
    const a = proj.toUV(90, 25);
    const b = proj.toUV(120, 45);
    expect(a.u).toBeGreaterThan(0);
    expect(a.u).toBeLessThan(b.u);
    expect(b.u).toBeLessThanOrEqual(1);
    expect(a.v).toBeGreaterThan(0);
    expect(a.v).toBeLessThanOrEqual(1);
    // 墨卡托 v：纬度越高（越靠北）v 越小
    expect(b.v).toBeLessThan(a.v);
  });
});

describe('createProjection 往返一致性', () => {
  it('toModel → toLonLat 可还原原始经纬度（误差 < 1e-6）', () => {
    const points: Array<[number, number]> = [
      [73, 54],
      [135.5, 17.5],
      [100, 30],
      [110.25, 23.75],
      [90.1, 45.9],
      [125.77, 21.33],
    ];
    for (const [lon, lat] of points) {
      const { x, z } = proj.toModel(lon, lat);
      const back = proj.toLonLat(x, z);
      close(back.lon, lon);
      close(back.lat, lat);
    }
  });
});

describe('纬度钳制（±89.5）', () => {
  it('超出 ±89.5 的纬度不会产生 NaN/Infinity', () => {
    const extremeLat = [90, -90, 89.9, -89.9, 1000, -1000];
    for (const lat of extremeLat) {
      const m = proj.toModel(100, lat);
      expect(Number.isFinite(m.x)).toBe(true);
      expect(Number.isFinite(m.z)).toBe(true);
      const uv = proj.toUV(100, lat);
      expect(Number.isFinite(uv.u)).toBe(true);
      expect(Number.isFinite(uv.v)).toBe(true);
    }
  });

  it('极端模型坐标反投影同样保持有限值', () => {
    const far = proj.toLonLat(1e9, 1e9);
    expect(Number.isFinite(far.lon)).toBe(true);
    expect(Number.isFinite(far.lat)).toBe(true);
    const near = proj.toLonLat(-1e9, -1e9);
    expect(Number.isFinite(near.lon)).toBe(true);
    expect(Number.isFinite(near.lat)).toBe(true);
  });
});

describe('pointInRing（射线法 / even-odd）', () => {
  const square: Array<[number, number]> = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it('内部点为 true，外部点为 false', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
    expect(pointInRing(15, 15, square)).toBe(false);
    expect(pointInRing(-1, 5, square)).toBe(false);
    expect(pointInRing(5, -1, square)).toBe(false);
  });

  it('落在边/顶点上的行为（射线法不保证一致，此处记录实际结果）', () => {
    // 下边中点：命中左侧真实交点 → 判定为内
    expect(pointInRing(5, 0, square)).toBe(true);
    // 顶点 (0,0)：判定为内
    expect(pointInRing(0, 0, square)).toBe(true);
    // 顶点 (0,10) 与 (10,0)：因射线法把顶点归到上/左侧，判定为外
    expect(pointInRing(0, 10, square)).toBe(false);
    expect(pointInRing(10, 0, square)).toBe(false);
  });

  it('L 形凹多边形：缺口内的点必须为外', () => {
    const lShape: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 4],
      [4, 4],
      [4, 10],
      [0, 10],
    ];
    // 主体内
    expect(pointInRing(2, 2, lShape)).toBe(true);
    expect(pointInRing(2, 8, lShape)).toBe(true);
    // 缺口（右上被切掉的正方形）内
    expect(pointInRing(7, 7, lShape)).toBe(false);
    expect(pointInRing(9, 9, lShape)).toBe(false);
  });
});
