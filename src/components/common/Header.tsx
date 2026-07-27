import { Leaf, Info } from 'lucide-react';
import SearchBar from '../SearchBar/SearchBar';

const Header: React.FC = () => {
  const handleAboutClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-yao-knowledge'));
    }
  };

  return (
    <header className="relative bg-gradient-to-r from-primary-700 via-primary-600 to-primary-700 text-primary-50 shadow-floating overflow-hidden">
      {/* 织锦纹理装饰 */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M0 20 L20 0 L40 20 L20 40 Z' fill='none' stroke='%23f0fdf4' stroke-opacity='0.55' stroke-width='0.8'/><path d='M10 20 L20 10 L30 20 L20 30 Z' fill='none' stroke='%23fde68a' stroke-opacity='0.5' stroke-width='0.6'/></svg>\")",
          backgroundSize: '40px 40px',
        }}
        aria-hidden
      />
      {/* 顶部金色高光 */}
      <div className="absolute top-0 left-0 right-0 h-px bg-amber-300/60" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 h-auto md:h-20 py-3">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-card"
              style={{
                background:
                  'linear-gradient(135deg,#fde68a 0%,#f59e0b 60%,#b45309 100%)',
                boxShadow:
                  '0 6px 18px -8px rgba(245, 158, 11, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
              }}
            >
              <Leaf className="w-7 h-7 text-primary-900" />
            </div>
            <div className="text-primary-50">
              <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-wide">瑶医分布地图</h1>
              <p className="text-xs sm:text-sm text-primary-100/85 mt-0.5">
                探索瑶族传统医学与草药资源 · 大瑶山瑶医药文化全景
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-md w-full">
            <SearchBar />
          </div>

          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={handleAboutClick}
              className="btn-yao btn-yao-ghost text-primary-50 hover:bg-primary-500/40 hover:text-white"
              aria-label="打开关于瑶医介绍"
            >
              <Info className="w-4 h-4" />
              <span>关于瑶医</span>
            </button>
          </div>
        </div>
      </div>
      {/* 底部柔和高光 */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-primary-900/30" aria-hidden />
    </header>
  );
};

export default Header;
