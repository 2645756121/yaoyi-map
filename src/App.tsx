import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import ErrorBoundary from '@/components/common/ErrorBoundary';

/**
 * 应用根组件：
 * - 在路由层使用 ErrorBoundary 兜底，捕获 Home 渲染期异常并展示降级 UI
 * - BrowserRouter 提供单页路由（当前仅 "/" 一条路由）
 */
export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}