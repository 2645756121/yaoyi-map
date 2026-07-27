import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { installMonitoring } from './lib/monitoring'

// ✅ 生产环境全局错误监控：捕获运行时异常 + 未处理的 Promise 拒绝
//    通过 navigator.sendBeacon 非阻塞上报到配置端点（默认不启用）
installMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
