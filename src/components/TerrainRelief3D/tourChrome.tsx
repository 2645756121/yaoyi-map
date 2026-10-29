/**
 * tourChrome.tsx —— 复刻「3D 交互课件」的地图外框交互层（适配到粤北旅游路线）
 *
 * 对应原视频中的五类界面元素（均为**可迁移的交互范式**，非素材照搬）：
 *   1. 封面页：大字标题 + 线路摘要 + 主标语 + 「进入路线」CTA
 *   2. 顶栏工具条：自动演示 / 剖面 / 全景 / 全屏 / 帮助
 *   3. 左上指北针：随相机方位实时旋转，点击回到路线全景
 *   4. 底部站点时间轴：圆点 + 站名刻度 + 当前站高亮 + 两端翻页
 *   5. 左下海拔剖面：真实地形高程折线，悬停读数、点击跳转到最近站点
 *
 * 视觉语言：深墨绿玻璃 + 暖金刻度 + 朱红行进色，与浮雕底图（深色台座 + 赭红路线）统一。
 */
import React, { useId, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LineChart,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  X,
} from 'lucide-react';
import { CATEGORY_LABELS, TOUR_ROUTES, type TourNode } from './tourData';
import type { RouteProfile } from './tourProfile';

/* ------------------------------------------------------------ 设计 token */

const INK = '#efe9db';
const INK_DIM = 'rgba(239,233,219,0.62)';
const GOLD = '#f0c674';
const RED = '#e8482c';
const GLASS =
  'linear-gradient(180deg, rgba(24,32,26,0.94) 0%, rgba(13,19,15,0.97) 100%)';
const GLASS_BORDER = '1px solid rgba(240,198,116,0.20)';
const SHADOW = '0 10px 30px rgba(0,0,0,0.38)';

/** 统一的浅色文字/暗色玻璃按钮 */
function chromeBtn(active = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 10px',
    borderRadius: 7,
    border: `1px solid ${active ? 'rgba(240,198,116,0.55)' : 'rgba(255,255,255,0.14)'}`,
    background: active ? 'rgba(240,198,116,0.16)' : 'rgba(255,255,255,0.05)',
    color: active ? GOLD : INK,
    fontSize: 11.5,
    lineHeight: 1,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease',
  };
}

function fmtMeters(v: number): string {
  return `${Math.round(v).toLocaleString('zh-CN')} m`;
}

/* ------------------------------------------------------------ 指北针 */

export interface TourCompassProps {
  /** 由父组件把相机方位写入该节点的 transform（避免每帧 setState 触发整棵树重渲染） */
  roseRef: React.RefObject<HTMLDivElement>;
  onReset: () => void;
}

/** 罗盘环（N/E/S/W + 指针），整体随相机方位旋转 */
export function TourCompass({ roseRef, onReset }: TourCompassProps) {
  return (
    <button
      type="button"
      onClick={onReset}
      title="指北针 · 点击回到路线全景"
      aria-label="指北针，点击回到路线全景"
      style={{
        position: 'absolute',
        // 84 → 122：缩放控件下方新增了「旅游路线」入口按钮（占 82–112），
        // 原来 84 的位置会与它重叠，整体下移让开
        top: 122,
        left: 12,
        width: 50,
        height: 50,
        padding: 0,
        borderRadius: '50%',
        border: GLASS_BORDER,
        background: GLASS,
        boxShadow: SHADOW,
        cursor: 'pointer',
        zIndex: 1310,
      }}
    >
      <div
        ref={roseRef}
        style={{
          position: 'absolute',
          inset: 3,
          transition: 'transform 160ms linear',
          willChange: 'transform',
        }}
      >
        <svg viewBox="0 0 44 44" width="100%" height="100%" aria-hidden="true">
          <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,0.20)" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const inner = i % 3 === 0 ? 14.5 : 16.5;
            return (
              <line
                key={i}
                x1={22 + Math.sin(a) * inner}
                y1={22 - Math.cos(a) * inner}
                x2={22 + Math.sin(a) * 18}
                y2={22 - Math.cos(a) * 18}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="0.8"
              />
            );
          })}
          {/* 北向指针（朱红）+ 南向配重（灰白） */}
          <polygon points="22,6.5 25.4,22 22,19.4 18.6,22" fill={RED} />
          <polygon points="22,37.5 25.4,22 22,24.6 18.6,22" fill="rgba(255,255,255,0.55)" />
          <text x="22" y="5" textAnchor="middle" fontSize="5.4" fontWeight="700" fill={GOLD}>
            N
          </text>
          <text x="40.6" y="24" textAnchor="middle" fontSize="5" fill={INK_DIM}>
            E
          </text>
          <text x="22" y="42.8" textAnchor="middle" fontSize="5" fill={INK_DIM}>
            S
          </text>
          <text x="3.4" y="24" textAnchor="middle" fontSize="5" fill={INK_DIM}>
            W
          </text>
        </svg>
      </div>
      <span
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 1,
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: GOLD,
          transform: 'translateX(-50%)',
        }}
      />
    </button>
  );
}

/* ------------------------------------------------------------ 顶栏工具条 */

export interface TourToolbarProps {
  auto: boolean;
  profile: boolean;
  fullscreen: boolean;
  compact: boolean;
  onToggleAuto: () => void;
  onToggleProfile: () => void;
  onOverview: () => void;
  onToggleFullscreen: () => void;
  onToggleHelp: () => void;
}

/** 顶栏功能开关（对应原视频的「自动演示 / 剖面 / 全景 / 全屏 / 帮助」） */
export function TourToolbar({
  auto,
  profile,
  fullscreen,
  compact,
  onToggleAuto,
  onToggleProfile,
  onOverview,
  onToggleFullscreen,
  onToggleHelp,
}: TourToolbarProps) {
  const item = (icon: React.ReactNode, label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      style={chromeBtn(active)}
    >
      {icon}
      {!compact && <span>{label}</span>}
    </button>
  );

  return (
    <div
      style={
        compact
          ? {
              // 窄屏：右上控制台占位较宽，工具条改为左侧竖向工具轨，避免与面板重叠
              position: 'absolute',
              top: 142,
              left: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '5px 4px',
              borderRadius: 12,
              border: GLASS_BORDER,
              background: GLASS,
              boxShadow: SHADOW,
              zIndex: 1310,
              backdropFilter: 'blur(6px)',
            }
          : {
              // 宽屏：贴左上（缩放控件右侧），避开右上角的「地形浮雕控制台」
              position: 'absolute',
              top: 12,
              left: 56,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 6px',
              borderRadius: 9999,
              border: GLASS_BORDER,
              background: GLASS,
              boxShadow: SHADOW,
              zIndex: 1310,
              backdropFilter: 'blur(6px)',
            }
      }
    >
      {item(
        auto ? <Pause size={13} /> : <Play size={13} />,
        auto ? '暂停演示' : '自动演示',
        auto,
        onToggleAuto,
      )}
      {item(<LineChart size={13} />, '剖面', profile, onToggleProfile)}
      {item(<MapIcon size={13} />, '全景', false, onOverview)}
      {item(
        fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />,
        fullscreen ? '退出全屏' : '全屏',
        fullscreen,
        onToggleFullscreen,
      )}
      {item(<HelpCircle size={13} />, '帮助', false, onToggleHelp)}
    </div>
  );
}

/* ------------------------------------------------------------ 底部站点时间轴 */

export interface TourTimelineProps {
  nodes: TourNode[];
  activeId: string | null;
  compact: boolean;
  onSelect: (node: TourNode) => void;
}

/** 底部站点时间轴：站点圆点 + 站名刻度 + 当前站高亮 + 两端翻页 */
export function TourTimeline({ nodes, activeId, compact, onSelect }: TourTimelineProps) {
  const activeIndex = nodes.findIndex((n) => n.id === activeId);
  const ratio = activeIndex > 0 && nodes.length > 1 ? activeIndex / (nodes.length - 1) : 0;
  const route = TOUR_ROUTES[0];

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 1300,
        padding: compact ? '7px 8px 5px' : '9px 12px 7px',
        borderRadius: 12,
        border: GLASS_BORDER,
        background: GLASS,
        boxShadow: SHADOW,
        color: INK,
      }}
    >
      {/* 头部：路线名 · 站数 · 当前站 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, marginBottom: compact ? 4 : 6 }}>
        <span style={{ width: 14, height: 3, borderRadius: 2, background: route.color, flex: '0 0 auto' }} />
        <span style={{ fontWeight: 600, color: INK, whiteSpace: 'nowrap' }}>{route.name}</span>
        <span style={{ color: INK_DIM, whiteSpace: 'nowrap' }}>· {nodes.length} 站</span>
        <span style={{ flex: '1 1 auto' }} />
        <span style={{ color: activeIndex >= 0 ? GOLD : INK_DIM, whiteSpace: 'nowrap' }}>
          {activeIndex >= 0 ? `第 ${activeIndex + 1} 站 · ${nodes[activeIndex].shortName}` : '点击站点查看图文'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 8 }}>
        <button
          type="button"
          aria-label="上一站"
          disabled={activeIndex <= 0}
          onClick={() => activeIndex > 0 && onSelect(nodes[activeIndex - 1])}
          style={{
            ...chromeBtn(false),
            padding: 4,
            opacity: activeIndex > 0 ? 1 : 0.32,
            cursor: activeIndex > 0 ? 'pointer' : 'default',
          }}
        >
          <ChevronLeft size={14} />
        </button>

        <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0, padding: '0 2px' }}>
          {/* 轨迹底线 + 已行进段 */}
          <div
            style={{
              position: 'absolute',
              left: 2,
              right: 2,
              top: 6,
              height: 2,
              borderRadius: 1,
              background: 'rgba(255,255,255,0.18)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 2,
              top: 6,
              height: 2,
              borderRadius: 1,
              width: `calc(${(ratio * 100).toFixed(3)}% - ${(ratio * 4).toFixed(2)}px)`,
              background: `linear-gradient(90deg, ${RED}, ${GOLD})`,
              transition: 'width 320ms cubic-bezier(.22,.8,.3,1)',
            }}
          />

          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
            {nodes.map((n, i) => {
              const active = n.id === activeId;
              const done = activeIndex >= 0 && i < activeIndex;
              return (
                <button
                  key={n.id}
                  type="button"
                  title={`第 ${i + 1} 站 · ${n.name}`}
                  aria-label={`第 ${i + 1} 站 ${n.name}`}
                  onClick={() => onSelect(n)}
                  style={{
                    width: compact ? 18 : 22,
                    height: compact ? 18 : 22,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: active ? 12 : 8,
                      height: active ? 12 : 8,
                      borderRadius: '50%',
                      background: active ? RED : done ? 'rgba(232,72,44,0.85)' : 'rgba(255,255,255,0.55)',
                      border: active ? '2px solid #fff' : '1px solid rgba(0,0,0,0.25)',
                      boxShadow: active
                        ? `0 0 0 4px rgba(232,72,44,0.28), 0 0 12px rgba(232,72,44,0.85)`
                        : 'none',
                      transition: 'all 260ms cubic-bezier(.34,1.25,.64,1)',
                    }}
                  />
                </button>
              );
            })}
          </div>

          {!compact && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              {nodes.map((n, i) => (
                <span
                  key={n.id}
                  style={{
                    flex: '1 1 0',
                    textAlign: 'center',
                    fontSize: 10.5,
                    lineHeight: 1.2,
                    color: n.id === activeId ? GOLD : i <= activeIndex ? 'rgba(239,233,219,0.82)' : INK_DIM,
                    fontWeight: n.id === activeId ? 700 : 400,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    transition: 'color 200ms ease',
                  }}
                >
                  {n.shortName}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="下一站"
          disabled={activeIndex < 0 || activeIndex >= nodes.length - 1}
          onClick={() => activeIndex >= 0 && activeIndex < nodes.length - 1 && onSelect(nodes[activeIndex + 1])}
          style={{
            ...chromeBtn(false),
            padding: 4,
            opacity: activeIndex >= 0 && activeIndex < nodes.length - 1 ? 1 : 0.32,
            cursor: activeIndex >= 0 && activeIndex < nodes.length - 1 ? 'pointer' : 'default',
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 海拔剖面 */

export interface ElevationProfileProps {
  profile: RouteProfile;
  activeId: string | null;
  nodes: TourNode[];
  compact: boolean;
  onSelect: (node: TourNode) => void;
}

const VB_W = 260;
const VB_H = 62;
const PAD_L = 3;
const PAD_R = 3;
const PAD_T = 7;
const PAD_B = 11;

/** 沿线地形海拔剖面：折线 + 面积填充 + 站点刻度 + 悬停读数 + 点击跳转 */
export function ElevationProfile({
  profile,
  activeId,
  nodes,
  compact,
  onSelect,
}: ElevationProfileProps) {
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);

  const { minElev, maxElev, totalKm, points } = profile;
  const span = Math.max(maxElev - minElev, 40);

  const xOfDist = (d: number) =>
    PAD_L + (totalKm > 0 ? d / totalKm : 0) * (VB_W - PAD_L - PAD_R);
  const yOfElev = (e: number) =>
    PAD_T + (1 - (e - minElev) / span) * (VB_H - PAD_T - PAD_B);

  const shape = useMemo(() => {
    if (points.length === 0) return { line: '', area: '' };
    const coords = points.map((p) => `${xOfDist(p.distKm).toFixed(2)},${yOfElev(p.elev).toFixed(2)}`);
    const base = VB_H - PAD_B;
    const area = `M${xOfDist(0).toFixed(2)},${base} L${coords.join(' L')} L${xOfDist(totalKm).toFixed(2)},${base} Z`;
    return { line: `M${coords.join(' L')}`, area };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, totalKm, minElev, maxElev]);

  const activeIndex = nodes.findIndex((n) => n.id === activeId);
  const activeSample =
    activeIndex >= 0 ? profile.stationIndices[activeIndex] ?? -1 : -1;

  const hoverPoint = hover !== null ? points[hover] : null;

  const pickByPointer = (clientX: number): number => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return -1;
    const vbX = ((clientX - rect.left) / rect.width) * VB_W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(xOfDist(points[i].distKm) - vbX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const handleClick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const vbX = ((clientX - rect.left) / rect.width) * VB_W;
    let best = 0;
    let bestD = Infinity;
    profile.stationDistKm.forEach((d, i) => {
      const delta = Math.abs(xOfDist(d) - vbX);
      if (delta < bestD) {
        bestD = delta;
        best = i;
      }
    });
    const node = nodes[best];
    if (node) onSelect(node);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: compact ? 82 : 100,
        width: compact ? 208 : 272,
        zIndex: 1300,
        padding: '8px 10px 7px',
        borderRadius: 10,
        border: GLASS_BORDER,
        background: GLASS,
        boxShadow: SHADOW,
        color: INK,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <LineChart size={12} color={GOLD} />
        <span style={{ fontWeight: 700, color: INK }}>线路海拔剖面</span>
        <span style={{ flex: '1 1 auto' }} />
        <span style={{ color: INK_DIM }}>最高 {fmtMeters(maxElev)}</span>
      </div>

      <div
        style={{
          marginTop: 3,
          fontSize: 11,
          height: 15,
          color: hoverPoint ? GOLD : INK_DIM,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {hoverPoint
          ? `海拔 ${fmtMeters(hoverPoint.elev)} · 距起点 ${hoverPoint.distKm.toFixed(1)} km`
          : activeIndex >= 0
            ? `当前 ${nodes[activeIndex].shortName} · ${fmtMeters(points[activeSample]?.elev ?? 0)}`
            : `沿线 ${fmtMeters(minElev)} – ${fmtMeters(maxElev)} · 全长 ${totalKm.toFixed(0)} km`}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: 62, cursor: 'crosshair' }}
        onPointerMove={(e) => {
          const i = pickByPointer(e.clientX);
          if (i >= 0) setHover(i);
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => handleClick(e.clientX)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED} stopOpacity="0.55" />
            <stop offset="100%" stopColor={RED} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* 水平参考线（1/4、1/2、3/4） */}
        {[0.25, 0.5, 0.75].map((k) => {
          const y = PAD_T + k * (VB_H - PAD_T - PAD_B);
          return (
            <line
              key={k}
              x1={PAD_L}
              x2={VB_W - PAD_R}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="0.7"
            />
          );
        })}

        <path d={shape.area} fill={`url(#${gradientId})`} />
        <path d={shape.line} fill="none" stroke={RED} strokeWidth="1.6" strokeLinejoin="round" />

        {/* 站点刻度 */}
        {profile.stationDistKm.map((d, i) => {
          const x = xOfDist(d);
          const isActive = i === activeIndex;
          const y = yOfElev(points[profile.stationIndices[i]]?.elev ?? minElev);
          return (
            <g key={nodes[i]?.id ?? i}>
              <line
                x1={x}
                x2={x}
                y1={isActive ? PAD_T - 1 : PAD_T + 4}
                y2={VB_H - PAD_B + 2}
                stroke={isActive ? GOLD : 'rgba(255,255,255,0.22)'}
                strokeWidth={isActive ? 1.2 : 0.7}
                strokeDasharray={isActive ? undefined : '2 2'}
              />
              <circle
                cx={x}
                cy={y}
                r={isActive ? 2.8 : 1.8}
                fill={isActive ? GOLD : '#fff'}
                stroke={RED}
                strokeWidth={isActive ? 1 : 0.7}
              />
            </g>
          );
        })}

        {/* 悬停十字线 */}
        {hoverPoint && (
          <line
            x1={xOfDist(hoverPoint.distKm)}
            x2={xOfDist(hoverPoint.distKm)}
            y1={PAD_T}
            y2={VB_H - PAD_B}
            stroke={GOLD}
            strokeWidth="0.9"
          />
        )}
      </svg>

      <div style={{ marginTop: 1, fontSize: 9.5, color: 'rgba(239,233,219,0.48)' }}>
        移动查看海拔 · 点击跳转到最近站点
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 帮助 */

export interface TourHelpProps {
  onClose: () => void;
}

/** 帮助面板：集中说明路线模式下的全部操作（对应原视频的「帮助」入口） */
export function TourHelp({ onClose }: TourHelpProps) {
  const rows: Array<[string, string]> = [
    ['拖拽 / 滚轮 / 右键', '旋转 · 缩放 · 平移浮雕地形'],
    ['点击站点圆点', '查看该站图文，并自动推近地形'],
    ['← / →', '切换上一站 / 下一站'],
    ['自动演示', '按顺序逐站巡航，可随时暂停'],
    ['剖面', '显示或隐藏左下角的沿线海拔剖面'],
    ['全景', '回到整条路线的总览视角'],
    ['全屏阅读', '进入单站的沉浸式阅读场景'],
    ['Esc', '依次关闭帮助 / 全屏阅读 / 详情面板'],
  ];
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        background: 'rgba(6,10,8,0.62)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="路线模式操作帮助"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 100%)',
          maxHeight: '82%',
          overflowY: 'auto',
          padding: '16px 18px 14px',
          borderRadius: 14,
          border: GLASS_BORDER,
          background: GLASS,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          color: INK,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <HelpCircle size={15} color={GOLD} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>路线模式操作说明</span>
          <span style={{ flex: '1 1 auto' }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭帮助"
            style={{ ...chromeBtn(false), padding: 4 }}
          >
            <X size={14} />
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: INK_DIM, marginBottom: 10 }}>
          所有操作都可在地图上直接完成，无需离开当前页面
        </div>
        {rows.map(([k, v], i) => (
          <div
            key={k}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '7px 0',
              borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.07)',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <span
              style={{
                flex: '0 0 128px',
                color: GOLD,
                fontWeight: 600,
                fontFamily: 'ui-monospace,SFMono-Regular,Consolas,monospace',
                fontSize: 11,
              }}
            >
              {k}
            </span>
            <span style={{ color: 'rgba(239,233,219,0.82)' }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop: 12, fontSize: 10, color: 'rgba(239,233,219,0.42)', lineHeight: 1.6 }}>
          站点类别：{(['red', 'scenic', 'yao', 'hub'] as const)
            .map((c) => CATEGORY_LABELS[c])
            .join(' / ')}
          ；节点配色与地图上的序号徽标一致。
        </div>
      </section>
    </div>
  );
}
