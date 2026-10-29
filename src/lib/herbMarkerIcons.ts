/**
 * herbMarkerIcons.ts —— 草药点位的手绘图标记集
 *
 * 素材来源：16 张透明底手绘植物插画，已统一处理为 128×128（按内容裁切 + 6% 留白居中），
 * 放在 `public/icons/herbs/h01.png ~ h16.png`。
 *
 * 为什么随机：同一省份内往往有多个草药点位，全部用同一图标会显得像"复制粘贴"；
 * 随机分配后，地形上的点位更有"手绘地图"的生气。随机发生在 DOM 创建时（每次进入省份重排），
 * 因此不会在渲染过程中跳动。
 */
import { assetPath } from './assetPath';

/** 全部可用标记图标（按文件名顺序，h01 – h16） */
export const HERB_MARKER_ICONS: string[] = Array.from({ length: 16 }, (_, i) =>
  assetPath(`icons/herbs/h${String(i + 1).padStart(2, '0')}.png`),
);

/** 随机取一个草药标记图标 */
export function pickHerbMarkerIcon(): string {
  return HERB_MARKER_ICONS[(Math.random() * HERB_MARKER_ICONS.length) | 0];
}
