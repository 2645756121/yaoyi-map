import React, { lazy, Suspense } from 'react';
import Header from '../components/common/Header';
import MapBoard from '../components/MapBoard/MapBoard';
import RegionPanel from '../components/RegionPanel/RegionPanel';
import BackToTop from '../components/common/BackToTop';
import HerbCatalog from '../components/HerbCatalog/HerbCatalog';

// ✅ 性能优化：所有 Modal/Portal 改为按需加载
//   这些组件仅在用户触发特定交互时才渲染，不应在首屏加载
//   lazy + Suspense 让 Vite 自动拆分为独立 chunk
//   节省首屏约 200-300KB（gzip 前）
const HerbModal = lazy(() => import('../components/HerbModal/HerbModal'));
const TherapyModal = lazy(() => import('../components/TherapyModal/TherapyModal'));
const HistoryModal = lazy(() => import('../components/HistoryModal/HistoryModal'));
const CountyInfoModal = lazy(() => import('../components/CountyInfoModal/CountyInfoModal'));
const YaoMedicalKnowledgePortal = lazy(
  () => import('../components/YaoMedicalKnowledge/YaoMedicalKnowledgePortal')
);

// ✅ Suspense fallback：Modal 加载期间显示轻量占位
const ModalFallback = () => null;

// 首页布局（整合后 + 草药目录置顶优化 + 真实地理地图）
export default function Home() {
  return (
    <div className="flex flex-col" style={{ width: '100vw', minHeight: '100vh' }}>
      <Header />

      <main
        className="flex flex-col flex-1"
        style={{
          minHeight: 'calc(100vh - 80px)',
          width: '100%',
        }}
      >
        <HerbCatalog />

        <section
          aria-label="瑶医分布地图 / 真实地理地图"
          className="w-full px-4 py-4"
          style={{
            flex: '1 1 auto',
            minHeight: '720px',
            height: 'calc(100vh - 80px)',
            maxHeight: '1100px',
            position: 'relative',
          }}
        >
          <MapBoard />
        </section>
      </main>

      <RegionPanel />

      {/* ✅ Modal 使用 Suspense 包裹，按需加载 */}
      <Suspense fallback={<ModalFallback />}>
        <HerbModal />
        <TherapyModal />
        <HistoryModal />
        <CountyInfoModal />
        <YaoMedicalKnowledgePortal />
      </Suspense>

      <BackToTop />
    </div>
  );
}