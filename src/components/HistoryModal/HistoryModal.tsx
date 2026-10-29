import React from 'react';
import { createPortal } from 'react-dom';
import { useMapStore } from '../../store/mapStore';
import { getTherapyById, getRegionById } from '../../data/mockData';
import {
  X,
  Clock,
  BookOpen,
  Users,
  Calendar,
  MapPin,
  Award,
  ChevronRight,
  Scroll,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react';

/**
 * 历史时期弹窗：展示选定历史时期的概述、重要事件、文化传承与相关疗法。
 *
 * 视觉层级：
 *   1. 顶部导航（返回 + 关闭）
 *   2. 时期标题区（时期名 + 时间范围 + 所属地区标签）
 *   3. 可折叠正文（一、概述 / 二、重要事件 / 三、文化传承 / 四、相关疗法）
 *
 * 排版约定：
 *   - 所有正文段落使用 `.text-indent` 实现中文首行缩进
 *   - 折叠面板标题与小标签用 flex 排版，**严禁** 给标题元素加 `text-indent`
 *     否则图标与小标签会被推到 2em 之后，与标题视觉重叠
 */
const HistoryModal: React.FC = () => {
  const {
    selectedHistoryPeriod,
    isHistoryModalOpen,
    closeHistoryModal,
    setSelectedTherapy,
    openTherapyModal,
  } = useMapStore();

  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    overview: true,
    events: true,
    culture: false,
    heritage: false,
    related: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;
  if (!selectedHistoryPeriod) return null;

  const relatedTherapies = selectedHistoryPeriod.relatedTherapies
    .map((id) => getTherapyById(id))
    .filter(Boolean);
  const region = getRegionById(selectedHistoryPeriod.regionId);

  const handleTherapyClick = (therapyId: string) => {
    const therapy = getTherapyById(therapyId);
    if (therapy) {
      setSelectedTherapy(therapy);
      openTherapyModal();
    }
  };

  const SectionHeader = ({
    icon,
    title,
    section,
    count,
  }: {
    icon: React.ReactNode;
    title: string;
    section: string;
    count?: number;
  }) => (
    <div
      className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
      onClick={() => toggleSection(section)}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        {/* 标题使用 font-serif + font-semibold 与正文清晰区分 */}
        <h3 className="font-serif font-semibold text-gray-900 text-lg whitespace-nowrap">
          {title}
        </h3>
        {count !== undefined && (
          <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full flex-shrink-0">
            {count}项
          </span>
        )}
      </div>
      <ChevronDown
        className={`w-6 h-6 text-gray-600 transition-transform duration-300 flex-shrink-0 ml-2 ${
          expandedSections[section] ? 'rotate-180' : ''
        }`}
      />
    </div>
  );

  return createPortal(
    <div
      className={`modal-layer modal-layer-high transition-all duration-300 ${
        isHistoryModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeHistoryModal();
        }
      }}
    >
      <div
        className={`info-panel-wrapper frosted-panel transform transition-all duration-300 ${
          isHistoryModalOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        {/* 顶部导航 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
          <button
            onClick={closeHistoryModal}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">返回历史时期</span>
          </button>
          <button
            onClick={closeHistoryModal}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="关闭弹窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 时期标题区：使用渐变背景，与浅色正文区域形成视觉分隔 */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-5 text-white">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-serif font-bold text-white truncate">
                {selectedHistoryPeriod.periodName}
              </h2>
              <p className="text-sm text-white/90 mt-1">{selectedHistoryPeriod.timeRange}</p>
            </div>
          </div>
          {/* 标签单独成行，避免与标题挤压 */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/20">
            <span className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-white/20 rounded-full">
              <MapPin className="w-3 h-3" />
              {region?.name || selectedHistoryPeriod.regionId}
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-white/20 rounded-full">
              <Calendar className="w-3 h-3" />
              {region?.nameEn || ''}
            </span>
          </div>
        </div>

        {/* 正文滚动区 */}
        <div
          className="p-4 overflow-y-auto modal-body-scroll"
          style={{ maxHeight: 'calc(85vh - 240px)' }}
        >
          {/* 一、时期概述 */}
          <div className="mb-4">
            <SectionHeader
              icon={<BookOpen className="w-5 h-5 text-amber-700 flex-shrink-0" />}
              title="一、时期概述"
              section="overview"
            />
            {expandedSections.overview && (
              <div className="mt-2 bg-amber-50 rounded-xl p-5">
                <p className="text-gray-900 leading-relaxed text-base" style={{ textIndent: '2em', lineHeight: '1.8' }}>
                  {selectedHistoryPeriod.description}
                </p>
              </div>
            )}
          </div>

          {/* 二、重要事件 */}
          <div className="mb-4">
            <SectionHeader
              icon={<Calendar className="w-5 h-5 text-blue-700 flex-shrink-0" />}
              title="二、重要事件"
              section="events"
              count={selectedHistoryPeriod.importantEvents.length}
            />
            {expandedSections.events && (
              <div className="mt-2 space-y-2">
                {selectedHistoryPeriod.importantEvents.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 bg-blue-50 rounded-xl p-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0 font-semibold text-sm">
                      {index + 1}
                    </div>
                    <p
                      className="text-gray-900 text-base pt-1 flex-1"
                      style={{ textIndent: '2em', lineHeight: '1.8' }}
                    >
                      {event}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 三、文化传承 */}
          <div className="mb-4">
            <SectionHeader
              icon={<Award className="w-5 h-5 text-purple-700 flex-shrink-0" />}
              title="三、文化传承"
              section="culture"
            />
            {expandedSections.culture && (
              <div className="mt-2 space-y-3">
                <div className="bg-purple-50 rounded-xl p-5">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    文化背景
                  </h4>
                  <p
                    className="text-gray-900 text-base"
                    style={{ textIndent: '2em', lineHeight: '1.8' }}
                  >
                    {selectedHistoryPeriod.culturalBackground}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    主要流派
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedHistoryPeriod.majorSchools.map((school, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-900"
                      >
                        <Award className="w-3 h-3" />
                        {school}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    传承脉络
                  </h4>
                  <ul className="bg-rose-50 rounded-xl p-4 space-y-2">
                    {selectedHistoryPeriod.inheritanceLineage.map((lineage, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-gray-900 text-base"
                      >
                        <span className="text-rose-700 font-semibold flex-shrink-0">→</span>
                        <span>{lineage}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Scroll className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    代表性典籍
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedHistoryPeriod.representativeWorks.map((work, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-900"
                      >
                        <Scroll className="w-3 h-3" />
                        {work}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 四、相关疗法 */}
          {relatedTherapies.length > 0 && (
            <div className="mb-4">
              <SectionHeader
                icon={<BookOpen className="w-5 h-5 text-emerald-700 flex-shrink-0" />}
                title="四、相关疗法"
                section="related"
                count={relatedTherapies.length}
              />
              {expandedSections.related && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relatedTherapies.map((therapy) => (
                    <button
                      key={therapy!.id}
                      onClick={() => handleTherapyClick(therapy!.id)}
                      className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl cursor-pointer hover:bg-amber-100 hover:shadow-sm transition-all group text-left"
                    >
                      <div className="w-12 h-12 rounded-lg bg-amber-200 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-6 h-6 text-amber-800" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 group-hover:text-amber-800 transition-colors truncate">
                          {therapy!.name}
                        </h4>
                        <p className="text-sm text-gray-700 truncate">{therapy!.system}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-amber-700 transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部关闭按钮 */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <button
            onClick={closeHistoryModal}
            className="w-full py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors shadow-md hover:shadow-lg"
          >
            关闭
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export default HistoryModal;