/**
 * 生产环境监控与错误上报
 *
 * 目标：
 *   1. 统一捕获运行时 JS 错误与未处理的 Promise 拒绝
 *   2. 上报到配置的后端端点（可对接 Sentry / 自建日志服务 / GA4）
 *   3. 通过 navigator.sendBeacon 实现非阻塞、无感知上报，避免阻塞用户
 *   4. 携带上下文（页面 URL、UA、时间戳、Referrer）便于排障
 *   5. 自动节流：同类型错误 5 秒内只上报一次，防止风暴
 *
 * 配置：
 *   - 在生产环境通过 `window.__YAOYI_MONITOR_ENDPOINT__` 或构建时变量指定
 *   - 未配置时仅在控制台 warn，不上报任何网络请求（默认安全）
 */

import type { MonitorEvent } from '../types';

const ENDPOINT_KEY = '__YAOYI_MONITOR_ENDPOINT__';
const SAMPLE_KEY = '__YAOYI_MONITOR_SAMPLE__';
const APP_VERSION = '1.0.0';

/**
 * 上报节流缓存：errorHash -> lastReportTimestamp
 */
const throttleMap = new Map<string, number>();
const THROTTLE_WINDOW_MS = 5_000;
/** 上报失败时的最大缓存条数（避免内存泄漏） */
const THROTTLE_CACHE_LIMIT = 200;

/**
 * 判断是否启用上报
 *
 * 默认仅在以下条件下上报：
 *  1. 非开发环境（import.meta.env.PROD === true）
 *  2. 已配置上报端点
 *  3. 通过采样率过滤（默认 100%）
 */
function isReportingEnabled(): boolean {
  const endpoint = getEndpoint();
  if (!endpoint) return false;
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return false;
  const sample = Number((window as unknown as Record<string, unknown>)[SAMPLE_KEY] ?? '1');
  return Number.isFinite(sample) && Math.random() < sample;
}

function getEndpoint(): string | null {
  const w = window as unknown as Record<string, unknown>;
  const v = w[ENDPOINT_KEY];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * 计算错误的稳定 hash 用于节流
 */
function hashError(event: MonitorEvent): string {
  const parts = [
    event.kind,
    event.message.slice(0, 200),
    event.source ?? '',
    event.lineno ?? '',
    event.colno ?? '',
  ];
  return parts.join('|');
}

/**
 * 通过 sendBeacon 非阻塞上报
 */
function report(event: MonitorEvent): void {
  const endpoint = getEndpoint();
  if (!endpoint) return;

  const hash = hashError(event);
  const now = Date.now();
  const lastReport = throttleMap.get(hash);
  if (lastReport && now - lastReport < THROTTLE_WINDOW_MS) {
    return; // 节流：同类型错误短时间内只上报一次
  }
  throttleMap.set(hash, now);
  if (throttleMap.size > THROTTLE_CACHE_LIMIT) {
    // LRU 简化：清空最早的一半
    const entries = Array.from(throttleMap.entries()).sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < entries.length / 2; i++) {
      throttleMap.delete(entries[i][0]);
    }
  }

  const payload = {
    ...event,
    appVersion: APP_VERSION,
    timestamp: new Date().toISOString(),
    url: location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };

  try {
    const body = JSON.stringify(payload);
    if ('sendBeacon' in navigator && typeof navigator.sendBeacon === 'function') {
      // ✅ sendBeacon 是 POST + 不阻塞、即使页面卸载也能完成
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (sent) return;
    }
    // 兜底：fetch keepalive（页面卸载时仍能完成）
    if (typeof fetch === 'function') {
      void fetch(endpoint, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        /* 上报失败不阻塞主流程 */
      });
    }
  } catch {
    /* ignore - monitoring 永远不应抛错 */
  }
}

/**
 * 转换 ErrorEvent 为 MonitorEvent
 */
function fromErrorEvent(ev: ErrorEvent): MonitorEvent {
  return {
    kind: 'error',
    message: ev.message || String(ev.error || 'Unknown error'),
    stack: ev.error instanceof Error ? ev.error.stack : undefined,
    source: ev.filename,
    lineno: ev.lineno,
    colno: ev.colno,
  };
}

/**
 * 转换未处理的 Promise 拒绝
 */
function fromUnhandledRejection(ev: PromiseRejectionEvent): MonitorEvent {
  const reason = ev.reason;
  return {
    kind: 'unhandledrejection',
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  };
}

/**
 * 初始化全局错误监听
 *
 * 应在应用入口（main.tsx）调用一次。
 * 自动避免重复注册（多次调用安全）。
 */
let installed = false;

export function installMonitoring(): void {
  if (installed) return;
  installed = true;

  if (typeof window === 'undefined') return;

  window.addEventListener('error', (ev) => {
    if (!isReportingEnabled()) {
      console.warn('[monitoring] error (未上报，未配置端点):', ev.message);
      return;
    }
    report(fromErrorEvent(ev));
  });

  window.addEventListener('unhandledrejection', (ev) => {
    if (!isReportingEnabled()) {
      console.warn('[monitoring] unhandledrejection (未上报):', ev.reason);
      return;
    }
    report(fromUnhandledRejection(ev));
  });

  // 生产环境可启用性能指标上报（Web Vitals）
  if (isReportingEnabled() && 'PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const nav = entry as PerformanceNavigationTiming;
            report({
              kind: 'perf',
              message: 'navigation',
              meta: {
                dns: nav.domainLookupEnd - nav.domainLookupStart,
                tcp: nav.connectEnd - nav.connectStart,
                ttfb: nav.responseStart - nav.requestStart,
                download: nav.responseEnd - nav.responseStart,
                domInteractive: nav.domInteractive - nav.fetchStart,
                loadComplete: nav.loadEventEnd - nav.fetchStart,
              },
            });
          }
        }
      });
      observer.observe({ type: 'navigation', buffered: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * 手动上报自定义事件
 * 可用于业务埋点、API 错误捕获等
 */
export function reportEvent(event: MonitorEvent): void {
  if (!isReportingEnabled()) return;
  report(event);
}

/**
 * 设置上报端点（运行时配置）
 * 适合从后端环境变量注入或 A/B 测试时动态切换
 */
export function configureMonitoring(endpoint: string, sampleRate = 1): void {
  (window as unknown as Record<string, unknown>)[ENDPOINT_KEY] = endpoint;
  (window as unknown as Record<string, unknown>)[SAMPLE_KEY] = String(Math.min(1, Math.max(0, sampleRate)));
}