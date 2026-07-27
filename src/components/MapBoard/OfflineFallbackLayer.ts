/**
 * MapBoard 离线兜底图层
 *
 * 当所有外部瓦片源（天地图、OSM）不可用时，自动启用本图层：
 * - 使用项目自带的 /map/100000.json（中国省级 GeoJSON）作为底图
 * - 真实 WGS84 经纬度坐标，Leaflet 直接渲染
 * - 包含省级标签 + 瑶医相关省份高亮
 *
 * 关键设计：
 * 1. 离线图层与外部瓦片互斥（同一时刻只能有一个）
 * 2. 外部瓦片 5 秒内未触发 tileload 事件 → 自动启用离线模式
 * 3. 离线模式可由用户主动退出（右下角按钮）
 * 4. 若用户切换瓦片源且新源可用，自动退出离线模式
 */

import L from 'leaflet';

/**
 * 检测浏览器是否在线
 */
export const isOnline = async (timeoutMs = 3000): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const r = await fetch('https://www.gstatic.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    return r.ok;
  } catch {
    return false;
  }
};

/**
 * 中国省级 GeoJSON Feature 属性（来自 100000.json）
 */
interface ProvinceProperties {
  adcode: number;
  name: string;
  center?: [number, number];
  centroid?: [number, number];
  level?: string;
}

/**
 * 瑶医相关省份（来自 yaoCounties.province）
 * 这些省份在离线兜底中会高亮显示
 */
const YAO_RELATED_PROVINCES = new Set([
  '广西壮族自治区',
  '广东省',
  '湖南省',
  '云南省',
  '贵州省',
  '江西省',
  '海南省',
  '重庆市',
  '四川省',
]);

/**
 * 创建离线兜底图层
 */
export const createOfflineFallbackLayers = (
  map: L.Map,
  fetchGeoJson: () => Promise<GeoJSON.FeatureCollection>
) => {
  const group = L.layerGroup();
  let isAdded = false;
  let hasLoaded = false;
  // 防止重复并发加载
  let loadingPromise: Promise<void> | null = null;
  // 持有当前 map 引用（解决 React Strict Mode 双调用导致旧 map 引用失效）
  let currentMap: L.Map | null = map;

  /**
   * 检查 map 仍有效（未销毁、未脱离文档）
   * 通过实验验证：map.remove() 后 _mapPane 会被设为 null（最可靠的检测）
   * 注：_loaded / _container / _size 在 remove() 后仍存在，无法可靠判断
   */
  const isMapValid = (targetMap: L.Map | null): targetMap is L.Map => {
    if (!targetMap) return false;
    const internal = targetMap as unknown as { _mapPane?: unknown; _container?: HTMLElement };
    // map.remove() 后 _mapPane === null
    if (!internal._mapPane) return false;
    // 容器脱离文档也算销毁
    if (!internal._container || !internal._container.isConnected) return false;
    return true;
  };

  const load = async () => {
    // 如果已经在加载中，复用现有 Promise（避免重复请求）
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      try {
        const data = await fetchGeoJson();
        if (!data.features || data.features.length === 0) {
          console.warn('[OfflineFallback] GeoJSON 数据为空');
          return;
        }

        // ⚠️ 关键修复：检查 map 仍然有效（React Strict Mode 双调用防护）
        // 如果组件已卸载，旧 map 已被 map.remove() 销毁，_container 为 undefined
        if (!isMapValid(currentMap)) {
          console.warn('[OfflineFallback] map 已被卸载或脱离文档，跳过渲染');
          return;
        }
        const targetMap = currentMap;
        console.info(`[OfflineFallback] 加载 ${data.features.length} 个省级 features`);

        // 1. 渲染省级多边形（真实 WGS84 坐标，Leaflet 直接处理）
        const geoLayer = L.geoJSON(data as unknown as GeoJSON.FeatureCollection, {
          style: (feature) => {
            if (!feature) return {};
            const props = feature.properties as ProvinceProperties;
            const isYaoProvince = YAO_RELATED_PROVINCES.has(props.name);
            return {
              // 瑶医相关省份用绿色高亮
              color: isYaoProvince ? '#166534' : '#64748b',
              weight: isYaoProvince ? 2 : 1,
              fillColor: isYaoProvince ? '#86efac' : '#e5e7eb',
              fillOpacity: isYaoProvince ? 0.55 : 0.35,
              dashArray: isYaoProvince ? undefined : '4 3',
            };
          },
          // 离线模式：禁用鼠标交互以避免与上层 Leaflet 控件冲突
          interactive: false,
        });
        // ⚠️ 关键修复：再次检查（fetch 期间 map 可能被销毁）
        if (!isMapValid(targetMap)) {
          console.warn('[OfflineFallback] fetch 完成后 map 已销毁，放弃渲染');
          return;
        }
        geoLayer.addTo(targetMap);
        console.info('[OfflineFallback] geoLayer 已添加到 map');

        // 2. 省级名称标签
        data.features.forEach((f) => {
          // 每次循环都检查 map 有效性
          if (!isMapValid(targetMap)) return;
          const props = f.properties as ProvinceProperties;
          const geom = f.geometry;
          if (!geom || !props.center) return;

          // 使用 properties.center 作为标签位置（GeoJSON 自带）
          const [lng, lat] = props.center;
          const isYaoProvince = YAO_RELATED_PROVINCES.has(props.name);

          const labelIcon = L.divIcon({
            className: 'yao-offline-label',
            html: `<div style="
              font-family: 'Noto Sans SC', -apple-system, sans-serif;
              font-size: ${isYaoProvince ? '13px' : '11px'};
              font-weight: ${isYaoProvince ? 700 : 500};
              color: ${isYaoProvince ? '#14532d' : '#475569'};
              text-shadow: 0 0 3px #fff, 0 0 6px #fff, 0 0 8px #fff;
              white-space: nowrap;
              text-align: center;
              width: 100px;
              box-sizing: border-box;
              left: -50px;
              position: relative;
              pointer-events: none;
              user-select: none;
              letter-spacing: 0.5px;
            ">${props.name.replace(/(壮族)?自治区|省|市/g, '')}</div>`,
            iconSize: [100, 18],
            iconAnchor: [50, 9],
          });
          L.marker([lat, lng], { icon: labelIcon, interactive: false }).addTo(group);
        });
        // 检查 map 后才 addTo(group)
        if (!isMapValid(targetMap)) {
          console.warn('[OfflineFallback] 添加标签前 map 已销毁');
          return;
        }
        group.addTo(targetMap);
        console.info(`[OfflineFallback] ${data.features.length} 个标签已添加到 map`);

        // 3. 缩放到中国范围
        const bounds = geoLayer.getBounds();
        if (bounds.isValid() && isMapValid(targetMap)) {
          targetMap.fitBounds(bounds, { padding: [20, 20], animate: false });
          console.info('[OfflineFallback] fitBounds 完成:', bounds.toBBoxString());
        } else {
          console.warn('[OfflineFallback] geoLayer bounds 无效或 map 已销毁');
        }

        hasLoaded = true;
      } catch (e) {
        console.error('[OfflineFallback] 加载失败:', e);
      } finally {
        loadingPromise = null;
      }
    })();
    return loadingPromise;
  };

  /**
   * 用户主动启用 / 禁用离线模式
   */
  const show = () => {
    // ⚠️ 检查 map 仍有效（React Strict Mode 双调用可能留下旧的引用）
    if (!isMapValid(currentMap)) {
      console.warn('[OfflineFallback] skip show(): map 已被销毁或脱离文档');
      return;
    }
    if (!isAdded) {
      // ⚠️ 关键修复：先确保 map 容器有尺寸（兜底常在初始化时被调用）
      try {
        currentMap!.invalidateSize();
      } catch (e) {
        console.warn('[OfflineFallback] invalidateSize 失败:', e);
        return;
      }
      isAdded = true;
      load();
    } else if (!hasLoaded) {
      load();
    }
  };
  const hide = () => {
    if (isAdded) {
      try {
        currentMap?.removeLayer(group);
      } catch {
        // map 已销毁，忽略
      }
      isAdded = false;
    }
  };
  const isShown = () => isAdded;

  /**
   * 解除绑定（组件卸载时调用）
   */
  const destroy = () => {
    // 解开 map 引用，让 load() 中的 async 回调能通过 isMapValid 提前返回
    currentMap = null;
    loadingPromise = null;
  };

  return { show, hide, isShown, destroy };
};

/**
 * 监听器类型
 */
export interface OfflineFallbackController {
  show: () => void;
  hide: () => void;
  isShown: () => boolean;
  destroy: () => void;
}