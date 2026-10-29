/**
 * tourGallery.tsx —— 站点配图的纵向自动播放大画廊
 *
 * 交互约定：
 *   · 多图时整列**缓缓向下循环滚动**（用两份列表首尾相接，位移到 -50% 即无缝衔接）
 *   · 鼠标移入整列暂停滚动；移到某张图上时该图轻微放大（1.045），避免"滚动中不好点"
 *   · 点击任意图片 → 全屏灯箱预览（支持 Esc / 点背景关闭）
 *   · 只有 1 张图时不滚动（不制造虚假动效），悬停与点击行为保持一致
 *   · 尊重 prefers-reduced-motion：跟随系统关闭动画
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { assetPath } from '../../lib/assetPath';
import type { TourImage } from './tourData';

export interface TourGalleryProps {
  images: TourImage[];
  /** 窄屏：降低画廊高度 */
  compact?: boolean;
  /** 无图时的兜底文案（一般由调用方传入站点名） */
  emptyLabel?: string;
}

/** 每张图停留的秒数（越大越慢） */
const SECONDS_PER_IMAGE = 13;

export default function TourGallery({ images, compact, emptyLabel }: TourGalleryProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const count = images.length;
  const scrollable = count > 1;
  // 两份拼接 + 动画到 -50%：视觉上无限循环且无跳变
  const track = useMemo(() => (scrollable ? [...images, ...images] : images), [images, scrollable]);
  const duration = Math.max(20, count * SECONDS_PER_IMAGE);

  const close = useCallback(() => setPreview(null), []);

  useEffect(() => {
    if (preview === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPreview(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [preview]);

  if (count === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: compact ? 220 : 360,
          borderRadius: 12,
          border: '1px dashed rgba(240,198,116,0.28)',
          background: 'rgba(255,255,255,0.03)',
          color: 'rgba(242,236,223,0.45)',
          fontSize: 12,
          letterSpacing: 0.5,
        }}
      >
        暂无实拍配图{emptyLabel ? ` · ${emptyLabel}` : ''}
      </div>
    );
  }

  return (
    <>
      <style>{`
@keyframes yaoyi-gallery-down { from { transform: translate3d(0, -50%, 0); } to { transform: translate3d(0, 0, 0); } }
@keyframes yaoyi-gallery-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
`}</style>

      <div
        className="yaoyi-gallery"
        style={{
          position: 'relative',
          height: compact ? 320 : 'min(70vh, 640px)',
          overflow: 'hidden',
          borderRadius: 12,
          border: '1px solid rgba(240,198,116,0.18)',
          background: 'rgba(0,0,0,0.28)',
          // 上下淡出，滚动进出更柔和
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%)',
        }}
      >
        <div
          className="yaoyi-gallery-track"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '10px',
            // 注意：这里必须用 animation-* 长写属性，不能用 `animation` 简写。
            // 简写会把 animation-play-state 也写成内联 running，从而压过
            // 样式表里的 `.yaoyi-gallery:hover .yaoyi-gallery-track { animation-play-state: paused }`，
            // 导致"悬停暂停"失效。
            animationName: scrollable ? 'yaoyi-gallery-down' : undefined,
            animationDuration: scrollable ? `${duration}s` : undefined,
            animationTimingFunction: scrollable ? 'linear' : undefined,
            animationIterationCount: scrollable ? 'infinite' : undefined,
            willChange: scrollable ? 'transform' : undefined,
          }}
        >
          {track.map((img, i) => (
            <button
              key={`${img.src}-${i}`}
              type="button"
              onClick={() => setPreview(i % count)}
              aria-label={`放大查看：${img.title || '站点配图'}`}
              className="yaoyi-gallery-item"
              style={{
                position: 'relative',
                display: 'block',
                width: '100%',
                padding: 0,
                border: 'none',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'transparent',
                cursor: 'zoom-in',
                flex: '0 0 auto',
                transition: 'transform 220ms ease, box-shadow 220ms ease',
              }}
            >
              <img
                src={assetPath(img.src)}
                alt={img.title || '站点配图'}
                loading="lazy"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
              {(img.author || img.license) && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: '14px 8px 5px',
                    fontSize: 9.5,
                    lineHeight: 1.3,
                    color: 'rgba(255,255,255,0.82)',
                    textAlign: 'left',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',
                    pointerEvents: 'none',
                  }}
                >
                  {img.author}
                  {img.author && img.license ? ' · ' : ''}
                  {img.license}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 悬停暂停 + 单项微放大：用本地 style 覆盖，避免全局污染 */}
        <style>{`
.yaoyi-gallery:hover .yaoyi-gallery-track { animation-play-state: paused; }
.yaoyi-gallery-item:hover { transform: scale(1.045); box-shadow: 0 10px 28px rgba(0,0,0,0.45); z-index: 2; }
@media (prefers-reduced-motion: reduce) {
  .yaoyi-gallery-track { animation: none !important; }
  .yaoyi-gallery-item { transition: none !important; }
}
`}</style>
      </div>

      {count > 1 && (
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            color: 'rgba(242,236,223,0.42)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>共 {count} 张 · 悬停暂停 · 点击放大</span>
          <span>自动缓速下滑</span>
        </div>
      )}

      {/* 灯箱 */}
      {preview !== null && images[preview] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(4,8,6,0.88)',
            backdropFilter: 'blur(3px)',
            animation: 'yaoyi-gallery-in 180ms ease',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={assetPath(images[preview].src)}
            alt={images[preview].title || '站点配图'}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '86vh',
              borderRadius: 10,
              boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
              cursor: 'default',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 18,
              textAlign: 'center',
              fontSize: 12,
              color: 'rgba(255,255,255,0.72)',
              pointerEvents: 'none',
            }}
          >
            {images[preview].title}
            {images[preview].author ? ` · ${images[preview].author}` : ''}
            {images[preview].license ? ` · ${images[preview].license}` : ''}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="关闭预览"
            style={{
              position: 'absolute',
              top: 18,
              right: 20,
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: 18,
              lineHeight: '30px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
