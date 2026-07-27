import React from 'react';
import Header from '../components/common/Header';
import MapBoard from '../components/MapBoard/MapBoard';
import RegionPanel from '../components/RegionPanel/RegionPanel';
import HerbModal from '../components/HerbModal/HerbModal';
import TherapyModal from '../components/TherapyModal/TherapyModal';
import HistoryModal from '../components/HistoryModal/HistoryModal';
import CountyInfoModal from '../components/CountyInfoModal/CountyInfoModal';
import YaoMedicalKnowledgePortal from '../components/YaoMedicalKnowledge/YaoMedicalKnowledgePortal';
import BackToTop from '../components/common/BackToTop';
import HerbCatalog from '../components/HerbCatalog/HerbCatalog';

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
      <HerbModal />
      <TherapyModal />
      <HistoryModal />
      <CountyInfoModal />
      <YaoMedicalKnowledgePortal />
      <BackToTop />
    </div>
  );
}