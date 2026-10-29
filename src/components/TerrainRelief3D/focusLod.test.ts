/**
 * focusLod.test.ts —— 聚焦 LOD 参数计算的单元测试
 * 覆盖：全局段数「只降不升」、补片分段按纵横比分配、退化输入与自定义上下限。
 */
import { describe, it, expect } from 'vitest';
import {
  computeFocusGlobalSegments,
  computePatchGrid,
  FOCUS_GLOBAL_SEGMENTS,
  FOCUS_PATCH_MAX_SEGMENTS,
  FOCUS_PATCH_MIN_SEGMENTS,
} from './focusLod';

describe('computeFocusGlobalSegments', () => {
  it('base 512 → min(512, FOCUS_GLOBAL_SEGMENTS)', () => {
    expect(computeFocusGlobalSegments(512)).toBe(
      Math.min(512, FOCUS_GLOBAL_SEGMENTS),
    );
  });

  it('base 256 → 256（绝不反向提升）', () => {
    expect(computeFocusGlobalSegments(256)).toBe(256);
  });

  it('base 1024 → FOCUS_GLOBAL_SEGMENTS', () => {
    expect(computeFocusGlobalSegments(1024)).toBe(FOCUS_GLOBAL_SEGMENTS);
  });

  it('NaN / undefined → FOCUS_GLOBAL_SEGMENTS', () => {
    expect(computeFocusGlobalSegments(Number.NaN)).toBe(FOCUS_GLOBAL_SEGMENTS);
    expect(
      computeFocusGlobalSegments(undefined as unknown as number),
    ).toBe(FOCUS_GLOBAL_SEGMENTS);
  });

  it('下界保护：0 / 负数至少为 1', () => {
    expect(computeFocusGlobalSegments(0)).toBe(1);
    expect(computeFocusGlobalSegments(-10)).toBe(1);
  });
});

describe('computePatchGrid', () => {
  it('正方形 span(100,100) → 两边都取 maxSeg', () => {
    expect(computePatchGrid(100, 100)).toEqual({
      segX: FOCUS_PATCH_MAX_SEGMENTS,
      segY: FOCUS_PATCH_MAX_SEGMENTS,
    });
  });

  it('横向长条 span(100,50) → segX=maxSeg，segY≈maxSeg/2', () => {
    const g = computePatchGrid(100, 50);
    expect(g.segX).toBe(FOCUS_PATCH_MAX_SEGMENTS);
    expect(g.segY).toBeCloseTo(FOCUS_PATCH_MAX_SEGMENTS / 2, 0);
  });

  it('纵向长条 span(50,100) → segY=maxSeg，segX≈maxSeg/2', () => {
    const g = computePatchGrid(50, 100);
    expect(g.segY).toBe(FOCUS_PATCH_MAX_SEGMENTS);
    expect(g.segX).toBeCloseTo(FOCUS_PATCH_MAX_SEGMENTS / 2, 0);
  });

  it('极端纵横比 span(100,0.0001) → 短边钳到至少 FOCUS_PATCH_MIN_SEGMENTS', () => {
    const g = computePatchGrid(100, 0.0001);
    expect(g.segX).toBe(FOCUS_PATCH_MAX_SEGMENTS);
    expect(g.segY).toBe(FOCUS_PATCH_MIN_SEGMENTS);
  });

  it('退化输入 (0,0) / (NaN,NaN) → min/min 且无 NaN', () => {
    expect(computePatchGrid(0, 0)).toEqual({
      segX: FOCUS_PATCH_MIN_SEGMENTS,
      segY: FOCUS_PATCH_MIN_SEGMENTS,
    });
    const nan = computePatchGrid(Number.NaN, Number.NaN);
    expect(nan).toEqual({
      segX: FOCUS_PATCH_MIN_SEGMENTS,
      segY: FOCUS_PATCH_MIN_SEGMENTS,
    });
    expect(Number.isNaN(nan.segX)).toBe(false);
    expect(Number.isNaN(nan.segY)).toBe(false);
  });

  it('尊重自定义 max/min 参数', () => {
    const g = computePatchGrid(100, 50, 100, 10);
    expect(g.segX).toBe(100);
    expect(g.segY).toBe(50);
  });
});
