import React from 'react';
import { useMapStore } from '../../store/mapStore';
import {
  getHerbById,
  getHistoryPeriodById,
  getRegionById,
} from '../../data/mockData';
import {
  X,
  Stethoscope,
  Pill,
  Clock,
  Users,
  FileText,
  AlertTriangle,
  ChevronRight,
  Heart,
  ChevronDown,
  Image as ImageIcon,
} from 'lucide-react';

/**
 * 特色疗法弹窗：展示选定疗法的概述、适用病症、操作流程、注意事项、
 * 传承人物、临床案例、相关草药与历史渊源。
 *
 * 视觉层级：
 *   1. 顶部导航（关闭按钮）
 *   2. 疗法标题区（中文名 + 英文名 + 分类标签 + 所属地区标签）
 *   3. 缩略图占位区（展示 1 张代表性插图，点击可放大查看）
 *   4. 可折叠正文（一~八）
 *
 * 排版约定：
 *   - 标题与小标签使用 flex 排版，**严禁** 对标题元素加首行缩进
 *   - 正文段落使用内联 `style={{ textIndent: '2em' }}` 而非全局类，
 *     以避免影响含图标的标题
 */
const TherapyModal: React.FC = () => {
  const {
    selectedTherapy,
    isTherapyModalOpen,
    closeTherapyModal,
    setSelectedHerb,
    openHerbModal,
  } = useMapStore();

  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    overview: true,
    conditions: true,
    operation: false,
    precautions: false,
    inheritors: false,
    cases: false,
    relatedHerbs: false,
    relatedHistory: false,
  });

  // 大图预览状态：保存当前要展示的图片 URL 和 alt
  const [previewImage, setPreviewImage] = React.useState<{ src: string; alt: string } | null>(
    null
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!selectedTherapy) return null;

  const relatedHerbs = selectedTherapy.relatedHerbs
    .map((id) => getHerbById(id))
    .filter(Boolean);
  const relatedHistory = selectedTherapy.relatedHistoryPeriods
    .map((id) => getHistoryPeriodById(id))
    .filter(Boolean);
  const region = getRegionById(selectedTherapy.regionId);

  const handleHerbClick = (herbId: string) => {
    const herb = getHerbById(herbId);
    if (herb) {
      setSelectedHerb(herb);
      openHerbModal();
    }
  };

  const operationSteps = selectedTherapy.operationFlow
    .split('；')
    .map((step, index) => ({
      index: index + 1,
      text: step.replace(/^\d+\.\s*/, '').trim(),
    }))
    .filter((step) => step.text.length > 0);

  // 缩略图：使用第一味相关草药作为疗法代表图，与常用药材板块缩略图一致
  const heroImage = relatedHerbs[0];

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

  return (
    <>
      <div
        className={`modal-layer modal-layer-high transition-all duration-300 ${
          isTherapyModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeTherapyModal}
      >
        <div
          className={`info-panel-wrapper frosted-panel transform transition-all duration-300 ${
            isTherapyModalOpen ? 'scale-100' : 'scale-95'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={closeTherapyModal}
            className="btn-yao-icon absolute top-4 right-4 z-10 w-9 h-9 shadow-card hover:bg-primary-50 text-ink-700 hover:text-primary-700 transition-colors"
            aria-label="关闭弹窗"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 标题区 */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
            <div className="flex items-center gap-3 mb-2 pr-12">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-serif font-bold truncate">{selectedTherapy.name}</h2>
                <p className="text-sm text-white/90 mt-1 truncate">{selectedTherapy.nameEn}</p>
              </div>
            </div>
            {/* 标签独占一行，使用 border-top 与标题区分 */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/20">
              <span className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-white/20 rounded-full">
                <Stethoscope className="w-3 h-3" />
                {selectedTherapy.system}
              </span>
              {region && (
                <span className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-white/20 rounded-full">
                  {region.name}
                </span>
              )}
            </div>
          </div>

          {/* 缩略图区：默认缩略图，点击放大。复用 HerbCard 中 InteractiveImage 的视觉规则 */}
          {heroImage && (
            <div className="px-4 pt-4">
              <button
                type="button"
                onClick={() =>
                  setPreviewImage({ src: heroImage.image, alt: heroImage.name })
                }
                className="group relative w-full overflow-hidden rounded-xl bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label={`查看疗法代表草药 ${heroImage.name} 大图`}
              >
                <img
                  src={heroImage.image}
                  alt={heroImage.name}
                  loading="lazy"
                  className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white">
                  <span className="text-sm font-medium truncate">{heroImage.name}</span>
                  <span className="inline-flex items-center gap-1 text-xs bg-black/40 px-2 py-1 rounded">
                    <ImageIcon className="w-3 h-3" />
                    点击查看大图
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* 正文滚动区 */}
          <div
            className="p-4 overflow-y-auto modal-body-scroll space-y-3"
            style={{ maxHeight: 'calc(85vh - 320px)' }}
          >
            {/* 一、疗法概述 */}
            <div>
              <SectionHeader
                icon={<Stethoscope className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
                title="一、疗法概述"
                section="overview"
              />
              {expandedSections.overview && (
                <div className="mt-2 bg-emerald-50 rounded-xl p-5">
                  <p
                    className="text-gray-800 leading-relaxed text-base"
                    style={{ textIndent: '2em' }}
                  >
                    {selectedTherapy.description}
                  </p>
                </div>
              )}
            </div>

            {/* 二、适用病症 */}
            <div>
              <SectionHeader
                icon={<Heart className="w-5 h-5 text-rose-600 flex-shrink-0" />}
                title="二、适用病症"
                section="conditions"
                count={selectedTherapy.applicableConditions.length}
              />
              {expandedSections.conditions && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTherapy.applicableConditions.map((condition, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-rose-100 text-rose-800"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      {condition}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 三、操作流程 */}
            <div>
              <SectionHeader
                icon={<Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                title="三、操作流程"
                section="operation"
                count={operationSteps.length}
              />
              {expandedSections.operation && (
                <div className="mt-2 space-y-2">
                  {operationSteps.map((step) => (
                    <div
                      key={step.index}
                      className="flex items-start gap-3 bg-blue-50 rounded-xl p-4"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 font-semibold">
                        {step.index}
                      </div>
                      <p
                        className="text-gray-700 text-base leading-relaxed pt-1 flex-1"
                        style={{ textIndent: '2em' }}
                      >
                        {step.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 四、注意事项 */}
            <div>
              <SectionHeader
                icon={<AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
                title="四、注意事项"
                section="precautions"
                count={selectedTherapy.precautions.length}
              />
              {expandedSections.precautions && (
                <ul className="mt-2 space-y-2">
                  {selectedTherapy.precautions.map((precaution, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-gray-700 text-base bg-amber-50 rounded-xl p-4"
                    >
                      <span className="text-amber-500 mt-1 flex-shrink-0">•</span>
                      <span>{precaution}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 五、传承人物 */}
            {selectedTherapy.inheritors.length > 0 && (
              <div>
                <SectionHeader
                  icon={<Users className="w-5 h-5 text-purple-600 flex-shrink-0" />}
                  title="五、传承人物"
                  section="inheritors"
                  count={selectedTherapy.inheritors.length}
                />
                {expandedSections.inheritors && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTherapy.inheritors.map((inheritor, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                      >
                        <Users className="w-3 h-3" />
                        {inheritor}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 六、临床案例 */}
            {selectedTherapy.clinicalCases.length > 0 && (
              <div>
                <SectionHeader
                  icon={<FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />}
                  title="六、临床案例"
                  section="cases"
                  count={selectedTherapy.clinicalCases.length}
                />
                {expandedSections.cases && (
                  <div className="mt-2 space-y-3">
                    {selectedTherapy.clinicalCases.map((caseItem) => (
                      <div key={caseItem.id} className="bg-indigo-50 rounded-xl p-4">
                        <h4 className="font-medium text-gray-900 mb-3 text-center">
                          {caseItem.caseName}
                        </h4>
                        <div className="space-y-1 text-base text-gray-700">
                          <p style={{ textIndent: '2em' }}>
                            <span className="font-medium">患者：</span>
                            {caseItem.patientInfo}
                          </p>
                          <p style={{ textIndent: '2em' }}>
                            <span className="font-medium">诊断：</span>
                            {caseItem.diagnosis}
                          </p>
                          <p style={{ textIndent: '2em' }}>
                            <span className="font-medium">治疗：</span>
                            {caseItem.treatmentProcess}
                          </p>
                          <p style={{ textIndent: '2em' }}>
                            <span className="font-medium">结果：</span>
                            <span className="text-green-700 font-medium">
                              {caseItem.outcome}
                            </span>
                          </p>
                          <p className="text-gray-500 text-sm mt-2 text-center">{caseItem.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 七、相关草药：每张缩略图都可点击放大，与常用药材板块一致 */}
            {relatedHerbs.length > 0 && (
              <div>
                <SectionHeader
                  icon={<Pill className="w-5 h-5 text-green-600 flex-shrink-0" />}
                  title="七、相关草药"
                  section="relatedHerbs"
                  count={relatedHerbs.length}
                />
                {expandedSections.relatedHerbs && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {relatedHerbs.map((herb) => (
                      <div
                        key={herb!.id}
                        className="flex items-center gap-3 p-3 bg-green-50 rounded-xl hover:bg-green-100 hover:shadow-sm transition-all group"
                      >
                        {/* 缩略图：点击放大查看，复用统一交互 */}
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({ src: herb!.image, alt: herb!.name })
                          }
                          className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-green-500 relative group/img"
                          aria-label={`查看草药 ${herb!.name} 大图`}
                        >
                          <img
                            src={herb!.image}
                            alt={herb!.name}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110"
                          />
                          <span className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHerbClick(herb!.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <h4 className="font-medium text-gray-900 group-hover:text-green-700 transition-colors truncate">
                            {herb!.name}
                          </h4>
                          <p className="text-sm text-gray-600 truncate">{herb!.taste}</p>
                        </button>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-green-600 transition-colors flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 八、历史渊源 */}
            {relatedHistory.length > 0 && (
              <div>
                <SectionHeader
                  icon={<Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />}
                  title="八、历史渊源"
                  section="relatedHistory"
                  count={relatedHistory.length}
                />
                {expandedSections.relatedHistory && (
                  <div className="mt-2 space-y-2">
                    {relatedHistory.map((period) => (
                      <div key={period!.id} className="bg-amber-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                          <h4 className="font-medium text-gray-900">{period!.periodName}</h4>
                          <span className="text-sm text-gray-600">{period!.timeRange}</span>
                        </div>
                        <p
                          className="text-base text-gray-700"
                          style={{ textIndent: '2em' }}
                        >
                          {period!.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 底部关闭按钮 */}
          <div className="p-4 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
            <button
              onClick={closeTherapyModal}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>

      {/* 大图预览：复用 HerbModal 风格的全屏遮罩 + 居中大图 */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/85 z-[40000] flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${previewImage.alt} 大图预览`}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="btn-yao-icon absolute -top-3 -right-3 z-10 w-9 h-9 bg-white text-ink-700 shadow-card hover:bg-primary-50 hover:text-primary-700 transition-colors"
              aria-label="关闭大图"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-6 py-3 rounded-b-lg">
              <h3 className="text-white font-serif font-semibold text-lg">
                {previewImage.alt}
              </h3>
              <p className="text-white/70 text-xs mt-1">点击空白区域关闭</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TherapyModal;