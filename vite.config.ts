import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// GitHub Pages 仓库名：用于构建时的 base 路径
const REPO_NAME = 'yaoyi-map'

/**
 * 性能优化配置 v2
 *
 * 关键优化点：
 * 1. manualChunks: 分离 vendor / react / leaflet / mapdata 到独立 chunk
 *    → 利用浏览器并行下载多个 chunk（HTTP/1.1 6 路并发 / HTTP/2 多路复用）
 *    → vendor chunk 可被多个 lazy chunk 共享，避免重复打包
 *
 * 2. assetsInlineLimit: 4KB 以下资源内联为 base64（减少 HTTP 请求）
 *    → 图标、字体子集、SVG 等小资源适合
 *
 * 3. cssCodeSplit: 启用 CSS 按需分割
 *    → 首页只需加载首页 CSS，懒加载页 CSS 按需加载
 *
 * 4. chunkSizeWarningLimit: 700KB
 *    → 之前的 500KB 阈值过于保守；gzip 后 218KB 远低于阈值
 */
export default defineConfig({
  base: process.env.GITHUB_PAGES ? `/${REPO_NAME}/` : '/',
  build: {
    sourcemap: 'hidden',
    // ✅ vendor chunk 拆分：长缓存 + 可并行下载
    rollupOptions: {
      output: {
        manualChunks: (id) => {
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
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 700,
    // ✅ 现代压缩（gzip + brotli 由服务器层负责）
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