/**
 * PanelKit.tsx —— 三个知识面板（草药分类目录 / 瑶医技法图集 / 瑶医基础知识）的共用 UI 套件
 *
 * 背景：三块面板此前各写一套——头部高度、图标尺寸、搜索框、筛选片、卡片圆角、底部栏
 * 全都不一样，并排/先后打开时风格割裂。这里把"外壳"统一，只保留各自的主色（tone）差异。
 *
 * 统一规格：
 *   · 遮罩：bg-black/45 + 居中，padding 12/24px
 *   · 面板：max-w-5xl、rounded-2xl、max-h-[88vh]、白底 + 细边框 + 大阴影
 *   · 头部：px-4 py-3.5、图标 44px（渐变圆角）、标题 16px 粗体、副标题 11px 灰
 *   · 搜索：高 38px、圆角 12px、左侧放大镜图标
 *   · 筛选片：高 28px、圆角全、选中为主色实心
 *   · 底部：px-4 py-2、11px 居中灰字
 */
import React from 'react';
import { Search, X } from 'lucide-react';

export type PanelTone = 'amber' | 'emerald' | 'violet' | 'teal';

/** 主色 → 图标渐变 / 选中态底色 */
const TONE: Record<PanelTone, { grad: string; solid: string; ring: string; text: string }> = {
  amber: {
    grad: 'from-amber-500 to-orange-600',
    solid: 'bg-amber-600 text-white border-amber-600',
    ring: 'focus:ring-amber-300/60',
    text: 'text-amber-700',
  },
  emerald: {
    grad: 'from-emerald-500 to-teal-600',
    solid: 'bg-emerald-600 text-white border-emerald-600',
    ring: 'focus:ring-emerald-300/60',
    text: 'text-emerald-700',
  },
  violet: {
    grad: 'from-violet-500 to-indigo-600',
    solid: 'bg-violet-600 text-white border-violet-600',
    ring: 'focus:ring-violet-300/60',
    text: 'text-violet-700',
  },
  teal: {
    grad: 'from-teal-500 to-cyan-600',
    solid: 'bg-teal-600 text-white border-teal-600',
    ring: 'focus:ring-teal-300/60',
    text: 'text-teal-700',
  },
};

export interface PanelOverlayProps {
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}

/** 遮罩层：点空白关闭 */
export const PanelOverlay: React.FC<PanelOverlayProps> = ({ onClose, label, children }) => (
  <div
    className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/45 p-3 sm:p-6"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
    aria-label={label}
  >
    {children}
  </div>
);

export interface PanelSurfaceProps {
  children: React.ReactNode;
  className?: string;
}

/** 面板本体：统一宽度/圆角/阴影/高度上限 */
export const PanelSurface: React.FC<PanelSurfaceProps> = ({ children, className = '' }) => (
  <div
    className={`w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-black/[0.06] overflow-hidden flex flex-col max-h-[88vh] ${className}`}
    onClick={(e) => e.stopPropagation()}
  >
    {children}
  </div>
);

export interface PanelHeaderProps {
  icon: React.ReactNode;
  tone: PanelTone;
  title: string;
  subtitle: string;
  onClose: () => void;
  closeLabel: string;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  icon,
  tone,
  title,
  subtitle,
  onClose,
  closeLabel,
}) => (
  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/[0.06] bg-white flex-shrink-0">
    <span
      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${TONE[tone].grad} text-white flex items-center justify-center flex-shrink-0 shadow-sm`}
      aria-hidden
    >
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <h2 className="text-base font-bold leading-tight text-gray-900 truncate">{title}</h2>
      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{subtitle}</p>
    </div>
    <button
      type="button"
      onClick={onClose}
      aria-label={closeLabel}
      className={`w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 flex items-center justify-center flex-shrink-0 transition-colors focus:outline-none focus:ring-4 ${TONE[tone].ring}`}
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

export interface PanelSearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  tone: PanelTone;
}

export const PanelSearch: React.FC<PanelSearchProps> = ({ value, onChange, placeholder, tone }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full h-[38px] pl-9 pr-9 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:bg-white focus:border-transparent ${TONE[tone].ring}`}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="清除搜索"
        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 flex items-center justify-center"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

export interface PanelChipProps {
  active: boolean;
  onClick: () => void;
  tone: PanelTone;
  children: React.ReactNode;
  /** 无障碍：视图切换这类多选一控件需要明确状态 */
  ariaLabel?: string;
  ariaPressed?: boolean;
}

export const PanelChip: React.FC<PanelChipProps> = ({
  active,
  onClick,
  tone,
  children,
  ariaLabel,
  ariaPressed,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-pressed={ariaPressed}
    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
      active
        ? TONE[tone].solid
        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
    }`}
  >
    {children}
  </button>
);

export const PanelChipRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-center gap-1.5">{children}</div>
);

export const PanelFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-4 py-2 border-t border-black/[0.06] bg-gray-50/60 text-center text-[11px] text-gray-500 flex-shrink-0">
    {children}
  </div>
);

export const PanelBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`flex-1 min-h-0 overflow-y-auto ${className}`}>{children}</div>;
