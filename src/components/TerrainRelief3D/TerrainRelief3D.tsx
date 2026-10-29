/**
 * TerrainRelief3D —— 可交互的中国地形浮雕查看器（React 容器 + UI 控制面板）
 *
 * 分层：
 *   heightmap.ts      高程数据加载 / 采样
 *   palette.ts        高程分层设色
 *   geoProjection.ts  经纬度 ⇄ 模型坐标投影（与高程图同一 Web Mercator）
 *   boundaryOverlay.ts 省/市行政区划边界线、悬停选中样式、名称标注、点击命中
 *   terrainViewer.ts  Three.js 场景（光照 / 网格 / 控制器 / 拾取 / 聚焦 / 按需渲染）
 *   本文件             React 生命周期、数据加载编排、UI 控制项与状态展示
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assetPath } from '../../lib/assetPath';
import { loadHeightmap, type Heightmap } from './heightmap';
import { paletteLegend, SEA_COLOR_CSS } from './palette';
import {
  createTerrainViewer,
  type TerrainViewerApi,
  type ViewerStats,
  type ViewPresetName,
} from './terrainViewer';
import {
  provinceColorLegend,
  shortProvinceName,
  type GeoFeatureCollection,
  type PoiItem,
  type ProvincePick,
  type ProvinceStat,
} from './boundaryOverlay';
import { yaoCounties } from '../../data/mockData';
import { aggregateToHierarchy, type AdminHierarchy } from '../../lib/adminAggregator';
import { useMapStore } from '../../store/mapStore';
import type { Herb, YaoCounty } from '../../types';
import { buildCountyPois, buildHerbPoisByProvince } from './poiData';
import TourPlaceholder from './tourPlaceholder';
import { CATEGORY_COLORS, CATEGORY_LABELS, TOUR_NODES, TOUR_ROUTES, type TourNode } from './tourData';
import { createProjection } from './geoProjection';
import { buildRouteProfile } from './tourProfile';
import {
  ElevationProfile,
  TourCompass,
  TourHelp,
  TourTimeline,
  TourToolbar,
} from './tourChrome';
import TourStage from './tourStage';

/** 高程图资源（不含扩展名）：由 scripts/export_relief_heightmap.py 生成 */
const HEIGHTMAP_BASE = assetPath('relief/china-heightmap');
/** 全国省级边界 */
const PROVINCE_URL = assetPath('map/100000_full.json');
/** 九段线要素（细长 MultiPolygon，不参与省份划分） */
const JD_ADCODE = '100000_JD';

/* ------------------------------------------------------------------
 * 与 2D 地图共享的业务数据（草药点位 / 瑶族县 / 省份统计）
 * 全部在模块级聚合一次，避免每次挂载重复计算。
 * ------------------------------------------------------------------ */

/** 县级 → 省/市 三级聚合（与 2D 的 DrillDownMap 使用同一份数据与聚合逻辑） */
const hierarchy: AdminHierarchy = aggregateToHierarchy(yaoCounties);

/** 瑶族相关省（2 位 adcode）：决定省份配色语义（与 2D 的绿色/灰色一致） */
const YAO_PROVINCE_ADCODES: string[] = hierarchy.provinces.filter((p) => p.hasYaoData).map((p) => p.adcode);

/** 各省统计（悬停信息卡内容，对齐 2D tooltip） */
const PROVINCE_STATS: Map<string, ProvinceStat> = new Map(
  hierarchy.provinces.map((p) => [
    p.adcode,
    {
      isYao: p.hasYaoData,
      countyCount: p.countyCount,
      institutions: p.totalInstitutions,
      herbs: p.uniqueHerbs.length,
    },
  ]),
);

/** 县分类 → 渐变色、草药/县级点位构建逻辑已抽到 `poiData.ts`（纯函数，便于单元测试） */

/** 视角预设按钮：从"顶视 → 俯瞰总览 → 正视 → 两个等轴测 → 低角度"梯度排列，
 *  覆盖平面/俯瞰/正面/立体/剖面五个维度；「正南俯瞰」为默认初始视角（业务可读性最高） */
const PRESET_LABELS: Array<{ key: ViewPresetName; label: string }> = [
  { key: 'top', label: '正俯视' },
  { key: 'overview', label: '正南俯瞰' },
  { key: 'front', label: '正南前视' },
  { key: 'southwest', label: '西南等轴测' },
  { key: 'southeast', label: '东南等轴测' },
  { key: 'low', label: '低角度侧视' },
];

const SEGMENT_OPTIONS = [
  { value: 256, label: '256（流畅）' },
  { value: 384, label: '384（均衡）' },
  { value: 512, label: '512（推荐·精细）' },
  { value: 768, label: '768（高精·偏重）' },
  { value: 1024, label: '1024（极高·可能掉帧）' },
];

/** 面板展开状态的本地记忆键 */
const LS_CONSOLE = 'yaoyi.relief.consoleOpen';
/** 「显示省份名称」开关的本地记忆键 */
const LS_PROVINCE_NAMES = 'yaoyi.relief.provinceNames';

/**
 * 带本地记忆的布尔状态：面板展开/收起状态在刷新与再次进入后保持。
 * localStorage 可能在隐私模式或被禁用时抛错，这里全部兜底忽略。
 */
function useStickyBoolean(key: string, initial: boolean): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch {
      /* 忽略：使用默认值 */
    }
    return initial;
  });

  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        /* 忽略：仅本次生效 */
      }
    },
    [key],
  );

  return [value, set];
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(74,124,58,0.28)',
  borderRadius: 8,
  boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
};

const btnBase: React.CSSProperties = {
  padding: '5px 9px',
  fontSize: 12,
  borderRadius: 5,
  border: '1px solid #cbd5cf',
  background: '#fff',
  color: '#33463a',
  cursor: 'pointer',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

/** 左上缩放控件（对齐 2D 地图 Leaflet 缩放控件的位置与观感） */
const zoomBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 6,
  border: '1px solid rgba(74,124,58,0.28)',
  background: 'rgba(255,255,255,0.94)',
  color: '#2d4a22',
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  padding: 0,
};

/* ---------------------------------------------------------------------------
 * 控制面板基础件与密度令牌
 * 目标：把原先"7 组要素平铺、留白硬编码"的面板改成「可折叠分区 + 统一密度档位」，
 *       让间距 / 字号 / 行高 / 控件高度成套缩放，避免忽紧忽松与视觉挤压。
 * ------------------------------------------------------------------------- */

export type PanelDensity = 'compact' | 'relaxed';

/** 密度档位 → 成套度量（间距、字号、行高、控件内边距、面板宽度） */
function densitySpec(d: PanelDensity) {
  return d === 'compact'
    ? { gap: 8, pad: 10, section: 8, label: 11.5, hint: 10.5, btn: 11.5, btnPad: '4px 8px', line: 1.5, width: 272 }
    : { gap: 13, pad: 14, section: 12, label: 12, hint: 11, btn: 12, btnPad: '6px 11px', line: 1.75, width: 300 };
}

/** 统一开关：固定 40×22，滑块 16，避免各处硬编码造成错位 */
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  title?: string;
}> = ({ checked, onChange, label, title }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={title}
    onClick={() => onChange(!checked)}
    style={{
      position: 'relative',
      width: 40,
      height: 22,
      flex: '0 0 auto',
      padding: 0,
      borderRadius: 11,
      border: '1px solid ' + (checked ? '#3f6b31' : '#cbd5cf'),
      background: checked ? '#4a7c3a' : '#d7ded9',
      cursor: 'pointer',
      transition: 'background 180ms ease, border-color 180ms ease',
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: 2,
        left: checked ? 20 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        transition: 'left 180ms ease',
      }}
    />
  </button>
);

/** 可折叠分区：标题行整行可点，右侧显示摘要与展开指示 */
const PanelSection: React.FC<{
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  first?: boolean;
  density: PanelDensity;
  children: React.ReactNode;
}> = ({ title, badge, open, onToggle, first, density, children }) => {
  const t = densitySpec(density);
  return (
    <section
      style={{
        borderTop: first ? undefined : '1px dashed #d9e2da',
        paddingTop: first ? 0 : t.section,
        marginTop: first ? 0 : t.section,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          font: 'inherit',
          fontSize: t.label,
          color: '#3f5546',
          lineHeight: t.line,
          textAlign: 'left',
        }}
      >
        <span style={{ flex: '1 1 auto', fontWeight: 600 }}>{title}</span>
        {badge ? <span style={{ color: '#8a9a90', fontSize: t.hint }}>{badge}</span> : null}
        <span aria-hidden style={{ color: '#7a8b80', fontSize: 10 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <div style={{ marginTop: t.gap }}>{children}</div> : null}
    </section>
  );
};

const TerrainRelief3D: React.FC<{ className?: string }> = ({ className }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<TerrainViewerApi | null>(null);
  /** 点位 id → 业务对象（点击时打开对应详情弹窗） */
  const herbByIdRef = useRef<Map<string, Herb>>(new Map());
  const countyByIdRef = useRef<Map<string, YaoCounty>>(new Map());
  /** 草药点位按省份分桶（2 位 adcode → 点位）；默认不显示，点击省份时才取出对应桶 */
  const herbByProvinceRef = useRef<Map<string, PoiItem[]>>(new Map());
  /** 点位点击回调的稳定引用 */
  const poiHandlerRef = useRef<(item: PoiItem) => void>(() => {});
  const heightmapRef = useRef<Heightmap | null>(null);
  /** 请求序号：切换省份时作废在途的下级区划请求，避免过期响应覆盖新省份 */
  const focusReqRef = useRef(0);
  /** 当前聚焦省份（供回调内同步读取，避免闭包过期） */
  const focusedRef = useRef<ProvincePick | null>(null);
  /** 点击回调的稳定引用 */
  const pickHandlerRef = useRef<(pick: ProvincePick | null) => void>(() => {});
  /**
   * 「因点省份而退出路线」标记：置位后本次关闭路线不清相机，
   * 让紧接着的 focusProvince 镜头生效（否则会先被 applyPreset('overview') 覆盖）。
   */
  const keepTourViewRef = useRef(false);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [preset, setPreset] = useState<ViewPresetName>('overview');
  const [reliefPercent, setReliefPercent] = useState(6);
  const [segments, setSegments] = useState(512);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [stats, setStats] = useState<ViewerStats>({
    fps: 0,
    triangles: 0,
    globalSegments: 512,
    patchSegX: null,
    patchSegY: null,
  });
  const [focused, setFocused] = useState<ProvincePick | null>(null);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityCount, setCityCount] = useState(0);
  // 面板展开状态：默认展开，用户收起后本地记忆
  const [consoleOpen, setConsoleOpen] = useStickyBoolean(LS_CONSOLE, true);
  // 省份名称常显开关：默认开启，状态本地记忆（刷新/重进后保持）
  const [showProvinceNames, setShowProvinceNames] = useStickyBoolean(LS_PROVINCE_NAMES, true);
  // 旅游路线层开关（不持久化：每次进入默认关闭，避免首屏被路线占据）
  const [tourOn, setTourOn] = useState(false);

  /* ---------------- 控制面板：密度档位与分区展开状态 ---------------- */
  const [density, setDensity] = useState<PanelDensity>(() => {
    try {
      return localStorage.getItem('yaoyi.terrain.density') === 'relaxed' ? 'relaxed' : 'compact';
    } catch {
      return 'compact';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('yaoyi.terrain.density', density);
    } catch {
      /* 隐私模式下忽略 */
    }
  }, [density]);

  // 默认只展开高频区（视角 / 地形 / 旅游路线）；显示与统计收纳为折叠态
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    view: true,
    terrain: true,
    tour: true,
    display: false,
    legend: false,
    stats: false,
  });
  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  // 路线类别图例默认收起（仅在需要时展开，避免面板被三行小字撑高）
  const [tourLegendOpen, setTourLegendOpen] = useState(false);
  /** 当前密度档位的成套度量 */
  const dz = densitySpec(density);

  /**
   * 「药田晕染」：把各县瑶医机构数归一化成 0~1 权重，交给渲染层做地表淡色场。
   * 权重口径与数据图层一致（除以全国最大值），保证省际可比。
   */
  const [tintOn, setTintOn] = useState(false);
  const tintPoints = useMemo(() => {
    const max = Math.max(...yaoCounties.map((c) => c.institutionCount ?? 0), 1);
    return yaoCounties.map((c) => ({
      lon: c.centerLng,
      lat: c.centerLat,
      weight: (c.institutionCount ?? 0) / max,
    }));
  }, []);
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || status !== 'ready') return;
    // 可选调用：宿主 API 若在某版本缺该方法，不应让整个面板崩溃
    v.setTintLayer?.(tintOn ? tintPoints : null);
    // 省名后附统计数字：仅在晕染图层开启时显示，与色块形成"面 + 数"的组合
    v.setProvinceStatLabels?.(tintOn);
  }, [tintOn, status, tintPoints]);

  /**
   * 面板可用高度：按视口实测，而不是只看父容器高度。
   * 父容器（地图区）在窄屏上可能高于视口，单用 calc(100% - N) 会让面板底缘越过视口，
   * 导致最底部分区标题被裁到屏幕外、必须滚动才够得到。
   */
  const [panelMaxH, setPanelMaxH] = useState<number | null>(null);
  /** 当前打开的路线节点（null = 未打开）；由地图节点点击设置 */
  const [tourNode, setTourNode] = useState<TourNode | null>(null);
  /**
   * 路线"当前站"：与详情面板解耦 —— 关闭面板后时间轴/剖面仍保留当前站高亮，
   * 对应参考视频底部时间轴的常驻当前站状态。
   */
  const [tourFocusId, setTourFocusId] = useState<string | null>(null);
  const tourFocusRef = useRef<string | null>(null);
  /** 详情抽屉延迟挂载的定时器：让相机过渡先起步（原因见 openTourNode） */
  const panelTimerRef = useRef<number | null>(null);
  /** 统一的"取消待挂载面板"入口，避免定时器在路线关闭后还把面板弹出来 */
  const cancelPanelTimer = useCallback(() => {
    if (panelTimerRef.current !== null) {
      window.clearTimeout(panelTimerRef.current);
      panelTimerRef.current = null;
    }
  }, []);
  useEffect(() => () => cancelPanelTimer(), [cancelPanelTimer]);
  const setTourFocus = useCallback((id: string | null) => {
    tourFocusRef.current = id;
    setTourFocusId(id);
  }, []);
  /** 窄屏：详情面板从右侧抽屉改为底部抽屉（按**容器**宽度判断，初值 false，由 ResizeObserver 即时修正） */
  const [narrow, setNarrow] = useState(false);
  const tourHandlerRef = useRef<(node: TourNode) => void>(() => {});
  /** 路线封面（对应参考视频的"进入课堂"封面页） */
  /** 自动演示：按站序逐站巡航 */
  const [autoTour, setAutoTour] = useState(false);
  /** 左下角沿线海拔剖面开关 */
  const [profileOn, setProfileOn] = useState(true);
  /** 操作帮助面板 */
  const [helpOpen, setHelpOpen] = useState(false);
  /** 单站全屏阅读场景 */
  const [stageOpen, setStageOpen] = useState(false);
  /** 浏览器全屏状态（由 fullscreenchange 同步） */
  const [fullscreen, setFullscreen] = useState(false);
  /** 指北针罗盘环：由相机回调直接写 transform，避免每帧 setState */
  const compassRef = useRef<HTMLDivElement>(null);

  /* ---------------- 点位点击 → 打开与 2D 一致的详情弹窗 ---------------- */
  const onPoiSelect = useCallback((item: PoiItem) => {
    const store = useMapStore.getState();
    if (item.kind === 'herb') {
      const herb = herbByIdRef.current.get(item.id);
      if (!herb) return;
      store.setSelectedHerb(herb); // 与 2D HerbMarkersLayer 的点击行为一致
      store.openHerbModal();
    } else {
      const county = countyByIdRef.current.get(item.id);
      if (!county) return;
      store.setSelectedCounty(county); // 与 2D 县级标记的点击行为一致
      store.openCountyModal();
    }
  }, []);

  useEffect(() => {
    poiHandlerRef.current = onPoiSelect;
  }, [onPoiSelect]);

  /**
   * 打开节点详情：徽标放大动画 + 相机推近 + 切换节点级高精度地形。
   * keepStage=true 时保留「全屏阅读」场景（场景内的上一站/下一站不应退回抽屉）。
   *
   * 顺序很关键：**先让相机起飞，再挂详情面板**。
   * 实测（页面内 rAF 间隔）每次开站首帧会有 70~120ms 的主线程停顿，
   * 来源是"React 渲染详情抽屉（含大图解码）+ 补片纹理上传"和相机过渡挤在同一帧。
   * 把 setTourNode 推迟约 1 帧多一点，镜头起步就能保持 60fps，
   * 面板随后滑入，观感是"镜头先到、面板再出现"。
   */
  const openTourNode = useCallback((node: TourNode, opts?: { keepStage?: boolean }) => {
    const viewer = viewerRef.current;
    // 1) 先启动相机（纯命令式，不触发 React 渲染）
    if (viewer) {
      viewer.setTourActiveNode(node.id);
      // 宽屏时右侧抽屉会遮住画面右侧，把节点让到抽屉左边的可视区中心；
      // 窄屏用底部抽屉，不需要水平让位。阈值与下方抽屉样式保持一致（容器 ≥700px 为宽屏）。
      const el = rootRef.current;
      const wide = !!el && el.clientWidth >= 700;
      viewer.focusTourNode(node, wide && el ? Math.min(380, el.clientWidth * 0.42) : 0);
    }
    // 2) 再挂面板 + 刷新焦点：延后到镜头基本到位后再挂（约一次过渡时长）。
    //    原因：面板出现的那一帧会触发一次合成/光栅化停顿（实测 200~260ms），
    //    若卡在镜头飞行途中，观感就是明显掉帧；放到过渡收尾之后，
    //    这次停顿落在画面静止时，几乎不可察觉，且"镜头到位→详情滑出"的编排更顺。
    if (!opts?.keepStage) setStageOpen(false);
    if (panelTimerRef.current) window.clearTimeout(panelTimerRef.current);
    panelTimerRef.current = window.setTimeout(() => {
      panelTimerRef.current = null;
      setTourFocus(node.id);
      setTourNode(node);
    }, 620);
  }, [setTourFocus]);

  /** 关闭节点详情：取消高亮 + 退出节点取景（补片淡出、镜头原位轻微退让） */
  const closeTourNode = useCallback(() => {
    cancelPanelTimer(); // 若面板还没挂载（延迟中），直接取消，避免关掉后又弹出来
    setTourNode(null);
    setStageOpen(false);
    const viewer = viewerRef.current;
    if (!viewer) return;
    // 保留"当前站"的徽标高亮：时间轴/剖面会继续指向该站
    viewer.setTourActiveNode(tourFocusRef.current);
    viewer.exitTourNode();
  }, [cancelPanelTimer]);

  /** 旅游路线节点点击 → 打开该地点的图文面板（回调经 ref 传递，避免重建 viewer） */
  useEffect(() => {
    tourHandlerRef.current = (node: TourNode) => openTourNode(node);
  }, [openTourNode]);

  /** 窄屏判断：详情面板在宽屏为右侧抽屉、窄屏为底部抽屉（跟随容器宽度实时切换） */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = () => setNarrow(el.clientWidth < 700);
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** 面板可用高度：按「视口剩余高度」实测，窗口/密度/展开状态变化时重算 */
  useEffect(() => {
    const measure = () => {
      const el = consoleRef.current;
      if (!el) return;
      const top = Math.max(0, el.getBoundingClientRect().top);
      setPanelMaxH(Math.max(240, Math.round(window.innerHeight - top - 16)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [status, consoleOpen, density, tourOn]);

  /**
   * 路线模式的键盘操作（对齐参考视频）：
   *   Esc        依次关闭 帮助 → 全屏阅读 → 详情面板 → 封面
   *   ← / →      在详情面板打开时切换上一站 / 下一站
   */
  useEffect(() => {
    if (!tourOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (stageOpen) {
          setStageOpen(false);
          return;
        }
        if (tourNode) {
          closeTourNode();
          return;
        }
        return;
      }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && tourNode && !helpOpen) {
        const idx = TOUR_NODES.findIndex((n) => n.id === tourNode.id);
        const next = e.key === 'ArrowLeft' ? TOUR_NODES[idx - 1] : TOUR_NODES[idx + 1];
        if (next) {
          e.preventDefault();
          openTourNode(next, { keepStage: stageOpen });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourOn, helpOpen, stageOpen, tourNode, closeTourNode, openTourNode]);

  /** 自动演示：每 5.2s 切到下一站，循环巡航；打开封面/帮助/全屏阅读时暂停 */
  useEffect(() => {
    if (!autoTour || !tourOn || helpOpen || stageOpen) return;
    const timer = window.setInterval(() => {
      const idx = tourFocusId ? TOUR_NODES.findIndex((n) => n.id === tourFocusId) : -1;
      const next = idx >= 0 ? TOUR_NODES[(idx + 1) % TOUR_NODES.length] : TOUR_NODES[0];
      openTourNode(next);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [autoTour, tourOn, helpOpen, stageOpen, tourFocusId, openTourNode]);

  /** 浏览器全屏状态同步（Esc 退出全屏时保持按钮状态正确） */
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  /** 全屏切换：作用于整个地图容器（含 UI 外框），失败时静默忽略 */
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      const req = el.requestFullscreen;
      if (req) void req.call(el).catch(() => {});
    }
  }, []);

  /**
   * 指北针初始方位（罗盘环旋转 180 - bearing，使 N 指向真实北向）。
   * 路线开启后指北针才挂载，此时必须补写一次初始角度；
   * 之后的角度变化由 viewer 的 onCameraChange 直接写 DOM（不触发 React 重渲染）。
   */
  useEffect(() => {
    if (!tourOn) return;
    // 可选链同时保护对象与方法：宿主 API 若在某版本缺该方法，不应让整个面板崩溃
    const bearing = viewerRef.current?.getCameraBearing?.();
    if (bearing === undefined || !compassRef.current) return;
    compassRef.current.style.transform = `rotate(${(180 - bearing).toFixed(1)}deg)`;
  }, [tourOn]);

  /** 聚焦指定省：同步草药/瑶族县点位 + store 视图层级（与 2D 钻取省级一致） */
  const applyProvinceFocus = useCallback((adcode: string, viewer: TerrainViewerApi) => {
    const adcode2 = adcode.substring(0, 2);
    // 该省关联的草药点位（默认全部隐藏，仅在此处按省放出）
    viewer.setHerbPois(herbByProvinceRef.current.get(adcode2) ?? []);
    const { items, byId } = buildCountyPois(adcode2, hierarchy);
    countyByIdRef.current = byId;
    viewer.setCountyPois(items); // 只显示该省的瑶族县（对齐 2D 省级视图的县级药丸）
    useMapStore.getState().setViewLevel('region');
  }, []);

  /** 取消聚焦：清空草药与瑶族县点位（两者都必须同步隐藏，避免残留） */
  const clearProvincePois = useCallback((viewer: TerrainViewerApi) => {
    viewer.setHerbPois([]);
    viewer.setCountyPois([]);
    countyByIdRef.current = new Map();
  }, []);

  /* ---------------- 点击省份 → 聚焦 + 加载下级区划 ---------------- */
  const onProvincePick = useCallback(async (pick: ProvincePick | null) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // 点击空白/海洋：已聚焦则返回全国
    if (!pick) {
      if (!focusedRef.current) return;
      focusReqRef.current += 1;
      viewer.setCityFeatures(null);
      clearProvincePois(viewer);
      viewer.resetView();
      focusedRef.current = null;
      setFocused(null);
      setCityCount(0);
      setCityLoading(false);
      useMapStore.getState().setViewLevel('national');
      return;
    }

    // 省级钻取与旅游路线是两种互斥的浏览模式：路线图层、站点时间轴、海拔剖面
    // 会与省级聚焦的县点/省界互相遮挡（实际反馈：开了路线再点省份，路线内容不消失）。
    // 因此只要选中省份就退出路线模式；关闭 tourOn 后由下方 tourOn 副作用统一清状态，
    // 避免在两处各写一遍清理逻辑导致漂移。
    // keepTourViewRef：标记"这次退出是点省份引起的"，关闭时保留相机，交给下面的聚焦接管。
    if (tourOn) {
      keepTourViewRef.current = true;
      setTourOn(false);
    }

    // 重复点击同一省份：仅重新居中，不重复加载
    if (focusedRef.current?.adcode === pick.adcode) {
      viewer.focusProvince(pick.adcode);
      return;
    }

    focusedRef.current = pick;
    setFocused(pick);
    setCityCount(0);

    // 1) 立即启动聚焦动画（点击响应同步完成，远小于 100ms）
    viewer.focusProvince(pick.adcode);
    applyProvinceFocus(String(pick.adcode), viewer);

    // 2) 异步加载该省下级区划（城市/区县），并做淡入过渡
    const reqId = ++focusReqRef.current;
    setCityLoading(true);
    try {
      const res = await fetch(assetPath(`map/province/${pick.adcode}_full.json`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fc = (await res.json()) as GeoFeatureCollection;
      if (reqId !== focusReqRef.current) return; // 已切换到其他省份，丢弃
      viewer.setCityFeatures(fc);
      setCityCount(fc.features?.length ?? 0);
    } catch (err) {
      if (reqId !== focusReqRef.current) return;
      console.warn('[TerrainRelief3D] 下级区划加载失败:', err);
      viewer.setCityFeatures(null);
      setCityCount(0);
    } finally {
      if (reqId === focusReqRef.current) setCityLoading(false);
    }
  }, [applyProvinceFocus, clearProvincePois, tourOn]);

  // 保持回调引用最新（初始化 effect 只创建一次查看器）
  useEffect(() => {
    pickHandlerRef.current = (pick) => {
      void onProvincePick(pick);
    };
  }, [onProvincePick]);

  /* ---------------- 初始化：加载高程数据 → 创建查看器 → 载入省级边界 ---------------- */
  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        setStatus('loading');
        const hm = await loadHeightmap(HEIGHTMAP_BASE);
        if (disposed || !hostRef.current) return;
        heightmapRef.current = hm;

        viewerRef.current = createTerrainViewer({
          container: hostRef.current,
          heightmap: hm,
          reliefRatio: reliefPercent / 100,
          segments,
          wireframe,
          onStats: setStats,
          onProvinceClick: (pick) => pickHandlerRef.current(pick),
          onPoiSelect: (item) => poiHandlerRef.current(item),
          onTourNodeClick: (node) => tourHandlerRef.current(node),
          // 用户把相机拉远到离开路线区域：自动退出路线，但保留当前镜头
          onTourAutoExit: () => {
            keepTourViewRef.current = true;
            setTourOn(false);
          },
          // 相机方位 → 指北针罗盘环（直接写 transform，避免每帧触发 React 重渲染）
          onCameraChange: (bearing) => {
            const el = compassRef.current;
            if (el) el.style.transform = `rotate(${(180 - bearing).toFixed(1)}deg)`;
          },
        });
        // 应用持久化的「名称显示」开关（查看器内部会记住该状态，等边界数据到达后生效）
        viewerRef.current.setProvinceLabelsVisible(showProvinceNames);
        // 与 2D 对齐的业务层：瑶族省配色语义 + 省份统计
        viewerRef.current.setYaoProvinceAdcodes(YAO_PROVINCE_ADCODES);
        viewerRef.current.setProvinceStats(PROVINCE_STATS);
        // 草药点位只做"分省缓存"，默认不显示；点击某省时才由 applyProvinceFocus 放出该省点位
        const herbPois = buildHerbPoisByProvince();
        herbByIdRef.current = herbPois.byId;
        herbByProvinceRef.current = herbPois.byProvince;
        setStatus('ready');

        // 省级边界只是叠加装饰层：单独兜底。此前它与地形共用一个 try/catch，
        // 一旦这个请求失败（网络抖动 / 404 / 非 JSON 响应），就会把已就绪的地形
        // 整体翻成 error 遮罩，同时 viewer 继续空跑渲染循环。
        try {
          const resp = await fetch(PROVINCE_URL);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const fc = (await resp.json()) as GeoFeatureCollection;
          if (disposed || !viewerRef.current) return;
          const features = (fc.features ?? []).filter(
            (f) => String(f.properties?.adcode) !== JD_ADCODE,
          );
          viewerRef.current.setProvinceFeatures({ type: 'FeatureCollection', features });
        } catch (boundaryErr) {
          if (disposed) return;
          console.warn('[TerrainRelief3D] 省级边界加载失败（地形仍可用）:', boundaryErr);
        }
      } catch (err) {
        if (disposed) return;
        console.error('[TerrainRelief3D] 初始化失败:', err);
        // 若失败发生在 viewer 创建之后，必须立刻释放：否则错误遮罩之下
        // requestAnimationFrame 渲染循环仍在运行，白白占用 GPU/CPU。
        viewerRef.current?.dispose();
        viewerRef.current = null;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      focusReqRef.current += 1;
      viewerRef.current?.dispose();
      viewerRef.current = null;
      heightmapRef.current = null;
    };
    // 仅首次挂载时创建；后续参数变化通过下方 effect 增量更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- 参数增量更新（避免重建整个场景） ---------------- */
  useEffect(() => {
    viewerRef.current?.setReliefRatio(reliefPercent / 100);
  }, [reliefPercent]);

  useEffect(() => {
    viewerRef.current?.setSegments(segments);
  }, [segments]);

  useEffect(() => {
    viewerRef.current?.setWireframe(wireframe);
  }, [wireframe]);

  useEffect(() => {
    viewerRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  // 省份名称开关：实时生效（查看器内部只负责渲染，开关状态由这里持有并持久化）
  useEffect(() => {
    viewerRef.current?.setProvinceLabelsVisible(showProvinceNames);
  }, [showProvinceNames]);

  // 聚焦 LOD 状态由查看器的周期统计上报（stats.globalSegments / patchSegX），
  // 因此无需单独轮询；面板每次收到 onStats 就会展示最新的细节等级。

  /**
   * 把各 UI 面板的**尺寸 + 锚点**上报给查看器，名称标注统一避让这些区域，
   * 从而杜绝"地名文字溢出/压在控制台区域上"的问题。
   *
   * 只上报尺寸而不上报绝对坐标：面板都贴着容器某个角/边定位，查看器会用**当前**画布尺寸
   * 实时换算出绝对矩形，因此窗口缩放、浏览器缩放、面板展开/收起都不会出现"预留区陈旧"。
   */
  const pushReservedRects = useCallback(() => {
    const specs: Array<{ el: HTMLDivElement | null; corner: 'tl' | 'tr' | 'bl' | 'br' | 'tc'; inset: number }> = [
      { el: consoleRef.current, corner: 'tr', inset: 12 }, // 右上：地形浮雕控制台
      { el: sourceRef.current, corner: 'br', inset: 12 }, // 右下：数据来源
      { el: chipRef.current, corner: 'tc', inset: 12 }, // 顶部居中：加载过渡提示
      { el: zoomRef.current, corner: 'tl', inset: 12 }, // 左上：缩放控件
    ];
    const rects: Array<{ corner: 'tl' | 'tr' | 'bl' | 'br' | 'tc'; w: number; h: number; inset: number }> = [];
    for (const spec of specs) {
      if (!spec.el) continue;
      const r = spec.el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      rects.push({ corner: spec.corner, w: r.width, h: r.height, inset: spec.inset });
    }
    viewerRef.current?.setReservedRects(rects);
  }, []);

  // 面板显隐/尺寸变化、聚焦状态变化（面板内容增减）、加载提示出现时都要重新测量
  useEffect(() => {
    pushReservedRects();
  }, [pushReservedRects, status, consoleOpen, focused, cityLoading]);

  // 窗口尺寸 / 容器尺寸变化时重新测量（覆盖浏览器缩放、窗口拖拽等场景）
  useEffect(() => {
    if (status !== 'ready') return;
    const ro = new ResizeObserver(() => pushReservedRects());
    if (rootRef.current) ro.observe(rootRef.current);
    window.addEventListener('resize', pushReservedRects);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', pushReservedRects);
    };
  }, [status, pushReservedRects]);

  const handlePreset = useCallback((key: ViewPresetName) => {
    setPreset(key);
    viewerRef.current?.applyPreset(key);
  }, []);

  /** 返回全国：清除聚焦省份、下级区划与草药/瑶族县点位，并回到默认鸟瞰 */
  const handleReset = useCallback(() => {
    focusReqRef.current += 1;
    setAutoRotate(false);
    viewerRef.current?.setAutoRotate(false);
    viewerRef.current?.setCityFeatures(null);
    if (viewerRef.current) clearProvincePois(viewerRef.current);
    viewerRef.current?.resetView();
    focusedRef.current = null;
    setFocused(null);
    setCityCount(0);
    setCityLoading(false);
    setPreset('overview');
    useMapStore.getState().setViewLevel('national');
  }, [clearProvincePois]);

  /**
   * 旅游路线开关：交给 viewer 负责展示与相机适配。
   * 开启时先"返回全国"（清掉省级钻取、下级区划与草药/瑶族县点位），
   * 否则县级药丸/草药点会与路线节点同名叠在一起，画面非常拥挤。
   */
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    if (tourOn) {
      handleReset();
      // 进入路线时自动收起控制台：路线自带顶栏工具条 + 底部时间轴，
      // 面板常开会压住右侧站点徽标（实际反馈的拥挤问题）。
      setConsoleOpen(false);
      // 进入路线：先展示封面（与原视频"进入课堂"一致），标记/相机在其后完成取景
      setAutoTour(false);
      setStageOpen(false);
      setHelpOpen(false);
      // 默认当前站 = 第 1 站（时间轴/剖面从一开始就有明确的定位点）
      setTourFocus(TOUR_NODES[0].id);
      v.setTourActiveNode(TOUR_NODES[0].id);
    } else {
      // 关闭路线时一并收起全部路线 UI，避免面板/封面残留
      cancelPanelTimer(); // 面板若还在延迟挂载，必须取消，否则会"关掉后又弹出来"
      setTourNode(null);
      setStageOpen(false);
      setHelpOpen(false);
      setAutoTour(false);
      setTourFocus(null);
      v.setTourActiveNode(null);
    }
    // 因"点省份"退出路线时保留相机（keepView=true），让省份聚焦镜头不被重置
    const keepView = !tourOn && keepTourViewRef.current;
    keepTourViewRef.current = false;
    v.setTourVisible(tourOn, keepView);
  }, [tourOn, handleReset, setTourFocus, setConsoleOpen, cancelPanelTimer]);

  /** 点击控制台以外的区域自动收起（仅在展开时挂监听，避免常驻全局指针处理） */
  useEffect(() => {
    if (!consoleOpen) return;
    const onDown = (e: PointerEvent) => {
      const el = consoleRef.current;
      const target = e.target as Node | null;
      if (!el || !target || el.contains(target)) return;
      setConsoleOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [consoleOpen, setConsoleOpen]);

  /**
   * 沿线海拔剖面：仅在路线开启且高程图就绪后计算一次。
   * 使用与浮雕同一套墨卡托投影 + 同一套 Catmull-Rom 路线，确保剖面与地图丝带同源。
   */
  const tourProfile = useMemo(() => {
    if (!tourOn || status !== 'ready') return null;
    const hm = heightmapRef.current;
    if (!hm) return null;
    const [west, south, east, north] = hm.meta.bounds;
    const projection = createProjection(
      { west, south, east, north },
      100,
      100 / hm.meta.aspect,
    );
    return buildRouteProfile(hm, projection);
  }, [tourOn, status]);

  /* ---------------- 图例（高程色带） ---------------- */
  // 注意：heightmapRef.current 是异步加载完成后才被赋值的 ref，
  // 因此必须把 status 计入依赖，才能在 status 变为 'ready' 后重建图例、
  // 读到真实的 meta（最大/最小高程与数据来源）。这属于"有意为之"的依赖，
  // 而非遗漏，故显式读取一次 status 以让 eslint 静态可见。
  const legend = useMemo(() => {
    void status; // 显式声明依赖：status 变化 → heightmapRef 可能已就绪 → 需重建图例
    const stops = paletteLegend();
    const gradient = stops
      .map((s, i) => `${s.css} ${((i / (stops.length - 1)) * 100).toFixed(1)}%`)
      .join(', ');
    const meta = heightmapRef.current?.meta;
    return {
      gradient: `linear-gradient(to top, ${SEA_COLOR_CSS} 0%, ${gradient})`,
      max: meta?.maxElevation ?? 8849,
      min: meta?.minElevation ?? 0,
      source: meta?.source ?? 'AWS Terrain Tiles (Mapzen) / SRTM+ASTER',
    };
  }, [status]); // 状态变化后重建，确保读到已加载的 meta

  /** 省域配色图例：色值与省界实现同源（boundaryOverlay 内计算），避免图例与线条漂移 */
  const provinceLegend = useMemo(() => provinceColorLegend(), []);

  const meta = status === 'ready' ? heightmapRef.current?.meta : undefined;

  /** 旅游路线节点的前后导航（按展示序号，跨三条主题线连续浏览） */
  const tourIndex = tourNode ? TOUR_NODES.findIndex((n) => n.id === tourNode.id) : -1;
  const prevTour = tourIndex > 0 ? TOUR_NODES[tourIndex - 1] : null;
  const nextTour =
    tourIndex >= 0 && tourIndex < TOUR_NODES.length - 1 ? TOUR_NODES[tourIndex + 1] : null;

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', background: '#e9eef2', overflow: 'hidden' }}
    >
      {/* Three.js 画布 + CSS2D 标注挂载点 */}
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />

      {/* 路线模式动画（封面 / 全屏阅读的入场） */}
      <style>{`
@keyframes tr-stage-in{from{opacity:0;transform:scale(1.012)}to{opacity:1;transform:none}}
`}</style>

      {/* ---------------- 路线模式外框：顶栏工具条 + 指北针 + 底部时间轴 + 海拔剖面 ---------------- */}
      {tourOn && status === 'ready' && (
        <>
          {/* 窄屏详情为底部抽屉，会盖住左侧工具轨与指北针：抽屉打开时收起，避免悬浮叠压 */}
          {!(narrow && tourNode) && (
            <>
              <TourToolbar
                auto={autoTour}
                profile={profileOn}
                fullscreen={fullscreen}
                compact={narrow}
                onToggleAuto={() => setAutoTour((v) => !v)}
                onToggleProfile={() => setProfileOn((v) => !v)}
                onOverview={closeTourNode}
                onToggleFullscreen={toggleFullscreen}
                onToggleHelp={() => setHelpOpen(true)}
              />
              <TourCompass roseRef={compassRef} onReset={closeTourNode} />
            </>
          )}
          {!tourNode && (
            <TourTimeline
              nodes={TOUR_NODES}
              activeId={tourFocusId}
              compact={narrow}
              onSelect={openTourNode}
            />
          )}
          {!tourNode && profileOn && tourProfile && (
            <ElevationProfile
              profile={tourProfile}
              activeId={tourFocusId}
              nodes={TOUR_NODES}
              compact={narrow}
              onSelect={openTourNode}
            />
          )}
        </>
      )}


      {/* ---------------- 单站全屏阅读场景 ---------------- */}
      {tourOn && tourNode && stageOpen && (
        <TourStage
          node={tourNode}
          index={tourIndex}
          total={TOUR_NODES.length}
          compact={narrow}
          hasPrev={!!prevTour}
          hasNext={!!nextTour}
          onClose={() => setStageOpen(false)}
          onPrev={() => prevTour && openTourNode(prevTour, { keepStage: true })}
          onNext={() => nextTour && openTourNode(nextTour, { keepStage: true })}
        />
      )}

      {/* ---------------- 操作帮助 ---------------- */}
      {tourOn && helpOpen && <TourHelp onClose={() => setHelpOpen(false)} />}


      {/* ---------------- 左上：缩放控件（对齐 2D 地图的 Leaflet 缩放控件） ---------------- */}
      {status === 'ready' && (
        <div
          ref={zoomRef}
          style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 900 }}
        >
          <button type="button" title="放大" aria-label="放大" style={zoomBtnStyle} onClick={() => viewerRef.current?.zoomBy(1 / 1.4)}>
            ＋
          </button>
          <button type="button" title="缩小" aria-label="缩小" style={zoomBtnStyle} onClick={() => viewerRef.current?.zoomBy(1.4)}>
            －
          </button>
          {/*
            旅游地图入口：原来放在控制台的「旅游路线」分区里，需要在面板里翻找；
            挪到缩放控件正下方后成为常驻入口，且不受控制台展开/收起影响。
            role=switch + aria-checked 保持"开关"语义，方便读屏与自动化断言。
          */}
          <button
            type="button"
            role="switch"
            aria-checked={tourOn}
            aria-label="旅游路线"
            title={tourOn ? '关闭旅游路线，返回全国总览' : '进入瑶医旅游地图（三条主题线路）'}
            onClick={() => setTourOn((v) => !v)}
            style={{
              ...zoomBtnStyle,
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...(tourOn
                ? {
                    background: 'linear-gradient(135deg, #2f8f4e 0%, #1f6b3a 100%)',
                    borderColor: 'rgba(31,107,58,0.92)',
                    color: '#ffffff',
                  }
                : null),
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {/* 定位针：30px 按钮里 18px 仍清晰可辨，语义是"进入地图/去某个地方" */}
              <path d="M12 21.5s6.8-5.6 6.8-11.1a6.8 6.8 0 1 0-13.6 0C5.2 15.9 12 21.5 12 21.5Z" />
              <circle cx="12" cy="10.2" r="2.5" />
            </svg>
          </button>
        </div>
      )}

      {/* ---------------- 左下：聚焦省份速览 ----------------
          省内视图点位天然稀疏（一个省通常只有 3~7 个瑶族县），
          用一块常驻信息卡把"县数 / 机构数 / 品种数"补上，避免画面显得空。 */}
      {focused && status === 'ready' && (() => {
        const st = PROVINCE_STATS.get(String(focused.adcode).substring(0, 2));
        const numStyle: React.CSSProperties = { color: '#2f6b7a', fontSize: 12.5, fontWeight: 800 };
        return (
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              zIndex: 950,
              pointerEvents: 'none',
              borderRadius: 12,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.94)',
              border: '1px solid rgba(74,124,58,0.22)',
              boxShadow: '0 6px 22px rgba(24,40,28,0.16)',
              backdropFilter: 'blur(6px)',
              minWidth: 170,
            }}
            aria-label={`${focused.name} 速览`}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1f3d17', lineHeight: 1.3 }}>
              {focused.name}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, fontSize: 10.5, color: '#5a6b5f' }}>
              <span>
                <b style={numStyle}>{st?.countyCount ?? 0}</b> 瑶族县
              </span>
              <span>
                <b style={numStyle}>{st?.institutions ?? 0}</b> 机构
              </span>
              <span>
                <b style={numStyle}>{st?.herbs ?? 0}</b> 味药
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: '#8a9a90' }}>
              县名后的数字＝该县瑶医机构数
            </div>
          </div>
        );
      })()}

      {/* ---------------- 右上：控制面板（分区折叠 + 密度切换 + 本地记忆） ---------------- */}
      <div
        ref={consoleRef}
        style={{
          ...cardStyle,
          position: 'absolute',
          // 下移让开右上角的「2D 地图 / 地形浮雕」模式切换器（zIndex 1000）：
          // 面板自身 zIndex 更高，若仍贴在 top:12 会把切换器压在下面、露出半个按钮。
          top: 52,
          right: 12,
          // 必须显式指定层级：地图叠加层（站点序号徽标、缩放控件 zIndex 900）原先会盖住面板
          zIndex: 1100,
          boxSizing: 'border-box',
          width: consoleOpen ? Math.min(dz.width, narrow ? 252 : dz.width) : undefined,
          maxWidth: 'min(320px, calc(100% - 24px))',
          padding: consoleOpen ? dz.pad : '7px 9px',
          // 高度取三者的最小值：面板自身不超过视口 / 不超过父容器 / 不小于可用下限
          maxHeight: panelMaxH
            ? `min(${panelMaxH}px, ${tourOn ? 'calc(100% - 112px)' : 'calc(100% - 24px)'})`
            : tourOn
              ? 'calc(100% - 112px)'
              : 'calc(100% - 24px)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#2d4a22', flex: '1 1 auto', lineHeight: 1.3 }}>
            地形浮雕控制台
          </span>
          <button
            onClick={() => setConsoleOpen(!consoleOpen)}
            title={consoleOpen ? '收起面板' : '展开面板'}
            style={{ ...btnBase, padding: '1px 7px', fontSize: 11 }}
          >
            {consoleOpen ? '收起 ▴' : '展开 ▾'}
          </button>
        </div>

        {consoleOpen && (
          <>
            {/* 副标题行：当前范围 + 密度切换（紧凑 / 宽松） */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: dz.gap }}>
              <span
                style={{
                  fontSize: dz.hint,
                  color: '#3f5546',
                  background: '#eef3ec',
                  border: '1px solid #dbe4dc',
                  borderRadius: 999,
                  padding: '1px 8px',
                  whiteSpace: 'nowrap',
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {focused ? shortProvinceName(focused.name).replace(/(省|市)$/, '') : '全国'}
              </span>
              <span style={{ flex: '1 1 auto' }} />
              <button
                type="button"
                onClick={() => setDensity(density === 'compact' ? 'relaxed' : 'compact')}
                title="切换面板疏密：紧凑（更多内容）/ 宽松（更大留白）"
                aria-label="切换面板疏密"
                style={{ ...btnBase, padding: '1px 7px', fontSize: dz.hint }}
              >
                {density === 'compact' ? '紧凑' : '宽松'}
              </button>
            </div>

            {/* ============ 视角（高频，默认展开） ============ */}
            <div style={{ marginTop: dz.section }}>
              <PanelSection
                title="视角"
                badge={focused ? '已聚焦' : undefined}
                open={!!openSections.view}
                onToggle={() => toggleSection('view')}
                first
                density={density}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {PRESET_LABELS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => handlePreset(p.key)}
                      aria-pressed={preset === p.key}
                      style={{
                        ...btnBase,
                        padding: dz.btnPad,
                        fontSize: dz.btn,
                        textAlign: 'center',
                        borderColor: preset === p.key ? '#4a7c3a' : '#cbd5cf',
                        background: preset === p.key ? '#e8f2e2' : '#fff',
                        fontWeight: preset === p.key ? 700 : 400,
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleReset}
                  style={{ ...btnBase, width: '100%', marginTop: dz.gap, padding: dz.btnPad, fontSize: dz.btn }}
                >
                  {focused ? '返回全国总览' : '重置视角'}
                </button>
              </PanelSection>
            </div>

            {/* ============ 地形（高频，默认展开） ============ */}
            <PanelSection
              title="地形"
              open={!!openSections.terrain}
              onToggle={() => toggleSection('terrain')}
              density={density}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: dz.label, color: '#5a6b5f', flex: '1 1 auto' }}>高度缩放</span>
                <b style={{ fontSize: dz.label, color: '#2d4a22' }}>{reliefPercent}%</b>
              </div>
              <input
                type="range"
                min={1}
                max={16}
                step={1}
                value={reliefPercent}
                aria-label="地形高度缩放百分比"
                title="最高峰高度 / 模型宽度"
                onChange={(e) => setReliefPercent(Number(e.target.value))}
                style={{ width: '100%', margin: '6px 0 0', accentColor: '#4a7c3a' }}
              />
              <div style={{ fontSize: dz.hint, color: '#8a9a90', marginTop: 3 }}>
                {reliefPercent}% · 最高峰高度 / 模型宽度
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: dz.gap }}>
                <span style={{ fontSize: dz.label, color: '#5a6b5f', flex: '1 1 auto' }}>网格精度</span>
                <select
                  value={segments}
                  aria-label="网格精度"
                  onChange={(e) => setSegments(Number(e.target.value))}
                  style={{ ...btnBase, padding: '4px 6px', fontSize: dz.btn, maxWidth: 132 }}
                >
                  {SEGMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </PanelSection>

            {/* ============ 路线图例（开关已移到缩放控件下方，这里只保留开启后的图例/摘要） ============ */}
            {tourOn && (
            <PanelSection
              title="路线图例"
              badge={`${TOUR_NODES.length} 站`}
              open={!!openSections.tour}
              onToggle={() => toggleSection('tour')}
              density={density}
            >
              {tourOn && (
                <div style={{ marginTop: dz.gap, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* 路线摘要：一行显示名称与站数，超长省略，避免把面板撑宽 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: dz.hint }}>
                    <span
                      style={{
                        width: 16,
                        height: 4,
                        borderRadius: 2,
                        background: TOUR_ROUTES[0].color,
                        flex: '0 0 auto',
                      }}
                    />
                    <span
                      style={{
                        color: '#2d4a22',
                        fontWeight: 600,
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {TOUR_ROUTES[0].name}
                    </span>
                    <span style={{ color: '#8a9a90', flex: '0 0 auto' }}>{TOUR_NODES.length} 站</span>
                  </div>
                  {/* 类别图例：默认收起，避免面板被小字撑高 */}
                  <button
                    type="button"
                    onClick={() => setTourLegendOpen((v) => !v)}
                    aria-expanded={tourLegendOpen}
                    style={{
                      ...btnBase,
                      alignSelf: 'flex-start',
                      padding: '2px 8px',
                      fontSize: dz.hint,
                      borderStyle: 'dashed',
                    }}
                  >
                    {tourLegendOpen ? '隐藏类别图例 ▴' : '类别图例 ▾'}
                  </button>
                  {tourLegendOpen && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: dz.hint }}>
                      {(['red', 'scenic', 'yao', 'hub'] as const).map((c) => (
                        <span
                          key={c}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#5a6b5f', minWidth: 0 }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: CATEGORY_COLORS[c],
                              display: 'inline-block',
                              flex: '0 0 auto',
                            }}
                          />
                          {CATEGORY_LABELS[c]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </PanelSection>
            )}

            {/* ============ 图例（原左下浮动面板并入此处，默认收起） ============ */}
            <PanelSection
              title="图例"
              open={!!openSections.legend}
              onToggle={() => toggleSection('legend')}
              density={density}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <div
                  style={{
                    width: 12,
                    height: 96,
                    borderRadius: 3,
                    background: legend.gradient,
                    border: '1px solid #cdd8d0',
                    flex: '0 0 auto',
                  }}
                />
                <div style={{ fontSize: dz.hint, color: '#5a6b5f', lineHeight: dz.line, flex: '1 1 auto', minWidth: 0 }}>
                  <div style={{ color: '#2d4a22', fontWeight: 700 }}>高程分层设色</div>
                  <div>{legend.max} m 雪线以上</div>
                  <div>4800 m</div>
                  <div>2200 m</div>
                  <div>200 m 低地</div>
                  <div style={{ color: '#3f6f9c' }}>海面 0 m</div>
                </div>
              </div>
              {/* 省域配色：与省界线条同源（粗细 + 色相共同承载"有无瑶族数据"） */}
              <div
                style={{
                  marginTop: dz.gap,
                  paddingTop: 6,
                  borderTop: '1px dashed #d9e2da',
                  fontSize: dz.hint,
                  color: '#5a6b5f',
                  lineHeight: dz.line,
                }}
              >
                <div style={{ color: '#2d4a22', fontWeight: 700, marginBottom: 2 }}>省域配色</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 22,
                      height: 4,
                      borderRadius: 2,
                      background: provinceLegend.yao,
                      flex: '0 0 auto',
                    }}
                  />
                  <span>有瑶族数据</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 22,
                      height: 2,
                      borderRadius: 1,
                      background: provinceLegend.neutral,
                      flex: '0 0 auto',
                    }}
                  />
                  <span style={{ color: '#8a9a90' }}>暂无数据</span>
                </div>
              </div>
            </PanelSection>

            {/* ============ 显示（低频，默认收起） ============ */}
            <PanelSection
              title="显示"
              badge={showProvinceNames ? '名称开' : '名称关'}
              open={!!openSections.display}
              onToggle={() => toggleSection('display')}
              density={density}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: dz.gap }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: dz.label, color: '#5a6b5f', flex: '1 1 auto', lineHeight: dz.line }}>
                    名称显示
                    <span style={{ color: '#8a9a90' }}>（省份 / 城市）</span>
                  </span>
                  <ToggleSwitch
                    checked={showProvinceNames}
                    onChange={setShowProvinceNames}
                    label="名称显示（省份 / 城市）"
                    title={showProvinceNames ? '关闭后隐藏地图上的名称标注' : '开启后显示地图上的名称标注'}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: dz.label, color: '#5a6b5f', flex: '1 1 auto', lineHeight: dz.line }}>
                    药田晕染
                    <span style={{ color: '#8a9a90' }}>（县级聚集度）</span>
                  </span>
                  <ToggleSwitch
                    checked={tintOn}
                    onChange={setTintOn}
                    label="药田晕染（县级瑶医聚集度）"
                    title={
                      tintOn
                        ? '关闭后恢复纯高程配色'
                        : '在地表叠一层淡色场：越明显表示该县瑶医机构越多'
                    }
                  />
                </div>
                {tintOn && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10.5,
                      lineHeight: 1.5,
                      color: '#6b7a70',
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 8,
                        borderRadius: 4,
                        flex: '0 0 auto',
                        background: 'linear-gradient(90deg, #6f8f5a 0%, #f3f0c8 100%)',
                        border: '1px solid #d7ded8',
                      }}
                    />
                    <span>
                      越亮 = 该县瑶医机构越多；省名后数字（如「广西 ·24」）为该省机构总数
                      {!showProvinceNames && '（需先开启上方「名称显示」）'}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setAutoRotate((v) => !v)}
                    aria-pressed={autoRotate}
                    style={{
                      ...btnBase,
                      flex: '1 1 auto',
                      padding: dz.btnPad,
                      fontSize: dz.btn,
                      borderColor: autoRotate ? '#4a7c3a' : '#cbd5cf',
                      background: autoRotate ? '#e8f2e2' : '#fff',
                      fontWeight: autoRotate ? 700 : 400,
                    }}
                  >
                    {autoRotate ? '停止旋转' : '自动旋转'}
                  </button>
                  <button
                    onClick={() => setWireframe((v) => !v)}
                    aria-pressed={wireframe}
                    style={{
                      ...btnBase,
                      flex: '1 1 auto',
                      padding: dz.btnPad,
                      fontSize: dz.btn,
                      borderColor: wireframe ? '#4a7c3a' : '#cbd5cf',
                      background: wireframe ? '#e8f2e2' : '#fff',
                    }}
                  >
                    {wireframe ? '实心着色' : '线框'}
                  </button>
                </div>
              </div>
            </PanelSection>

            {/* ============ 统计与提示（低频，默认收起） ============ */}
            <PanelSection
              title="统计与提示"
              badge={`${stats.fps || '—'} FPS`}
              open={!!openSections.stats}
              onToggle={() => toggleSection('stats')}
              density={density}
            >
              <div style={{ fontSize: dz.hint, color: '#5a6b5f', lineHeight: dz.line }}>
                <div>
                  三角面：<b style={{ color: '#2d4a22' }}>{(stats.triangles || 0).toLocaleString()}</b>
                  <span style={{ marginLeft: 8 }}>
                    FPS：<b style={{ color: stats.fps >= 50 ? '#2d4a22' : '#b26a1f' }}>{stats.fps || '—'}</b>
                  </span>
                </div>
                {meta && (
                  <div>
                    高程：{meta.minElevation} – {meta.maxElevation} m · 网格 {meta.width}×{meta.height}
                  </div>
                )}
                <div>
                  细节等级：
                  <b style={{ color: '#2d4a22' }}>
                    {stats.patchSegX
                      ? `局部补片 ${stats.patchSegX}×${stats.patchSegY} · 其余 ${stats.globalSegments} 段`
                      : `全局 ${stats.globalSegments} 段`}
                  </b>
                </div>
                {focused && (
                  <div>
                    下级区划：
                    <b style={{ color: '#2d4a22' }}>{cityLoading ? '加载中…' : `${cityCount} 个`}</b>
                  </div>
                )}
                <div style={{ marginTop: 4 }}>左键拖拽旋转 · 滚轮缩放 · 右键平移</div>
                <div style={{ color: '#7a8b80' }}>点击省份可聚焦，并显示该省的瑶族县与草药点位</div>
              </div>
            </PanelSection>
        </>
        )}
      </div>

      {/* ---------------- 顶部：下级区划加载过渡提示 ---------------- */}
      {cityLoading && (
        <div
          ref={chipRef}
          style={{
            ...cardStyle,
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '5px 12px',
            fontSize: 12,
            color: '#2d4a22',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              border: '2px solid rgba(74,124,58,0.28)',
              borderTopColor: '#4a7c3a',
              display: 'inline-block',
              animation: 'yao-spin 0.7s linear infinite',
            }}
          />
          正在加载 {focused ? shortProvinceName(focused.name) : ''} 下级区划…
        </div>
      )}


      {/* ---------------- 右下：数据来源 ---------------- */}
      {status === 'ready' && !tourOn && (
        <div
          ref={sourceRef}
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            fontSize: 11,
            color: '#5c6b62',
            background: 'rgba(255,255,255,0.85)',
            padding: '3px 8px',
            borderRadius: 5,
          }}
        >
          地形数据 © {legend.source} · CC-BY 4.0
        </div>
      )}

      {/* ---------------- 加载 / 错误遮罩 ---------------- */}
      {status !== 'ready' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 10,
            background: 'rgba(233,238,242,0.92)',
            color: '#3c5346',
            fontSize: 14,
          }}
        >
          {status === 'loading' ? (
            <>
              <div style={{ fontWeight: 700 }}>正在加载中国地形高程数据…</div>
              <div style={{ fontSize: 12, color: '#6b7d70' }}>解码 Terrarium 高程图并构建三维网格</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, color: '#a33' }}>地形浮雕初始化失败</div>
              <div style={{ fontSize: 12, color: '#6b7d70', maxWidth: 420, textAlign: 'center' }}>{errorMsg}</div>
            </>
          )}
        </div>
      )}

      {/* ---------------- 路线节点详情：宽屏右侧抽屉 / 窄屏底部抽屉 ---------------- */}
      {tourOn && tourNode && !stageOpen && (
        <>
          <style>{`
@keyframes tr-panel-in{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
@keyframes tr-backdrop-in{from{opacity:0}to{opacity:1}}
@keyframes tr-sheet-in{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
`}</style>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1200,
              display: 'flex',
              alignItems: narrow ? 'flex-end' : 'stretch',
              justifyContent: narrow ? 'center' : 'flex-end',
            }}
          >
            {/* 点击面板外部：关闭面板并恢复节点与地图的初始状态 */}
            <div
              aria-hidden="true"
              onClick={closeTourNode}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(12, 20, 16, 0.30)',
                animation: 'tr-backdrop-in 200ms ease-out',
              }}
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-label={tourNode.name}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                width: narrow ? '100%' : 'min(380px, 42%)',
                maxHeight: narrow ? '68%' : '100%',
                background: '#fffdf8',
                borderRadius: narrow ? '14px 14px 0 0' : '14px 0 0 14px',
                borderTop: narrow ? '1px solid rgba(74,124,58,0.18)' : 'none',
                borderLeft: narrow ? 'none' : '1px solid rgba(74,124,58,0.18)',
                boxShadow: narrow
                  ? '0 -14px 38px rgba(0,0,0,0.28)'
                  : '-14px 0 38px rgba(0,0,0,0.26)',
                animation: narrow
                  ? 'tr-sheet-in 300ms cubic-bezier(.22,.8,.3,1)'
                  : 'tr-panel-in 300ms cubic-bezier(.22,.8,.3,1)',
                overflow: 'hidden',
              }}
            >
              {/* 头部：类别 + 序号 + 关闭 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderBottom: '1px solid #eef1ea',
                  flex: '0 0 auto',
                }}
              >
                <span
                  style={{
                    padding: '2px 9px',
                    borderRadius: 9999,
                    background: CATEGORY_COLORS[tourNode.category],
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {CATEGORY_LABELS[tourNode.category]}
                </span>
                <span style={{ fontSize: 11, color: '#7a8a80' }}>
                  第 {tourNode.order} 站 / 共 {TOUR_NODES.length} 站
                </span>
                <button
                  type="button"
                  aria-label="关闭详情"
                  onClick={closeTourNode}
                  style={{
                    marginLeft: 'auto',
                    width: 26,
                    height: 26,
                    padding: 0,
                    borderRadius: '50%',
                    border: '1px solid #dfe7da',
                    background: '#f4f7f1',
                    color: '#4a5a50',
                    fontSize: 15,
                    lineHeight: '24px',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              {/* 可滚动内容区（长文本在小屏也可完整查看） */}
              <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '12px 14px 8px' }}>
                {tourNode.image ? (
                  <figure style={{ margin: 0 }}>
                    <img
                      src={assetPath(tourNode.image)}
                      alt={tourNode.name}
                      loading="lazy"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: 'auto',
                        borderRadius: 10,
                        border: '1px solid #e2e9dd',
                      }}
                    />
                    <figcaption style={{ marginTop: 4, fontSize: 9.5, lineHeight: 1.45, color: '#9aa89f' }}>
                      图源 Wikimedia Commons
                      {tourNode.imageCredit?.author ? ` · ${tourNode.imageCredit.author}` : ''}
                      {tourNode.imageCredit?.license ? ` · ${tourNode.imageCredit.license}` : ''}
                    </figcaption>
                  </figure>
                ) : (
                  <TourPlaceholder label={tourNode.name} />
                )}
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 10.5,
                    letterSpacing: 0.5,
                    color: CATEGORY_COLORS[tourNode.category],
                    fontWeight: 700,
                  }}
                >
                  {tourNode.region} · {CATEGORY_LABELS[tourNode.category]}
                </div>
                <h3
                  style={{
                    margin: '4px 0 0',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#1f3d17',
                    lineHeight: 1.3,
                  }}
                >
                  {tourNode.name}
                </h3>
                <div style={{ marginTop: 3, fontSize: 11, color: '#7a8a80' }}>
                  {tourNode.subtitle}
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.8, color: '#3f4b43' }}>
                  {tourNode.intro}
                </p>
                <ul
                  style={{
                    margin: '10px 0 0',
                    paddingLeft: 18,
                    fontSize: 12,
                    lineHeight: 1.85,
                    color: '#4a5a50',
                  }}
                >
                  {tourNode.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>

                {/* 分维度详解：人文 / 红色基地 / 瑶医非遗（按节点实际有内容的维度渲染） */}
                {tourNode.sections.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {tourNode.sections.map((s) => (
                      <div key={s.title}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: '#6b4b1f',
                          }}
                        >
                          <span
                            style={{
                              width: 3,
                              height: 11,
                              borderRadius: 2,
                              background: '#d8b26a',
                              flex: '0 0 auto',
                            }}
                          />
                          {s.title}
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: 12, lineHeight: 1.8, color: '#4a5a50' }}>
                          {s.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ margin: '12px 0 6px', fontSize: 10, color: '#9aa89f' }}>
                  点击面板外侧或按 Esc 关闭；也可进入「全屏阅读」查看沉浸式图文
                </div>
              </div>

              {/* 全屏阅读入口：对应参考视频详情卡底部的「全屏阅读」按钮 */}
              <div style={{ padding: '0 14px 10px', flex: '0 0 auto' }}>
                <button
                  type="button"
                  onClick={() => setStageOpen(true)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #dfcba4',
                    background: 'linear-gradient(180deg, #fffaf0 0%, #f5ead4 100%)',
                    color: '#6b4b1f',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                  }}
                >
                  全屏阅读 · 沉浸式场景
                </button>
              </div>

              {/* 底部导航：固定，不随内容滚动 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderTop: '1px solid #eef1ea',
                  flex: '0 0 auto',
                }}
              >
                <button
                  type="button"
                  disabled={!prevTour}
                  onClick={() => prevTour && openTourNode(prevTour)}
                  style={{
                    ...btnBase,
                    opacity: prevTour ? 1 : 0.45,
                    cursor: prevTour ? 'pointer' : 'default',
                  }}
                >
                  上一站
                </button>
                <span
                  style={{ flex: '1 1 auto', textAlign: 'center', fontSize: 11, color: '#8a9a90' }}
                >
                  {tourNode.order} / {TOUR_NODES.length}
                </span>
                <button
                  type="button"
                  disabled={!nextTour}
                  onClick={() => nextTour && openTourNode(nextTour)}
                  style={{
                    ...btnBase,
                    opacity: nextTour ? 1 : 0.45,
                    cursor: nextTour ? 'pointer' : 'default',
                  }}
                >
                  下一站
                </button>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default TerrainRelief3D;
