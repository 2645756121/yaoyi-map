/**
 * palette.ts —— 高程分层设色（hypsometric tint）
 *
 * 职责：把「高程（米）」映射为「颜色」，用于地形网格的顶点着色与图例渲染。
 * 色带按自然地貌规律设置：低地绿 → 丘陵黄绿 → 山地棕黄 → 高山棕褐 → 雪线以上灰白 → 极高山雪白。
 *
 * 说明：返回的是 sRGB 空间的 0-255 分量；Three.js 侧在写入顶点色时会转换到线性工作空间，
 * 避免颜色被二次 gamma 处理而发灰。
 */

export type Rgb = [number, number, number];

/** 色带停靠点：高程(米) → sRGB 颜色 */
const STOPS: Array<{ h: number; c: Rgb }> = [
  { h: 0, c: [126, 175, 133] },      // 低地 / 平原
  { h: 200, c: [152, 191, 122] },    // 缓丘
  { h: 600, c: [178, 196, 112] },    // 丘陵
  { h: 1200, c: [199, 178, 112] },   // 低山
  { h: 2200, c: [189, 143, 98] },    // 中山
  { h: 3500, c: [163, 118, 96] },    // 高山
  { h: 4800, c: [196, 180, 172] },   // 雪线附近
  { h: 6000, c: [233, 238, 244] },   // 雪山
  { h: 8849, c: [252, 254, 255] },   // 极高山
];

/** 海面（高程 ≤ SEA_LEVEL）统一颜色 */
export const SEA_COLOR: Rgb = [96, 134, 172];
/** 判定为海面的高程阈值（米） */
export const SEA_LEVEL = 0.5;

/**
 * 高程 → RGB（线性插值）。
 * 为减少 GC，结果写入调用方提供的 out 数组。
 */
export function elevationToRgb(elev: number, out: Rgb = [0, 0, 0]): Rgb {
  if (!Number.isFinite(elev)) {
    // 非法高程（高程序列出现 NaN 时最可能命中）：NaN / -Infinity 按海面处理，
    // +Infinity 按最高色处理。否则所有比较都返回 false，会落到最后一档"极高山雪白"，
    // 表现为大片错误的白斑。
    const c = elev === Infinity ? STOPS[STOPS.length - 1].c : SEA_COLOR;
    out[0] = c[0];
    out[1] = c[1];
    out[2] = c[2];
    return out;
  }
  if (elev <= SEA_LEVEL) {
    out[0] = SEA_COLOR[0];
    out[1] = SEA_COLOR[1];
    out[2] = SEA_COLOR[2];
    return out;
  }
  if (elev <= STOPS[0].h) {
    out[0] = STOPS[0].c[0];
    out[1] = STOPS[0].c[1];
    out[2] = STOPS[0].c[2];
    return out;
  }
  for (let i = 1; i < STOPS.length; i++) {
    const a = STOPS[i - 1];
    const b = STOPS[i];
    if (elev <= b.h) {
      const t = (elev - a.h) / (b.h - a.h);
      out[0] = a.c[0] + (b.c[0] - a.c[0]) * t;
      out[1] = a.c[1] + (b.c[1] - a.c[1]) * t;
      out[2] = a.c[2] + (b.c[2] - a.c[2]) * t;
      return out;
    }
  }
  const last = STOPS[STOPS.length - 1];
  out[0] = last.c[0];
  out[1] = last.c[1];
  out[2] = last.c[2];
  return out;
}

/** 图例数据：{ 高程, css 颜色 }，供 UI 渲染色带 */
export function paletteLegend(): Array<{ elevation: number; css: string }> {
  return STOPS.map((s) => ({
    elevation: s.h,
    css: `rgb(${Math.round(s.c[0])}, ${Math.round(s.c[1])}, ${Math.round(s.c[2])})`,
  }));
}

/** 海面色（CSS），供图例与说明使用 */
export const SEA_COLOR_CSS = `rgb(${SEA_COLOR[0]}, ${SEA_COLOR[1]}, ${SEA_COLOR[2]})`;
