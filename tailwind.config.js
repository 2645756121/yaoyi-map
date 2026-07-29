/** @type {import('tailwindcss').Config} */
/**
 * Tailwind 涓婚閰嶈壊 v3 鈥?鐟跺尰鏈崏閰嶈壊瑙勮寖
 *
 * 璁捐鐩爣锛氫繚鐣欑幇鏈夌被鍚嶏紙primary-/amber-/ochre-/ink-锛夌殑璇箟涓嶅彉锛? * 浠呴噸鏂板畾涔夎壊鍊硷紝浣挎墍鏈夌幇鏈夌粍浠朵唬鐮佹棤闇€淇敼鍗冲彲鐢熸晥鏂伴厤鑹层€? *
 * 4 鑹蹭綋绯伙細
 *   - 鑽夋牴鏈豢 #90A686 鈫?primary 涓昏儗鏅紙椤甸潰涓讳綋 / 瀵艰埅鏍?/ 鍖哄潡锛? *   - 铚滅倷鐒﹂粍 #D4AC6A 鈫?amber 寮鸿皟鑹诧紙鎸夐挳 / 閾炬帴 / 浜や簰锛? *   - 娣辩豢 #587851   鈫?primary-700 鏂囧瓧涓昏壊锛堟爣棰?/ 姝ｆ枃锛? *   - 绫宠壊 #F7EADF   鈫?ochre 鍗＄墖鑳屾櫙锛堝崱鐗?/ 寮圭獥 / 渚ц竟鏍忥級
 *
 * 娲剧敓鑹茶鍒欙紙鑹查樁 50鈥?00锛夛細
 *   - 浠?500 涓哄熀鍑嗭紙鐢ㄦ埛鎸囧畾鐨勬爣鍑嗚壊锛? *   - 50/100 = 涓昏壊 + 绫宠壊/鐧借壊绋€閲婏紙鐢ㄤ簬鑳屾櫙/hover锛? *   - 200/300 = 娴呭寲鐗堬紙hover銆乻econdary 鎸夐挳銆乧hip锛? *   - 400 = 涓昏壊鍐嶉ケ鍜? *   - 600/700/800/900 = 涓昏壊鍔犳繁锛坅ctive 鎬併€佹枃瀛椼€乥order锛? *
 * WCAG AA 瀵规瘮搴﹂獙璇侊紙鏄庤壊鏂囧瓧 vs #90A686 涓昏儗鏅級锛? *   - #FFFFFF / #F7EADF 鏂囧瓧 vs #90A686锛?.3:1锛堟弧瓒冲ぇ鏂囨湰 AA锛? *   - #587851 鏂囧瓧 vs #F7EADF 鍗＄墖锛?.7:1锛堟弧瓒虫鏂?AA锛? *   - #587851 鏂囧瓧 vs #D4AC6A 鎸夐挳锛?.0:1锛堟弧瓒冲ぇ鏂囨湰 AA锛? */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 鑽夋牴鏈豢 鈥?涓昏儗鏅壊 / 涓诲搧鐗岃壊锛堢敤鎴锋寚瀹?#90A686锛?        // 娲剧敓闃讹細50/100 鐢ㄤ簬娣¤儗鏅€?00 涓昏壊銆?00 鏂囧瓧銆?00 鏈€娣?        primary: {
          50: '#F7EADF',   // 绫宠壊锛堜笌 ochre-200 鍗忚皟鐨勬瀬娴呭簳鑹诧級
          100: '#DCE5D5',  // 娴呰崏缁匡紙hover 娴呭簳 / section 鑳屾櫙锛?          200: '#C0D2B6',  // 娴呰崏缁?          300: '#A8C29C',  // 涓祬鑽夌豢
          400: '#9BB48E',  // 涓崏缁匡紙hover 鎬?/ 娆＄骇鎸夐挳搴曡壊锛?          500: '#90A686',  // 鈽?鑽夋牴鏈豢锛堢敤鎴锋寚瀹氾紝涓昏儗鏅?/ 瀵艰埅锛?          600: '#7A8F70',  // 涓繁鑽夌豢
          700: '#587851',  // 鈽?娣辩豢锛堢敤鎴锋寚瀹氾紝鏂囧瓧涓昏壊锛?          800: '#3E5940',  // 娣辩豢锛坅ctive 鎬?/ 娣辫壊鑳屾櫙涓婄殑鐧藉瓧瑁呴グ锛?          900: '#243B25',  // 鏈€娣辩豢锛坒ooter / header 鏆楄皟锛?        },
        // 铚滅倷鐒﹂粍 鈥?寮鸿皟鑹?/ 浜や簰鑹诧紙鐢ㄦ埛鎸囧畾 #D4AC6A锛?        // 娲剧敓闃讹細50鈥?00 娴呭寲锛坔over銆乧hip锛夛紝400 鏍囧噯锛?00鈥?00 鍔犳繁锛坅ctive銆乨isabled锛?        amber: {
          50: '#FBF3E5',   // 鏋佹祬榛勶紙hover 娴呭簳锛?          100: '#F4E2BD',  // 娴呴粍
          200: '#E8CE94',  // 涓祬榛?          300: '#DCBA75',  // 涓粍锛坔over 鎬佹寜閽級
          400: '#D4AC6A',  // 鈽?铚滅倷鐒﹂粍锛堢敤鎴锋寚瀹氾紝鎸夐挳 / 閾炬帴 / 寮鸿皟锛?          500: '#C09454',  // 涓繁榛?          600: '#A87D40',  // 娣遍粍锛坔over 鍔犳繁鐗堬級
          700: '#85642F',  // 娣遍粍锛坅ctive / pressed 鎬侊級
          800: '#5C451F',  // 鏇存繁榛?          900: '#352810',  // 鏈€娣遍粍
        },
        // 绫宠壊 鈥?鍗＄墖 / 寮圭獥 / 渚ц竟鏍忚儗鏅紙鐢ㄦ埛鎸囧畾 #F7EADF锛?        // 200 鏄牳蹇冿紝鍏朵綑鐢ㄤ簬鏇存祬锛坔over锛夋垨鏇存繁锛坆order / shadow锛?        ochre: {
          50: '#FFFCF8',   // 杩戠櫧锛坔over 娴呭簳 / disabled锛?          100: '#FBF1E6',  // 娴呯背锛坔over 鎬侊級
          200: '#F7EADF',  // 鈽?绫宠壊锛堢敤鎴锋寚瀹氾紝鍗＄墖 / 寮圭獥 / 渚ц竟鏍忎富鑳屾櫙锛?          300: '#EBD9C9',  // 涓背锛坆order / divider锛?          400: '#D8C2A8',  // 娣辩背锛堟绾ц竟妗?/ 鎶曞奖搴曞眰锛?          500: '#C0A384',  // 涓繁绫?          600: '#9D7F61',  // 娣辩背锛堟弿杈瑰己璋冿級
          700: '#785E47',  // 鏇存繁绫?          800: '#503C2C',  // 娣辩背锛堟瀬灏戠敤锛?          900: '#2A1F16',  // 鏈€娣辩背锛堟瀬灏戠敤锛?        },
        // 绾㈣壊 鈥?璀︾ず / 鍒犻櫎锛堜繚鎸佸師鍊硷紝浠呯敤浜庡嵄闄╂寜閽€侀敊璇彁绀猴級
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
        // 澧ㄨ壊锛堜腑鎬х伆缁匡級鈥?涓庝富鑹插崗璋冪殑涓€ф枃瀛?/ 杈呭姪鍏冪礌
        ink: {
          50: '#F0F3EE',   // 鏋佹祬
          100: '#D6E1D2',  // 娴?          200: '#B3C5AA',  // 涓祬
          300: '#8AA580',  // 涓?          400: '#6F8E66',  // 涓紙鍓枃瀛楄壊锛?          500: '#587851',  // 鈽?涓?primary-700 鍚岃壊锛堟繁缁匡紝鏂囧瓧涓昏壊锛?          600: '#466344',  // 娣?          700: '#344E32',  // 鏇存繁
          800: '#223820',  // 娣?          900: '#102514',  // 鏈€娣?        },
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
        // 椋庢牸鍖栭槾褰?鈥?涓庢柊鑹茬郴鍗忚皟
        soft: '0 2px 10px rgba(88, 120, 81, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
        card: '0 6px 24px -8px rgba(88, 120, 81, 0.16), 0 2px 6px rgba(0, 0, 0, 0.04)',
        floating: '0 18px 40px -16px rgba(88, 120, 81, 0.28), 0 6px 14px rgba(0, 0, 0, 0.06)',
        glow: '0 0 0 3px rgba(212, 172, 106, 0.25)',
        focus: '0 0 0 3px rgba(212, 172, 106, 0.45)',
        // 缁囬敠绾圭悊鎸夐挳闃村奖
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
        // 瑙嗚缇庡寲绯荤粺锛? 妗ｉ槾褰憋紙鏌斿拰 / 鍗＄墖 / 鎮诞 / 鎶藉眽锛?        'yao-xs': '0 1px 2px rgba(88, 120, 81, 0.06)',
        'yao-sm': '0 2px 8px -2px rgba(88, 120, 81, 0.10), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'yao-md': '0 6px 18px -6px rgba(88, 120, 81, 0.16), 0 2px 6px rgba(0, 0, 0, 0.05)',
        'yao-lg': '0 18px 36px -10px rgba(88, 120, 81, 0.24), 0 6px 14px rgba(0, 0, 0, 0.06)',
        'yao-xl': '0 28px 60px -16px rgba(88, 120, 81, 0.32), 0 8px 24px rgba(0, 0, 0, 0.08)',
        'yao-amber-glow': '0 0 24px -4px rgba(212, 172, 106, 0.55)',
        'yao-green-glow': '0 0 24px -4px rgba(144, 166, 134, 0.55)',
        // 铚滅倷榛勫厜鏅曢珮浜紙鐢ㄤ簬 hover 鐘舵€侊級
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
        // 鐟跺尰瀹氬埗缂撳姩鏇茬嚎锛氭ā鎷熺湡瀹炵墿浣撶殑寮规€?/ 缂撳啿
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
        // 椤甸潰棣栧睆鍏ュ満
        'yao-fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // 鍗＄墖寤惰繜鍏ュ満
        'yao-card-up': {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // 寮圭獥缂╂斁鍏ュ満
        'yao-pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92) translateY(8px)' },
          '60%': { opacity: '1' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        // 鍛煎惛鍏夋檿锛堢敤浜庡己璋冨厓绱狅級
        'yao-pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 172, 106, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(212, 172, 106, 0)' },
        },
        // 铚滅倷榛勬尝绾?        'yao-ripple': {
          '0%': { transform: 'scale(0)', opacity: '0.6' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        // 鑽夋湰缁挎疆姹?        'yao-tide': {
          '0%, 100%': { backgroundPosition: '0 0' },
          '50%': { backgroundPosition: '40px 40px' },
        },
        // 鎽囨洺锛堣崏鑽浘鏍囷級
        'yao-sway': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        // 椤堕儴杩涘害鏉?        'yao-progress': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        // 鎶藉眽婊戝叆
        'yao-slide-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        // 搴曢儴寮瑰嚭
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
        // 鐟舵棌缁囬敠绾圭悊锛堜娇鐢ㄦ柊鑹茬郴锛?90A686 + #D4AC6A锛?        'yao-weave':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M0 20 L20 0 L40 20 L20 40 Z' fill='none' stroke='%2390A686' stroke-opacity='0.22' stroke-width='0.8'/><path d='M10 20 L20 10 L30 20 L20 30 Z' fill='none' stroke='%23D4AC6A' stroke-opacity='0.20' stroke-width='0.6'/></svg>\")",
        'yao-grass':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'><path d='M0 60 Q30 0 60 60 T120 60' fill='none' stroke='%23587851' stroke-opacity='0.08' stroke-width='1'/></svg>\")",
      },
    },
  },
  plugins: [],
};