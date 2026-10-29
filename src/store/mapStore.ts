import { create } from 'zustand';
import { Region, Herb, Therapy, HistoryPeriod, YaoCounty } from '../types';

/**
 * 视图层级：national（全国）→ region（区域）→ herb / county（详情）
 *
 * 说明：本类型仍在使用（TerrainRelief3D 通过 setViewLevel 切换全国/区域态）。
 */
export type ViewLevel = 'national' | 'region' | 'herb' | 'county';

/**
 * 全应用唯一的全局状态容器。
 *
 * 历史清理说明（2026 修复）：
 *   本 store 原先还持有一整套「SVG 概念地图时代」的视口状态与控制器
 *   （viewBox / defaultViewBox / zoomLevel / isPanning / mapLayer / defaultViewBox、
 *    以及 zoomIn / zoomOut / panBy / setZoomLevel / setIsPanning /
 *    zoomToRegion / zoomToCounty / setViewBox / resetViewBox / setMapLayer、
 *    还有已删除的 RegionModal 遗留状态 isRegionModalOpen 与 openRegionModal/closeRegionModal、
 *    以及从未被消费的 hoveredProvince / hoveredCountyCode / togglePanel / clearSelection）。
 *
 *   自 2D 地图改为 Leaflet 命令式实现后，视口由 Leaflet 自己管理
 *   （见 DrillDownMap 的 flyToBounds），上述状态**已无任何消费者**，
 *   属于"双轨遗留"，故整体移除，避免后来者误以为改动 viewBox 会影响地图。
 *
 *   如需重新引入地图视口状态，请以 Leaflet 的 setView/flyToBounds 为单一来源，
 *   不要再引入第二套坐标体系。
 */
interface MapState {
  /* ---------- 当前选中项 ---------- */
  selectedRegion: Region | null;
  selectedHerb: Herb | null;
  selectedTherapy: Therapy | null;
  selectedHistoryPeriod: HistoryPeriod | null;
  selectedCounty: YaoCounty | null;

  /* ---------- 弹窗 / 面板开关 ---------- */
  isPanelOpen: boolean;
  isHerbModalOpen: boolean;
  isTherapyModalOpen: boolean;
  isHistoryModalOpen: boolean;
  isCountyModalOpen: boolean;

  /* ---------- 视图层级（供 3D 地形与地图联动） ---------- */
  viewLevel: ViewLevel;

  /* ---------- 选中项 setter ---------- */
  setSelectedRegion: (region: Region | null) => void;
  setSelectedHerb: (herb: Herb | null) => void;
  setSelectedTherapy: (therapy: Therapy | null) => void;
  setSelectedHistoryPeriod: (history: HistoryPeriod | null) => void;
  setSelectedCounty: (county: YaoCounty | null) => void;

  /* ---------- 面板控制 ---------- */
  openPanel: () => void;
  closePanel: () => void;
  /** 一站式「选中区域 + 打开面板」 */
  selectRegionAndOpenPanel: (region: Region) => void;

  /* ---------- 弹窗控制 ---------- */
  openHerbModal: () => void;
  closeHerbModal: () => void;
  openTherapyModal: () => void;
  closeTherapyModal: () => void;
  openHistoryModal: () => void;
  closeHistoryModal: () => void;
  openCountyModal: () => void;
  closeCountyModal: () => void;

  /* ---------- 视图层级控制 ---------- */
  setViewLevel: (level: ViewLevel) => void;
}

export const useMapStore = create<MapState>((set, get) => {
  // 暴露到 window 便于 E2E 测试（只暴露 get/set 入口，不暴露业务数据）
  if (typeof window !== 'undefined') {
    (window as unknown as { __MAP_STORE__?: unknown }).__MAP_STORE__ = { getState: get, set };
  }
  return {
    selectedRegion: null,
    selectedHerb: null,
    selectedTherapy: null,
    selectedHistoryPeriod: null,
    selectedCounty: null,
    isPanelOpen: false,
    isHerbModalOpen: false,
    isTherapyModalOpen: false,
    isHistoryModalOpen: false,
    isCountyModalOpen: false,

    viewLevel: 'national',

    setSelectedRegion: (region) => set({ selectedRegion: region }),

    setSelectedHerb: (herb) => set({ selectedHerb: herb }),

    setSelectedTherapy: (therapy) => set({ selectedTherapy: therapy }),

    setSelectedHistoryPeriod: (history) => set({ selectedHistoryPeriod: history }),

    setSelectedCounty: (county) => set({ selectedCounty: county }),

    openPanel: () => set({ isPanelOpen: true }),

    closePanel: () => set({ isPanelOpen: false }),

    selectRegionAndOpenPanel: (region) => {
      set({
        selectedRegion: region,
        isPanelOpen: true,
        viewLevel: 'region',
      });
    },

    openHerbModal: () => set({ isHerbModalOpen: true, viewLevel: 'herb' }),

    closeHerbModal: () => {
      const state = get();
      set({
        isHerbModalOpen: false,
        selectedHerb: null,
        // 关闭草药弹窗后回到"有区域选区则 region，否则 national"
        viewLevel: state.selectedRegion ? 'region' : 'national',
      });
    },

    openTherapyModal: () => set({ isTherapyModalOpen: true }),

    closeTherapyModal: () => set({ isTherapyModalOpen: false, selectedTherapy: null }),

    openHistoryModal: () => set({ isHistoryModalOpen: true }),

    closeHistoryModal: () => set({ isHistoryModalOpen: false, selectedHistoryPeriod: null }),

    openCountyModal: () => set({ isCountyModalOpen: true, viewLevel: 'county' }),

    closeCountyModal: () => set({ isCountyModalOpen: false, selectedCounty: null }),

    setViewLevel: (level) => set({ viewLevel: level }),
  };
});
