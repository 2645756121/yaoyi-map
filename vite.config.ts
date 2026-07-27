import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// GitHub Pages 仓库名：用于构建时的 base 路径
const REPO_NAME = 'yaoyi-map'

export default defineConfig({
  // ✅ base 路径：GitHub Pages 部署到 https://用户名.github.io/yaoyi-map/
  //    设置 base 后，资产文件会引用 /yaoyi-map/assets/* 而不是 /assets/*
  base: process.env.GITHUB_PAGES ? `/${REPO_NAME}/` : '/',
  build: {
    sourcemap: 'hidden',
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
