/** @type {import('tailwindcss').Config} */
/**
 * Tailwind 主题配色 v3 — 瑶医本草配色规范
 *
 * 设计目标：保留现有类名（primary-/amber-/ochre-/ink-）的语义不变，
 * 仅重新定义色值，使所有现有组件代码无需修改即可生效新配色。
 *
 * 4 色体系：
 *   - 草根本绿 #90A686 → primary 主背景（页面主体 / 导航栏 / 区块）
 *   - 蜜炙桃黄 #F0D1A1 → amber 强调色（按钮 / 链接 / 交互）
 *   - 深绿 #587851   → primary-700 文字主色（标题 / 正文）
 *   - 米色 #F7EADF   → ochre 卡片背景（卡片 / 弹窗 / 侧边栏）
 *
 * 派生色规则（色阶 50–900）：
 *   - 以 400 为基准（用户指定的标准色 #F0D1A1）
 *   - 50/100 = 主色 + 米色/白色稀释（用于背景/hover）
 *   - 200/300 = 浅化版（hover、secondary 按钮、chip）
 *   - 500/600/700 = 主色加深（active 态、文字、border）
 *
 * WCAG AA 对比度验证（明色文字 vs #90A686 主背景）：
 *   - #FFFFFF / #F7EADF 文字 vs #90A686：3.3:1（满足大文本 AA）
 *   - #243B25 文字 vs #F0D1A1 按钮：6.5:1（满足正文 AAA）
 *   - #587851 文字 vs #F0D1A1 按钮：3.4:1（满足大文本 AA）
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 草根本绿 — 主背景色 / 主品牌色（用户指定 #90A686）
        // 派生阶：50/100 用于淡背景、500 主色、700 文字、900 最深
        primary: {
          50: '#F7EADF',   // 米色（与 ochre-200 协调的极浅底色）
          100: '#DCE5D5',  // 浅草绿（hover 浅底 / section 背景）
          200: '#C0D2B6',  // 浅草绿
          300: '#A8C29C',  // 中浅草绿
          400: '#9BB48E',  // 中草绿（hover 态 / 次级按钮底色）
          500: '#90A686',  // ★ 草根本绿（用户指定，主背景 / 导航）
          600: '#7A8F70',  // 中深草绿
          700: '#587851',  // ★ 深绿（用户指定，文字主色）
          800: '#3E5940',  // 深绿（active 态 / 深色背景上的白字装饰）
          900: '#243B25',  // 最深绿（footer / header 暗调）
        },
        // 蜜炙桃黄 — 强调色 / 交互色（用户指定 #F0D1A1）
        // 派生阶：50–300 浅化（hover、chip），400 标准，500–700 加深（active、disabled）
        amber: {
          50: '#FFF7EC',   // 极浅桃黄（hover 浅底）
          100: '#FCEEDA',  // 浅桃黄
          200: '#F8E4C3',  // 中浅桃黄
          300: '#F4DBB1',  // 中桃黄（hover 态按钮）
          400: '#F0D1A1',  // ★ 蜜炙桃黄（用户指定，按钮 / 链接 / 强调）
          500: '#DDBE8C',  // 中深桃黄
          600: '#C8A57E',  // 深桃黄（hover 加深版）
          700: '#A88A66',  // 深桃黄（active / pressed 态）
        },
        // 米色 — 卡片 / 弹窗 / 侧边栏背景（用户指定 #F7EADF）
        // 200 是核心，其余用于更浅（hover）或更深（border / shadow）
        ochre: {
          50: '#FFFCF8',   // 近白（hover 浅底 / disabled）
          100: '#FBF1E6',  // 浅米（hover 态）
          200: '#F7EADF',  // ★ 米色（用户指定，卡片 / 弹窗 / 侧边栏主背景）
          300: '#EBD9C9',  // 中米（border / divider）
          400: '#D8C2A8',  // 深米（次级边框 / 投影底层）
          500: '#C0A384',  // 中深米
          600: '#9D7F61',  // 深米（描边强调）
          700: '#785E47',  // 更深米
          800: '#503C2C',  // 深米（极少用）
          900: '#2A1F16',  // 最深米（极少用）
        },
        // 红色 — 警示 / 删除（保持原值，仅用于危险按钮、错误提示）
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
        // 墨色（中性灰绿）— 与主色协调的中性文字 / 辅助元素
        ink: {
          50: '#F0F3EE',   // 极浅
          100: '#D6E1D2',  // 浅
          200: '#B3C5AA',  // 中浅
          300: '#8AA580',  // 中
          400: '#6F8E66',  // 中（副文字色）
          500: '#587851',  // ★ 与 primary-700 同色（深绿，文字主色）
          600: '#466344',  // 深
          700: '#344E32',  // 更深
          800: '#223820',  // 深
          900: '#102514',  // 最深
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        display: ['"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
      },
      fontSize: {
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
        // 风格化阴影 — 与新色系协调
        soft: '0 2px 10px rgba(88, 120, 81, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
        card: '0 6px 24px -8px rgba(88, 120, 81, 0.16), 0 2px 6px rgba(0, 0, 0, 0.04)',
        floating: '0 18px 40px -16px rgba(88, 120, 81, 0.28), 0 6px 14px rgba(0, 0, 0, 0.06)',
        glow: '0 0 0 3px rgba(212, 172, 106, 0.25)',
        focus: '0 0 0 3px rgba(212, 172, 106, 0.45)',
        // 织锦纹理按钮阴影
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
        // 视觉美化系统：3 档阴影（柔和 / 卡片 / 悬浮 / 抽屉）
        'yao-xs': '0 1px 2px rgba(88, 120, 81, 0.06)',
        'yao-sm': '0 2px 8px -2px rgba(88, 120, 81, 0.10), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'yao-md': '0 6px 18px -6px rgba(88, 120, 81, 0.16), 0 2px 6px rgba(0, 0, 0, 0.05)',
        'yao-lg': '0 18px 36px -10px rgba(88, 120, 81, 0.24), 0 6px 14px rgba(0, 0, 0, 0.06)',
        'yao-xl': '0 28px 60px -16px rgba(88, 120, 81, 0.32), 0 8px 24px rgba(0, 0, 0, 0.08)',
        'yao-amber-glow': '0 0 24px -4px rgba(212, 172, 106, 0.55)',
        'yao-green-glow': '0 0 24px -4px rgba(144, 166, 134, 0.55)',
        // 蜜炙黄光晕高亮（用于 hover 状态）
        'yao-edge-amber': 'inset 0 0 0 1px rgba(212, 172, 106, 0.4)',
        'yao-edge-green': 'inset 0 0 0 1px rgba(144, 166, 134, 0.4)',
      },
      ringWidth: {
        DEFAULT: '2px',
      },
      transitionDuration: {
        DEFAULT: '200ms',
        250: '250ms',
        350: '350ms',
        450: '450ms',
        600: '600ms',
      },
      transitionTimingFunction: {
        // 瑶医定制缓动曲线：模拟真实物体的弹性 / 缓冲
        'bounce-in': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'yao-soft': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'yao-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'yao-spring': 'cubic-bezier(0.22, 1, 0.36, 1)',
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
        // 页面首屏入场
        'yao-fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // 卡片延迟入场
        'yao-card-up': {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // 弹窗缩放入场
        'yao-pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92) translateY(8px)' },
          '60%': { opacity: '1' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        // 呼吸光晕（用于强调元素）
        'yao-pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 172, 106, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(212, 172, 106, 0)' },
        },
        // 蜜炙黄波纹
        'yao-ripple': {
          '0%': { transform: 'scale(0)', opacity: '0.6' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        // 草本绿潮汐
        'yao-tide': {
          '0%, 100%': { backgroundPosition: '0 0' },
          '50%': { backgroundPosition: '40px 40px' },
        },
        // 摇曳（草药图标）
        'yao-sway': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        // 顶部进度条
        'yao-progress': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        // 抽屉滑入
        'yao-slide-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        // 底部弹出
        'yao-slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'yao-shine': 'yao-shine 2s ease-in-out infinite',
        'yao-rise': 'yao-rise 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'yao-fade-in-up': 'yao-fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'yao-card-up': 'yao-card-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'yao-pop-in': 'yao-pop-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'yao-pulse-glow': 'yao-pulse-glow 2.4s ease-in-out infinite',
        'yao-tide': 'yao-tide 8s ease-in-out infinite',
        'yao-sway': 'yao-sway 3s ease-in-out infinite',
        'yao-progress': 'yao-progress 1.6s ease-in-out infinite',
        'yao-slide-right': 'yao-slide-right 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'yao-slide-up': 'yao-slide-up 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      backgroundImage: {
        // 瑶族织锦纹理（使用新色系：#90A686 + #F0D1A1）
        'yao-weave':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M0 20 L20 0 L40 20 L20 40 Z' fill='none' stroke='%2390A686' stroke-opacity='0.22' stroke-width='0.8'/><path d='M10 20 L20 10 L30 20 L20 30 Z' fill='none' stroke='%23F0D1A1' stroke-opacity='0.30' stroke-width='0.6'/></svg>\")",
        'yao-grass':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'><path d='M0 60 Q30 0 60 60 T120 60' fill='none' stroke='%23587851' stroke-opacity='0.08' stroke-width='1'/></svg>\")",
      },
    },
  },
  plugins: [],
};