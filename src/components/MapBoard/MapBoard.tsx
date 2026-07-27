/**
 * MapBoard - 主地图组件
 *
 * 集成:
 *   - Leaflet 基础地图（合规化：无外部瓦片）
 *   - 三级钻取地图（全国 → 省 → 县）
 */

import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  DEFAULT_MAP_VIEW,
  DEFAULT_MAP_BOUNDS,
  CHINA_FULL_BOUNDS,
  TileProvider,
} from '../../lib/tileProviders';
import {
  yaoCounties,
} from '../../data/mockData';
import {
  createOfflineFallbackLayers,
  OfflineFallbackController,
} from './OfflineFallbackLayer';
import {
  loadChinaTerritories,
  type ChinaTerritoriesResult,
} from './ChinaTerritoriesLoader';
import {
  createDrillDownMap,
  type DrillDownController,
  type DrillState,
} from './DrillDownMap';
import {
  createHerbMarkersLayer,
  type HerbMarkersController,
} from './HerbMarkersLayer';
import RegionQuickSelector from './RegionQuickSelector';
import {
  aggregateToHierarchy,
  type AdminHierarchy,
} from '../../lib/adminAggregator';
import { registerDrillDownController } from '../../lib/mapEvents';
import { useMapStore } from '../../store/mapStore';
import type { Herb } from '../../types';

interface MapBoardProps {
  className?: string;
}

const MapBoard: React.FC<MapBoardProps> = ({ className }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const fallbackRef = useRef<OfflineFallbackController | null>(null);
  const drillDownRef = useRef<DrillDownController | null>(null);
  const chinaTerritoriesRef = useRef<ChinaTerritoriesResult | null>(null);
  const herbMarkersRef = useRef<HerbMarkersController | null>(null);
  const [, setDrillState] = useState<DrillState>({ level: 'province' });
  const hierarchyRef = useRef<AdminHierarchy | null>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // 从 store 拿草药弹窗控制回调
  const setSelectedHerb = useMapStore((s) => s.setSelectedHerb);
  const openHerbModal = useMapStore((s) => s.openHerbModal);

  // 1. 初始化地图
  useEffect(() => {
    // ✅ 修复 React 18 Strict Mode 双挂载：在每次 effect 内新建闭包 destroyed 标志
    if (!mapContainerRef.current || mapRef.current) return;
    let destroyed = false;
    // 在第一次挂载时暂存一个引用，用于 cleanup 时检查是否仍生效
    const thisContainer = mapContainerRef.current;
    (async () => {
      try {
        if (destroyed || !thisContainer.isConnected) return;
        setStatus('loading');

        const containerEl = thisContainer;
        const initialWidth = containerEl.offsetWidth || 1280;
        const initialHeight = containerEl.offsetHeight || 720;
        console.info(
          `[MapBoard] 容器初始尺寸: ${initialWidth.toFixed(0)}x${initialHeight.toFixed(0)}px`
        );

        const map = L.map(containerEl, {
          center: [DEFAULT_MAP_VIEW.center.lat, DEFAULT_MAP_VIEW.center.lng],
          zoom: DEFAULT_MAP_VIEW.zoom,
          minZoom: 3, // 锁定最小缩放级别（不再允许查看全球）
          maxZoom: 12,
          // 使用自定义位置，避免默认左上角控件与返回按钮/标注重叠
          zoomControl: false,
          // ✅ 合规：禁用 worldCopyJump，禁止跨越日界线
          worldCopyJump: false,
          // ✅ 合规：锁定视域到中国完整范围内
          // 包含台湾、钓鱼岛、南海诸岛等所有合法领土
          maxBounds: CHINA_FULL_BOUNDS,
          // ✅ 合规：拖到边界时反弹回区域，禁止出境
          maxBoundsViscosity: 1.0,
          attributionControl: true,
          // 关键：禁用 fadeAnimation 避免瓦片闪烁
          fadeAnimation: true,
          // 关键：启用 zoomAnimation
          zoomAnimation: true,
          // 关键：markerZoomAnimation 启用
          markerZoomAnimation: true,
        });

        if (destroyed) {
          // 立即清理：创建后但 cleanup 已发生
          map.remove();
          return;
        }
        mapRef.current = map;

        // 缩放控件移至左下角，避免与左上角返回按钮、顶部导航和标注区域重叠
        L.control.zoom({ position: 'bottomleft' }).addTo(map);

        // 暴露给测试
        (window as unknown as { __MAP_INSTANCE?: L.Map }).__MAP_INSTANCE = map;

        // ✅ 合规：彻底移除外部瓦片（OSM / 天地图）加载
        // 直接渲染本地 GeoJSON，不再请求任何外部网络瓦片
        const externalTileProviders: TileProvider[] = []; // 不加载任何外部瓦片
        if (externalTileProviders.length > 0) {
          console.info('[MapBoard] 仅渲染本地数据，无外部瓦片请求');
        } else {
          console.info('[MapBoard] 完全本地化渲染（无外部瓦片，符合合规要求）');
        }

        // 视图设置：适应中国范围（不缩放到境外）
        map.fitBounds(DEFAULT_MAP_BOUNDS, {
          padding: [20, 20],
          animate: false,
        });

        // ⚠️ 关键修复：fitBounds 后再次 invalidateSize，确保 viewport 计算正确
        requestAnimationFrame(() => {
          map.invalidateSize();
        });

        // ✅ 合规加载：中国主权要素（南海诸岛/钓鱼岛/九段线/台湾）
        // ✅ 已修复：ChinaTerritoriesLoader 内部添加 _mapPane 双重校验，
        //    避免 Strict Mode 下 map 已销毁时调用 addTo 触发 appendChild 异常。
        if (destroyed) return;
        try {
          const territoriesResult = await loadChinaTerritories(map);
          if (destroyed) return;
          chinaTerritoriesRef.current = territoriesResult;
          if (territoriesResult.compliance.compliant) {
            console.info('[MapBoard] ✅ 合规校验通过：所有领土要素完整');
          } else {
            console.warn(
              '[MapBoard] ⚠️ 合规校验未通过：缺失',
              territoriesResult.compliance.missing.map((m) => m.name)
            );
          }
        } catch (e) {
          console.error('[MapBoard] 合规模块加载异常:', e);
        }

        // ✅ 三级钻取地图：默认渲染全国省级，点击省份聚焦下辖县级
        if (destroyed) return;
        try {
          // 1. 聚合三级层次
          if (!hierarchyRef.current) {
            hierarchyRef.current = aggregateToHierarchy(yaoCounties);
            console.info(
              `[MapBoard] 行政层次聚合完成: ${hierarchyRef.current.total.provinces} 省 / ${hierarchyRef.current.total.cities} 市 / ${hierarchyRef.current.total.counties} 县`
            );
          }

          // 2. 创建钻取控制器
          const controller = await createDrillDownMap(map, hierarchyRef.current, {
            level: 'province',
          });
          if (destroyed) return;
          controller.onStateChange = (newState) => {
            setDrillState(newState);
            console.info('[MapBoard] 钻取状态变更:', newState);
          };
          drillDownRef.current = controller;

          // 3. 钻取初始化成功后，隐藏兜底层（避免与省级轮廓重叠）
          if (fallbackRef.current?.isShown()) {
            fallbackRef.current.hide();
            console.info('[MapBoard] 钻取地图接管，兜底层已隐藏');
          }

          // ✅ 修复：红点点击 = 弹模态框（而非直接钻取）
          //    使用 zustand store 的 setSelectedCounty + openCountyModal
          controller.setOnCountyClick((county) => {
            try {
              const fresh = useMapStore.getState();
              fresh.setSelectedCounty(county);
              fresh.openCountyModal();
            } catch (err) {
              console.error('[MapBoard] setSelectedCounty 失败:', err);
            }
          });

          // 调试钩子：暴露 drillDown 控制器到 window 供测试使用
          if (import.meta.env.DEV) {
            (window as unknown as { __DRILL_DOWN__?: DrillDownController }).__DRILL_DOWN__ = controller;
          }

          // ✅ 注册到全局事件中心（供 RegionQuickSelector 等调用钻取）
          registerDrillDownController(controller);

          console.info('[MapBoard] ✅ 三级钻取地图已初始化');
        } catch (e) {
          console.error('[MapBoard] 钻取地图初始化异常:', e);
        }

        // 创建离线兜底图层（默认隐藏，由 drillDown 失败时显示）
        if (destroyed) return;
        fallbackRef.current = createOfflineFallbackLayers(map, async () => {
          const r = await fetch('/map/100000.json');
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return (await r.json()) as GeoJSON.FeatureCollection;
        });

        // ✅ 整合草药点位标记（原 ChinaMap 功能）
        if (destroyed || !(map as unknown as { _mapPane?: unknown })._mapPane) {
          console.warn('[MapBoard] map 已销毁，跳过草药标记层加载');
        } else {
          herbMarkersRef.current = createHerbMarkersLayer(map, {
            onHerbClick: (herb: Herb) => {
              // 打开草药详情弹窗（弹窗由 zustand store 统一管理）
              setSelectedHerb(herb);
              openHerbModal();
            },
          });
          console.info('[MapBoard] ✅ 草药点位标记层已初始化');
        }

        setStatus('ready');
        console.info('[MapBoard] 地图初始化完成');
      } catch (e) {
        console.error('[MapBoard] 初始化异常:', e);
        setStatus('error');
      }
    })();

    return () => {
      // ✅ 标记销毁状态，异步流程检测后立即返回
      destroyed = true;
      // 解绑合规模块
      chinaTerritoriesRef.current?.destroy?.();
      chinaTerritoriesRef.current = null;
      // 解绑钻取地图
      drillDownRef.current?.destroy();
      drillDownRef.current = null;
      // ✅ 解绑草药标记层
      herbMarkersRef.current?.destroy();
      herbMarkersRef.current = null;
      // ✅ 清理全局事件中心的钻取控制器引用
      registerDrillDownController(null);
      mapRef.current?.remove();
      mapRef.current = null;
      // ✅ 同时清理全局暴露（防止重挂载后引用旧实例）
      try {
        const w = window as unknown as { __MAP_INSTANCE__?: L.Map | undefined };
        if (w.__MAP_INSTANCE__ === mapRef.current) delete w.__MAP_INSTANCE__;
      } catch { /* ignore */ }
      fallbackRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

  return (
    <div
      ref={mapContainerRef}
      className={`leaflet-container-host ${className ?? ''}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 1000,
            background: 'white',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            color: '#374151',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        >
          加载中...
        </div>
      )}

      {/* ✅ 整合：省份/区域快速选择工具栏（替代原 ChinaMap 下方的速选按钮） */}
      {status === 'ready' && <RegionQuickSelector />}
    </div>
  );
};

export default MapBoard;