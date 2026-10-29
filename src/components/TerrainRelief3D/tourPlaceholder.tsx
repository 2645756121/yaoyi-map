/**
 * tourPlaceholder.tsx —— 路线节点详情的**统一图片占位符**
 *
 * 交付约定：
 *   · 所有节点共用同一套尺寸（16:9）、同一套留白、同一套文案结构，只把地点名作为副文案；
 *   · 以虚线边框 + 图标 + "图片占位符 / 待替换 · 地点名" 明示"此处尚未接入实拍素材"；
 *   · 后续替换真实素材时，只需把本组件换成 `<img src=.../>`，调用方无需改动。
 */
import React from 'react';

export interface TourPlaceholderProps {
  /** 地点名（显示在"待替换"后面，便于对照素材） */
  label: string;
}

export default function TourPlaceholder({ label }: TourPlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={`${label} 图片占位符`}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px dashed #b9c8b6',
        background:
          'linear-gradient(135deg, #eef3ec 0%, #e2ead9 52%, #ece3d0 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
      }}
    >
      {/* 统一的"图片"图标 */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7f9a78"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <circle cx="8.6" cy="9.6" r="1.7" />
        <path d="M21 15.5 L15.6 10.2 L7 19" />
      </svg>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7d70', letterSpacing: 0.5 }}>
        图片占位符
      </div>
      <div style={{ fontSize: 10, color: '#8a9a90' }}>待替换 · {label}</div>
    </div>
  );
}
