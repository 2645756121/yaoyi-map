/**
 * YaoKnowledgeEntry.tsx —— 「瑶医基础知识」统一入口（顶栏版）
 *
 * 背景：该入口原先挂在每个县区的详情面板里（CountyInfoModal），
 * 导致每次要看基础知识都得先点开一个县。现改为与「草药分类目录 / 瑶医技法」并列的顶栏入口。
 *
 * 实现方式与原入口完全一致：派发 `open-yao-knowledge` 事件，
 * 由常驻的 YaoMedicalKnowledgePortal 统一打开 Modal（单实例，避免重复挂载）。
 * 卡片样式复用 common/EntryCard，保证与另外两个入口完全一致。
 */
import React from 'react';
import { BookOpen } from 'lucide-react';
import EntryCard from '../common/EntryCard';

const YaoKnowledgeEntry: React.FC = () => {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('open-yao-knowledge'));
  };

  return (
    <section className="w-full" aria-label="瑶医基础知识入口">
      <EntryCard
        tone="violet"
        icon={<BookOpen className="w-5 h-5" />}
        title="瑶医基础知识"
        subtitle="基础理论 · 特色诊疗 · 性味归经"
        ariaLabel="打开瑶医基础知识"
        onClick={handleClick}
      />
    </section>
  );
};

export default YaoKnowledgeEntry;
