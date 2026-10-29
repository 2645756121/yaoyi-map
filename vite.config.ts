import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// GitHub Pages 仓库名：用于构建时的 base 路径
const REPO_NAME = 'yaoyi-map'

/**
 * 性能优化配置 v3
 *
 * 关键优化点：
 * 1. manualChunks: 分离 vendor / react / leaflet / three / mapdata 到独立 chunk
 *    → 利用浏览器并行下载多个 chunk（HTTP/1.1 6 路并发 / HTTP/2 多路复用）
 *    → vendor chunk 可被多个 lazy chunk 共享，避免重复打包
 *
 *    ✅ v3 新增：把 three.js 从 vendor-utils 中**单独拆出**。
 *    原因：three（约 574KB）只被懒加载的 TerrainRelief3D 使用，但 v2 把它
 *    和所有其它 node_modules 一起打进 vendor-utils，而入口 chunk 会引用
 *    vendor-utils 的导出，导致 Vite 在 index.html 里为它注入
 *    <link rel="modulepreload">，**首屏就被下载**（虽不执行），
 *    白白让首屏多付约 500KB。拆成 vendor-three 后，它只被
 *    TerrainRelief3D 这个动态 chunk 依赖，不再进入首屏预加载。
 *
 * 2. assetsInlineLimit: 4KB 以下资源内联为 base64（减少 HTTP 请求）
 * 3. cssCodeSplit: 启用 CSS 按需分割
 * 4. chunkSizeWarningLimit: 700KB
 *
 * 5. modulePreload: 关闭"为动态导入预加载依赖"的行为，
 *    确保非首屏 chunk（three / leaflet 等）不会因静态分析而被提前预载。
 */
export default defineConfig({
  base: process.env.GITHUB_PAGES ? `/${REPO_NAME}/` : '/',
  build: {
    sourcemap: 'hidden',
    // ✅ vendor chunk 拆分：长缓存 + 可并行下载
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // three.js 及其 examples/jsm 附属模块：仅 TerrainRelief3D 使用，独立成 chunk
          if (
            id.includes('node_modules/three') ||
            id.includes('node_modules/.vite/deps/three')
          ) {
            return 'vendor-three';
          }
          // 第三方 vendor（React、Zustand 等核心运行时）
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler') || id.includes('node_modules/zustand')) {
            return 'vendor-react';
          }
          // Leaflet（地图库，约 150KB）单独切分
          if (id.includes('node_modules/leaflet')) {
            return 'vendor-leaflet';
          }
          // 工具库（其他较小的 vendor）
          if (id.includes('node_modules/')) {
            return 'vendor-utils';
          }
          return undefined;
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // ✅ 关键：不要让非首屏的动态依赖进入首屏 modulepreload
    modulePreload: {
      polyfill: false,
      resolveDependencies: (_filename, deps) =>
        // 只预加载被"入口直接依赖"的 chunk；three 只在 TerrainRelief3D 内被动态导入，
        // 因此不应出现在首屏依赖列表中。这里排除 vendor-three。
        deps.filter((d) => !d.includes('vendor-three')),
    },
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 700,
    target: 'es2020',
    minify: 'esbuild',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
  ],
})