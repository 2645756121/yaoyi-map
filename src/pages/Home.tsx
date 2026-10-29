import React, { lazy, Suspense } from 'react';
import Header from '../components/common/Header';
import RegionPanel from '../components/RegionPanel/RegionPanel';
import BackToTop from '../components/common/BackToTop';
import HerbCatalog from '../components/HerbCatalog/HerbCatalog';
import TherapyGallery from '../components/TherapyGallery/TherapyGallery';
import YaoKnowledgeEntry from '../components/YaoKnowledgeEntry/YaoKnowledgeEntry';
import Footer from '../components/common/Footer';
import { useMapStore } from '../store/mapStore';

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
// 地形浮雕查看器含 Three.js，体积较大 → 按需懒加载，避免拖慢首屏
const TerrainRelief3D = lazy(() => import('../components/TerrainRelief3D/TerrainRelief3D'));

// 鉁?Suspense fallback锛歁odal 鍔犺浇鏈熼棿鏄剧ず杞婚噺鍗犱綅
const ModalFallback = () => null;

// 首页布局
// 关键设计：
//   - RegionPanel 采用流式（streaming）布局：position: relative 参与文档流
//   - 当面板打开时（isPanelOpen=true），整个页面 main 区域被面板接管
//   - 当面板关闭时，恢复为"草药目录 + 地图"的默认布局
//   - 任何时候都没有元素被遮盖，所有内容均可滚动查看
export default function Home() {
  const { isPanelOpen } = useMapStore();

  return (
    <div className="flex flex-col" style={{ width: '100vw', minHeight: '100vh' }}>
      <Header />

      <main
        className="flex flex-col flex-1 relative"
        style={{
          minHeight: 'calc(100vh - 80px)',
          width: '100%',
        }}
      >
        {isPanelOpen ? (
          // ============ 面版打开：流式布局，面板占据主要区域 ============
          <div
            className="w-full"
            style={{
              minHeight: 'calc(100vh - 80px)',
              // 避免遮挡：确保 main 在面板打开时不参与 overflow:hidden
              position: 'relative',
            }}
          >
            <RegionPanel />
          </div>
        ) : (
          // ============ 默认布局：草药目录 + 地图 ============
          <>
            {/* 顶栏目录区：草药分类目录 / 瑶医技法 / 瑶医基础知识 三个入口并排 */}
            <section aria-label="瑶医知识入口" className="w-full px-4 pt-4 pb-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-stretch">
                <HerbCatalog bare />
                <TherapyGallery />
                <YaoKnowledgeEntry />
              </div>
            </section>

            <section
              aria-label="瑶医分布地图 / 真实地理地图"
              className="relative w-full px-3 sm:px-4 py-3 sm:py-4 animate-yao-fade-in-up"
              style={{
                flex: '1 1 auto',
                minHeight: '720px',
                height: 'calc(100vh - 80px)',
                maxHeight: '1100px',
              }}
            >
              {/* 顶部装饰条：蜜炙黄渐变流光 */}
              <div
                className="absolute top-0 left-4 right-4 sm:left-6 sm:right-6 h-0.5 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(212, 172, 106, 0.6) 30%, rgba(212, 172, 106, 0.9) 50%, rgba(212, 172, 106, 0.6) 70%, transparent 100%)',
                }}
                aria-hidden
              />
              {/* 地形浮雕为唯一地图形态：2D Leaflet 地图已移除 */}
              <Suspense fallback={<ModalFallback />}>
                <TerrainRelief3D />
              </Suspense>
            </section>
          </>
        )}
      </main>

      {/* ✅ Modal 使用 Suspense 包裹，按需加载 */}
      <Suspense fallback={<ModalFallback />}>
        <HerbModal />
        <TherapyModal />
        <HistoryModal />
        <CountyInfoModal />
        <YaoMedicalKnowledgePortal />
      </Suspense>

      {/* ✅ Footer：底部信息栏，统一使用 Logo 组件 */}
      <Footer />

      <BackToTop />
    </div>
  );
}