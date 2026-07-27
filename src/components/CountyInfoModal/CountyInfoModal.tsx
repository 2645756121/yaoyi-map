import React, { useState } from 'react';
import { useMapStore } from '../../store/mapStore';
import { YAO_CATEGORY_META } from '../../types';
import { getHerbById } from '../../data/mockData';
import { getYaoCountyExtendedByCode } from '../../data/yaoCountyData';
import {
  X,
  MapPin,
  Building2,
  Pill,
  Users,
  Calendar,
  Sparkles,
  Award,
  BookOpen,
  Sprout,
  ChevronDown,
  ChevronRight,
  Leaf,
  Heart,
  FlaskConical,
  History,
} from 'lucide-react';

/**
 * 县级瑶医资源面板：点击地图上的县级多边形后展示
 *
 * 数据结构：
 *   - 基础信息（来自 yaoCountyData.ts）
 *   - 扩展资料（来自 yaoCountyExtendedData.ts）：
 *       当地特有瑶药资源详情、临床应用案例、采集方法论、
 *       传承保护现状、代表性医疗机构、瑶药种植基地
 *
 * 视觉层级：
 *   1. 顶部关闭按钮
 *   2. 县级标题（按分类切换主色调）
 *   3. 5 列核心数据卡（机构 / 药材 / 流派 / 临床 / 传承人）
 *   4. 当地特有瑶药资源（按药展开详情）
 *   5. 临床应用案例
 *   6. 当地采集方法论
 *   7. 传承保护现状（含挑战）
 *   8. 代表性机构 + 产业基地
 *   9. 特别说明
 */
const CountyInfoModal: React.FC = () => {
  const {
    selectedCounty,
    isCountyModalOpen,
    closeCountyModal,
    setSelectedHerb,
    openHerbModal,
  } = useMapStore();

  // 扩展资料（详细瑶医资料）
  const extended = selectedCounty ? getYaoCountyExtendedByCode(selectedCounty.code) : undefined;
  // 折叠面板状态
  const [expandedHerbIdx, setExpandedHerbIdx] = useState<number | null>(0);
  const [expandedCaseIdx, setExpandedCaseIdx] = useState<number | null>(0);
  // ✅ 关闭动画状态（用 is-closing class 触发淡出动画后再卸载）
  const [isClosing, setIsClosing] = useState(false);

  /**
   * 处理关闭：先触发淡出动画，200ms 后真正卸载 DOM
   */
  const handleClose = React.useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      closeCountyModal();
    }, 200); // 与 modalSlideOutRight 动画时长一致
  }, [closeCountyModal]);

  // ESC 键关闭
  React.useEffect(() => {
    if (!isCountyModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCountyModalOpen, handleClose]);

  if (!selectedCounty) return null;

  const meta = YAO_CATEGORY_META[selectedCounty.category];
  const herbs = selectedCounty.herbVarieties
    .map((id) => getHerbById(id))
    .filter((h): h is NonNullable<typeof h> => Boolean(h));

  /**
   * ✅ 章节编号动态化（修复"五→七"等跳跃错位）
   *
   * 问题：原实现中所有章节标题（如"一、""二、""六、"等）均为硬编码，
   *       当某节数据缺失（如产业基地）时该节整段不渲染，但下一节的硬编码
   *       编号仍为"七"，导致标题序号不连续（用户反馈的"内容跳跃错位"）。
   *
   * 修复：把硬编码数字改为由 renderer 计数生成，仅对实际渲染的章节递增。
   *       - 即使多个章节数据缺失，编号也能保持连续（一、二、三、…）
   *       - 用户查阅时序号连贯无跳跃，符合排版规范
   */
  const cn = (idx: number): string => '一二三四五六七八九'[idx] || String(idx + 1);

  // 用于动态编号：闭包计数器
  const ordinal = (() => {
    let i = 0;
    return () => cn(i++);
  })();

  const handleHerbClick = (herbId: string) => {
    const herb = getHerbById(herbId);
    if (herb) {
      closeCountyModal();
      setSelectedHerb(herb);
      openHerbModal();
    }
  };

  // 进入"瑶医基础知识"时自动关闭当前县级窗口
  const handleKnowledgeEntryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 关闭当前模态，再触发打开知识页事件（YaoMedicalKnowledgePortal 会完成后续打开动作）
    handleClose();
    window.dispatchEvent(new CustomEvent('open-yao-knowledge'));
  };

  // 政府支持级别徽章
  const govLevelLabel: Record<string, { label: string; color: string }> = {
    county: { label: '县级支持', color: 'bg-gray-100 text-gray-700' },
    city: { label: '市级支持', color: 'bg-blue-100 text-blue-700' },
    province: { label: '省级支持', color: 'bg-emerald-100 text-emerald-700' },
    national: { label: '国家支持', color: 'bg-amber-100 text-amber-800' },
  };

  return (
    <div
      className={`modal-layer modal-layer-high modal-slide modal-fade ${
        isCountyModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="county-modal-title"
    >
      <div
        className={`info-panel-wrapper frosted-panel info-panel-wrapper-scrollable ${
          isCountyModalOpen && !isClosing ? '' : 'pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部关闭按钮 */}
        <button
          type="button"
          onClick={handleClose}
          className="btn-yao-icon absolute top-4 right-4 z-10 w-9 h-9 shadow-card hover:bg-primary-50 text-ink-700 hover:text-primary-700 transition-colors"
          aria-label="关闭弹窗"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 县级标题区 - 根据分类选择主题色 */}
        <div
          className="p-6 text-white"
          style={{
            background:
              selectedCounty.category === 'core'
                ? 'linear-gradient(to right, #14532d, #166534)'
                : selectedCounty.category === 'development'
                  ? 'linear-gradient(to right, #15803d, #22c55e)'
                  : 'linear-gradient(to right, #b45309, #d97706)',
          }}
        >
          <div className="flex items-start gap-3 mb-3 pr-12">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2
                id="county-modal-title"
                className="text-2xl font-serif font-bold truncate"
              >
                {selectedCounty.name}
              </h2>
              <p className="text-sm text-white/90 mt-1 truncate">
                {selectedCounty.nameEn}
              </p>
            </div>
          </div>

          {/* 标签独占一行 */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/20">
            <span
              className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
            >
              <Sparkles className="w-3 h-3" />
              {meta.label}
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-white/20 rounded-full">
              <MapPin className="w-3 h-3" />
              {selectedCounty.province}
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-white/20 rounded-full font-mono">
              {selectedCounty.code}
            </span>
          </div>
        </div>

        {/*
          ✅ 瑶医基础知识统一入口（v2）：
             - 不再嵌入重复内容（基础理论、特色诊疗、瑶药经典分类、性味归经、非遗传承）
             - 替换为统一入口跳转按钮，用户点击后访问独立 Modal
             - 避免每个县区面板重复渲染占用页面资源
        */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 bg-gradient-to-br from-emerald-50/40 to-amber-50/30">
          <button
            type="button"
            onClick={handleKnowledgeEntryClick}
            className="w-full flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-emerald-200/60 hover:bg-emerald-50 hover:border-emerald-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 via-amber-500 to-rose-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <BookOpen className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-medium text-sm text-gray-900">
                  瑶医基础知识（统一入口）
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  基础理论 · 特色诊疗 · 经典分类 · 性味归经 · 非遗传承
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>
        </div>

        {/* 数据概览（5 列核心数据卡）*/}
        <div className="grid grid-cols-5 gap-2 p-4 border-b border-gray-100 bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center p-2 bg-emerald-50 rounded-xl">
            <Building2 className="w-4 h-4 text-emerald-600 mb-1" />
            <span className="text-xl font-bold text-emerald-700">
              {selectedCounty.institutionCount}
            </span>
            <span className="text-[10px] text-gray-600 mt-0.5">瑶医机构</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 bg-amber-50 rounded-xl">
            <Pill className="w-4 h-4 text-amber-600 mb-1" />
            <span className="text-xl font-bold text-amber-700">
              {extended?.localHerbResources.length ?? selectedCounty.herbVarieties.length}
            </span>
            <span className="text-[10px] text-gray-600 mt-0.5">特有瑶药</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 bg-purple-50 rounded-xl">
            <Users className="w-4 h-4 text-purple-600 mb-1" />
            <span className="text-xl font-bold text-purple-700">
              {selectedCounty.schools.length}
            </span>
            <span className="text-[10px] text-gray-600 mt-0.5">传承流派</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 bg-rose-50 rounded-xl">
            <Heart className="w-4 h-4 text-rose-600 mb-1" />
            <span className="text-xl font-bold text-rose-700">
              {extended?.clinicalCases.length ?? 0}
            </span>
            <span className="text-[10px] text-gray-600 mt-0.5">临床案例</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 bg-indigo-50 rounded-xl">
            <Award className="w-4 h-4 text-indigo-600 mb-1" />
            <span className="text-xl font-bold text-indigo-700">
              {extended?.heritage.inheritorCount ?? 0}
            </span>
            <span className="text-[10px] text-gray-600 mt-0.5">传承人</span>
          </div>
        </div>

        {/* 详情列表（已移除内层滚动：让 info-panel-wrapper-scrollable 作为唯一滚动容器，
            标题、5 列功能图标、知识按钮等会跟随滚动条一同向上滑动） */}
        <div className="p-4 space-y-5">
          {/* 当地特有瑶药资源详情 */}
          {extended && extended.localHerbResources.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-semibold text-gray-900 flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  {ordinal()}、当地特有瑶药资源
                </h3>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {extended.localHerbResources.length} 种
                </span>
              </div>
              <div className="space-y-2">
                {extended.localHerbResources.map((resource, idx) => {
                  const expanded = expandedHerbIdx === idx;
                  return (
                    <div
                      key={idx}
                      className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl overflow-hidden border border-amber-200/60"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedHerbIdx(expanded ? null : idx)
                        }
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-amber-100/40 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-200 to-orange-200 flex items-center justify-center flex-shrink-0">
                          <Sprout className="w-5 h-5 text-amber-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-800">
                              {resource.name}
                            </span>
                            {resource.nameYao && (
                              <span className="text-xs text-gray-500 italic">
                                瑶名：{resource.nameYao}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 italic mt-0.5 truncate">
                            {resource.scientificName}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                            resource.source === 'wild'
                              ? 'bg-emerald-100 text-emerald-700'
                              : resource.source === 'cultivated'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {resource.source === 'wild'
                            ? '野生'
                            : resource.source === 'cultivated'
                              ? '栽培'
                              : '野生+栽培'}
                        </span>
                        {expanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      {expanded && (
                        <div className="px-3 pb-3 space-y-2 text-xs text-gray-700 border-t border-amber-200/40 pt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-semibold text-amber-800">
                                药用部位：
                              </span>
                              {resource.medicinalPart}
                            </div>
                            {resource.yieldEstimate && (
                              <div>
                                <span className="font-semibold text-amber-800">
                                  年产量：
                                </span>
                                {resource.yieldEstimate}
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-amber-800">
                              药用功效：
                            </span>
                            {resource.efficacy}
                          </div>
                          <div>
                            <span className="font-semibold text-amber-800">
                              临床应用：
                            </span>
                            {resource.clinicalApplication}
                          </div>
                          <div>
                            <span className="font-semibold text-amber-800">
                              当地产地：
                            </span>
                            {resource.habitat}
                          </div>
                          <div>
                            <span className="font-semibold text-amber-800">
                              采集方法：
                            </span>
                            {resource.collectionMethod}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 临床应用案例 */}
          {extended && extended.clinicalCases.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-semibold text-gray-900 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  {ordinal()}、临床应用案例
                </h3>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {extended.clinicalCases.length} 例
                </span>
              </div>
              <div className="space-y-2">
                {extended.clinicalCases.map((c, idx) => {
                  const expanded = expandedCaseIdx === idx;
                  return (
                    <div
                      key={idx}
                      className="bg-rose-50 rounded-xl overflow-hidden border border-rose-200/60"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCaseIdx(expanded ? null : idx)
                        }
                        className="w-full flex items-center gap-2 p-3 text-left hover:bg-rose-100/40 transition-colors"
                      >
                        <Heart className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-gray-800 truncate">
                            {c.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {c.year} 年 · {c.diagnosis}
                          </div>
                        </div>
                        {expanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      {expanded && (
                        <div className="px-3 pb-3 space-y-1.5 text-xs text-gray-700 border-t border-rose-200/40 pt-2">
                          <div>
                            <span className="font-semibold text-rose-800">
                              患者信息：
                            </span>
                            {c.patientInfo}
                          </div>
                          <div>
                            <span className="font-semibold text-rose-800">
                              诊断：
                            </span>
                            {c.diagnosis}
                          </div>
                          <div>
                            <span className="font-semibold text-rose-800">
                              治疗过程：
                            </span>
                            {c.treatmentProcess}
                          </div>
                          <div>
                            <span className="font-semibold text-rose-800">
                              疗效：
                            </span>
                            {c.outcome}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 当地瑶药采集方法 */}
          {extended?.collectionMethodology && (
            <div>
              <h3 className="font-serif font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                {ordinal()}、当地瑶药采集方法论
              </h3>
              <div className="bg-emerald-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed border border-emerald-200/60">
                {extended.collectionMethodology}
              </div>
            </div>
          )}

          {/* 传承保护现状 */}
          {extended?.heritage && (
            <div>
              <h3 className="font-serif font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                {ordinal()}、传承保护现状
              </h3>
              <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-200/60 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      extended.heritage.hasHospital
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Building2 className="w-3 h-3" />
                    {extended.heritage.hasHospital ? '有瑶医医院' : '无独立瑶医医院'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    <Users className="w-3 h-3" />
                    瑶医医师约 {extended.heritage.practitionerCount} 人
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                    <Award className="w-3 h-3" />
                    非遗 {extended.heritage.intangibleHeritageCount} 项
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700">
                    <Users className="w-3 h-3" />
                    传承人 {extended.heritage.inheritorCount} 人
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      extended.heritage.hasCultivationBase
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Sprout className="w-3 h-3" />
                    {extended.heritage.hasCultivationBase ? '有种植基地' : '无规模基地'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      govLevelLabel[extended.heritage.govSupportLevel]?.color
                    }`}
                  >
                    {govLevelLabel[extended.heritage.govSupportLevel]?.label}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {extended.heritage.description}
                </p>
                {extended.heritage.challenges.length > 0 && (
                  <div className="pt-2 border-t border-indigo-200/60">
                    <div className="text-xs font-semibold text-rose-700 mb-1">
                      ⚠ 当前挑战：
                    </div>
                    <ul className="text-xs text-gray-600 space-y-0.5 list-disc pl-4">
                      {extended.heritage.challenges.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 代表性医疗机构 */}
          {extended?.representativeInstitutions &&
            extended.representativeInstitutions.length > 0 && (
              <div>
                <h3 className="font-serif font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  {ordinal()}、代表性医疗机构
                </h3>
                <div className="space-y-1.5">
                  {extended.representativeInstitutions.map((inst, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-sm bg-emerald-50 rounded-lg p-2"
                    >
                      <Building2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{inst}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* 产业基地 */}
          {extended?.industryBase && extended.industryBase.length > 0 && (
            <div>
              <h3 className="font-serif font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-lime-600 flex-shrink-0" />
                {ordinal()}、瑶药产业基地
              </h3>
              <div className="space-y-1.5">
                {extended.industryBase.map((b, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-sm bg-lime-50 rounded-lg p-2"
                  >
                    <Sprout className="w-4 h-4 text-lime-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 传承流派 */}
          <div>
            <h3 className="font-serif font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600 flex-shrink-0" />
              {ordinal()}、传承流派
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedCounty.schools.map((school, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                >
                  <Award className="w-3 h-3" />
                  {school}
                </span>
              ))}
            </div>
          </div>

          {/* 关联瑶药（来自 mockData.herbs） */}
          {herbs.length > 0 && (
            <div>
              <h3 className="font-serif font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />
                {ordinal()}、关联瑶药品种（标准库）
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {herbs.map((herb) => (
                  <button
                    key={herb.id}
                    type="button"
                    onClick={() => handleHerbClick(herb.id)}
                    className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors group text-left"
                  >
                    <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                      <Pill className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 group-hover:text-amber-700 truncate">
                        {herb.name}
                      </div>
                      <div className="text-xs text-gray-500 italic truncate">
                        {herb.scientificName}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 传承历史（仅核心区有 since 字段）*/}
          {selectedCounty.since && (
            <div>
              <h3 className="font-serif font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                {ordinal()}、传承起始年代
              </h3>
              <p className="text-sm text-gray-700 bg-blue-50 rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl font-bold text-blue-700">
                  {selectedCounty.since}
                </span>
                <span className="text-gray-600">
                  年起，瑶医在该县域有持续传承，距今约{' '}
                  {new Date().getFullYear() - selectedCounty.since} 年历史。
                </span>
              </p>
            </div>
          )}

          {/* 备注 */}
          {selectedCounty.note && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <h4 className="font-medium text-amber-900 mb-1 flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                特别说明
              </h4>
              <p className="text-sm text-amber-800 leading-relaxed">
                {selectedCounty.note}
              </p>
            </div>
          )}

          {/* 无扩展资料提示 */}
          {extended == null && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">
                该县/市的详细瑶医资料正在整理中，敬请期待。
              </p>
            </div>
          )}
        </div>

        {/* 底部关闭按钮 */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <button
            onClick={closeCountyModal}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default CountyInfoModal;