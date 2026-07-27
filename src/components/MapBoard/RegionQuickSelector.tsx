/**
 * 省份/区域快速选择工具栏
 *
 * 替代原 ChinaMap 下方的速选按钮。
 * 位置：MapBoard 顶部右侧。
 * 功能：点击省份按钮 → 调用 store 的 selectRegionAndOpenPanel，
 *       触发 RegionPanel 滑入 + 钻取地图聚焦。
 */

import React from 'react';
import { regions } from '../../data/mockData';
import { useMapStore } from '../../store/mapStore';
import { dispatchZoomToRegion } from '../../lib/mapEvents';
import type { Region } from '../../types';

const RegionQuickSelector: React.FC = () => {
  const { selectedRegion, selectRegionAndOpenPanel } = useMapStore();

  const handleClick = (region: Region) => {
    // ✅ 修复海南等地域入口关联问题：
    //    同时触发 store 状态更新 + Leaflet 地图钻取到对应省级
    selectRegionAndOpenPanel(region);
    dispatchZoomToRegion(region.id);
  };

  return (
    <div
      className="region-quick-selector absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto"
      role="toolbar"
      aria-label="省份快速选择"
    >
      <div
        className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-primary-100 flex items-center"
        style={{
          padding: '6px 10px',
          gap: '8px',
          maxWidth: '92vw',
        }}
      >
        {regions.map((region) => {
          const isActive = selectedRegion?.id === region.id;
          return (
            <button
              key={region.id}
              type="button"
              onClick={() => handleClick(region)}
              className={`rounded-lg text-xs font-medium transition-all duration-200 ${
                isActive
                  ? 'text-white shadow-md ring-2 ring-primary-300'
                  : 'text-gray-700 hover:shadow-md hover:bg-primary-50'
              }`}
              style={{
                backgroundColor: isActive ? region.color : 'transparent',
                border: isActive ? 'none' : '1px solid #e5e7eb',
                padding: '6px 14px',
                minWidth: '56px',
                letterSpacing: '0.5px',
              }}
              aria-label={`查看 ${region.name} 详情`}
            >
              {region.name
                .replace('壮族自治区', '')
                .replace('省', '')
                .replace('市', '')
                .replace('自治区', '')
                .trim()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RegionQuickSelector;