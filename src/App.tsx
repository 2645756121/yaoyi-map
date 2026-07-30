import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { APP_BASE_URL } from '@/lib/assetPath';
import Home from '@/pages/Home';
import ErrorBoundary from '@/components/common/ErrorBoundary';

/**
 * 应用根组件：
 * - 在路由层使用 ErrorBoundary 兜底，捕获 Home 渲染期异常并展示降级 UI
 * - BrowserRouter 提供单页路由（当前仅 "/" 一条路由）
 *
 * ✅ basename 必须与 Vite 的 `base` 配置保持一致：
 *   - GitHub Pages 项目页（base = '/yaoyi-map/'）：访问 /yaoyi-map/ 时
 *     basename 会去掉该前缀，再去匹配 <Route path="/" />
 *   - 自定义域 / Vercel（base = '/'）：basename 为 '/'，行为与原来一致
 */
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