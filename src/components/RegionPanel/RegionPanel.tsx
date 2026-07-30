import React, { useState, useEffect } from 'react';
import { useMapStore } from '../../store/mapStore';
import { getHerbsByRegion, getTherapiesByRegion, getHistoryPeriodsByRegion } from '../../data/mockData';
import HerbCard from './HerbCard';
import CollapsibleSection from './CollapsibleSection';
import StarRating from './StarRating';
<<<<<<< HEAD
import { X, MapPin, Leaf, Clock, Stethoscope, TrendingUp, Sparkles, Calendar, ChevronLeft, Compass } from 'lucide-react';
=======
import {
  X,
  MapPin,
  Leaf,
  Clock,
  Stethoscope,
  TrendingUp,
  Sparkles,
  Calendar,
  ChevronLeft,
  Compass,
  BookOpen,
  Beaker,
  FlaskConical,
  Mountain,
  ScrollText,
  Sprout,
  Hammer,
} from 'lucide-react';
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)

// 关键词高亮处理
const renderHighlightedText = (text: string, keywords: string[] = []): React.ReactNode => {
  if (keywords.length === 0) return text;
  const escapedKeywords = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'g');
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (keywords.includes(part)) {
      return (
        <span key={index} className="keyword">
          {part}
        </span>
      );
    }
    return part;
  });
};

// 常见瑶药关键词
const commonHerbKeywords = ['三七', '天麻', '灵芝', '杜仲', '黄精', '茯苓', '金银花', '板蓝根', '半夏', '当归'];

const RegionPanel: React.FC = () => {
  const { selectedRegion, isPanelOpen, closePanel, setSelectedHerb, openHerbModal, setSelectedTherapy, openTherapyModal, setSelectedHistoryPeriod, openHistoryModal } = useMapStore();

  const herbs = selectedRegion ? getHerbsByRegion(selectedRegion.id) : [];
  const therapies = selectedRegion ? getTherapiesByRegion(selectedRegion.id) : [];
  const historyPeriods = selectedRegion ? getHistoryPeriodsByRegion(selectedRegion.id) : [];

  // 卡片 staggered 动画延迟
  const [animationKey, setAnimationKey] = useState(0);
<<<<<<< HEAD
=======
  const [expandedSections, setExpandedSections] = useState({
    philosophy: true,
    lineage: true,
    techniques: false,
    resources: true,
    herbs: false,
    processing: false,
    modern: true,
    history: false,
    therapies: false,
    common: false,
    development: false,
  });
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)

  useEffect(() => {
    if (selectedRegion) {
      setAnimationKey(prev => prev + 1);
      // 当面板打开时，页面滚到面板顶部位置
      const tryScroll = () => {
        const el = document.getElementById('region-panel-streaming-root');
        if (el) {
          const headerHeight = 80;
          const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      };
      // 等待面板入场后再滚动
      const t = setTimeout(tryScroll, 320);
      return () => clearTimeout(t);
    }
  }, [selectedRegion]);

  const handleHerbClick = (herbId: string) => {
    const herb = herbs.find(h => h.id === herbId);
    if (herb) {
      closePanel();
      setSelectedHerb(herb);
      openHerbModal();
    }
  };

  const handleTherapyClick = (therapyId: string) => {
    const therapy = therapies.find(t => t.id === therapyId);
    if (therapy) {
      closePanel();
      setSelectedTherapy(therapy);
      openTherapyModal();
    }
  };

  const handleHistoryClick = (historyId: string) => {
    const history = historyPeriods.find(h => h.id === historyId);
    if (history) {
      closePanel();
      setSelectedHistoryPeriod(history);
      openHistoryModal();
    }
  };

<<<<<<< HEAD
=======
  // 切换折叠
  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)
  // 空状态组件
  const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-yao-fade-in-up">
      <div className="relative w-28 h-28 mb-6">
        <div className="absolute inset-0 rounded-full bg-amber-200/60 animate-yao-pulse-glow" aria-hidden />
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-ochre-200 to-amber-100 flex items-center justify-center shadow-yao-md">
          <Compass className="w-12 h-12 text-amber-700 animate-yao-sway" />
        </div>
      </div>
      <h3 className="font-serif font-bold text-xl text-ink-800 mb-2">探索瑶医分布</h3>
      <p className="text-sm text-ink-600 mb-5 max-w-xs leading-relaxed">
        点击地图上的绿色区域，了解各地区的瑶医特色、草药资源和历史渊源
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {['广西', '广东', '湖南', '云南', '贵州', '江西', '海南', '重庆', '四川'].map((region) => (
          <span
            key={region}
            className="px-3 py-1 rounded-full bg-ochre-100 text-ink-700 text-xs border border-ochre-300 hover:bg-amber-100 hover:border-amber-300 transition-all duration-200"
          >
            {region}
          </span>
        ))}
      </div>
    </div>
  );

<<<<<<< HEAD
  // 头部区域
  const PanelHeader = ({ onClose }: { onClose?: () => void }) => (
    <div
      className="relative px-5 py-5 border-b border-ochre-300 overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, rgba(247, 234, 223, 0.95) 0%, rgba(212, 172, 106, 0.18) 50%, rgba(247, 234, 223, 0.95) 100%)',
      }}
    >
      {/* 顶部琥珀色高光 */}
      <span
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(212, 172, 106, 0.8), transparent)',
        }}
        aria-hidden
      />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          {/* 瑶族图腾圆形图标 */}
          <div
            className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-yao-md transition-transform duration-300 hover:scale-105"
            style={{
              background:
                'linear-gradient(135deg, #F0D1A1 0%, #DDBE8C 50%, #C8A57E 100%)',
              boxShadow: '0 6px 18px -4px rgba(240, 209, 161, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
            }}
          >
            <svg
              className="w-8 h-8 text-ink-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="6" r="2" />
              <path d="M8 10 Q12 8 16 10" />
              <path d="M6 14 Q12 11 18 14" />
              <path d="M4 18 Q12 14 20 18" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif font-bold text-2xl text-ink-800 leading-tight">
              {selectedRegion!.name}
            </h2>
            <p className="text-sm text-ink-600 mt-0.5 font-light">
              {selectedRegion!.nameEn}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-ochre-100 hover:bg-amber-100 border border-ochre-200 hover:border-amber-300 text-ink-700 hover:text-amber-900 transition-all duration-200 hover:rotate-90"
            aria-label="关闭面板"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-5 mb-1 flex-wrap">
        <div className="flex items-center gap-2 text-amber-700 text-sm">
          <MapPin className="w-4 h-4" />
          <span>{selectedRegion!.location}</span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full shadow-yao-xs"
            style={{ backgroundColor: selectedRegion!.color }}
          />
          <span className="text-sm text-ink-600">分布密度：</span>
          <StarRating rating={selectedRegion!.density} />
        </div>
=======
  // 头像（图腾）+ 标题
  const RegionIdentity = () => (
    <div className="flex items-center gap-4">
      <div
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-yao-md transition-transform duration-300 hover:scale-105 flex-shrink-0"
        style={{
          background:
            'linear-gradient(135deg, #F0D1A1 0%, #DDBE8C 50%, #C8A57E 100%)',
          boxShadow: '0 6px 18px -4px rgba(240, 209, 161, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
        }}
      >
        <svg
          className="w-8 h-8 text-ink-700"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <circle cx="12" cy="6" r="2" />
          <path d="M8 10 Q12 8 16 10" />
          <path d="M6 14 Q12 11 18 14" />
          <path d="M4 18 Q12 14 20 18" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-serif font-bold text-xl sm:text-2xl text-ink-800 leading-tight truncate">
          {selectedRegion!.name}
        </h2>
        <p className="text-sm text-ink-600 mt-0.5 font-light truncate">
          {selectedRegion!.nameEn}
        </p>
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)
      </div>
    </div>
  );

<<<<<<< HEAD
  // 简介文本区域
  const DescriptionSection = () => (
    <div className="px-6 py-4 bg-ochre-50/60 backdrop-blur-sm border-b border-ochre-200">
      <p
        className="text-ink-700 text-base text-indent"
        style={{ lineHeight: '1.8' }}
      >
        {renderHighlightedText(selectedRegion!.description, commonHerbKeywords)}
      </p>
    </div>
  );

  // 内容区域
  const PanelContent = () => (
    <div
      key={animationKey}
      className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 region-panel-scroll"
    >
      {/* 历史渊源 */}
      <div
        className="animate-yao-card-up"
        style={{ animationDelay: '0.08s' }}
      >
        <CollapsibleSection
          title="历史渊源"
          icon={<Clock className="w-5 h-5 text-amber-700" />}
          count={historyPeriods.length}
          defaultExpanded={false}
        >
          <p className="text-ink-700 text-base text-indent" style={{ lineHeight: '1.8', marginBottom: '16px' }}>
            {selectedRegion!.history}
          </p>
          <div className="flex flex-wrap gap-2">
            {historyPeriods.map((period) => (
              <button
                key={period.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleHistoryClick(period.id);
                }}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 hover:shadow-yao-xs"
              >
                <Calendar className="w-4 h-4" />
                {period.periodName}
              </button>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* 特色疗法 */}
      <div
        className="animate-yao-card-up"
        style={{ animationDelay: '0.18s' }}
      >
        <CollapsibleSection
          title="特色疗法"
          icon={<Stethoscope className="w-5 h-5 text-primary-700" />}
          count={therapies.length}
          defaultExpanded={false}
        >
          <div className="space-y-2">
            {therapies.map((therapy) => (
              <button
                key={therapy.id}
                onClick={() => handleTherapyClick(therapy.id)}
                className="w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 text-left group border border-ochre-200 hover:border-amber-400 hover:shadow-yao-sm bg-ochre-50 hover:bg-amber-50"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-200 text-amber-700 group-hover:scale-110 transition-all duration-200">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-ink-800 group-hover:text-amber-700 text-base">{therapy.name}</h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 border border-primary-200">
                      {therapy.system}
                    </span>
                    <span className="text-xs text-ink-500">
                      {therapy.applicableConditions.length} 个适用病症
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* 常用药材 */}
      <div
        className="animate-yao-card-up"
        style={{ animationDelay: '0.28s' }}
      >
        <CollapsibleSection
          title="常用药材"
          icon={<Leaf className="w-5 h-5 text-primary-700" />}
          count={herbs.length}
          defaultExpanded={false}
        >
          <div className="space-y-2">
            {herbs.map((herb) => (
              <div
                key={herb.id}
                className="cursor-pointer"
                onClick={() => handleHerbClick(herb.id)}
              >
                <HerbCard
                  herb={herb}
                  onClick={() => handleHerbClick(herb.id)}
                />
              </div>
            ))}
          </div>

          {herbs.length === 0 && (
            <div className="text-center py-8">
              <Leaf className="w-12 h-12 text-ink-300 mx-auto mb-3" />
              <p className="text-ink-400 text-sm">暂无草药数据</p>
            </div>
=======
  // 通用章节头部（折叠头）
  const SectionToggleHead = ({
    sectionKey,
    title,
    icon,
    accent,
    badge,
  }: {
    sectionKey: keyof typeof expandedSections;
    title: string;
    icon: React.ReactNode;
    accent?: string;
    badge?: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      aria-expanded={expandedSections[sectionKey]}
      className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 bg-gradient-to-r from-ochre-100 to-ochre-50 hover:from-amber-100 hover:to-ochre-100 rounded-2xl border border-ochre-300 transition-all duration-200 group"
      style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-white/80 border border-ochre-300 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="text-left min-w-0">
          <h3 className="font-serif font-bold text-base sm:text-lg text-ink-800 truncate">
            {title}
          </h3>
          {badge && (
            <span className="text-xs text-ink-500 mt-0.5 truncate block">{badge}</span>
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)
          )}
        </div>
      </div>
<<<<<<< HEAD

      {/* 现代发展 */}
      <div
        className="animate-yao-card-up"
        style={{ animationDelay: '0.38s' }}
      >
        <CollapsibleSection
          title="现代发展"
          icon={<TrendingUp className="w-5 h-5 text-amber-700" />}
        >
          <p className="text-ink-700 text-base text-indent" style={{ lineHeight: '1.8' }}>
            {selectedRegion!.modernDevelopment}
          </p>
        </CollapsibleSection>
      </div>
    </div>
  );

  // 底部按钮
  const PanelFooter = () => (
    <div className="p-4 border-t border-ochre-300 bg-ochre-100/70 backdrop-blur-sm">
      <button
        onClick={closePanel}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-ink-700 rounded-xl shadow-yao-md hover:shadow-yao-lg transition-all duration-200 hover:from-amber-400 hover:to-amber-500 font-semibold active:translate-y-0.5"
      >
        <ChevronLeft className="w-5 h-5" />
        返回地图探索
      </button>
    </div>
  );

  return (
    <>
      <div
        className={`modal-layer transition-all duration-300 ease-yao-soft ${
          isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closePanel}
      >
        <div
          className={`info-panel-wrapper frosted-panel transform transition-all duration-450 ease-yao-soft ${
            isPanelOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
=======
      <ChevronLeft
        className={`w-5 h-5 text-ink-600 transition-transform duration-300 flex-shrink-0 ${
          expandedSections[sectionKey] ? '-rotate-90' : 'rotate-180'
        }`}
        aria-hidden
      />
    </button>
  );

  return (
    <div
      id="region-panel-streaming-root"
      key={animationKey}
      className={`region-panel-streaming relative w-full transition-opacity duration-500 ease-yao-soft ${
        isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!isPanelOpen}
      style={{
        // 关键：流式布局关键 - 这是文档流中的一个普通块级元素
        // 没有 position: fixed，因此会跟随页面滚动
        display: isPanelOpen ? 'block' : 'none',
        zIndex: 5, // 在地图之上的轻量级层级，但不阻挡其它重要元素
        position: 'relative',
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-6 py-4">
        <div
          className="frosted-panel animate-yao-fade-in-up mx-auto"
          style={{
            maxWidth: 920,
            // 允许在窄屏下完整展示内容，并通过内部滚动保证高内容也能完整访问
            width: '100%',
          }}
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)
        >
          {!selectedRegion ? (
            <>
              <EmptyState />
              <div className="px-4 py-3 border-t border-ochre-300 bg-ochre-100/60 backdrop-blur-sm text-center">
                <span className="text-xs text-ink-500">点击地图探索</span>
              </div>
            </>
          ) : (
            <>
              {/* 省份简介 - 粘性头部（始终可见，跟随滚动） */}
              <div
                className="region-panel-sticky-header sticky top-0 z-30 px-5 py-4 border-b border-ochre-300 backdrop-blur-md"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(247, 234, 223, 0.96) 0%, rgba(212, 172, 106, 0.18) 50%, rgba(247, 234, 223, 0.96) 100%)',
                  boxShadow: '0 6px 16px -10px rgba(88, 120, 81, 0.35)',
                }}
              >
                {/* 顶部装饰高光 */}
                <span
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(212, 172, 106, 0.8), transparent)',
                  }}
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-3">
                  <RegionIdentity />
                  {closePanel && (
                    <button
                      onClick={closePanel}
                      className="p-2 rounded-full bg-ochre-100 hover:bg-amber-100 border border-ochre-200 hover:border-amber-300 text-ink-700 hover:text-amber-900 transition-all duration-200 hover:rotate-90 flex-shrink-0"
                      aria-label="关闭面板"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <div className="flex items-center gap-2 text-amber-700 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>{selectedRegion!.location}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full shadow-yao-xs"
                      style={{ backgroundColor: selectedRegion!.color }}
                      aria-hidden
                    />
                    <span className="text-sm text-ink-600">分布密度：</span>
                    <StarRating rating={selectedRegion!.density} />
                  </div>
                </div>

                {selectedRegion?.description && (
                  <p
                    className="text-ink-700 text-sm sm:text-base text-indent mt-3"
                    style={{ lineHeight: '1.8' }}
                  >
                    {renderHighlightedText(selectedRegion!.description, commonHerbKeywords)}
                  </p>
                )}
              </div>

              {/* 省份内容（流式布局，按章节顺序滚动） */}
              <div className="p-3 sm:p-4 lg:p-5 space-y-4 region-panel-scroll">
                {/* ============ 诊疗理念 ============ */}
                {selectedRegion.yaoMedicineProfile && (
                  <div
                    className="animate-yao-card-up"
                    style={{ animationDelay: '0.05s' }}
                  >
                    <SectionToggleHead
                      sectionKey="philosophy"
                      title="瑶医核心诊疗理念"
                      icon={<BookOpen className="w-5 h-5 text-amber-700" />}
                      accent="#587851"
                      badge={`${selectedRegion.yaoMedicineProfile.philosophyPoints.length} 个核心要点`}
                    />
                    {expandedSections.philosophy && (
                      <div className="p-4 sm:p-5 mt-3 bg-ochre-50/70 backdrop-blur-sm rounded-2xl border border-ochre-200 space-y-3">
                        <p
                          className="text-ink-700 text-base text-indent"
                          style={{ lineHeight: '1.8' }}
                        >
                          {selectedRegion.yaoMedicineProfile.corePhilosophy}
                        </p>
                        <ul className="space-y-2 pt-2">
                          {selectedRegion.yaoMedicineProfile.philosophyPoints.map((point, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-3 text-sm sm:text-base text-ink-700 leading-relaxed"
                            >
                              <span
                                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                                style={{
                                  background: 'linear-gradient(135deg, #F0D1A1, #C8A57E)',
                                  color: '#243B25',
                                }}
                                aria-hidden
                              >
                                {idx + 1}
                              </span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* ============ 传承脉络 ============ */}
                {selectedRegion.yaoMedicineProfile && (
                  <div
                    className="animate-yao-card-up"
                    style={{ animationDelay: '0.12s' }}
                  >
                    <SectionToggleHead
                      sectionKey="lineage"
                      title="传承发展脉络"
                      icon={<ScrollText className="w-5 h-5 text-amber-700" />}
                      accent="#A88A66"
                      badge="历史分期"
                    />
                    {expandedSections.lineage && (
                      <div className="p-4 sm:p-5 mt-3 bg-ochre-50/70 backdrop-blur-sm rounded-2xl border border-ochre-200">
                        <p
                          className="text-ink-700 text-base text-indent"
                          style={{ lineHeight: '1.8' }}
                        >
                          {selectedRegion.yaoMedicineProfile.inheritanceLineage}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ============ 代表性诊疗技法 ============ */}
                {selectedRegion.yaoMedicineProfile && (
                  <div
                    className="animate-yao-card-up"
                    style={{ animationDelay: '0.19s' }}
                  >
                    <SectionToggleHead
                      sectionKey="techniques"
                      title="代表性诊疗技法"
                      icon={<Stethoscope className="w-5 h-5 text-primary-700" />}
                      accent="#587851"
                      badge={`${selectedRegion.yaoMedicineProfile.representativeTechniques.length} 项特色技艺`}
                    />
                    {expandedSections.techniques && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedRegion.yaoMedicineProfile.representativeTechniques.map((tech, idx) => (
                          <div
                            key={idx}
                            className="p-4 bg-ochre-50/80 rounded-xl border border-ochre-200 hover:border-amber-300 hover:shadow-yao-sm transition-all duration-200"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{
                                  background: 'linear-gradient(135deg, #F0D1A1, #C8A57E)',
                                  color: '#243B25',
                                }}
                                aria-hidden
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </span>
                              <h4 className="font-semibold text-ink-800 text-sm sm:text-base">
                                {tech.name}
                              </h4>
                            </div>
                            <p
                              className="text-ink-700 text-sm leading-relaxed"
                              style={{ textIndent: '2em' }}
                            >
                              {tech.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ============ 资源分布特点 ============ */}
                {selectedRegion.yaoMedicineProfile && (
                  <div
                    className="animate-yao-card-up"
                    style={{ animationDelay: '0.26s' }}
                  >
                    <SectionToggleHead
                      sectionKey="resources"
                      title="瑶药资源分布特点"
                      icon={<Mountain className="w-5 h-5 text-amber-700" />}
                      accent="#22c55e"
                      badge="地形 · 气候 · 物种"
                    />
                    {expandedSections.resources && (
                      <div className="p-4 sm:p-5 mt-3 bg-ochre-50/70 backdrop-blur-sm rounded-2xl border border-ochre-200">
                        <p
                          className="text-ink-700 text-base text-indent"
                          style={{ lineHeight: '1.8' }}
                        >
                          {renderHighlightedText(
                            selectedRegion.yaoMedicineProfile.resourceDistribution,
                            commonHerbKeywords
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ============ 常用道地药材品种 ============ */}
                {selectedRegion.yaoMedicineProfile && (
                  <div
                    className="animate-yao-card-up"
                    style={{ animationDelay: '0.33s' }}
                  >
                    <SectionToggleHead
                      sectionKey="herbs"
                      title="常用道地药材品种"
                      icon={<Leaf className="w-5 h-5 text-primary-700" />}
                      accent="#587851"
                      badge={`${selectedRegion.yaoMedicineProfile.authenticHerbs.length} 种`}
                    />
                    {expandedSections.herbs && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedRegion.yaoMedicineProfile.authenticHerbs.map((herb, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2.5 bg-amber-50/70 border border-amber-300 rounded-xl text-ink-800 text-sm flex items-start gap-2"
                          >
                            <Sprout className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{herb}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ============ 传统炮制工艺 ============ */}
                {selectedRegion.yaoMedicineProfile && (
                  <div
                    className="animate-yao-card-up"
                    style={{ animationDelay: '0.40s' }}
                  >
                    <SectionToggleHead
                      sectionKey="processing"
                      title="传统炮制工艺"
                      icon={<Hammer className="w-5 h-5 text-amber-700" />}
                      accent="#C8A57E"
                      badge={`${selectedRegion.yaoMedicineProfile.processingPoints.length} 项要点`}
                    />
                    {expandedSections.processing && (
                      <div className="p-4 sm:p-5 mt-3 bg-ochre-50/70 backdrop-blur-sm rounded-2xl border border-ochre-200 space-y-3">
                        <p
                          className="text-ink-700 text-base text-indent"
                          style={{ lineHeight: '1.8' }}
                        >
                          {selectedRegion.yaoMedicineProfile.processingCraft}
                        </p>
                        <ul className="space-y-2 pt-1">
                          {selectedRegion.yaoMedicineProfile.processingPoints.map((point, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-3 text-sm sm:text-base text-ink-700 leading-relaxed"
                            >
                              <FlaskConical className="w-4 h-4 text-amber-700 flex-shrink-0 mt-1" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* ============ 现代应用成果 ============ */}
                {selectedRegion.yaoMedicineProfile && (
                  <div
                    className="animate-yao-card-up"
                    style={{ animationDelay: '0.47s' }}
                  >
                    <SectionToggleHead
                      sectionKey="modern"
                      title="现代应用成果"
                      icon={<TrendingUp className="w-5 h-5 text-amber-700" />}
                      accent="#F0D1A1"
                      badge={`${selectedRegion.yaoMedicineProfile.modernHighlights.length} 项亮点`}
                    />
                    {expandedSections.modern && (
                      <div className="p-4 sm:p-5 mt-3 bg-gradient-to-br from-amber-50 to-ochre-50 backdrop-blur-sm rounded-2xl border border-amber-300 space-y-3">
                        <p
                          className="text-ink-700 text-base text-indent"
                          style={{ lineHeight: '1.8' }}
                        >
                          {selectedRegion.yaoMedicineProfile.modernApplications}
                        </p>
                        <ul className="space-y-2 pt-1">
                          {selectedRegion.yaoMedicineProfile.modernHighlights.map((point, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-3 text-sm sm:text-base text-ink-700 leading-relaxed"
                            >
                              <Beaker className="w-4 h-4 text-primary-700 flex-shrink-0 mt-1" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* ============ 常用药材（卡片列表） ============ */}
                <div
                  className="animate-yao-card-up"
                  style={{ animationDelay: '0.54s' }}
                >
                  <CollapsibleSection
                    title="常用瑶药材"
                    icon={<Leaf className="w-5 h-5 text-primary-700" />}
                    count={herbs.length}
                    defaultExpanded={expandedSections.common}
                  >
                    <div className="space-y-2">
                      {herbs.map((herb) => (
                        <div
                          key={herb.id}
                          className="cursor-pointer"
                          onClick={() => handleHerbClick(herb.id)}
                        >
                          <HerbCard
                            herb={herb}
                            onClick={() => handleHerbClick(herb.id)}
                          />
                        </div>
                      ))}

                      {herbs.length === 0 && (
                        <div className="text-center py-8">
                          <Leaf className="w-12 h-12 text-ink-300 mx-auto mb-3" />
                          <p className="text-ink-400 text-sm">暂无草药数据</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                </div>

                {/* ============ 历史渊源 ============ */}
                <div
                  className="animate-yao-card-up"
                  style={{ animationDelay: '0.61s' }}
                >
                  <CollapsibleSection
                    title="历史渊源"
                    icon={<Clock className="w-5 h-5 text-amber-700" />}
                    count={historyPeriods.length}
                    defaultExpanded={expandedSections.history}
                  >
                    <p
                      className="text-ink-700 text-base text-indent"
                      style={{ lineHeight: '1.8', marginBottom: '16px' }}
                    >
                      {selectedRegion.history}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {historyPeriods.map((period) => (
                        <button
                          key={period.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHistoryClick(period.id);
                          }}
                          className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 hover:shadow-yao-xs"
                        >
                          <Calendar className="w-4 h-4" />
                          {period.periodName}
                        </button>
                      ))}
                    </div>
                  </CollapsibleSection>
                </div>

                {/* ============ 特色疗法 ============ */}
                <div
                  className="animate-yao-card-up"
                  style={{ animationDelay: '0.68s' }}
                >
                  <CollapsibleSection
                    title="特色疗法"
                    icon={<Stethoscope className="w-5 h-5 text-primary-700" />}
                    count={therapies.length}
                    defaultExpanded={expandedSections.therapies}
                  >
                    <div className="space-y-2">
                      {therapies.map((therapy) => (
                        <button
                          key={therapy.id}
                          onClick={() => handleTherapyClick(therapy.id)}
                          className="w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 text-left group border border-ochre-200 hover:border-amber-400 hover:shadow-yao-sm bg-ochre-50 hover:bg-amber-50"
                        >
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-200 text-amber-700 group-hover:scale-110 transition-all duration-200">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-ink-800 group-hover:text-amber-700 text-base">
                              {therapy.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 border border-primary-200">
                                {therapy.system}
                              </span>
                              <span className="text-xs text-ink-500">
                                {therapy.applicableConditions.length} 个适用病症
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CollapsibleSection>
                </div>
              </div>

              {/* 底部按钮（粘性） */}
              <div className="sticky bottom-0 p-3 sm:p-4 border-t border-ochre-300 bg-ochre-100/90 backdrop-blur-md z-20">
                <button
                  onClick={closePanel}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-ink-700 rounded-xl shadow-yao-md hover:shadow-yao-lg transition-all duration-200 hover:from-amber-400 hover:to-amber-500 font-semibold active:translate-y-0.5"
                >
                  <ChevronLeft className="w-5 h-5" />
                  返回地图探索
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegionPanel;
