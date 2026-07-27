/**
 * 瑶医基础知识统一入口 Portal 组件
 *
 * 监听 window 'open-yao-knowledge' 自定义事件，
 * 用于从县区面板或其他位置触发打开 YaoMedicalKnowledgeModal。
 *
 * 设计要点：
 *   - 使用 window CustomEvent 通信（避免循环依赖）
 *   - 单实例管理 isOpen 状态
 *   - 渲染一个全屏的 Modal 容器
 *   - 进入"瑶医基础知识"页面时自动关闭其它已打开的模态窗口
 *     （CountyInfoModal / RegionPanel / HerbModal / TherapyModal / HistoryModal）
 *     保证页面切换的流畅度，避免模态堆叠遮挡
 */

import React, { useState, useEffect } from 'react';
import YaoMedicalKnowledgeModal from './YaoMedicalKnowledgeModal';
import { useMapStore } from '../../store/mapStore';

const YaoMedicalKnowledgePortal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      // ✅ 进入"瑶医基础知识"页面时自动关闭所有已打开的模态窗口
      // 通过 store 集中关闭：CountyInfoModal / RegionPanel / HerbModal / TherapyModal / HistoryModal
      const store = useMapStore.getState();
      store.closeCountyModal();
      store.closePanel();
      store.closeHerbModal();
      store.closeTherapyModal();
      store.closeHistoryModal();
      setIsOpen(true);
    };
    window.addEventListener('open-yao-knowledge', handler);
    return () => window.removeEventListener('open-yao-knowledge', handler);
  }, []);

  return <YaoMedicalKnowledgeModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
};

export default YaoMedicalKnowledgePortal;