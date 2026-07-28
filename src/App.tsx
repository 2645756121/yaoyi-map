import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { APP_BASE_URL } from '@/lib/assetPath';
import Home from '@/pages/Home';
import ErrorBoundary from '@/components/common/ErrorBoundary';

/**
 * 搴旂敤鏍圭粍浠讹細
 * - 鍦ㄨ矾鐢卞眰浣跨敤 ErrorBoundary 鍏滃簳锛屾崟鑾?Home 娓叉煋鏈熷紓甯稿苟灞曠ず闄嶇骇 UI
 * - BrowserRouter 鎻愪緵鍗曢〉璺敱锛堝綋鍓嶄粎 "/" 涓€鏉¤矾鐢憋級
 *
 * 鉁?basename 蹇呴』涓?Vite 鐨?`base` 閰嶇疆淇濇寔涓€鑷达細
 *   - GitHub Pages 椤圭洰椤碉紙base = '/yaoyi-map/'锛夛細璁块棶 /yaoyi-map/ 鏃? *     basename 浼氬幓鎺夎鍓嶇紑锛屽啀鍘诲尮閰?<Route path="/" />
 *   - 鑷畾涔夊煙 / Vercel锛坆ase = '/'锛夛細basename 涓?'/'锛岃涓轰笌鍘熸潵涓€鑷? */
export default function App() {
  return (
    <ErrorBoundary>
      <Router basename={APP_BASE_URL}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}