import { describe, expect, it } from 'vitest';
import { buildTintField, mixTint, sampleTint, MAX_LIFT } from './terrainTint';

describe('terrainTint —— 地形晕染的场与混色', () => {
  it('单核场：核中心采样≈1，远处≈0', () => {
    const f = buildTintField([{ u: 0.5, v: 0.5, weight: 1 }], 128, 0.05);
    const center = sampleTint(f, 0.5, 0.5);
    expect(center).toBeGreaterThan(0.95);
    expect(center).toBeLessThanOrEqual(1.0001);
    // 3σ 之外应基本为 0
    expect(sampleTint(f, 0.5 + 0.4, 0.5)).toBeLessThan(0.02);
  });

  it('双核场：各自中心都接近峰值（重叠处归一化后仍可读）', () => {
    const f = buildTintField(
      [
        { u: 0.3, v: 0.6, weight: 1 },
        { u: 0.7, v: 0.4, weight: 1 },
      ],
      128,
      0.05,
    );
    expect(sampleTint(f, 0.3, 0.6)).toBeGreaterThan(0.9);
    expect(sampleTint(f, 0.7, 0.4)).toBeGreaterThan(0.9);
    // 两点中间应低于两侧峰值
    expect(sampleTint(f, 0.5, 0.5)).toBeLessThan(0.9);
  });

  it('权重全部为 0 / 空点集：返回全 0 场，不产生 NaN', () => {
    const empty = buildTintField([], 64);
    expect(sampleTint(empty, 0.5, 0.5)).toBe(0);
    const zero = buildTintField([{ u: 0.4, v: 0.4, weight: 0 }], 64);
    expect(sampleTint(zero, 0.4, 0.4)).toBe(0);
  });

  it('非法输入不破坏场（NaN 坐标被跳过）', () => {
    const f = buildTintField([{ u: NaN, v: 0.5, weight: 1 }, { u: 0.5, v: 0.5, weight: 1 }], 64);
    expect(sampleTint(f, 0.5, 0.5)).toBeGreaterThan(0.9);
  });

  it('采样钳制：超出 0~1 的 uv 不越界、不抛错', () => {
    const f = buildTintField([{ u: 0.5, v: 0.5, weight: 1 }], 64);
    expect(() => sampleTint(f, -3, 9)).not.toThrow();
    expect(Number.isFinite(sampleTint(f, -3, 9))).toBe(true);
  });

  it('提亮：t=1 时三个通道等比放大 (1 + MAX_LIFT)，且不超过 255', () => {
    const base: [number, number, number] = [110, 130, 90];
    const rgb: [number, number, number] = [...base];
    mixTint(rgb, 1);
    for (let i = 0; i < 3; i++) expect(rgb[i]).toBeCloseTo(base[i] * (1 + MAX_LIFT), 5);
    // 提亮不改变色相比例（通道比值保持一致）
    expect(rgb[1] / rgb[0]).toBeCloseTo(base[1] / base[0], 3);
    // 已经接近白色的颜色不会被放大到越界
    const bright: [number, number, number] = [250, 250, 250];
    mixTint(bright, 1);
    expect(Math.max(...bright)).toBeLessThanOrEqual(255);
  });

  it('混色：t=0 不改变颜色（零开销路径）', () => {
    const rgb: [number, number, number] = [100, 120, 80];
    mixTint(rgb, 0);
    expect(rgb).toEqual([100, 120, 80]);
  });

  it('混色：alphaScale=0 等价于关闭', () => {
    const rgb: [number, number, number] = [100, 120, 80];
    mixTint(rgb, 1, 0);
    expect(rgb).toEqual([100, 120, 80]);
  });
});
