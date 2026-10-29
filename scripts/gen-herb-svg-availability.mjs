#!/usr/bin/env node
/**
 * gen-herb-svg-availability.mjs
 *
 * 扫描 public/herbs/*.svg 的文件名，生成 src/lib/herbSvgAvailability.ts。
 *
 * 为什么需要生成而不是运行时探测：
 *   浏览器无法同步判断某个静态文件是否存在，因此 getHerbImageFallback()
 *   必须依赖一份**编译期已知**的清单来决定能否降级到本地 SVG。
 *
 * 何时需要重新运行：
 *   在 public/herbs/ 中新增或删除 SVG 之后（例如为新草药补充图鉴）。
 *   否则新 SVG 不会被用作兜底图。
 *
 * 用法：node scripts/gen-herb-svg-availability.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SVG_DIR = path.join(ROOT, 'public', 'herbs');
const OUT = path.join(ROOT, 'src', 'lib', 'herbSvgAvailability.ts');

const files = fs
  .readdirSync(SVG_DIR)
  .filter((f) => f.toLowerCase().endsWith('.svg'))
  .map((f) => path.basename(f, '.svg'))
  .sort();

if (files.length === 0) {
  console.error(`[gen-herb-svg-availability] 在 ${SVG_DIR} 未找到任何 .svg`);
  process.exit(1);
}

const lines = [
  '/**',
  ' * 本地草药图鉴 SVG 可用清单（自动生成，请勿手工编辑）',
  ' *',
  ` * 生成方式：扫描 public/herbs/*.svg 的文件名（不含扩展名），共 ${files.length} 个。`,
  ' * 生成脚本：`node scripts/gen-herb-svg-availability.mjs`（在 public/herbs/ 增删 SVG 后需重新运行）。',
  ' *',
  ' * 为什么需要这份清单：',
  ' *   `getHerbImageFallback()` 必须在远程图加载失败时给出本地兜底 URL，',
  ' *   但浏览器端无法同步探测文件是否存在。此前该函数只对存在于',
  ' *   HERB_IMAGE_OVERRIDES 中的 id 返回兜底，导致**另外 27 味已自备 SVG 的草药**',
  ' *   白白退化成占位图标。改为对照本清单后，兜底覆盖全部实际存在的 SVG。',
  ' */',
  'export const AVAILABLE_HERB_SVGS: ReadonlySet<string> = new Set([',
  ...files.map((f) => `  '${f}',`),
  ']);',
  '',
];

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(
  `[gen-herb-svg-availability] 已写入 ${path.relative(ROOT, OUT)}（${files.length} 个 SVG）`
);
