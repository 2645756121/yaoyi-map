import React, { useEffect, useState } from 'react';
import { Leaf, Info, BookOpen } from 'lucide-react';
import SearchBar from '../SearchBar/SearchBar';

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  const handleAboutClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-yao-knowledge'));
    }
  };

  // 婊氬姩鐩戝惉锛氬鑸爮闄勫姞鎮诞闃村奖
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      setScrolled(y > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`relative bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 text-primary-50 overflow-hidden transition-shadow duration-450 ease-yao-soft ${
        scrolled ? 'shadow-yao-xl' : 'shadow-yao-lg'
      }`}
      style={{
        backgroundImage:
          'linear-gradient(135deg, #1a4f23 0%, #22652c 35%, #1a4f23 65%, #243B25 100%)',
      }}
    >
      {/* ===== 瑁呴グ锛氱粐閿︾汗鐞?===== */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M0 20 L20 0 L40 20 L20 40 Z' fill='none' stroke='%23f0fdf4' stroke-opacity='0.55' stroke-width='0.8'/><path d='M10 20 L20 10 L30 20 L20 30 Z' fill='none' stroke='%23fde68a' stroke-opacity='0.5' stroke-width='0.6'/></svg>\")",
          backgroundSize: '40px 40px',
        }}
        aria-hidden
      />

      {/* ===== 瑁呴グ锛氬彸涓婅铚滅倷榛勫厜鏅?===== */}
      <div
        className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(212, 172, 106, 0.32) 0%, rgba(212, 172, 106, 0) 70%)',
        }}
        aria-hidden
      />
      {/* ===== 瑁呴グ锛氬乏涓嬭鑽夋湰缁垮厜鏅?===== */}
      <div
        className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(144, 166, 134, 0.28) 0%, rgba(144, 166, 134, 0) 70%)',
        }}
        aria-hidden
      />

      {/* ===== 椤堕儴閲戣壊楂樺厜 ===== */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(212, 172, 106, 0.6) 30%, rgba(212, 172, 106, 0.9) 50%, rgba(212, 172, 106, 0.6) 70%, transparent 100%)',
        }}
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 h-auto md:h-22 py-3.5 md:py-4">
          {/* ===== Logo + 鏍囬 ===== */}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-3.5 w-full md:w-auto group yao-tooltip"
            data-tip="鐟跺尰鍒嗗竷鍦板浘"
            aria-label="鐟跺尰鍒嗗竷鍦板浘 鈥?鍥炲埌椤堕儴"
          >
            {/* 铚滅倷榛勫浘鏍囧窘绔狅細娓愬彉 + 鎽囨洺鑽夎嵂鍥炬爣 */}
            <div
              className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-yao-md transition-all duration-300 ease-yao-bounce group-hover:rotate-3 group-hover:scale-105 flex-shrink-0"
              style={{
                background:
                  'linear-gradient(135deg,#fde68a 0%, #D4AC6A 40%, #c09454 70%, #a87d40 100%)',
                boxShadow:
                  '0 8px 22px -8px rgba(245, 158, 11, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.45), inset 0 -1px 0 rgba(168, 125, 64, 0.3)',
              }}
            >
              <Leaf
                className="w-7 h-7 sm:w-8 sm:h-8 text-primary-900 yao-leaf-sway"
                style={{ filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15))' }}
              />
              {/* 鍙充笂瑙掕楗板皬鍦嗙偣 */}
              <span
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-primary-700"
                aria-hidden
              />
            </div>

            <div className="text-primary-50 min-w-0 flex-1">
              <h1
                className="font-serif font-bold tracking-wide leading-tight truncate"
                style={{
                  fontSize: 'clamp(1.25rem, 2.4vw, 1.5rem)',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
                }}
              >
                鐟跺尰鍒嗗竷鍦板浘
                <span className="ml-2 inline-block px-2 py-0.5 text-[0.625rem] font-sans font-medium bg-amber-400/95 text-amber-950 rounded-full align-middle shadow-yao-xs">
                  V1.0
                </span>
              </h1>
              <p
                className="text-xs sm:text-sm text-primary-100/85 mt-0.5 truncate font-light"
                style={{ textShadow: '0 1px 1px rgba(0, 0, 0, 0.15)' }}
              >
                鎺㈢储鐟舵棌浼犵粺鍖诲涓庤崏鑽祫婧?路 澶х懚灞辩懚鍖昏嵂鏂囧寲鍏ㄦ櫙
              </p>
            </div>
          </a>

          {/* ===== 鎼滅储鏍忥細md 鍙婁互涓婃樉绀?===== */}
          <div className="flex-1 max-w-md w-full md:order-none md:mx-2">
            <SearchBar />
          </div>

          {/* ===== 鎿嶄綔鎸夐挳缁?===== */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={handleAboutClick}
              className="btn-yao btn-yao-ghost text-primary-50 hover:bg-white/15 hover:text-white border border-transparent hover:border-white/20 transition-all duration-200"
              aria-label="鎵撳紑鍏充簬鐟跺尰浠嬬粛"
            >
              <BookOpen className="w-4 h-4" />
              <span>鍏充簬鐟跺尰</span>
            </button>
            <span
              className="h-6 w-px bg-white/15"
              aria-hidden
            />
            <button
              type="button"
              className="btn-yao-icon bg-white/15 border-white/20 text-white hover:bg-amber-400 hover:border-amber-300 hover:text-amber-950 transition-all duration-200"
              aria-label="椤圭洰淇℃伅"
              title="椤圭洰淇℃伅"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ===== 搴曢儴鏌斿拰鍒嗛殧绾?===== */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.25) 50%, transparent 100%)',
        }}
        aria-hidden
      />
    </header>
  );
};

export default Header;