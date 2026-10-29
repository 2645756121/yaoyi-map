/**
 * EntryCard.tsx —— 顶栏三个入口（草药分类目录 / 瑶医技法 / 瑶医基础知识）的共用卡片
 *
 * 之所以抽成组件：三张卡此前各写一套，图标尺寸、圆角、字号、副标题、箭头各不相同，
 * 并排时高度与留白对不齐。统一到这里后，三者只通过 tone 区分色系，结构完全一致。
 *
 * 规格（与 885px 视口实测一致）：
 *   · 高 69px：px-3 sm:px-4 py-3
 *   · 图标 40px 方圆形 + 白色 15% 蒙层
 *   · 标题 text-sm sm:text-base font-bold；副标题 text-[11px]
 *   · 右侧统一一个 › 箭头
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';

export type EntryTone = 'amber' | 'emerald' | 'violet';

const TONE_CLASS: Record<EntryTone, string> = {
  amber: 'from-amber-600 via-orange-600 to-amber-600 hover:from-amber-500 hover:via-orange-500 hover:to-amber-500 focus:ring-amber-300/60',
  emerald:
    'from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 focus:ring-emerald-300/60',
  violet:
    'from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:via-indigo-500 hover:to-violet-500 focus:ring-violet-300/60',
};

export interface EntryCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  /** 右侧数字徽标，如「49 种」「44 项」 */
  badge?: string;
  ariaLabel: string;
  tone: EntryTone;
  onClick: () => void;
}

const EntryCard: React.FC<EntryCardProps> = ({
  icon,
  title,
  subtitle,
  badge,
  ariaLabel,
  tone,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className={`group w-full h-full flex items-center gap-2.5 px-3 sm:px-4 py-3 rounded-2xl shadow-md hover:shadow-lg bg-gradient-to-r ${TONE_CLASS[tone]} text-white transition-all duration-300 focus:outline-none focus:ring-4`}
  >
    <span
      className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
      aria-hidden
    >
      {icon}
    </span>
    <span className="flex-1 min-w-0 text-left">
      <span className="flex items-center gap-1.5">
        <span className="text-sm sm:text-base font-bold truncate">{title}</span>
        {badge && (
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 bg-white/20 text-white text-[10px] rounded-full font-semibold flex-shrink-0">
            {badge}
          </span>
        )}
      </span>
      <span className="block text-[11px] text-white/80 truncate mt-0.5">{subtitle}</span>
    </span>
    <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
  </button>
);

export default EntryCard;
