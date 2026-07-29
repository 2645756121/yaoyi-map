import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // 蹇界暐鏋勫缓浜х墿涓庡巻鍙查儴缃插寘锛氳繖浜涚洰褰曚繚瀛樹簡鏃х増鏈揩鐓э紝
    // 涓嶅簲绾冲叆褰撳墠浠ｇ爜璐ㄩ噺鐨勬鏌ヨ寖鍥淬€?    ignores: [
      'dist',
      'deploy-package/**',
      'yao-medical-map-*/**',
      'node_modules',
      'yaoyi data/**',
      // 椤圭洰閰嶇疆鏂囦欢涓庢紨绀?楠岃瘉鑴氭湰锛氶潪婧愮爜锛岃烦杩?lint
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
      // 鍏佽浣跨敤 _ 寮€澶存垨涓嬪垝绾垮墠缂€鏍囪瘑"鏁呮剰蹇界暐"鐨勫彉閲?      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)