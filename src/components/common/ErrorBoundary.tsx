import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /**
   * 兜底渲染函数：当组件抛出未捕获异常时调用。
   * 默认渲染内置的"出错了"提示，可由调用方覆盖。
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 通用错误边界：
 * - 捕获子组件树中的同步渲染异常，阻止整页白屏
 * - 提供 reset() 方法让用户重试
 * - 仅捕获渲染期异常，不捕获事件回调、Promise、async 错误
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // 仅在开发环境输出详细信息，生产环境可在接入 Sentry 后上报
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] caught error:', error, info.componentStack);
    }
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.handleReset);
      }
      return (
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <h3 className="font-serif font-semibold text-amber-900 text-lg">
                组件渲染异常
              </h3>
            </div>
            <p className="text-sm text-amber-800 mb-1">
              请尝试刷新或重试。若问题持续，请联系管理员。
            </p>
            {import.meta.env.DEV && (
              <pre className="mt-3 max-h-32 overflow-auto text-xs text-amber-900 bg-amber-100 rounded p-2 whitespace-pre-wrap">
                {error.message}
              </pre>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </button>
              <button
                onClick={this.handleReload}
                className="px-3 py-1.5 bg-white text-amber-700 border border-amber-300 rounded-lg text-sm hover:bg-amber-50 transition-colors"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;