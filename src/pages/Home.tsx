import React, { lazy, Suspense } from 'react';
import Header from '../components/common/Header';
import MapBoard from '../components/MapBoard/MapBoard';
import RegionPanel from '../components/RegionPanel/RegionPanel';
import BackToTop from '../components/common/BackToTop';
import HerbCatalog from '../components/HerbCatalog/HerbCatalog';

// 鉁?鎬ц兘浼樺寲锛氭墍鏈?Modal/Portal 鏀逛负鎸夐渶鍔犺浇
//   杩欎簺缁勪欢浠呭湪鐢ㄦ埛瑙﹀彂鐗瑰畾浜や簰鏃舵墠娓叉煋锛屼笉搴斿湪棣栧睆鍔犺浇
//   lazy + Suspense 璁?Vite 鑷姩鎷嗗垎涓虹嫭绔?chunk
//   鑺傜渷棣栧睆绾?200-300KB锛坓zip 鍓嶏級
const HerbModal = lazy(() => import('../components/HerbModal/HerbModal'));
const TherapyModal = lazy(() => import('../components/TherapyModal/TherapyModal'));
const HistoryModal = lazy(() => import('../components/HistoryModal/HistoryModal'));
const CountyInfoModal = lazy(() => import('../components/CountyInfoModal/CountyInfoModal'));
const YaoMedicalKnowledgePortal = lazy(
  () => import('../components/YaoMedicalKnowledge/YaoMedicalKnowledgePortal')
);

// 鉁?Suspense fallback锛歁odal 鍔犺浇鏈熼棿鏄剧ず杞婚噺鍗犱綅
const ModalFallback = () => null;

// 棣栭〉甯冨眬锛堟暣鍚堝悗 + 鑽夎嵂鐩綍缃《浼樺寲 + 鐪熷疄鍦扮悊鍦板浘 + 瑙嗚缇庡寲鐗堬級
export default function Home() {
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
        <HerbCatalog />

        <section
          aria-label="鐟跺尰鍒嗗竷鍦板浘 / 鐪熷疄鍦扮悊鍦板浘"
          className="relative w-full px-3 sm:px-4 py-3 sm:py-4 animate-yao-fade-in-up"
          style={{
            flex: '1 1 auto',
            minHeight: '720px',
            height: 'calc(100vh - 80px)',
            maxHeight: '1100px',
          }}
        >
          {/* 椤堕儴瑁呴グ鏉★細铚滅倷榛勬笎鍙樻祦鍏?*/}
          <div
            className="absolute top-0 left-4 right-4 sm:left-6 sm:right-6 h-0.5 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(212, 172, 106, 0.6) 30%, rgba(212, 172, 106, 0.9) 50%, rgba(212, 172, 106, 0.6) 70%, transparent 100%)',
            }}
            aria-hidden
          />
          <MapBoard />
        </section>
      </main>

      <RegionPanel />

      {/* 鉁?Modal 浣跨敤 Suspense 鍖呰９锛屾寜闇€鍔犺浇 */}
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