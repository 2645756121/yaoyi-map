import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * 忽略构建产物与历史部署包：这些目录保留为参考，不纳入 lint 范围
 * 项目配置文件与演示/验证脚本：非源码，跳过 lint
 */
export default tseslint.config(
  {
    ignores: [
      'dist',
      'deploy-package/**',
      'yao-medical-map-*/**',
      'node_modules',
      'yaoyi data/**',
      'tailwind.config.js',
      'postcss.config.js',
      'vite.config.ts',
      'scripts/**',
      '*.cjs',
      '*.mjs',
      '*.config.{js,ts,mjs,cjs}',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // 允许使用 _ 开头或下划线前缀标识"故意忽略"的变量
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);