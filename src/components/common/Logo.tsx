import React, { useState, useEffect, useCallback, useRef } from 'react';
import { assetPath } from '../../lib/assetPath';

/**
 * 项目官方 Logo 统一组件
 *
 * 核心特性：
 *  1. 资源路径：使用 assetPath() 自动注入运行时 base 前缀，
 *     兼容 GitHub Pages 子路径、vercel 自定义域名等部署形态，绝不出现 404。
 *  2. 加载策略：四级降级链
 *       ① LOGO(1).svg  → 1024×1024 高保真矢量主源（项目最新官方设计稿）
 *       ② logo.png      → 1.15 MB 栅格备用（SVG 不可用时的兜底）
 *       ③ logo.svg      → 10 KB 精简矢量备用
 *       ④ data:URL 占位 → 永不失败的最小兜底
 *     任一级失败时自动降级到下一级，绝不出现破图。
 *  3. 懒加载：使用原生 loading="lazy" + decoding="async"，
 *     配合 fetchpriority 与 IntersectionObserver，控制首屏加载预算。
 *  4. 响应式：基于 size 预设（xs / sm / md / lg / xl）自动切换 CSS clamp 数值，
 *     在 320px 手机到 1920px 桌面端都能清晰显示。
 *  5. 交互：自带 hover 缩放 / 阴影 / 旋转效果，遵循 prefers-reduced-motion 偏好。
 *  6. 语义：可为 <a> 包裹（点击跳首页）或纯展示。
 */

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface LogoProps {
  /** 预设尺寸，自动适配响应式 */
  size?: LogoSize;
  /** 自定义宽度（覆盖预设，会变成 inline style） */
  width?: number | string;
  /** 自定义高度 */
  height?: number | string;
  /** 是否可点击跳转首页（渲染 <a>） */
  clickToHome?: boolean;
  /** 自定义点击跳转的目标 URL（覆盖默认 '/'） */
  homeHref?: string;
  /** 是否启用懒加载（默认 true） */
  lazy?: boolean;
  /** 是否启用 hover 效果（默认 true） */
  interactive?: boolean;
  /** 自定义 className */
  className?: string;
  /** 自定义 alt 文本 */
  alt?: string;
  /** 自定义 title 文本 */
  title?: string;
  /** 加载完成回调（暴露给外部监控统计） */
  onLoaded?: () => void;
  /** 加载失败回调（暴露给外部监控统计） */
  onError?: (err: unknown) => void;
}

/**
 * 响应式尺寸映射（width / height 同时套用）：
 *  - xs：徽章位（28–36px）       ≈ 浏览器标签 / footer 小徽标
 *  - sm：移动端导航（36–48px）
 *  - md：桌面导航（48–64px）     ← 默认 Header 使用
 *  - lg：登录/注册 (64–80px)
 *  - xl：Admin 侧边栏/大屏 (96–144px)
 */
const sizeMap: Record<LogoSize, { min: string; max: string; defaultMin: number }> = {
  xs: { min: '1.75rem', max: '2.25rem', defaultMin: 28 },
  sm: { min: '2.25rem', max: '3rem',    defaultMin: 36 },
  md: { min: '2.75rem', max: '4rem',    defaultMin: 44 },
  lg: { min: '4rem',    max: '5rem',    defaultMin: 64 },
  xl: { min: '6rem',    max: '9rem',    defaultMin: 96 },
};

// 资源路径按优先级排序：
//   1. LOGO(1).svg — 项目最新官方设计稿（1024×1024 矢量，锐利可缩放）
//   2. logo.png     — 栅格备用，覆盖 SVG 不支持的边缘场景
//   3. logo.svg     — 轻量矢量备用，体积仅为 LOGO(1).svg 的 1.5%
//   4. data:URL     — 内联占位，永不失败
const LOGO_PRIMARY = assetPath('logo/LOGO(1).svg');
const LOGO_PNG = assetPath('logo/logo.png');
const LOGO_SVG = assetPath('logo/logo.svg');
const LOGO_DIMS = { w: 1024, h: 1024 };

/**
 * 占位 fallback：当所有外部资源都失败时显示的极简 SVG 兜底
 * 直接走 data: URL，不依赖任何外部资源 → 永远不会失败
 */
const PLACEHOLDER_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
      <defs>
        <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
          <stop offset='0' stop-color='#F0D1A1'/>
          <stop offset='1' stop-color='#C8A57E'/>
        </linearGradient>
      </defs>
      <circle cx='64' cy='64' r='60' fill='url(#g)' stroke='#587851' stroke-width='3'/>
      <text x='64' y='78' text-anchor='middle' font-size='40' font-family='serif'
            fill='#243B25' font-weight='700'>瑶</text>
    </svg>`
  );

const Logo: React.FC<LogoProps> = ({
  size = 'md',
  width,
  height,
  clickToHome = false,
  homeHref = '/',
  lazy = true,
  interactive = true,
  className = '',
  alt = '瑶医分布地图 · 官方 Logo',
  title = '瑶医分布地图 · 官方 Logo',
  onLoaded,
  onError,
}) => {
  // 四级降级：LOGO(1).svg → logo.png → logo.svg → 占位 data-url
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);
  const [loaded, setLoaded] = useState(false);
  const [viewportVisible, setViewportVisible] = useState(!lazy);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  // 懒加载：使用 IntersectionObserver 在元素进入视口后才渲染主图
  useEffect(() => {
    if (!lazy || viewportVisible) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      // 不支持 IntersectionObserver 时直接显示
      setViewportVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setViewportVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '120px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazy, viewportVisible]);

  // 错误处理：当前 stage 的 src 加载失败时，自动降级到下一阶段
  const handleError = useCallback<React.ReactEventHandler<HTMLImageElement>>(
    (e) => {
      const target = e.currentTarget;
      if (stage === 0) {
        // LOGO(1).svg 失败 → 切 logo.png
        target.src = LOGO_PNG;
        setStage(1);
        return;
      }
      if (stage === 1) {
        // logo.png 失败 → 切 logo.svg
        target.src = LOGO_SVG;
        setStage(2);
        return;
      }
      if (stage === 2) {
        // logo.svg 失败 → 占位
        target.src = PLACEHOLDER_SVG;
        setStage(3);
        onError?.(e);
        return;
      }
      onError?.(e);
    },
    [stage, onError]
  );

  const handleLoad = useCallback<React.ReactEventHandler<HTMLImageElement>>(
    () => {
      setLoaded(true);
      onLoaded?.();
    },
    [onLoaded]
  );

  const cfg = sizeMap[size];
  const containerStyle: React.CSSProperties = {
    width: width ?? `clamp(${cfg.min}, ${cfg.defaultMin}px + 1vw, ${cfg.max})`,
    height: height ?? `clamp(${cfg.min}, ${cfg.defaultMin}px + 1vw, ${cfg.max})`,
  };

  // 当前阶段的 src（依次降级）
  const currentSrc =
    stage === 0 ? LOGO_PRIMARY :
    stage === 1 ? LOGO_PNG :
    stage === 2 ? LOGO_SVG :
    PLACEHOLDER_SVG;

  // 图片渲染层
  const imageEl = (
    <span
      ref={containerRef}
      className={`yao-logo-badge relative flex items-center justify-center flex-shrink-0 ${
        interactive ? 'yao-logo-badge-interactive' : ''
      } ${className}`}
      style={containerStyle}
      aria-hidden={clickToHome ? undefined : 'true'}
    >
      {viewportVisible ? (
        <img
          src={currentSrc}
          alt={alt}
          title={title}
          loading={lazy ? 'lazy' : 'eager'}
          // React 18.3 + TypeScript：fetchpriority 在 JSX 类型上不存在，
          // 通过对象展开直接写入 DOM 属性，绕开 TS 类型检查同时保留浏览器侧语义。
          {...({ fetchpriority: size === 'xs' || size === 'sm' ? 'low' : 'high' } as Record<string, string>)}
          decoding="async"
          draggable={false}
          onLoad={handleLoad}
          onError={handleError}
          width={LOGO_DIMS.w}
          height={LOGO_DIMS.h}
          className={`yao-logo-img block w-full h-full object-contain select-none transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        // 占位骨架：保持容器尺寸，避免累计布局偏移 (CLS = 0)
        <span
          className="block w-full h-full rounded-2xl yao-logo-skeleton"
          aria-hidden="true"
        />
      )}
    </span>
  );

  if (!clickToHome) {
    return imageEl;
  }

  // 点击 → 跳首页（SPA 友好）
  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // 允许修饰键走默认行为（右键新标签 / Ctrl+Click）
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    if (homeHref === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // 派发事件让其它页面（如地图视图）能同步重置
      window.dispatchEvent(new CustomEvent('yao:goto-home'));
    }
  };

  return (
    <a
      href={homeHref}
      onClick={handleLogoClick}
      className={`group yao-logo-link inline-flex items-center justify-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
        interactive ? '' : 'pointer-events-auto'
      }`}
      aria-label="瑶医分布地图 — 回到首页"
      data-tip="瑶医分布地图 · 回到首页"
    >
      {imageEl}
    </a>
  );
};

export default Logo;