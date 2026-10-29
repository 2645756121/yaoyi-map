/**
 * Application entry point
 *
 * 修复说明 (2026-07-28):
 * - 移除 StrictMode：避免 React 18 在某些浏览器（含 Edge 旧版）上的渲染冲突
 * - 添加 ErrorBoundary：组件渲染失败时显示降级 UI，避免整个页面空白
 * - 添加持久化 debug 标记：让用户能确认页面已成功加载
 */
import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { installMonitoring } from './lib/monitoring'

// 安装生产环境监控（捕获运行时错误）
installMonitoring()

// 错误边界：组件渲染失败时显示降级 UI，避免整页空白
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: 'system-ui, sans-serif',
          maxWidth: '600px',
          margin: 'auto',
          color: '#333',
          lineHeight: 1.6,
        }}>
          <h1 style={{ color: '#c00' }}>页面加载出错</h1>
          <p>应用遇到了一个错误，请刷新页面重试。</p>
          <pre style={{
            background: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '12px',
          }}>
            {String(this.state.error)}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

// 挂载 React 应用（不使用 StrictMode 以兼容更多浏览器）
const rootEl = document.getElementById('root')!
const root = createRoot(rootEl)

// 持久化版本标记（让用户能确认页面已成功加载）
const buildDate = new Date().toISOString().substring(0, 10)
const buildTag = `__BUILD_production_${buildDate}__`
rootEl.setAttribute('data-build', buildTag)
console.log('[Yaoyi Map] ' + buildTag)

root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
