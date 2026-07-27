/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 瑶医主题色彩体系 — 黛绿为基调，配琥珀、赭土作层次
        primary: {
          50: '#eef5ee',
          100: '#d6e6d6',
          200: '#a8cca7',
          300: '#7bb279',
          400: '#4d984b',
          500: '#2c7e36',
          600: '#22652c',
          700: '#1a4f23',
          800: '#16391c',
          900: '#102514',
        },
        // 琥珀 — 辅助色（药材/药汤色）
        amber: {
          50: '#fbf3e3',
          100: '#f5e0b8',
          200: '#ecc880',
          300: '#e3b052',
          400: '#cf9230',
          500: '#a97621',
          600: '#84591a',
          700: '#5e3f12',
          800: '#3d2a0c',
          900: '#221806',
        },
        // 赭土 — 接地中性色（卡片/分隔）
        ochre: {
          50: '#f7f3ed',
          100: '#ece2d3',
          200: '#d8c19c',
          300: '#b89463',
          400: '#8c6a3c',
          500: '#6e5128',
          600: '#50391b',
          700: '#372711',
          800: '#1f160a',
          900: '#100a05',
        },
        // 柔和红 — 警示/突出（提高可读性，并通过 WCAG AA）
        accent: {
          50: '#fdecec',
          100: '#fad0d0',
          200: '#f5a4a4',
          300: '#ec7575',
          400: '#dc4646',
          500: '#b33030',
          600: '#8c2626',
          700: '#651c1c',
          800: '#3f1212',
          900: '#260b0b',
        },
        ink: {
          50: '#f6f7f5',
          100: '#e8ebe6',
          200: '#c7cfc2',
          300: '#9aa594',
          400: '#6e7d68',
          500: '#465b42',
          600: '#34432f',
          700: '#253020',
          800: '#181e15',
          900: '#0c100a',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        display: ['"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
      },
      fontSize: {
        // 统一字号层级
        '2xs': ['0.6875rem', { lineHeight: '1.2' }],
        xs: ['0.75rem', { lineHeight: '1.4' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.6' }],
        lg: ['1.125rem', { lineHeight: '1.55' }],
        xl: ['1.25rem', { lineHeight: '1.45' }],
        '2xl': ['1.5rem', { lineHeight: '1.35' }],
        '3xl': ['1.875rem', { lineHeight: '1.25' }],
        '4xl': ['2.25rem', { lineHeight: '1.2' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13': '3.25rem',
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.75rem',
      },
      boxShadow: {
        // 风格化阴影 — 中性 + 绿色调
        soft: '0 2px 10px rgba(26, 78, 38, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        card: '0 6px 24px -8px rgba(28, 64, 36, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
        floating: '0 18px 40px -16px rgba(22, 88, 36, 0.28), 0 6px 14px rgba(0, 0, 0, 0.06)',
        glow: '0 0 0 3px rgba(44, 126, 54, 0.18)',
        focus: '0 0 0 3px rgba(44, 126, 54, 0.35)',
        // 织锦纹理按钮阴影
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
      },
      ringWidth: {
        DEFAULT: '2px',
      },
      keyframes: {
        'yao-shine': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'yao-rise': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        // 瑶族织锦纹理（非装饰 SVG，轻量可用作背景）
        'yao-weave':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M0 20 L20 0 L40 20 L20 40 Z' fill='none' stroke='%23a8cca7' stroke-opacity='0.18' stroke-width='0.8'/><path d='M10 20 L20 10 L30 20 L20 30 Z' fill='none' stroke='%23b89463' stroke-opacity='0.16' stroke-width='0.6'/></svg>\")",
        'yao-grass':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'><path d='M0 60 Q30 0 60 60 T120 60' fill='none' stroke='%2322652c' stroke-opacity='0.07' stroke-width='1'/></svg>\")",
      },
    },
  },
  plugins: [],
};
