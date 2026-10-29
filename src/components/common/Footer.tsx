import React from 'react';
import Logo from './Logo';
import { Github, Mail, BookOpen, Compass } from 'lucide-react';

/**
 * 网站底部 Footer 组件
 *
 * - 统一引用 Logo 组件（PNG → SVG → 占位三级降级）
 * - 提供相关链接、关于信息、版权信息
 * - 响应式：移动端堆叠 / 桌面端横排
 * - 点击 logo 跳回首页（由 Logo 内部实现）
 */

interface FooterLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  const aboutLinks: FooterLink[] = [
    { label: '关于瑶医', href: '#about-yao', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { label: '交互地图', href: '#', icon: <Compass className="w-3.5 h-3.5" /> },
    { label: '草药目录', href: '#herbs', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  const resourceLinks: FooterLink[] = [
    { label: 'GitHub 仓库', href: 'https://github.com/', icon: <Github className="w-3.5 h-3.5" /> },
    { label: '联系作者', href: 'mailto:yaoyi@example.cn', icon: <Mail className="w-3.5 h-3.5" /> },
  ];

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('#')) return;
    e.preventDefault();
    if (typeof document === 'undefined') return;
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // 找不到锚点 → 跳首页
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer
      role="contentinfo"
      aria-label="网站底部信息"
      className="yao-footer relative w-full mt-8 pt-8 pb-6 px-4 sm:px-6 lg:px-8 border-t-4"
      style={{
        background:
          'linear-gradient(180deg, rgba(36,59,37,0.92) 0%, rgba(36,59,37,0.98) 100%)',
        borderTopColor: '#F0D1A1',
        color: '#F7EADF',
      }}
    >
      {/* 顶部蜜炙桃黄描边线 */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(212, 172, 106, 0.6), rgba(212, 172, 106, 0.9), rgba(212, 172, 106, 0.6), transparent)',
        }}
        aria-hidden
      />

      {/* 装饰纹理 */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M0 20 L20 0 L40 20 L20 40 Z' fill='none' stroke='%23F0D1A1' stroke-opacity='0.45' stroke-width='0.7'/></svg>\")",
          backgroundSize: '40px 40px',
        }}
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
          {/* ===== 列 1：Logo + 简介 ===== */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {/* 官方 LOGO(1).svg 矢量主源，自动四级降级 */}
              <Logo
                size="sm"
                interactive
                clickToHome
                alt="瑶医分布地图 logo"
                title="瑶医分布地图 · 官方 Logo"
              />
              <div>
                <p className="font-serif font-bold text-base sm:text-lg text-primary-50 leading-tight">
                  瑶医分布地图
                </p>
                <p className="text-xs text-primary-100/70 mt-0.5">
                  Yao Medical Heritage Atlas
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-primary-100/80 leading-relaxed max-w-sm">
              以交互式地图为载体，可视化呈现瑶族传统医学、草药资源与文化分布，
              让更多人了解、传承与保护这一珍贵的民族医药遗产。
            </p>
            <p className="text-xs text-amber-200/80 italic mt-1">
              本资料仅用于科普展示 · 不构成医疗建议
            </p>
          </div>

          {/* ===== 列 2：网站导览 ===== */}
          <div>
            <h3 className="font-serif font-bold text-sm text-amber-300 mb-3 tracking-wide">
              网站导览
            </h3>
            <ul className="space-y-2">
              {aboutLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={(e) => handleAnchorClick(e, link.href)}
                    className="inline-flex items-center gap-1.5 text-sm text-primary-50/85 hover:text-amber-200 transition-colors duration-150"
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ===== 列 3：资源 / 联系 ===== */}
          <div>
            <h3 className="font-serif font-bold text-sm text-amber-300 mb-3 tracking-wide">
              资源与联系
            </h3>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="inline-flex items-center gap-1.5 text-sm text-primary-50/85 hover:text-amber-200 transition-colors duration-150"
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-primary-100/65 leading-relaxed">
              资料参考：中国民族医药学会瑶医药分会<br />
              《瑶医药学》（覃迅云 主编）<br />
              国家中医药管理局公开档案
            </p>
          </div>
        </div>

        {/* ===== 版权与备案 ===== */}
        <div className="pt-4 border-t border-amber-400/20 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-primary-100/70">
          <p>
            © {year} 瑶医分布地图 · 瑶族医药文化科普平台
          </p>
          <p className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden />
              内容仅供学习参考
            </span>
            <span className="hidden sm:inline">·</span>
            <span>Powered by React + Vite + Leaflet</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
