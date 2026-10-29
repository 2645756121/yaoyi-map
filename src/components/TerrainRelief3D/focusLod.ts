/**
 * focusLod.ts —— 聚焦模式的细节分级（LOD）参数计算（纯函数，便于单元测试）
 *
 * 思路：地形是**一整块**由高程图派生的网格，"逐省细节"无法直接表达，
 * 因此采用"**全局降级 + 焦点省高精度补片**"的组合：
 *   - 聚焦某省时：把全局网格降到 `FOCUS_GLOBAL_SEGMENTS`（三角面与显存明显下降，
 *     此时相机已贴近该省，远处降级的观感差异不可见）；
 *   - 同时在焦点省范围内叠加一块**按源高程图精细采样**的补片（分段数按包围盒比例分配，
 *     单元尺寸远小于全局网格），把该省的浮雕细节提升到远高于全局的水平；
 *   - 退出聚焦时：先恢复全局网格，再把补片淡出销毁（平滑过渡）。
 */

/** 聚焦时全局网格降到的最小段数（用户设定更小则保持更小，不反向提升） */
export const FOCUS_GLOBAL_SEGMENTS = 384;

/** 焦点省补片较长边的分段数上限（再高也受源高程图分辨率限制，收益递减） */
export const FOCUS_PATCH_MAX_SEGMENTS = 288;
/** 焦点省补片较短边的分段数下限（避免狭长省份另一轴过粗） */
export const FOCUS_PATCH_MIN_SEGMENTS = 48;
/** 补片淡出时长（毫秒），要求 300–500ms 内完成且无闪烁 */
export const FOCUS_PATCH_FADE_MS = 260;

export interface PatchGrid {
  segX: number;
  segY: number;
}

function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.round(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(Math.max(n, lo), hi);
}

/**
 * 聚焦时的全局网格段数：只降不升（用户本来设得更低时不要反而加重）。
 */
export function computeFocusGlobalSegments(baseSegments: number): number {
  const base = Number.isFinite(baseSegments) ? Math.max(1, Math.round(baseSegments)) : FOCUS_GLOBAL_SEGMENTS;
  return Math.min(base, FOCUS_GLOBAL_SEGMENTS);
}

/**
 * 焦点省补片的分段数：让补片单元接近正方形 —— 较长边取 `maxSegments`，
 * 较短边按世界尺寸比例换算并夹取到 [minSegments, maxSegments]。
 * 退化输入（0/负/NaN）一律回退为最小分段，保证补片始终可构建。
 */
export function computePatchGrid(
  spanX: number,
  spanZ: number,
  maxSegments: number = FOCUS_PATCH_MAX_SEGMENTS,
  minSegments: number = FOCUS_PATCH_MIN_SEGMENTS,
): PatchGrid {
  const maxSeg = clampInt(maxSegments, 8, 1024);
  const minSeg = clampInt(minSegments, 2, maxSeg);
  const sx = Number.isFinite(spanX) ? Math.abs(spanX) : 0;
  const sz = Number.isFinite(spanZ) ? Math.abs(spanZ) : 0;
  if (sx <= 0 && sz <= 0) return { segX: minSeg, segY: minSeg };

  if (sx >= sz) {
    return { segX: maxSeg, segY: clampInt(maxSeg * (sz / Math.max(sx, 1e-9)), minSeg, maxSeg) };
  }
  return { segX: clampInt(maxSeg * (sx / Math.max(sz, 1e-9)), minSeg, maxSeg), segY: maxSeg };
}

/** 聚焦 LOD 的对外状态（用于 UI 展示当前细节等级） */
export interface FocusLodState {
  focused: boolean;
  /** 当前全局网格段数 */
  globalSegments: number;
  /** 焦点省补片分段（未聚焦为 null） */
  patchSegX: number | null;
  patchSegY: number | null;
}
