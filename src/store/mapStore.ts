import { create } from 'zustand';
import { Region, Herb, Therapy, HistoryPeriod, YaoCounty } from '../types';

export type ViewLevel = 'national' | 'region' | 'herb' | 'county';
export type MapLayer = 'province' | 'county';

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MapState {
  selectedRegion: Region | null;
  selectedHerb: Herb | null;
  selectedTherapy: Therapy | null;
  selectedHistoryPeriod: HistoryPeriod | null;
  selectedCounty: YaoCounty | null;
  isPanelOpen: boolean;
  isRegionModalOpen: boolean;
  isHerbModalOpen: boolean;
  isTherapyModalOpen: boolean;
  isHistoryModalOpen: boolean;
  isCountyModalOpen: boolean;
  hoveredProvince: string | null;
  hoveredCountyCode: string | null;

  viewLevel: ViewLevel;
  mapLayer: MapLayer;
  viewBox: ViewBox;
  defaultViewBox: ViewBox;
  zoomLevel: number;
  isPanning: boolean;

  setSelectedRegion: (region: Region | null) => void;
  setSelectedHerb: (herb: Herb | null) => void;
  setSelectedTherapy: (therapy: Therapy | null) => void;
  setSelectedHistoryPeriod: (history: HistoryPeriod | null) => void;
  setSelectedCounty: (county: YaoCounty | null) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  selectRegionAndOpenPanel: (region: Region) => void;
  openHerbModal: () => void;
  closeHerbModal: () => void;
  openTherapyModal: () => void;
  closeTherapyModal: () => void;
  openHistoryModal: () => void;
  closeHistoryModal: () => void;
  openCountyModal: () => void;
  closeCountyModal: () => void;
  setHoveredProvince: (provinceId: string | null) => void;
  setHoveredCountyCode: (code: string | null) => void;
  clearSelection: () => void;

  setViewLevel: (level: ViewLevel) => void;
  setMapLayer: (layer: MapLayer) => void;
  setViewBox: (viewBox: ViewBox) => void;
  resetViewBox: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  panBy: (dx: number, dy: number) => void;
  setZoomLevel: (level: number) => void;
  setIsPanning: (panning: boolean) => void;
  zoomToRegion: (regionId: string) => void;
  zoomToCounty: (lng: number, lat: number) => void;
}

const DEFAULT_VIEW_BOX = { x: 0, y: 0, width: 900, height: 600 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.3;

const regionViewBoxes: Record<string, { x: number; y: number; width: number; height: number }> = {
  guangxi: { x: 380, y: 370, width: 220, height: 200 },
  guangdong: { x: 500, y: 390, width: 180, height: 160 },
  hunan: { x: 480, y: 280, width: 200, height: 180 },
  yunnan: { x: 200, y: 300, width: 280, height: 240 },
  guizhou: { x: 380, y: 280, width: 180, height: 180 },
  jiangxi: { x: 580, y: 270, width: 160, height: 150 },
  hainan: { x: 440, y: 480, width: 120, height: 100 },
  chongqing: { x: 340, y: 220, width: 180, height: 150 },
  sichuan: { x: 180, y: 180, width: 260, height: 200 },
};

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
  isRegionModalOpen: false,
  isHerbModalOpen: false,
  isTherapyModalOpen: false,
  isHistoryModalOpen: false,
  isCountyModalOpen: false,
  hoveredProvince: null,
  hoveredCountyCode: null,

  viewLevel: 'national',
  mapLayer: 'province',
  viewBox: DEFAULT_VIEW_BOX,
  defaultViewBox: DEFAULT_VIEW_BOX,
  zoomLevel: 1,
  isPanning: false,

  setSelectedRegion: (region) => set({ selectedRegion: region }),

  setSelectedHerb: (herb) => set({ selectedHerb: herb }),

  setSelectedTherapy: (therapy) => set({ selectedTherapy: therapy }),

  setSelectedHistoryPeriod: (history) => set({ selectedHistoryPeriod: history }),

  setSelectedCounty: (county) => set({ selectedCounty: county }),

  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),

  openPanel: () => set({ isPanelOpen: true }),

  closePanel: () => set({ isPanelOpen: false }),

  selectRegionAndOpenPanel: (region) => {
    set({
      selectedRegion: region,
      isPanelOpen: true,
      viewLevel: 'region',
      mapLayer: 'county',
    });
  },

  openRegionModal: () => set({ isRegionModalOpen: true }),

  closeRegionModal: () => {
    set({
      isRegionModalOpen: false,
      viewLevel: 'national',
      mapLayer: 'province',
      viewBox: DEFAULT_VIEW_BOX,
      zoomLevel: 1,
    });
  },

  openHerbModal: () => set({ isHerbModalOpen: true, viewLevel: 'herb' }),

  closeHerbModal: () => {
    const state = get();
    set({
      isHerbModalOpen: false,
      selectedHerb: null,
      viewLevel: state.selectedRegion ? 'region' : 'national',
    });
  },

  openTherapyModal: () => set({ isTherapyModalOpen: true }),

  closeTherapyModal: () => set({ isTherapyModalOpen: false, selectedTherapy: null }),

  openHistoryModal: () => set({ isHistoryModalOpen: true }),

  closeHistoryModal: () => set({ isHistoryModalOpen: false, selectedHistoryPeriod: null }),

  openCountyModal: () => set({ isCountyModalOpen: true, viewLevel: 'county' }),

  closeCountyModal: () => set({ isCountyModalOpen: false, selectedCounty: null }),

  setHoveredProvince: (provinceId) => set({ hoveredProvince: provinceId }),

  setHoveredCountyCode: (code) => set({ hoveredCountyCode: code }),

  clearSelection: () => set({
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
    hoveredProvince: null,
    hoveredCountyCode: null,
    viewLevel: 'national',
    mapLayer: 'province',
    viewBox: DEFAULT_VIEW_BOX,
    zoomLevel: 1,
  }),

  setViewLevel: (level) => set({ viewLevel: level }),

  setMapLayer: (layer) => set({ mapLayer: layer }),

  setViewBox: (viewBox) => set({ viewBox }),

  resetViewBox: () => set({
    viewBox: DEFAULT_VIEW_BOX,
    zoomLevel: 1,
    viewLevel: 'national',
    mapLayer: 'province',
  }),

  zoomIn: () => {
    const state = get();
    const newZoom = Math.min(state.zoomLevel + ZOOM_STEP, MAX_ZOOM);
    const scale = state.zoomLevel / newZoom;
    const cx = state.viewBox.x + state.viewBox.width / 2;
    const cy = state.viewBox.y + state.viewBox.height / 2;
    const newWidth = state.viewBox.width * scale;
    const newHeight = state.viewBox.height * scale;
    set({
      zoomLevel: newZoom,
      viewBox: {
        x: cx - newWidth / 2,
        y: cy - newHeight / 2,
        width: newWidth,
        height: newHeight,
      }
    });
  },

  zoomOut: () => {
    const state = get();
    const newZoom = Math.max(state.zoomLevel - ZOOM_STEP, MIN_ZOOM);
    if (newZoom === MIN_ZOOM) {
      set({
        zoomLevel: MIN_ZOOM,
        viewBox: DEFAULT_VIEW_BOX,
      });
      return;
    }
    const scale = state.zoomLevel / newZoom;
    const cx = state.viewBox.x + state.viewBox.width / 2;
    const cy = state.viewBox.y + state.viewBox.height / 2;
    const newWidth = state.viewBox.width * scale;
    const newHeight = state.viewBox.height * scale;
    set({
      zoomLevel: newZoom,
      viewBox: {
        x: cx - newWidth / 2,
        y: cy - newHeight / 2,
        width: newWidth,
        height: newHeight,
      }
    });
  },

  panBy: (dx, dy) => {
    const state = get();
    set({
      viewBox: {
        ...state.viewBox,
        x: state.viewBox.x + dx,
        y: state.viewBox.y + dy,
      }
    });
  },

  setZoomLevel: (level) => {
    const clampedLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
    const state = get();
    const scale = state.zoomLevel / clampedLevel;
    const cx = state.viewBox.x + state.viewBox.width / 2;
    const cy = state.viewBox.y + state.viewBox.height / 2;
    const newWidth = state.viewBox.width * scale;
    const newHeight = state.viewBox.height * scale;
    set({
      zoomLevel: clampedLevel,
      viewBox: {
        x: cx - newWidth / 2,
        y: cy - newHeight / 2,
        width: newWidth,
        height: newHeight,
      }
    });
  },

  setIsPanning: (panning) => set({ isPanning: panning }),

  zoomToRegion: (regionId) => {
    const regionBox = regionViewBoxes[regionId];
    if (regionBox) {
      const zoom = DEFAULT_VIEW_BOX.width / regionBox.width;
      set({
        viewBox: regionBox,
        zoomLevel: zoom,
        viewLevel: 'region',
        mapLayer: 'county',
      });
    }
  },

  /**
   * 缩放到指定县级中心：将视口中心平移到该点，缩放等级提升至 2.5x
   * 注：经纬度到 viewBox 的换算由调用方（ChinaMap）负责，此处只更新视图参数
   */
  zoomToCounty: (lng, lat) => {
    // 投影参数与 ChinaMap.processGeoJson 中保持一致
    const padding = 20;
    const minLon = 73;
    const maxLon = 135;
    const minLat = 18;
    const maxLat = 54;
    const lonRange = maxLon - minLon;
    const latRange = maxLat - minLat;
    const scaleX = (DEFAULT_VIEW_BOX.width - padding * 2) / lonRange;
    const scaleY = (DEFAULT_VIEW_BOX.height - padding * 2) / latRange;
    const scale = Math.min(scaleX, scaleY);

    const cx = padding + (lng - minLon) * scale;
    const cy = padding + (maxLat - lat) * scale;

    // 目标缩放等级 2.5x，对应视口尺寸为默认的 1/2.5
    const targetZoom = 2.5;
    const newWidth = DEFAULT_VIEW_BOX.width / targetZoom;
    const newHeight = DEFAULT_VIEW_BOX.height / targetZoom;

    set({
      viewBox: {
        x: cx - newWidth / 2,
        y: cy - newHeight / 2,
        width: newWidth,
        height: newHeight,
      },
      zoomLevel: targetZoom,
      viewLevel: 'county',
      mapLayer: 'county',
    });
  },
  };
});