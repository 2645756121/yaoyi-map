import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { APP_BASE_URL } from '@/lib/assetPath';
import Home from '@/pages/Home';
import ErrorBoundary from '@/components/common/ErrorBoundary';

/**
<<<<<<< HEAD
 * 搴旂敤鏍圭粍浠讹細
 * - 鍦ㄨ矾鐢卞眰浣跨敤 ErrorBoundary 鍏滃簳锛屾崟鑾?Home 娓叉煋鏈熷紓甯稿苟灞曠ず闄嶇骇 UI
 * - BrowserRouter 鎻愪緵鍗曢〉璺敱锛堝綋鍓嶄粎 "/" 涓€鏉¤矾鐢憋級
 *
 * 鉁?basename 蹇呴』涓?Vite 鐨?`base` 閰嶇疆淇濇寔涓€鑷达細
 *   - GitHub Pages 椤圭洰椤碉紙base = '/yaoyi-map/'锛夛細璁块棶 /yaoyi-map/ 鏃? *     basename 浼氬幓鎺夎鍓嶇紑锛屽啀鍘诲尮閰?<Route path="/" />
 *   - 鑷畾涔夊煙 / Vercel锛坆ase = '/'锛夛細basename 涓?'/'锛岃涓轰笌鍘熸潵涓€鑷? */
=======
 * 应用根组件：
 * - 在路由层使用 ErrorBoundary 兜底，捕获 Home 渲染期异常并展示降级 UI
 * - BrowserRouter 提供单页路由（当前仅 "/" 一条路由）
 *
 * ✅ basename 必须与 Vite 的 `base` 配置保持一致：
 *   - GitHub Pages 项目页（base = '/yaoyi-map/'）：访问 /yaoyi-map/ 时
 *     basename 会去掉该前缀，再去匹配 <Route path="/" />
 *   - 自定义域 / Vercel（base = '/'）：basename 为 '/'，行为与原来一致
 */
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)
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