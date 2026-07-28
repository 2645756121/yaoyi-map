/**
 * assetPath - 运行时资源路径解析器
 *
 * 为什么需要：
 *   Vite 的 `base` 配置只会改写「编译时可识别」的静态资源引用
 *   （HTML 模板里的 <script src> / <link href> / `import` 语句等）。
 *   但是运行时通过 `fetch()`、`<img src>` 字符串拼接、或
 *   模板字面量拼出的路径（如 `\`/map/${code}.json\``）不会被改写。
 *
 *   这些路径在不同部署环境下需要不同前缀：
 *     - GitHub Pages 项目页：base = '/yaoyi-map/'   → 资源前缀 '/yaoyi-map/'
 *     - Vercel / Cloudflare / 自定义域名等根路径： base = '/'  → 资源无前缀
 *
 * 修复策略：
 *   - 通过 `import.meta.env.BASE_URL`（Vite 在构建时静态替换为 base 值）
 *   - 自动去除传入路径开头的 `/`，避免拼接出 `//map/...`
 *
 * 用法：
 *   fetch(assetPath('map/100000.json'))            // → fetch('/yaoyi-map/map/100000.json' or '/map/100000.json')
 *   <img src={assetPath('herbs/baishao.svg')} />   // 同上
 */

const BASE_URL: string = import.meta.env.BASE_URL;

/**
 * 返回拼接好 base 前缀的资源 URL
 *
 * @param path 相对路径，例如 'map/100000.json'、'herbs/baishao.svg'
 * @returns 带 base 前缀的 URL（始终以 '/' 开头）
 */
export function assetPath(path: string): string {
  const trimmed = path.replace(/^\/+/, '');
  // BASE_URL 末尾已带 '/'，直接拼接即可
  return `${BASE_URL}${trimmed}`;
}

/**
 * 暴露原始 BASE_URL（极少数需要直接拼接的场景）
 */
export const APP_BASE_URL = BASE_URL;