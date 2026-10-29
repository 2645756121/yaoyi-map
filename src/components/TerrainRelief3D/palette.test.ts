/**
 * palette.test.ts —— 高程分层设色（palette）的单元测试
 * 覆盖：海面判定、停靠点取样、中间值线性插值、超高钳制、图例与海面 CSS。
 */
import { describe, it, expect } from 'vitest';
import {
  elevationToRgb,
  paletteLegend,
  SEA_LEVEL,
  SEA_COLOR,
  SEA_COLOR_CSS,
} from './palette';

type Rgb = [number, number, number];

/** 与源码 STOPS 对应的文档化停靠点（用于校验） */
const STOPS: Array<{ h: number; c: Rgb }> = [
  { h: 0, c: [126, 175, 133] },
  { h: 200, c: [152, 191, 122] },
  { h: 600, c: [178, 196, 112] },
  { h: 1200, c: [199, 178, 112] },
  { h: 2200, c: [189, 143, 98] },
  { h: 3500, c: [163, 118, 96] },
  { h: 4800, c: [196, 180, 172] },
  { h: 6000, c: [233, 238, 244] },
  { h: 8849, c: [252, 254, 255] },
];

function expectRgbClose(actual: Rgb, expected: Rgb, tol = 1) {
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(tol);
  }
}

describe('elevationToRgb：海面判定', () => {
  it('高程 ≤ SEA_LEVEL 返回海面颜色（含 0 与阈值本身）', () => {
    expectRgbClose(elevationToRgb(0), SEA_COLOR, 0);
    expectRgbClose(elevationToRgb(0.5), SEA_COLOR, 0);
    expectRgbClose(elevationToRgb(SEA_LEVEL), SEA_COLOR, 0);
  });

  it('负高程返回海面颜色', () => {
    expectRgbClose(elevationToRgb(-100), SEA_COLOR, 0);
    expectRgbClose(elevationToRgb(-1e6), SEA_COLOR, 0);
  });
});

describe('elevationToRgb：停靠点取样', () => {
  it('h=1（刚出海面，属富陆段起点的极小插值）接近 0 停靠点颜色（±1）', () => {
    expectRgbClose(elevationToRgb(1), STOPS[0].c, 1);
  });

  it('每个陆地停靠点高程都返回该停靠点颜色（±1）', () => {
    // h=0 属于海面（elevation ≤ SEA_LEVEL），已在上面单独覆盖，这里从第一个陆地停靠点开始
    for (const stop of STOPS.slice(1)) {
      expectRgbClose(elevationToRgb(stop.h), stop.c, 1);
    }
  });
});

describe('elevationToRgb：中间值线性插值', () => {
  it('相邻停靠点区间的中点：各通道等于两停靠点的均值', () => {
    // 400 = (200 + 600) / 2
    const mid1 = elevationToRgb(400);
    for (let i = 0; i < 3; i++) {
      expect(mid1[i]).toBeCloseTo((STOPS[1].c[i] + STOPS[2].c[i]) / 2, 6);
    }
    // 900 = (600 + 1200) / 2
    const mid2 = elevationToRgb(900);
    for (let i = 0; i < 3; i++) {
      expect(mid2[i]).toBeCloseTo((STOPS[2].c[i] + STOPS[3].c[i]) / 2, 6);
    }
  });

  it('插值结果落在相邻两停靠点之间（逐通道）', () => {
    const c = elevationToRgb(2500); // 介于 2200 与 3500
    const a = STOPS[4].c;
    const b = STOPS[5].c;
    for (let i = 0; i < 3; i++) {
      const lo = Math.min(a[i], b[i]);
      const hi = Math.max(a[i], b[i]);
      expect(c[i]).toBeGreaterThanOrEqual(lo - 1e-6);
      expect(c[i]).toBeLessThanOrEqual(hi + 1e-6);
    }
  });
});

describe('elevationToRgb：极值钳制与 out 复用', () => {
  it('高于最后停靠点则钳制到最后一个颜色', () => {
    expectRgbClose(elevationToRgb(20000), STOPS[STOPS.length - 1].c, 1);
    expectRgbClose(elevationToRgb(8849.001), STOPS[STOPS.length - 1].c, 1);
  });

  it('复用的 out 数组被返回（同一引用）', () => {
    const out: Rgb = [0, 0, 0];
    const ret = elevationToRgb(1000, out);
    expect(ret).toBe(out);
  });
});

describe('elevationToRgb：非法高程兜底', () => {
  it('NaN 按海面处理，不会落到最高档雪白', () => {
    expectRgbClose(elevationToRgb(Number.NaN), SEA_COLOR, 0);
  });

  it('-Infinity 按海面处理，+Infinity 按最高档处理', () => {
    expectRgbClose(elevationToRgb(-Infinity), SEA_COLOR, 0);
    expectRgbClose(elevationToRgb(Infinity), STOPS[STOPS.length - 1].c, 0);
  });
});

describe('paletteLegend 与海面 CSS', () => {
  it('图例长度等于停靠点数量，且每项 css 匹配 rgb(r, g, b)', () => {
    const legend = paletteLegend();
    expect(legend).toHaveLength(STOPS.length);
    for (let i = 0; i < legend.length; i++) {
      expect(legend[i].elevation).toBe(STOPS[i].h);
      expect(legend[i].css).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    }
    // 首尾抽检具体字符串
    expect(legend[0].css).toBe('rgb(126, 175, 133)');
    expect(legend[legend.length - 1].css).toBe('rgb(252, 254, 255)');
  });

  it('SEA_COLOR_CSS 格式与取值正确', () => {
    expect(SEA_COLOR_CSS).toBe('rgb(96, 134, 172)');
    expect(SEA_COLOR_CSS).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
});
