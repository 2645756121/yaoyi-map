import React, { useEffect, useState } from 'react';
<<<<<<< HEAD
import { Leaf, Info, BookOpen } from 'lucide-react';
=======
import { Info, BookOpen } from 'lucide-react';
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)
import SearchBar from '../SearchBar/SearchBar';
import Logo from './Logo';

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  const handleAboutClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-yao-knowledge'));
    }
  };

  // 滚动监听：导航栏附加悬浮阴影
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
      {/* ===== 装饰：织锦纹理 ===== */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M0 20 L20 0 L40 20 L20 40 Z' fill='none' stroke='%23f0fdf4' stroke-opacity='0.55' stroke-width='0.8'/><path d='M10 20 L20 10 L30 20 L20 30 Z' fill='none' stroke='%23fde68a' stroke-opacity='0.5' stroke-width='0.6'/></svg>\")",
          backgroundSize: '40px 40px',
        }}
        aria-hidden
      />

      {/* ===== 装饰：右上角蜜炙黄光晕 ===== */}
      <div
        className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(212, 172, 106, 0.32) 0%, rgba(212, 172, 106, 0) 70%)',
        }}
        aria-hidden
      />
      {/* ===== 装饰：左下角草本绿光晕 ===== */}
      <div
        className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(144, 166, 134, 0.28) 0%, rgba(144, 166, 134, 0) 70%)',
        }}
        aria-hidden
      />

      {/* ===== 顶部金色高光 ===== */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
<<<<<<< HEAD
            'linear-gradient(90deg, transparent 0%, rgba(212, 172, 106, 0.6) 30%, rgba(212, 172, 106, 0.9) 50%, rgba(212, 172, 106, 0.6) 70%, transparent 100%)',
=======
            'linear-gradient(90deg, transparent, rgba(212, 172, 106, 0.6), rgba(212, 172, 106, 0.9), rgba(212, 172, 106, 0.6), transparent)',
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)
        }}
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 h-auto md:h-22 py-3.5 md:py-4">
          {/* ===== Logo + 标题 ===== */}
          <a
<<<<<<< HEAD
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-3.5 w-full md:w-auto group yao-tooltip"
            data-tip="瑶医分布地图"
            aria-label="瑶医分布地图 — 回到顶部"
          >
            {/* 蜜炙桃黄图标徽章：渐变 + 摇曳草药图标 */}
            <div
              className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-yao-md transition-all duration-300 ease-yao-bounce group-hover:rotate-3 group-hover:scale-105 flex-shrink-0"
              style={{
                background:
                  'linear-gradient(135deg,#FFF7EC 0%, #F0D1A1 40%, #DDBE8C 70%, #C8A57E 100%)',
                boxShadow:
                  '0 8px 22px -8px rgba(240, 209, 161, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -1px 0 rgba(200, 165, 126, 0.3)',
              }}
            >
              <Leaf
                className="w-7 h-7 sm:w-8 sm:h-8 text-primary-900 yao-leaf-sway"
                style={{ filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15))' }}
              />
              {/* 右上角装饰小圆点 */}
              <span
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-primary-700"
                aria-hidden
              />
            </div>
=======
            href="/"
            onClick={(e) => {
              // 允许修饰键走默认行为（Ctrl/Meta/Shift = 新标签）
              if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
              window.dispatchEvent(new CustomEvent('yao:goto-home'));
            }}
            className="flex items-center gap-3.5 w-full md:w-auto group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 rounded-xl"
            aria-label="瑶医分布地图 — 回到首页"
            data-tip="瑶医分布地图 · 回到首页"
          >
            {/* 统一 Logo 组件：响应式、PNG→SVG→占位三级降级、懒加载 */}
            <Logo
              size="md"
              interactive
              lazy={false}
              alt="瑶医分布地图 logo · 瑶族医药文化标识"
              title="瑶医分布地图 · 官方 Logo"
            />
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)

            <div className="text-primary-50 min-w-0 flex-1">
              <h1
                className="font-serif font-bold tracking-wide leading-tight truncate"
                style={{
                  fontSize: 'clamp(1.25rem, 2.4vw, 1.5rem)',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
                }}
              >
                瑶医分布地图
                <span className="ml-2 inline-block px-2 py-0.5 text-[0.625rem] font-sans font-medium bg-amber-400/95 text-amber-950 rounded-full align-middle shadow-yao-xs">
                  V1.0
                </span>
              </h1>
              <p
                className="text-xs sm:text-sm text-primary-100/85 mt-0.5 truncate font-light"
                style={{ textShadow: '0 1px 1px rgba(0, 0, 0, 0.15)' }}
              >
                探索瑶族传统医学与草药资源 · 大瑶山瑶医药文化全景
              </p>
            </div>
          </a>

          {/* ===== 搜索栏：md 及以上显示 ===== */}
          <div className="flex-1 max-w-md w-full md:order-none md:mx-2">
            <SearchBar />
          </div>

          {/* ===== 操作按钮组 ===== */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={handleAboutClick}
              className="btn-yao btn-yao-ghost text-primary-50 hover:bg-white/15 hover:text-white border border-transparent hover:border-white/20 transition-all duration-200"
              aria-label="打开关于瑶医介绍"
            >
              <BookOpen className="w-4 h-4" />
              <span>关于瑶医</span>
            </button>
            <span
              className="h-6 w-px bg-white/15"
              aria-hidden
            />
            <button
              type="button"
              className="btn-yao-icon bg-white/15 border-white/20 text-white hover:bg-amber-400 hover:border-amber-300 hover:text-amber-950 transition-all duration-200"
              aria-label="项目信息"
              title="项目信息"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ===== 底部柔和分隔线 ===== */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
<<<<<<< HEAD
            'linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.25) 50%, transparent 100%)',
=======
            'linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.25), transparent)',
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)
        }}
        aria-hidden
      />
    </header>
  );
};

export default Header;