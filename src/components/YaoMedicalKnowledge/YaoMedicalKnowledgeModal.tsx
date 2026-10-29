/**
 * 瑶医基础知识统一入口 Modal
 *
 * 设计目标：
 *   - 将所有"瑶医基础知识"内容（基础理论、特色诊疗、瑶药经典分类、性味归经、非遗传承）
 *     从县区级面板中抽离，集中到统一的独立入口
 *   - 避免每个县区面板重复嵌入占用页面资源
 *   - 用户可通过统一入口集中访问所有瑶医基础知识资料
 *
 * 数据来源（与原 CountyInfoModal 中嵌入板块一致）：
 *   1. 国家中医药管理局《全国中医药传承创新发展》
 *   2. 中国民族医药学会瑶医药分会公开资料
 *   3. 《瑶医药学》（覃迅云主编，民族出版社）
 *   4. 瑶医药国家级非物质文化遗产代表性项目名录
 *   5. 全国第四次中药资源普查瑶药专项报告
 */

import { PanelBody, PanelFooter, PanelHeader, PanelOverlay, PanelSurface } from '../common/PanelKit';
import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Heart,
  FlaskConical,
  Leaf,
  Award,
  Users,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import {
  YAO_MEDICAL_THEORIES,
  YAO_DIAGNOSTIC_METHODS,
  YAO_HERB_CATEGORIES,
  YAO_HERB_EFFICACY_OVERVIEW,
  YAO_HERITAGE_ITEMS,
  YAO_INHERITORS,
} from '../../data/yaoMedicalKnowledge';

interface YaoMedicalKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 瑶医基础知识统一入口 Modal
 *
 * 通过 zustand store 暴露给外部触发：
 *   useYaoMedicalKnowledgeStore.getState().open()
 *
 * 也可通过按钮直接调用：
 *   <button onClick={() => setIsOpen(true)}>查看瑶医基础知识</button>
 */
const YaoMedicalKnowledgeModal: React.FC<YaoMedicalKnowledgeModalProps> = ({
  isOpen,
  onClose,
}) => {
  // 默认展开第一个分类（基础理论）
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    theories: true,
    diagnostics: true,
    categories: false,
    efficacy: false,
    heritage: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <PanelOverlay onClose={onClose} label="瑶医基础知识">
      <PanelSurface>
        <PanelHeader
          tone="violet"
          icon={<BookOpen className="w-5 h-5" />}
          title="瑶医基础知识"
          subtitle="国家级非遗 · 共享资料库"
          onClose={onClose}
          closeLabel="关闭瑶医基础知识"
        />

        {/* 数据来源声明（统一放在内容区顶部，头部只留标题） */}
        <PanelBody className="p-4 space-y-3">
          <p className="text-[11px] leading-relaxed text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            数据来源：国家中医药管理局《全国中医药传承创新发展》、中国民族医药学会瑶医药分会、
            《瑶医药学》（覃迅云主编）、瑶医药国家级非物质文化遗产代表性项目名录。
          </p>
          {/* 1. 基础理论 */}
          <Section
            icon={<Sparkles className="w-4 h-4 text-emerald-600" />}
            title="一、基础理论（4 大核心）"
            isOpen={openSections.theories}
            onToggle={() => toggle('theories')}
            colorTheme="emerald"
          >
            <div className="space-y-2">
              {YAO_MEDICAL_THEORIES.map((t) => (
                <div
                  key={t.name}
                  className="bg-white p-3 rounded-md border border-emerald-100"
                >
                  <div className="font-semibold text-sm text-emerald-800">
                    {t.name}{' '}
                    {t.pinyin && (
                      <span className="text-xs font-normal text-gray-500">({t.pinyin})</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 mt-1 leading-relaxed">{t.description}</p>
                  <ul className="mt-2 space-y-0.5">
                    {t.keyPoints.map((p, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* 2. 特色诊疗方法 */}
          <Section
            icon={<Heart className="w-4 h-4 text-rose-500" />}
            title="二、特色诊疗方法（6 大技法）"
            isOpen={openSections.diagnostics}
            onToggle={() => toggle('diagnostics')}
            colorTheme="amber"
          >
            <div className="space-y-2">
              {YAO_DIAGNOSTIC_METHODS.map((m) => (
                <div
                  key={m.name}
                  className="bg-white p-3 rounded-md border border-amber-100"
                >
                  <div className="font-semibold text-sm text-amber-800">{m.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">来源：{m.origin}</div>
                  <div className="text-xs text-gray-700 mt-1.5">
                    <span className="font-medium text-rose-600">主治：</span>
                    {m.indications.join('、')}
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    <span className="font-medium text-amber-600">操作：</span>
                    {m.procedure}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 3. 瑶药经典分类 */}
          <Section
            icon={<FlaskConical className="w-4 h-4 text-purple-600" />}
            title='三、瑶药经典分类（"五虎九牛十八钻七十二风"）'
            isOpen={openSections.categories}
            onToggle={() => toggle('categories')}
            colorTheme="purple"
          >
            <div className="space-y-2">
              {YAO_HERB_CATEGORIES.map((c) => (
                <div
                  key={c.category}
                  className="bg-white p-3 rounded-md border border-purple-100"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm text-purple-800">{c.category}</div>
                    <div className="text-xs text-gray-500">瑶语：{c.nameYao}</div>
                  </div>
                  <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">{c.meaning}</p>
                  <div className="mt-2 text-xs">
                    <span className="font-medium text-purple-700">代表药材：</span>
                    <span className="text-gray-600">
                      {c.representatives.slice(0, 6).join('、')}
                      {c.representatives.length > 6 ? '等' : ''}
                    </span>
                  </div>
                  <div className="text-xs mt-1">
                    <span className="font-medium text-emerald-700">主要功效：</span>
                    <span className="text-gray-600">{c.mainEffects}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 4. 性味归经 */}
          <Section
            icon={<Leaf className="w-4 h-4 text-teal-600" />}
            title="四、瑶药四性五味归经"
            isOpen={openSections.efficacy}
            onToggle={() => toggle('efficacy')}
            colorTheme="teal"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-700">
                    <th className="py-1 px-2 font-semibold">性</th>
                    <th className="py-1 px-2 font-semibold">味</th>
                    <th className="py-1 px-2 font-semibold">归经</th>
                    <th className="py-1 px-2 font-semibold">功效</th>
                    <th className="py-1 px-2 font-semibold">临床应用</th>
                  </tr>
                </thead>
                <tbody>
                  {YAO_HERB_EFFICACY_OVERVIEW.map((e) => (
                    <tr key={e.nature} className="border-t border-teal-100">
                      <td className="py-1.5 px-2 font-bold text-teal-700">{e.nature}</td>
                      <td className="py-1.5 px-2 text-gray-700">{e.flavor}</td>
                      <td className="py-1.5 px-2 text-gray-700">{e.meridian}</td>
                      <td className="py-1.5 px-2 text-gray-600">{e.efficacy.join('、')}</td>
                      <td className="py-1.5 px-2 text-gray-600">{e.clinicalUse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 5. 非遗传承 */}
          <Section
            icon={<Award className="w-4 h-4 text-rose-600" />}
            title={`五、瑶医药非遗传承（${YAO_HERITAGE_ITEMS.length} 项）`}
            isOpen={openSections.heritage}
            onToggle={() => toggle('heritage')}
            colorTheme="rose"
          >
            <div className="space-y-2">
              {YAO_HERITAGE_ITEMS.map((h) => (
                <div
                  key={h.name}
                  className="bg-white p-3 rounded-md border border-rose-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm text-rose-800">{h.name}</div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        h.type === '国家级'
                          ? 'bg-rose-100 text-rose-700 font-bold'
                          : h.type === '省级'
                            ? 'bg-amber-100 text-amber-700'
                            : h.type === '市级'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {h.type} · {h.year}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">保护单位：{h.custodian}</div>
                  <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">{h.description}</p>
                </div>
              ))}

              {/* 代表性传承人 */}
              <div className="mt-3 pt-3 border-t border-rose-100">
                <div className="text-xs font-semibold text-rose-700 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  代表性传承人（{YAO_INHERITORS.length} 位）
                </div>
                <div className="space-y-1.5">
                  {YAO_INHERITORS.map((inh) => (
                    <div
                      key={inh.name}
                      className="text-xs text-gray-700 bg-white/80 p-2 rounded"
                    >
                      <span className="font-medium">{inh.name}</span>
                      <span className="text-gray-500"> · {inh.title} · {inh.region}</span>
                      <div className="text-gray-600 mt-0.5">擅长：{inh.specialty}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </PanelBody>

        <PanelFooter>
          本资料仅用于教学与科普展示，不构成医疗建议。实际诊疗请咨询具备瑶医执业资格的医疗机构。
        </PanelFooter>
      </PanelSurface>
    </PanelOverlay>
  );
};

export default YaoMedicalKnowledgeModal;

/* ===================================================================
 * 可折叠 Section 子组件
 * =================================================================== */
interface SectionProps {
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  colorTheme: 'emerald' | 'amber' | 'purple' | 'teal' | 'rose';
}

const colorThemeMap = {
  emerald: {
    summary: 'hover:bg-emerald-50/40',
    content: 'bg-emerald-50/40',
  },
  amber: {
    summary: 'hover:bg-amber-50/40',
    content: 'bg-amber-50/40',
  },
  purple: {
    summary: 'hover:bg-purple-50/40',
    content: 'bg-purple-50/40',
  },
  teal: {
    summary: 'hover:bg-teal-50/40',
    content: 'bg-teal-50/40',
  },
  rose: {
    summary: 'hover:bg-rose-50/40',
    content: 'bg-rose-50/40',
  },
};

const Section: React.FC<SectionProps> = ({ icon, title, isOpen, onToggle, children, colorTheme }) => {
  const theme = colorThemeMap[colorTheme];
  return (
    <div className="border border-white/40 rounded-xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full p-3 bg-white/80 backdrop-blur-sm flex items-center justify-between text-left transition-colors ${theme.summary}`}
      >
        <span className="font-medium text-sm text-gray-800 flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className={`p-3 ${theme.content}`}>{children}</div>}
    </div>
  );
};
