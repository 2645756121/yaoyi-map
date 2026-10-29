/**
 * heightmap.test.ts —— 高程图双线性采样（sampleElevation）的单元测试
 * 覆盖：网格点取样、单元中心双线性、u/v 越界钳制、1×1 与单行退化输入。
 */
import { describe, it, expect } from 'vitest';
import { sampleElevation, type Heightmap } from './heightmap';

/** 构造一个最小可用的 Heightmap 对象字面量 */
function makeHeightmap(
  width: number,
  height: number,
  values: number[],
  bounds: [number, number, number, number] = [73, 17.5, 135.5, 54],
): Heightmap {
  return {
    width,
    height,
    data: new Float32Array(values),
    meta: {
      name: 'test',
      encoding: 'terrarium',
      projection: 'mercator',
      bounds,
      width,
      height,
      aspect: width / Math.max(height, 1),
      minElevation: Math.min(...values),
      maxElevation: Math.max(...values),
      meanElevation: values.reduce((s, v) => s + v, 0) / values.length,
      seaPixelRatio: 0,
      source: 'synthetic',
      generatedBy: 'unit-test',
    },
  };
}

// 3×2 网格（行优先，row 0 = 北边缘）
// 北：0  10  20
// 南：30 40  50
const hm32 = makeHeightmap(3, 2, [0, 10, 20, 30, 40, 50]);

describe('sampleElevation：精确网格点', () => {
  it('四个角点与边中点取样正确', () => {
    expect(sampleElevation(hm32, 0, 0)).toBe(0); // 西北
    expect(sampleElevation(hm32, 1, 0)).toBe(20); // 东北
    expect(sampleElevation(hm32, 0, 1)).toBe(30); // 西南
    expect(sampleElevation(hm32, 1, 1)).toBe(50); // 东南
    expect(sampleElevation(hm32, 0.5, 0)).toBe(10); // 上边中点
    expect(sampleElevation(hm32, 0, 0.5)).toBe(15); // 左边中点
  });
});

describe('sampleElevation：单元中心双线性', () => {
  it('u=v=0.5 为四个角点的平均（25）', () => {
    expect(sampleElevation(hm32, 0.5, 0.5)).toBeCloseTo(25, 10);
  });
});

describe('sampleElevation：u/v 钳制', () => {
  it('u/v < 0 时等于边界值，且无 NaN', () => {
    expect(sampleElevation(hm32, -5, 0)).toBe(sampleElevation(hm32, 0, 0));
    expect(sampleElevation(hm32, -5, 0.5)).toBe(sampleElevation(hm32, 0, 0.5));
    expect(sampleElevation(hm32, 0.5, -5)).toBe(sampleElevation(hm32, 0.5, 0));
    expect(Number.isNaN(sampleElevation(hm32, -5, -5))).toBe(false);
  });

  it('u/v > 1 时等于边界值，且无 NaN', () => {
    expect(sampleElevation(hm32, 9, 0)).toBe(sampleElevation(hm32, 1, 0));
    expect(sampleElevation(hm32, 9, 1)).toBe(sampleElevation(hm32, 1, 1));
    expect(sampleElevation(hm32, 0.5, 9)).toBe(sampleElevation(hm32, 0.5, 1));
    expect(Number.isNaN(sampleElevation(hm32, 9, 9))).toBe(false);
  });
});

describe('sampleElevation：退化输入', () => {
  it('1×1 高程图任意 uv 都返回唯一值', () => {
    const hm11 = makeHeightmap(1, 1, [42]);
    expect(sampleElevation(hm11, 0, 0)).toBe(42);
    expect(sampleElevation(hm11, 0.5, 0.5)).toBe(42);
    expect(sampleElevation(hm11, 1, 1)).toBe(42);
    expect(Number.isNaN(sampleElevation(hm11, 2, -2))).toBe(false);
  });

  it('单行高程图不越界/不抛错', () => {
    const hmRow = makeHeightmap(3, 1, [1, 2, 3]);
    expect(sampleElevation(hmRow, 0, 0)).toBe(1);
    expect(sampleElevation(hmRow, 1, 0)).toBe(3);
    // 行退化为 1 行时，v 被钳到 0，取该行插值
    expect(sampleElevation(hmRow, 0.5, 0.5)).toBe(2);
    expect(sampleElevation(hmRow, 0.5, 1)).toBe(2);
  });
});
