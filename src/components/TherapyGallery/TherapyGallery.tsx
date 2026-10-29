/**
 * TherapyGallery.tsx —— 瑶医技法图集（全地区汇总）
 *
 * 背景：原先"关联瑶医技法"只散落在各个草药详情里，用户无法一览全部 44 项技法。
 * 本组件把所有地区（广西/广东/湖南/云南/贵州/江西/海南/重庆/四川）的技法汇总成图集，
 * 支持关键词搜索 + 体系分类 + 地区筛选，点击卡片直接打开既有的 TherapyModal。
 *
 * 设计要点：
 *   · 技法没有实拍图，用"首字徽记 + 体系配色"生成视觉标识，避免全部撞成同一个占位图；
 *   · 外壳（遮罩/头部/搜索/筛选片/底部）统一走 common/PanelKit，与另外两个面板一致；
 *   · 不做假数据：数量、地区、关联草药数全部从 mockData 推导。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MapPin, Leaf } from 'lucide-react';
import { therapies, regions, getRegionById } from '../../data/mockData';
import { useMapStore } from '../../store/mapStore';
import EntryCard from '../common/EntryCard';
import {
  PanelBody,
  PanelChip,
  PanelChipRow,
  PanelFooter,
  PanelHeader,
  PanelOverlay,
  PanelSearch,
  PanelSurface,
} from '../common/PanelKit';
import type { Therapy } from '../../types';

/** 体系 → 展示用分类（把"国家级非物质文化遗产·外治疗法"这类长描述归一） */
function categoryOf(system: string): { key: string; label: string } {
  if (system.includes('内治')) return { key: 'neizhi', label: '内治' };
  if (system.includes('外治')) return { key: 'waizhi', label: '外治' };
  if (system.includes('经络')) return { key: 'jingluo', label: '经络' };
  if (system.includes('养生')) return { key: 'yangsheng', label: '养生' };
  if (system.includes('综合')) return { key: 'zonghe', label: '综合' };
  return { key: 'jichu', label: '基础' };
}

const CATEGORY_STYLE: Record<string, { bg: string }> = {
  neizhi: { bg: 'from-emerald-500 to-teal-600' },
  waizhi: { bg: 'from-sky-500 to-cyan-600' },
  jingluo: { bg: 'from-violet-500 to-purple-600' },
  yangsheng: { bg: 'from-amber-500 to-orange-600' },
  zonghe: { bg: 'from-rose-500 to-pink-600' },
  jichu: { bg: 'from-slate-500 to-slate-600' },
};

interface TherapyEntry {
  therapy: Therapy;
  category: { key: string; label: string };
  regionName: string;
}

const ALL_ENTRIES: TherapyEntry[] = therapies.map((t) => ({
  therapy: t,
  category: categoryOf(t.system),
  regionName: getRegionById(t.regionId)?.name ?? t.regionId,
}));

const CATEGORIES = ['全部', '内治', '外治', '经络', '养生', '综合', '基础'];

const TherapyGallery: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('全部');
  const [regionId, setRegionId] = useState<string>('all');

  // 只保留确实有技法的地区，避免出现空分类
  const regionOptions = useMemo(() => {
    const ids = new Set(therapies.map((t) => t.regionId));
    return regions.filter((r) => ids.has(r.id));
  }, []);

  const list = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return ALL_ENTRIES.filter((e) => {
      if (category !== '全部' && e.category.label !== category) return false;
      if (regionId !== 'all' && e.therapy.regionId !== regionId) return false;
      if (!kw) return true;
      const hay = [
        e.therapy.name,
        e.therapy.nameEn,
        e.therapy.description,
        e.therapy.system,
        e.regionName,
        ...(e.therapy.applicableConditions || []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(kw);
    });
  }, [keyword, category, regionId]);

  const openTherapy = (t: Therapy) => {
    const st = useMapStore.getState();
    st.setSelectedTherapy(t);
    st.openTherapyModal();
  };

  // Esc 关闭（图集是遮罩层，需自己处理键盘）
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <>
      {/* ---------------- 入口条（与草药分类目录并列） ---------------- */}
      {!isOpen && (
        <section className="w-full" aria-label="瑶医技法入口">
          <EntryCard
            tone="emerald"
            icon={<Heart className="w-5 h-5" />}
            title="瑶医技法"
            subtitle="九大地区技法汇总图集"
            badge={`${therapies.length} 项`}
            ariaLabel="打开瑶医技法图集"
            onClick={() => setIsOpen(true)}
          />
        </section>
      )}

      {/* ---------------- 图集面板（统一 PanelKit 外壳） ---------------- */}
      {isOpen &&
        createPortal(
          <PanelOverlay onClose={() => setIsOpen(false)} label="瑶医技法图集">
            <PanelSurface>
              <PanelHeader
                tone="emerald"
                icon={<Heart className="w-5 h-5" />}
                title="瑶医技法图集"
                subtitle={`全地区汇总 · 共 ${therapies.length} 项技法`}
                onClose={() => setIsOpen(false)}
                closeLabel="关闭瑶医技法图集"
              />

              <div className="px-4 pt-3 pb-2 space-y-2 border-b border-black/[0.05]">
                <PanelSearch
                  value={keyword}
                  onChange={setKeyword}
                  placeholder="搜索技法名称、适用症状、地区…"
                  tone="emerald"
                />
                <PanelChipRow>
                  {CATEGORIES.map((c) => (
                    <PanelChip
                      key={c}
                      active={category === c}
                      onClick={() => setCategory(c)}
                      tone="emerald"
                    >
                      {c}
                    </PanelChip>
                  ))}
                </PanelChipRow>
                <PanelChipRow>
                  <PanelChip active={regionId === 'all'} onClick={() => setRegionId('all')} tone="teal">
                    全部地区
                  </PanelChip>
                  {regionOptions.map((r) => (
                    <PanelChip
                      key={r.id}
                      active={regionId === r.id}
                      onClick={() => setRegionId(r.id)}
                      tone="teal"
                    >
                      {r.name}
                    </PanelChip>
                  ))}
                </PanelChipRow>
              </div>

              <PanelBody className="px-4 py-3">
                {list.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    没有匹配的技法，试试其它关键词或筛选条件
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {list.map(({ therapy, category: cat, regionName }) => {
                      const style = CATEGORY_STYLE[cat.key] ?? CATEGORY_STYLE.jichu;
                      return (
                        <button
                          key={therapy.id}
                          type="button"
                          onClick={() => openTherapy(therapy)}
                          className="group text-left p-3 rounded-xl bg-white border border-black/[0.07] hover:border-emerald-300 hover:shadow-md transition-all"
                          title={`${therapy.name}（${therapy.nameEn}）`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-9 h-10 rounded-lg bg-gradient-to-br ${style.bg} text-white flex items-center justify-center font-serif font-bold text-base flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform`}
                              aria-hidden
                            >
                              {therapy.name.slice(0, 1)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm text-gray-900 truncate">
                                {therapy.name}
                              </div>
                              <div className="text-[10px] text-gray-500 font-medium truncate">
                                {cat.label} · {regionName}
                              </div>
                            </div>
                          </div>

                          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-600 line-clamp-2">
                            {therapy.description || therapy.system}
                          </p>

                          <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500">
                            <span className="inline-flex items-center gap-0.5">
                              <Leaf className="w-3 h-3 text-emerald-500" />
                              {therapy.relatedHerbs?.length ?? 0} 味药
                            </span>
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-emerald-500" />
                              {regionName}
                            </span>
                            {therapy.system.includes('非物质') && (
                              <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                                非遗
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </PanelBody>

              <PanelFooter>
                当前显示 {list.length} / {therapies.length} 项 · 点击卡片查看操作流程与注意事项
              </PanelFooter>
            </PanelSurface>
          </PanelOverlay>,
          document.body
        )}
    </>
  );
};

export default TherapyGallery;
