/**
 * terrainTint.ts —— 地形专题晕染（"药田晕染"）的纯计算层
 *
 * 思路：地形用**顶点色**上色（palette.elevationToRgb），颜色通道已被高程占用。
 * 因此这里不新增几何、也不做新的贴图，而是在 UV 空间叠一张**很淡的连续标量场**，
 * 逐顶点与高程色做一次混合：
 *
 *   rgb' = rgb * (1 + field(u,v) * MAX_LIFT)
 *
 * 为什么在 UV 空间：
 *   · 省界 alphaMap、聚焦补片都用 uv 定位，uv 空间与地表严格对齐；
 *   · 免去逐顶点做经纬投影，几十万顶点也不必额外开销。
 *
 * 场的形状：以县中心为核的高斯叠加（可理解为"每个县一圈光晕"），
 * 叠加后按最大值归一化到 0~1，保证强弱省之间相对可比。
 */

/** 一个核：UV 坐标 + 权重（0~1） */
export interface TintPoint {
  u: number;
  v: number;
  weight: number;
}

export interface TintField {
  w: number;
  h: number;
  /** 行优先：index = y * w + x，v 方向 0 = 北（与 uv 的 v 一致） */
  data: Float32Array;
}

/** 晕染色：品红偏玫红 —— 与绿/棕/白的高程色相拉开，压在任何地形上都能读出"叠加层" */
/** @deprecated 改为提亮编码后不再使用；保留导出以免外部引用报错 */
export const TINT_RGB: [number, number, number] = [255, 232, 170];
/** 混合强度上限：再高就会盖掉地形起伏的明暗 */
/** 提亮上限：0.55 = 最亮的县中心比原地形亮 55% */
export const MAX_LIFT = 0.55;

/**
 * 构建晕染场。
 * @param points 核（UV + 权重）
 * @param size   网格边长（越大越平滑，192 已足够，全国视角看不出栅格）
 * @param sigma  高斯半径（UV 单位；0.045 ≈ 全国宽度的 4.5%）
 */
export function buildTintField(points: TintPoint[], size = 192, sigma = 0.026): TintField {
  const n = Math.max(16, Math.round(size));
  const data = new Float32Array(n * n);
  const denom = 2 * sigma * sigma;

  for (const p of points) {
    if (!p || !Number.isFinite(p.u) || !Number.isFinite(p.v)) continue;
    const wgt = Number.isFinite(p.weight) ? Math.max(0, p.weight) : 0;
    if (wgt <= 0) continue;

    // 只遍历落在 3σ 内的格子，避免 192² × N 的全量扫描
    const span = Math.ceil((sigma * 3) * n);
    const cx = Math.round(p.u * (n - 1));
    const cy = Math.round(p.v * (n - 1));
    const x0 = Math.max(0, cx - span);
    const x1 = Math.min(n - 1, cx + span);
    const y0 = Math.max(0, cy - span);
    const y1 = Math.min(n - 1, cy + span);

    for (let y = y0; y <= y1; y++) {
      const dy = y / (n - 1) - p.v;
      for (let x = x0; x <= x1; x++) {
        const dx = x / (n - 1) - p.u;
        const d2 = dx * dx + dy * dy;
        data[y * n + x] += wgt * Math.exp(-d2 / denom);
      }
    }
  }

  // 归一化到 0~1，再压一次对比
  let max = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
  if (max > 0) {
    // 多个县的高斯会互相叠加，若直接线性显示，峰值会被"重叠区"拉平，
    // 导致大多数县看起来都很淡（实测 ΔG 仅 -5）。这里统一做一次对比压缩。
    for (let i = 0; i < data.length; i++) data[i] = Math.pow(data[i] / max, 0.7);
  }

  return { w: n, h: n, data };
}

/** 双线性采样（越界钳到边界，返回 0~1） */
export function sampleTint(field: TintField, u: number, v: number): number {
  const { w, h, data } = field;
  if (w < 2 || h < 2) return 0;

  const fx = Math.min(Math.max(u, 0), 1) * (w - 1);
  const fy = Math.min(Math.max(v, 0), 1) * (h - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const a = data[y0 * w + x0];
  const b = data[y0 * w + x1];
  const c = data[y1 * w + x0];
  const d = data[y1 * w + x1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/**
 * 把晕染叠到高程色上（就地修改 rgb，0~255）。
 *
 * 编码用**提亮**而不是染色：
 *   实测把品红/暖色以 0.30~0.50 的 alpha 混到绿色地形上会变成"泥褐色"，
 *   而按密度向白色方向提亮只会让该区域像被"照亮"，色相不变、不发脏。
 *
 * @param t 采样值 0~1
 * @param alphaScale 整体强度（0 关闭，1 用满 MAX_LIFT）
 */
export function mixTint(rgb: [number, number, number], t: number, alphaScale = 1): void {
  const k = Math.min(1, Math.max(0, t)) * MAX_LIFT * Math.max(0, alphaScale);
  if (k <= 0.003) return;
  const gain = 1 + k;
  rgb[0] = Math.min(255, rgb[0] * gain);
  rgb[1] = Math.min(255, rgb[1] * gain);
  rgb[2] = Math.min(255, rgb[2] * gain);
}
