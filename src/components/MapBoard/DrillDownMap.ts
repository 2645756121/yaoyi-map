/**
 * 三级钻取地图渲染器
 *
 * 职责：
 *   1. 默认渲染全国 34 个省级轮廓 + 名称 + 瑶族相关统计
 *   2. 点击省份 → 0.8s 平滑 flyToBounds 聚焦
 *   3. 聚焦后加载该省下辖所有市级（或县级）轮廓 + 名称 + 数据
 *   4. 点击市级 → flyToBounds 聚焦 + 渲染下辖县
 *   5. 提供 zoomOut() 返回上级视图
 *
 * 设计：每个 zoom level 渲染独立的 LayerGroup，
 *      切换时清理上一个 level 的 layer group，保证性能。
 */

import L, { type LatLngBoundsExpression, type Map as LMap } from 'leaflet';
import type { FeatureCollection } from 'geojson';
import type { AdminHierarchy } from '../../lib/adminAggregator';
import type { YaoCounty } from '../../types';

/** 钻取层级 */
export type DrillLevel = 'province' | 'city' | 'county';

/** 当前状态 */
export interface DrillState {
  level: DrillLevel;
  provinceAdcode?: string;
  cityAdcode?: string;
  countyCode?: string;
}

/** 钻取地图控制器 */
export interface DrillDownController {
  /** 当前状态 */
  getState: () => DrillState;
  /** 钻入省级（flyToBounds + 加载市级轮廓） */
  drillToProvince: (provinceAdcode: string) => Promise<void>;
  /** 钻入市级（flyToBounds + 加载县级轮廓） */
  drillToCity: (cityAdcode: string) => Promise<void>;
  /** 钻入县级 */
  drillToCounty: (countyCode: string) => Promise<void>;
  /** 返回上级 */
  zoomOut: () => Promise<void>;
  /** 销毁 */
  destroy: () => void;
  /** 状态变更回调 */
  onStateChange?: (state: DrillState) => void;
  /** ✅ 设置红点点击回调（用于弹出信息面板而非直接钻取） */
  setOnCountyClick: (cb: (county: YaoCounty) => void) => void;
}

/** 缓存加载的省级 GeoJSON */
const provinceGeoJSONCache = new Map<string, FeatureCollection>();
/** 缓存加载的县级 GeoJSON */
const countyGeoJSONCache = new Map<string, FeatureCollection>();

/** 加载省级 GeoJSON */
async function loadProvinceGeoJSON(adcode: string): Promise<FeatureCollection> {
  if (provinceGeoJSONCache.has(adcode)) return provinceGeoJSONCache.get(adcode)!;
  // adcode 是 2 位（如 45），文件名是 6 位（如 450000_full.json）
  const fullAdcode = adcode.padEnd(6, '0');
  const url = `/map/province/${fullAdcode}_full.json`;
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`省级 GeoJSON 加载失败: ${url} HTTP ${r.status}`);
  const json = (await r.json()) as FeatureCollection;
  provinceGeoJSONCache.set(adcode, json);
  return json;
}

/** 加载县级 GeoJSON（带兜底） */
async function loadCountyGeoJSON(code: string): Promise<FeatureCollection> {
  if (countyGeoJSONCache.has(code)) return countyGeoJSONCache.get(code)!;
  // 主路径：/map/county/{code}.json
  const primary = await fetch(`/map/county/${code}.json`, { signal: AbortSignal.timeout(5000) });
  if (primary.ok) {
    const json = (await primary.json()) as FeatureCollection;
    countyGeoJSONCache.set(code, json);
    return json;
  }
  // ✅ 兜底路径：尝试从聚合文件 yao_counties_real.json 中抽取对应 feature
  //   用于：海南 469xxx 直辖县级等 download 脚本遗漏的边界 case
  console.warn(`[DrillDown] /map/county/${code}.json 不可用 (HTTP ${primary.status})，尝试从聚合文件兜底`);
  try {
    const fallback = await fetch('/map/yao_counties_real.json', { signal: AbortSignal.timeout(8000) });
    if (fallback.ok) {
      const fc = (await fallback.json()) as FeatureCollection;
      const matched = fc.features?.filter(
        (f) => String(f.properties?.adcode ?? '').padStart(6, '0') === code.padStart(6, '0')
      ) ?? [];
      if (matched.length > 0) {
        const constructed: FeatureCollection = { type: 'FeatureCollection', features: matched };
        countyGeoJSONCache.set(code, constructed);
        console.info(`[DrillDown] 已从聚合文件兜底提取 ${code} (${matched.length} features)`);
        return constructed;
      }
    }
  } catch (e) {
    console.warn(`[DrillDown] 聚合文件兜底失败:`, e);
  }
  throw new Error(`县级 GeoJSON 加载失败: ${code} 主路径与聚合兜底均不可用`);
}

/** 加载全国基础 GeoJSON（含所有省级 + 几何） */
async function loadNationalGeoJSON(): Promise<FeatureCollection> {
  const r = await fetch(`/map/100000_full.json`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`全国 GeoJSON 加载失败: HTTP ${r.status}`);
  return (await r.json()) as FeatureCollection;
}

/**
 * 创建三级钻取地图控制器
 */
export async function createDrillDownMap(
  map: LMap,
  hierarchy: AdminHierarchy,
  initialState: DrillState = { level: 'province' }
): Promise<DrillDownController> {
  let state: DrillState = { ...initialState };
  let layerGroup: L.LayerGroup = L.layerGroup();
  let destroyed = false;
  const customControls: L.Control[] = [];
  /** ✅ 红点点击回调（默认行为：钻取到县级；可被外部覆盖为弹出模态框） */
  let onCountyClickCb: ((county: YaoCounty) => void) | null = null;
  /** 动画时长（秒），符合 0.3-0.5s 淡入淡出要求 */
  const ANIMATION_DURATION = 0.4;
  /** 淡入淡出过渡：用于 leaflet pane 的 CSS 动画 */
  const FADE_DURATION_MS = 400;

  const isMapValid = (): boolean => {
    const m = map as unknown as { _mapPane?: unknown };
    return !!m._mapPane && !destroyed;
  };

  /**
   * 空白区域点击处理：检测点击是否发生在 marker / polygon 内
   * 若当前在省/县级视图，点击空白处自动合并回上级
   *
   * 注：Leaflet 内部事件总线独立于 DOM，
   *    这里只能通过 e.originalEvent.target 检测是否击中了 layer
   */
  const handleMapClick = (e: L.LeafletMouseEvent): void => {
    if (!isMapValid()) return;
    // ✅ 仅在点击目标是地图容器本身（未击中任何 layer）时合并
    const target = e.originalEvent?.target as HTMLElement | undefined;
    if (!target) return;
    // 检查 target 是否在 leaflet-overlay-pane 内
    const overlayPane = map.getPanes().overlayPane;
    if (overlayPane && overlayPane.contains(target)) {
      // 击中 overlay pane 但没有 marker — 不合并
      return;
    }
    // 检查是否击中 interactive layer（marker/polygon）
    if (target.classList && target.classList.contains('leaflet-interactive')) {
      // 击中了 marker — 不合并
      return;
    }
    if (state.level === 'city') {
      console.info('[DrillDown] 空白点击，合并回省级视图');
      void zoomOut();
    }
    // 注意：county 级保留（仍可通过返回按钮退出）
  };

  /**
   * 清理所有自定义 Leaflet 控件
   * 用于避免切换层级时按钮重复堆叠
   */
  const cleanupCustomControls = (): void => {
    for (const ctrl of customControls) {
      try {
        ctrl.remove();
      } catch {
        // ignore
      }
    }
    customControls.length = 0;
  };

  const notify = (): void => {
    controller.onStateChange?.(state);
  };

  // === 1. 默认渲染：全国省级轮廓 + 名称 + 瑶族统计 ===
  const renderNationalView = (): void => {
    if (!isMapValid()) return;

    // ✅ 修复：清理旧 layer 之前先清理旧的自定义控件（避免堆叠）
    cleanupCustomControls();

    // 清理旧 layer
    if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
    layerGroup = L.layerGroup();
    // 关键：设置高 zIndex 避免被兜底层覆盖
    (layerGroup as unknown as { options: { zIndex: number } }).options = { zIndex: 1000 };
    layerGroup.addTo(map);

    // ✅ 空白点击合并：监听 map 的 click 事件，当未击中下级要素时收起
    map.off('click', handleMapClick);
    map.on('click', handleMapClick);

    // ✅ 淡入淡出：在 layer 上添加 fade-in CSS 动画
    if (typeof document !== 'undefined') {
      layerGroup.eachLayer((l) => {
        const el = (l as unknown as { getElement?: () => HTMLElement | undefined }).getElement?.();
        if (el) {
          el.style.opacity = '0';
          el.style.transition = `opacity ${FADE_DURATION_MS}ms ease-in-out`;
          requestAnimationFrame(() => {
            el.style.opacity = '1';
          });
        }
      });
    }

    loadNationalGeoJSON()
      .then((geojson) => {
        if (!isMapValid()) return;

        const yaoAdcodes = new Set(
          hierarchy.provinces.filter((p) => p.hasYaoData).map((p) => p.adcode)
        );

        const nationalLayer = L.geoJSON(geojson, {
          style: (feature) => {
            if (!feature) return {};
            const adcode = String(feature.properties?.adcode ?? '').substring(0, 2);
            const isYao = yaoAdcodes.has(adcode);
            return {
              color: isYao ? '#10b981' : '#94a3b8',
              weight: isYao ? 1.5 : 1,
              fillColor: isYao ? '#34d399' : '#f1f5f9',
              fillOpacity: isYao ? 0.4 : 0.1,
              opacity: 0.9,
            };
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties as Record<string, unknown> | null;
            const adcode = String(props?.adcode ?? '').substring(0, 2);
            const name = String(props?.name ?? '');
            const yaoProvince = hierarchy.byProvinceAdcode.get(adcode);

            // 鼠标交互
            layer.on({
              mouseover: (e) => {
                const target = e.target as L.Path;
                target.setStyle({ weight: 2.5, fillOpacity: 0.6 });
              },
              mouseout: (e) => {
                const target = e.target as L.Path;
                if (yaoProvince) {
                  target.setStyle({ weight: 1.5, fillOpacity: 0.4 });
                } else {
                  target.setStyle({ weight: 1, fillOpacity: 0.1 });
                }
              },
              click: (e) => {
                // 阻止冒泡，避免触发 map 的"空白点击合并"
                L.DomEvent.stopPropagation(e as unknown as Event);
                if (yaoProvince) {
                  void controller.drillToProvince(adcode);
                }
              },
            });

            // 提示框
            const tooltipText = yaoProvince
              ? `<b>${name}</b><br>瑶族相关县: ${yaoProvince.countyCount}<br>机构数: ${yaoProvince.totalInstitutions}<br>点击查看详情`
              : `<b>${name}</b><br>暂无瑶族数据`;
            layer.bindTooltip(tooltipText, { sticky: true });
          },
        });
        layerGroup.addLayer(nationalLayer);

        // ✅ 修复：省级名称标签使用省级 GeoJSON 几何中心（而非县级平均坐标）
        // 提取每个瑶族省的省级 feature 并计算几何中心
        const yaoAdcodeSet = new Set(
          hierarchy.provinces.filter((p) => p.hasYaoData).map((p) => p.adcode)
        );
        // 按 adcode 索引 layer bounds
        const provinceLayerMap = new Map<string, L.Layer>();
        nationalLayer.eachLayer((layer) => {
          const props = (layer as L.GeoJSON & { feature?: { properties?: { adcode?: string | number } } }).feature
            ?.properties;
          if (props && props.adcode != null) {
            const adcode = String(props.adcode).substring(0, 2);
            if (yaoAdcodeSet.has(adcode)) {
              provinceLayerMap.set(adcode, layer);
            }
          }
        });

        for (const province of hierarchy.provinces.filter((p) => p.hasYaoData)) {
          if (province.counties.length === 0) continue;
          // ✅ 用省级 layer 的 bounds.getCenter() 作为标签坐标（精准位于省级几何中心）
          const provLayer = provinceLayerMap.get(province.adcode);
          let labelLat: number;
          let labelLng: number;
          if (provLayer) {
            const provBounds = (provLayer as L.GeoJSON).getBounds();
            labelLat = provBounds.getCenter().lat;
            labelLng = provBounds.getCenter().lng;
          } else {
            // 兜底：仍使用县级平均坐标
            labelLat = province.centerLat;
            labelLng = province.centerLng;
          }
          const label = L.marker([labelLat, labelLng], {
            icon: L.divIcon({
              className: 'province-label',
              html: `<div style="font-size:13px;font-weight:600;color:#047857;text-shadow:0 0 3px white,0 0 3px white,0 0 3px white,0 0 3px white;white-space:nowrap;text-align:center;width:120px;box-sizing:border-box;left:-60px;position:relative;">${province.name}</div>`,
              iconSize: [120, 18],
              iconAnchor: [60, 9],
            }),
            interactive: false,
          });
          layerGroup.addLayer(label);
        }
      })
      .catch((e) => {
        console.error('[DrillDown] 全国 GeoJSON 加载失败:', e);
      });
  };

  // === 2. 省级聚焦：flyToBounds + 加载市级轮廓 ===
  const drillToProvince = async (provinceAdcode: string): Promise<void> => {
    if (!isMapValid()) return;
    const province = hierarchy.byProvinceAdcode.get(provinceAdcode);
    if (!province) {
      console.warn('[DrillDown] 省级不存在:', provinceAdcode);
      return;
    }
    if (!province.hasYaoData) {
      console.info('[DrillDown] 该省无瑶族数据，跳过钻取');
      return;
    }

    state = { level: 'city', provinceAdcode };
    notify();

    try {
      // ✅ 修复：钻取前先清理旧自定义控件（防止多次钻取堆叠）
      cleanupCustomControls();

      // 1. 加载省级 GeoJSON 计算 bounds
      const geojson = await loadProvinceGeoJSON(provinceAdcode);
      if (!isMapValid()) return;

      // 2. 清理旧 layer
      if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
      layerGroup = L.layerGroup();
      layerGroup.addTo(map);

      // 3. 渲染省级轮廓（高亮）
      const provinceLayer = L.geoJSON(geojson, {
        style: {
          color: '#10b981',
          weight: 2.5,
          fillColor: '#34d399',
          fillOpacity: 0.15,
          opacity: 1,
        },
      });
      layerGroup.addLayer(provinceLayer);

      // 4. 平滑 flyToBounds（0.4s 淡入淡出动画，符合 0.3-0.5s 要求）
      const bounds = provinceLayer.getBounds();
      map.flyToBounds(bounds, {
        duration: ANIMATION_DURATION,
        padding: [50, 50],
        easeLinearity: 0.5,
      });

      // 5. 加载该省下辖所有县级 GeoJSON（替代市级，因为我们有县数据）
      const countyPromises = province.counties.map((c) =>
        loadCountyGeoJSON(c.code).catch(() => null)
      );
      const countyGeojsons = await Promise.all(countyPromises);

      if (!isMapValid()) return;

      // 6. 渲染县级轮廓
      for (let i = 0; i < countyGeojsons.length; i++) {
        const geojson = countyGeojsons[i];
        const county = province.counties[i];
        if (!geojson || !county) continue;

        const countyLayer = L.geoJSON(geojson, {
          style: {
            color: '#059669',
            weight: 1.5,
            fillColor: '#6ee7b7',
            fillOpacity: 0.35,
            opacity: 0.85,
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties as Record<string, unknown> | null;
            const cName = String(props?.name ?? county.name);
            layer.bindTooltip(
              `<b>${cName}</b><br>瑶族机构: ${county.institutionCount}<br>瑶药: ${county.herbVarieties.length} 种`,
              { sticky: true }
            );
            layer.on('click', (e) => {
              L.DomEvent.stopPropagation(e as unknown as Event);
              // ✅ 同 marker：优先调用外部回调（用于弹模态框）
              if (onCountyClickCb) {
                try {
                  onCountyClickCb(county);
                } catch (err) {
                  console.error('[DrillDown] onCountyClickCb failed:', err);
                }
              } else {
                void controller.drillToCounty(county.code);
              }
            });
            layer.on('mouseover', (e) => {
              const t = e.target as L.Path;
              t.setStyle({ weight: 2.5, fillOpacity: 0.55 });
            });
            layer.on('mouseout', (e) => {
              const t = e.target as L.Path;
              t.setStyle({ weight: 1.5, fillOpacity: 0.35 });
            });
          },
        });
        layerGroup.addLayer(countyLayer);

        // ✅ 修复：县级标记使用县级 GeoJSON 几何中心（而非预设 centerLat/Lng）
        // 这样标签精准位于县区边界中心，避免偏移
        const countyBounds = countyLayer.getBounds();
        const markerLat = countyBounds.getCenter().lat;
        const markerLng = countyBounds.getCenter().lng;
        // ✅ v2 美化标签：毛玻璃 + 渐变 + 类别配色（替代原红色圆点）
        const categoryColorMap: Record<string, { bg: string; ring: string; text: string }> = {
          core: { bg: 'linear-gradient(135deg,#166534 0%,#22c55e 100%)', ring: 'rgba(34,197,94,0.45)', text: '#ffffff' },
          development: { bg: 'linear-gradient(135deg,#22c55e 0%,#84cc16 100%)', ring: 'rgba(132,204,22,0.45)', text: '#ffffff' },
          production: { bg: 'linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%)', ring: 'rgba(251,191,36,0.45)', text: '#ffffff' },
        };
        const scheme = categoryColorMap[county.category] ?? categoryColorMap.development;
        const tagHtml = `
          <div class="county-beauty-tag" style="
            display:inline-flex;align-items:center;gap:4px;
            padding:4px 10px;border-radius:9999px;
            background:${scheme.bg};
            color:${scheme.text};
            font-size:11px;font-weight:600;letter-spacing:0.3px;
            backdrop-filter:blur(8px);
            -webkit-backdrop-filter:blur(8px);
            border:1.5px solid rgba(255,255,255,0.4);
            box-shadow:0 4px 12px ${scheme.ring},inset 0 1px 0 rgba(255,255,255,0.3);
            white-space:nowrap;
            cursor:pointer;
            transition:transform .2s ease,box-shadow .2s ease;
            font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;
          ">
            <span style="
              display:inline-block;width:5px;height:5px;border-radius:50%;
              background:rgba(255,255,255,0.85);
              box-shadow:0 0 6px rgba(255,255,255,0.8);
            "></span>
            ${county.name}
          </div>`;
        const marker = L.marker([markerLat, markerLng], {
          icon: L.divIcon({
            className: 'county-beauty-tag-wrapper',
            html: tagHtml,
            iconSize: [120, 24],
            iconAnchor: [60, 12],
          }),
          interactive: true,
        });
        marker.bindTooltip(
          `${county.name} · ${county.herbVarieties.length} 种瑶药 · ${county.institutionCount} 家机构`,
          { permanent: false, direction: 'top', offset: [0, -14] }
        );
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e as unknown as Event);
          // ✅ 修复：点击红点优先调用外部回调（用于弹模态框）
          //    默认行为：钻入县级聚焦（保持兼容）
          if (onCountyClickCb) {
            try {
              onCountyClickCb(county);
            } catch (err) {
              console.error('[DrillDown] onCountyClickCb failed:', err);
            }
          } else {
            void controller.drillToCounty(county.code);
          }
        });
        layerGroup.addLayer(marker);
      }

      // 7. 添加省级名称标签（使用省级 GeoJSON bounds.getCenter()，精准居中）
      const provinceLabel = L.marker(
        [bounds.getCenter().lat, bounds.getCenter().lng],
        {
          icon: L.divIcon({
            className: 'province-focused-label',
            html: `<div style="font-size:18px;font-weight:700;color:#047857;text-shadow:0 0 4px white,0 0 4px white,0 0 4px white,0 0 4px white;white-space:nowrap;text-align:center;width:220px;box-sizing:border-box;left:-110px;position:relative;">${province.name}<br/><span style="font-size:11px;color:#059669;">${province.countyCount} 个瑶族县 · ${province.totalInstitutions} 个机构</span></div>`,
            iconSize: [220, 40],
            iconAnchor: [110, 20],
          }),
          interactive: false,
        }
      );
      layerGroup.addLayer(provinceLabel);

      // 8. 返回上级按钮：绝对定位到地图容器内，避免固定到浏览器视口导致遮挡顶部导航
      const backDiv = document.createElement('div');
      backDiv.className = 'drill-back-btn';
      backDiv.setAttribute('data-drill-back', '1');
      backDiv.style.cssText = [
        'position: absolute',
        'top: 12px',
        'left: 12px',
        'z-index: 1000',
        'padding: 8px 16px',
        'background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
        'border: 2px solid #047857',
        'border-radius: 6px',
        'color: #047857',
        'font-size: 14px',
        'font-weight: 700',
        'cursor: pointer',
        'box-shadow: 0 2px 8px rgba(0,0,0,0.15)',
        'user-select: none',
        'white-space: nowrap',
      ].join(';');
      backDiv.textContent = '← 返回全国';
      backDiv.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void controller.zoomOut();
      });
      // 挂载到地图容器内，保证滚动、布局和屏幕边界都与地图区域一致
      map.getContainer().appendChild(backDiv);
      // 跟踪 DOM 节点，destroy 时移除
      const backBtnDom = backDiv;
      customControls.push({
        remove: () => {
          if (backBtnDom.parentNode) backBtnDom.parentNode.removeChild(backBtnDom);
        },
      } as unknown as L.Control);
      console.info('[DrillDown] 返回按钮已附加到 body（fixed 定位）');

      console.info(
        `[DrillDown] 已钻入 ${province.name}: ${province.countyCount} 个县, ${province.totalInstitutions} 个机构`
      );
    } catch (e) {
      console.error('[DrillDown] 钻入省级失败:', e);
      // ✅ 修复：恢复省级轮廓（即使县区加载失败，也能看到省级背景）
      //   之前会静默失败，用户看到"钻入但无县区"的诡异状态
      try {
        const geojson = await loadProvinceGeoJSON(provinceAdcode);
        if (isMapValid()) {
          const provinceLayer = L.geoJSON(geojson, {
            style: {
              color: '#10b981',
              weight: 2.5,
              fillColor: '#34d399',
              fillOpacity: 0.2,
              opacity: 1,
            },
          });
          if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
          layerGroup = L.layerGroup();
          layerGroup.addTo(map);
          layerGroup.addLayer(provinceLayer);
          map.flyToBounds(provinceLayer.getBounds(), {
            duration: ANIMATION_DURATION,
            padding: [50, 50],
          });
          console.warn(`[DrillDown] ${province.name} 部分县区数据缺失，已显示省级轮廓`);
        }
      } catch (fallbackErr) {
        console.error('[DrillDown] 省级轮廓兜底也失败:', fallbackErr);
      }
    }
  };

  // === 3. 县级聚焦 ===
  const drillToCounty = async (countyCode: string): Promise<void> => {
    if (!isMapValid()) return;
    const county = hierarchy.byCountyCode.get(countyCode);
    if (!county) return;

    state = {
      level: 'county',
      provinceAdcode: getProvinceAdcodeFromCountySafe(countyCode),
      cityAdcode: county.provinceCode,
      countyCode,
    };
    notify();

    try {
      const geojson = await loadCountyGeoJSON(countyCode);
      if (!isMapValid()) return;

      if (map.hasLayer(layerGroup)) map.removeLayer(layerGroup);
      layerGroup = L.layerGroup();
      layerGroup.addTo(map);

      const countyLayer = L.geoJSON(geojson, {
        style: {
          color: '#059669',
          weight: 2.5,
          fillColor: '#34d399',
          fillOpacity: 0.4,
        },
      });
      layerGroup.addLayer(countyLayer);

      const bounds = countyLayer.getBounds();
      map.flyToBounds(bounds, {
        duration: ANIMATION_DURATION,
        padding: [80, 80],
      });

      // ✅ 修复：县级聚焦标记使用县区 GeoJSON bounds.getCenter()（精准居中，无偏移）
      // ✅ v2 美化标签：毛玻璃 + 渐变 + 类别配色（替代原红色圆点）
      const focusedScheme: Record<string, { bg: string; ring: string; text: string }> = {
        core: { bg: 'linear-gradient(135deg,#166534 0%,#22c55e 100%)', ring: 'rgba(34,197,94,0.6)', text: '#ffffff' },
        development: { bg: 'linear-gradient(135deg,#22c55e 0%,#84cc16 100%)', ring: 'rgba(132,204,22,0.6)', text: '#ffffff' },
        production: { bg: 'linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%)', ring: 'rgba(251,191,36,0.6)', text: '#ffffff' },
      };
      const focusedColor = focusedScheme[county.category] ?? focusedScheme.development;
      const focusedTagHtml = `
        <div class="county-focused-tag" style="
          display:inline-flex;align-items:center;gap:6px;
          padding:6px 14px;border-radius:9999px;
          background:${focusedColor.bg};
          color:${focusedColor.text};
          font-size:12px;font-weight:700;letter-spacing:0.4px;
          backdrop-filter:blur(10px);
          -webkit-backdrop-filter:blur(10px);
          border:1.5px solid rgba(255,255,255,0.5);
          box-shadow:0 6px 18px ${focusedColor.ring},inset 0 1px 0 rgba(255,255,255,0.4);
          white-space:nowrap;
          font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;
          animation: countyTagPulse 2s ease-in-out infinite;
        ">
          <span style="
            display:inline-block;width:6px;height:6px;border-radius:50%;
            background:rgba(255,255,255,0.95);
            box-shadow:0 0 8px rgba(255,255,255,0.9);
            animation: countyTagDot 1.5s ease-in-out infinite;
          "></span>
          ${county.name}
          <span style="
            display:inline-block;margin-left:2px;
            padding:1px 6px;border-radius:9999px;
            background:rgba(255,255,255,0.25);
            font-size:10px;font-weight:500;
          ">${county.herbVarieties.length} 种</span>
        </div>`;
      const marker = L.marker([bounds.getCenter().lat, bounds.getCenter().lng], {
        icon: L.divIcon({
          className: 'county-focused-tag-wrapper',
          html: focusedTagHtml,
          iconSize: [160, 28],
          iconAnchor: [80, 14],
        }),
      });
      marker.bindTooltip(
        `<b>${county.name}</b><br>机构: ${county.institutionCount} · 瑶药: ${county.herbVarieties.length}`,
        { permanent: true, direction: 'top', offset: [0, -18], className: 'leaflet-tooltip county-focused-tip' }
      );
      layerGroup.addLayer(marker);

      console.info(`[DrillDown] 已钻入县级: ${county.name}`);
    } catch (e) {
      console.error('[DrillDown] 钻入县级失败:', e);
    }
  };

  // === 4. 返回上级 ===
  const zoomOut = async (): Promise<void> => {
    if (!isMapValid()) return;
    if (state.level === 'county') {
      // 县 → 省
      if (state.provinceAdcode) {
        await drillToProvince(state.provinceAdcode);
      }
    } else if (state.level === 'city') {
      // 市 → 全国
      state = { level: 'province' };
      notify();
      renderNationalView();
      // 平滑回到全国视图（0.4s 淡入淡出）
      map.flyToBounds(
        [
          [17.5, 97.0],
          [35.0, 123.0],
        ] as LatLngBoundsExpression,
        { duration: ANIMATION_DURATION, padding: [20, 20] }
      );
    }
  };

  // === 5. 销毁 ===
  const destroy = (): void => {
    destroyed = true;
    if (isMapValid()) {
      if (map.hasLayer(layerGroup)) {
        map.removeLayer(layerGroup);
      }
      // 移除自定义控件
      for (const ctrl of customControls) {
        try {
          ctrl.remove();
        } catch {
          // ignore
        }
      }
      // 解绑空白点击监听
      map.off('click', handleMapClick);
    }
  };

  // === 6. 控制器 ===
  const controller: DrillDownController = {
    getState: () => state,
    drillToProvince,
    drillToCity: async (cityAdcode: string) => {
      // 当前实现：直接跳转到省级（简化）
      const city = hierarchy.byCityAdcode.get(cityAdcode);
      if (city) {
        await drillToProvince(city.provinceAdcode);
      }
    },
    drillToCounty,
    zoomOut,
    destroy,
    setOnCountyClick: (cb: (county: YaoCounty) => void) => {
      onCountyClickCb = cb;
    },
  };

  // 初次渲染全国视图
  renderNationalView();

  return controller;
}

/** 县级 adcode 前 2 位 → 省级 adcode（辅助函数避免重复导入） */
function getProvinceAdcodeFromCountySafe(code: string): string {
  return code.substring(0, 2);
}