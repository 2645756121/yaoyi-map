/**
 * tourStage.tsx —— 单站「全屏阅读」沉浸场景
 *
 * 对应原视频的沉浸式长卷场景模块，保留其结构范式：
 *   · 顶部左侧：`第 07 站 / 共 12 站` + 所属线路；右侧：`返回地图 Esc`
 *   · 左上/主区：大字标题 + 副标题 + 分段切换（原视频用于切换桥头/桥中/桥东视角，
 *     这里适配为「概况 / 看点 / 坐标」三份可核对的信息）
 *   · 底部：短横线进度 + 序号 + 上/下一站箭头
 *
 * 说明：右栏为站点配图的纵向自动播放大画廊（TourGallery）：
 * 缓速下滑、悬停暂停并轻微放大、点击进入灯箱；无图时由画廊内部显示兜底文案。
 */
import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import TourGallery from './tourGallery';
import { CATEGORY_COLORS, CATEGORY_LABELS, TOUR_ROUTES, tourNodeImages, type TourNode } from './tourData';

const INK = '#f2ecdf';
const INK_DIM = 'rgba(242,236,223,0.60)';
const GOLD = '#f0c674';
const RED = '#e8482c';

type StageTab = 'intro' | 'sights' | 'geo';

const TABS: Array<{ key: StageTab; label: string }> = [
  { key: 'intro', label: '概况' },
  { key: 'sights', label: '看点' },
  { key: 'geo', label: '坐标' },
];

export interface TourStageProps {
  node: TourNode;
  /** 0 起的站序 */
  index: number;
  total: number;
  compact: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function TourStage({
  node,
  index,
  total,
  compact,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
}: TourStageProps) {
  const [tab, setTab] = useState<StageTab>('intro');

  // 切换站点时回到「概况」，避免停留在一个与当前站无关的分段
  useEffect(() => {
    setTab('intro');
  }, [node.id]);

  const accent = CATEGORY_COLORS[node.category];
  const route = TOUR_ROUTES[0];
  /** 右栏画廊图集：主图 + 额外图（无图时画廊内部显示兜底文案） */
  const galleryImages = tourNodeImages(node);

  const tabBody = () => {
    if (tab === 'sights') {
      return (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
          {node.highlights.map((h, i) => (
            <li key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span
                style={{
                  flex: '0 0 22px',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: `1px solid ${GOLD}66`,
                  color: GOLD,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(242,236,223,0.88)' }}>{h}</span>
            </li>
          ))}
        </ol>
      );
    }
    if (tab === 'geo') {
      const rows: Array<[string, string]> = [
        ['所属区域', node.region],
        ['主题类别', CATEGORY_LABELS[node.category]],
        ['线路序号', `第 ${node.order} 站 / 共 ${total} 站`],
        ['站点坐标', `${node.lon.toFixed(4)}°E, ${node.lat.toFixed(4)}°N`],
        ['底图来源', 'AWS Terrain Tiles / SRTM+ASTER（CC-BY 4.0）'],
      ];
      return (
        <div style={{ display: 'grid', gap: 0 }}>
          {rows.map(([k, v], i) => (
            <div
              key={k}
              style={{
                display: 'flex',
                gap: 14,
                padding: '9px 0',
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <span style={{ flex: '0 0 74px', color: INK_DIM }}>{k}</span>
              <span style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 2, color: 'rgba(242,236,223,0.88)' }}>
          {node.intro}
        </p>
        {/* 分维度详解：人文 / 红色基地 / 瑶医非遗（按节点实际有内容的维度渲染） */}
        {node.sections.length > 0 && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {node.sections.map((s) => (
              <div key={s.title}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      width: 3,
                      height: 13,
                      borderRadius: 2,
                      background: '#c8a86a',
                      flex: '0 0 auto',
                    }}
                  />
                  <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.4, color: '#e8d6ae' }}>
                    {s.title}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.95, color: 'rgba(242,236,223,0.8)' }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1600,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background:
          'radial-gradient(120% 90% at 22% 0%, #26362a 0%, #141d17 46%, #090e0b 100%)',
        color: INK,
        animation: 'tr-stage-in 320ms cubic-bezier(.22,.8,.3,1)',
      }}
    >
      {/* 背景等高线 */}
      <svg
        aria-hidden="true"
        viewBox="0 0 900 620"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }}
      >
        {Array.from({ length: 11 }).map((_, i) => (
          <path
            key={i}
            d={`M-60 ${90 + i * 46} C 180 ${20 + i * 44}, 320 ${190 + i * 42}, 520 ${110 + i * 46}
                S 760 ${20 + i * 46}, 960 ${110 + i * 44}`}
            fill="none"
            stroke="rgba(240,198,116,0.08)"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* 顶栏 */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: compact ? '12px 14px' : '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flex: '0 0 auto',
        }}
      >
        <span
          style={{
            padding: '2px 9px',
            borderRadius: 9999,
            background: accent,
            color: '#fff',
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          {CATEGORY_LABELS[node.category]}
        </span>
        <span style={{ fontSize: 11.5, color: INK_DIM, letterSpacing: 0.5 }}>
          第 {String(index + 1).padStart(2, '0')} 站 / 共 {String(total).padStart(2, '0')} 站
        </span>
        <span style={{ width: 1, height: 11, background: 'rgba(255,255,255,0.18)' }} />
        <span style={{ fontSize: 11.5, color: INK_DIM }}>{route.name}</span>
        <span style={{ flex: '1 1 auto' }} />
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 11px',
            borderRadius: 9999,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: INK,
            fontSize: 11.5,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <X size={13} />
          返回地图
          <span style={{ color: INK_DIM, fontSize: 10 }}>Esc</span>
        </button>
      </div>

      {/* 主体 */}
      <div
        style={{
          position: 'relative',
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          alignItems: compact ? 'stretch' : 'center',
          gap: compact ? 16 : 42,
          padding: compact ? '18px 16px' : '28px clamp(24px, 5vw, 64px)',
          overflowY: 'auto',
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 560 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, marginBottom: 10 }}>
            {node.region} · {node.subtitle}
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily: '"Songti SC","STSong","SimSun",serif',
              fontSize: compact ? 26 : 'clamp(28px, 3.4vw, 40px)',
              fontWeight: 700,
              letterSpacing: 2,
              lineHeight: 1.28,
              color: '#faf5e9',
            }}
          >
            {node.name}
          </h2>

          {/* 分段切换（对应原视频的场景视角切换） */}
          <div
            style={{
              display: 'inline-flex',
              gap: 2,
              marginTop: 18,
              padding: 3,
              borderRadius: 9999,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-pressed={active}
                  style={{
                    padding: '5px 15px',
                    borderRadius: 9999,
                    border: 'none',
                    background: active ? 'rgba(240,198,116,0.18)' : 'transparent',
                    color: active ? GOLD : INK_DIM,
                    fontSize: 11.5,
                    fontWeight: active ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'background 180ms ease, color 180ms ease',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 16, minHeight: 110 }}>{tabBody()}</div>

          <div style={{ marginTop: 16, fontSize: 10, color: 'rgba(242,236,223,0.38)', lineHeight: 1.7 }}>
            内容依据公开资料整理；配图含 Wikimedia Commons 与政府/文旅授权图，署名见图片与灯箱。
          </div>
        </div>

        <div
          style={{
            flex: compact ? '0 0 auto' : '0 0 44%',
            width: compact ? '100%' : 'auto',
            maxWidth: 540,
            alignSelf: compact ? 'stretch' : 'center',
          }}
        >
            <TourGallery images={galleryImages} compact={compact} emptyLabel={node.shortName} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: 8,
                fontSize: 10,
                color: 'rgba(242,236,223,0.44)',
              }}
            >
              <span>
                第 {String(index + 1).padStart(2, '0')} 站 · {node.shortName}
              </span>
              <span>{galleryImages.length} 张配图 · 署名见图片</span>
            </div>
        </div>
      </div>

      {/* 底部：短横线进度 + 序号 + 上/下一站 */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: compact ? '10px 14px 12px' : '12px 24px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          flex: '0 0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '1 1 auto', minWidth: 0 }}>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              style={{
                height: 3,
                flex: i === index ? '0 0 26px' : '1 1 0',
                maxWidth: 26,
                borderRadius: 2,
                background: i === index ? GOLD : i < index ? 'rgba(232,72,44,0.75)' : 'rgba(255,255,255,0.18)',
                transition: 'all 260ms ease',
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontSize: 11,
            color: INK_DIM,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <button
          type="button"
          aria-label="上一站"
          disabled={!hasPrev}
          onClick={onPrev}
          style={{
            width: 30,
            height: 30,
            padding: 0,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.16)',
            background: 'rgba(255,255,255,0.06)',
            color: INK,
            cursor: hasPrev ? 'pointer' : 'default',
            opacity: hasPrev ? 1 : 0.35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          aria-label="下一站"
          disabled={!hasNext}
          onClick={onNext}
          style={{
            width: 30,
            height: 30,
            padding: 0,
            borderRadius: '50%',
            border: `1px solid ${hasNext ? 'rgba(232,72,44,0.6)' : 'rgba(255,255,255,0.16)'}`,
            background: hasNext ? RED : 'rgba(255,255,255,0.06)',
            color: '#fff',
            cursor: hasNext ? 'pointer' : 'default',
            opacity: hasNext ? 1 : 0.35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
