/**
 * 草药点位标记层
 *
 * 职责：
 *   1. 在 MapBoard 上为每个有坐标的草药渲染 L.circleMarker
 *   2. 点击标记打开 HerbModal
 *   3. hover 标记显示 popup 提示
 *
 * 设计：
 *   - 独立于 DrillDownMap，可在国家/省/县任意层级叠加显示
 *   - 使用 L.circleMarker 而非 L.marker，避免对图标资源依赖
 *   - 通过 layerGroup 管理生命周期，destroy() 时彻底清理
 */

import L, { type Map as LMap, type LayerGroup } from 'leaflet';
import { herbs } from '../../data/mockData';
import { getHerbLngLat } from '../../lib/herbPositions';
import type { Herb } from '../../types';

export interface HerbMarkersController {
  /** 销毁标记层 */
  destroy: () => void;
  /** 重新创建所有标记（适用于地图视图重置后） */
  refresh: () => void;
}

export interface HerbMarkersOptions {
  onHerbClick: (herb: Herb) => void;
}

/**
 * 创建草药标记层并绑定到地图。
 * - 地图缩放/平移时标记跟随移动
 * - 点击标记触发 onHerbClick 回调
 * - 鼠标悬停显示 Leaflet 原生 popup
 */
export function createHerbMarkersLayer(
  map: LMap,
  options: HerbMarkersOptions
): HerbMarkersController {
  const group: LayerGroup = L.layerGroup().addTo(map);

  const buildPopupHtml = (herb: Herb): string => {
    const efficacy = herb.efficacy.length > 60
      ? `${herb.efficacy.substring(0, 60)}...`
      : herb.efficacy;
    return `
      <div style="font-family: 'Noto Sans SC', sans-serif; min-width: 200px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="font-weight: 600; color: #14532d; font-size: 14px;">${herb.name}</span>
          ${herb.nameYao ? `<span style="font-size: 12px; color: #6b7280;">${herb.nameYao}</span>` : ''}
        </div>
        ${herb.scientificName ? `<div style="font-size: 11px; font-style: italic; color: #6b7280; margin-bottom: 4px;">${herb.scientificName}</div>` : ''}
        <div style="font-size: 12px; color: #374151; line-height: 1.5;">${efficacy}</div>
        <div style="font-size: 11px; color: #16a34a; margin-top: 4px;">点击查看详情</div>
      </div>
    `;
  };

  const addMarkers = () => {
    group.clearLayers();
    herbs.forEach((herb) => {
      const pos = getHerbLngLat(herb);
      if (!pos) return;
      const marker = L.circleMarker([pos.lat, pos.lng], {
        radius: 7,
        fillColor: '#16a34a',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
        className: 'herb-marker',
      });
      marker.bindPopup(buildPopupHtml(herb), {
        closeButton: false,
        offset: [0, -4],
        className: 'herb-popup',
      });
      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout', () => marker.closePopup());
      marker.on('click', (e) => {
        // 阻止冒泡，避免触发放大镜缩小等地图默认行为
        L.DomEvent.stopPropagation(e);
        options.onHerbClick(herb);
      });
      marker.addTo(group);
    });
  };

  addMarkers();

  return {
    destroy: () => {
      group.clearLayers();
      map.removeLayer(group);
    },
    refresh: () => {
      addMarkers();
    },
  };
}