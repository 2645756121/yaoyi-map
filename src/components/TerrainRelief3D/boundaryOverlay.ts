﻿/**
 * boundaryOverlay.ts —— 浮雕地图上的行政区划覆盖层
 *
 * 职责：
 *   1. 省级边界：每个省两条同源线段（外侧暗色描边 + 内层彩色主线），
 *      按省份分配不同色相 → 实现"不同省份的可视化区分"，描边保证与地形纹理不混淆；
 *   2. 交互样式：悬停加粗提亮、选中用高亮色并压暗其余省份（层级关系清晰）；
 *   3. 下级区划：聚焦某省后绘制其城市/区县边界与中文名称标注，并做淡入过渡；
 *   4. 点击命中：用与绘制**完全相同**的多边形数据做点在多边形内判定 → 热区与框选边界 100% 对应；
 *   5. 贴合地形：环先按渲染网格的单元尺寸加密，再逐顶点用与网格一致的高度函数取高程，
 *      使线条沿真实地形起伏（而不是折线跨过山脊）。
 *
 * 线宽说明：WebGL 原生 LineBasicMaterial.linewidth 在多数平台恒为 1px，
 *   故这里使用 three 的 LineSegments2 / LineMaterial（linewidth 以 CSS 像素为单位）。
 */

import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { pointInRing, type Projection } from './geoProjection';
import { pickHerbMarkerIcon } from '../../lib/herbMarkerIcons';

/* ------------------------------------------------------------------ 类型 */

export interface GeoFeature {
  type: 'Feature';
  properties: {
    adcode?: number | string;
    name?: string;
    /** [lon, lat]，数据自带，用于标注定位 */
    center?: [number, number];
    centroid?: [number, number];
    level?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  } | null;
}

export interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface ProvincePick {
  adcode: number;
  name: string;
}

export interface LonLatBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** 聚焦所需信息：视觉中心 + 用于相机适配的范围 + 原始外环（用于构建高精度补片/遮罩） */
export interface ProvinceFocusInfo {
  center: { lon: number; lat: number };
  bounds: LonLatBounds;
  /** 全部外环（经纬度，未加密的原始环） */
  rings: Array<Array<[number, number]>>;
}

export interface BoundaryOverlayOptions {
  scene: THREE.Scene;
  projection: Projection;
  /** 归一化地表高度（0~1）采样：必须与渲染网格使用同一算法，边界才能贴合地形 */
  sampleNormHeight: (u: number, v: number) => number;
  /** 当前起伏高度（世界单位）的读取器，随高度滑条变化 */
  getReliefHeight: () => number;
  /** 边界环加密步长（世界单位），建议取渲染网格单元尺寸 */
  densifyStep: number;
  /** 点位被点击时回调（草药 → 打开草药详情；瑶族县 → 打开县信息） */
  onPoiSelect?: (item: PoiItem) => void;
}

export interface BoundaryOverlay {
  setProvinces(fc: GeoFeatureCollection | null): void;
  setCities(fc: GeoFeatureCollection | null): void;
  setHover(adcode: number | null): void;
  setSelected(adcode: number | null): void;
  /** 起伏高度变化后重写所有边界顶点 Y 与标注高度 */
  refreshHeights(): void;
  /** 视口尺寸变化时更新线宽解析（LineMaterial.resolution） */
  setResolution(width: number, height: number): void;
  /** 每帧调用，推进淡入过渡；返回 true 表示画面需要重绘 */
  update(now: number): boolean;
  /** 视角距离分级：0=全国总览（线条更细更淡），1=贴近观察（常规强度）；返回是否发生变化 */
  setEmphasis(value: number): boolean;
  /** 省份名称常显开关（开关状态由外部持有并持久化，这里只负责渲染；同时控制下级区划名称） */
  setProvinceLabelsVisible(on: boolean): void;
  /** 省名后附省级统计数字（如「广西 ·24」），与药田晕染图层联动 */
  setProvinceStatLabels(on: boolean): void;
  /** 上报 UI 面板占用的矩形（画布坐标系像素）：名称标注一律不得落入这些区域 */
  setReservedRects(rects: ReservedRect[]): void;
  /** 相机/视口变化后重排全部名称标注（屏幕空间去重叠 + 避让 UI 面板）；返回是否需要重绘 */
  updateLabelLayout(camera: THREE.Camera): boolean;
  /** 命中测试：返回包含该经纬度的省份（无则 null） */
  hitTest(lon: number, lat: number): ProvincePick | null;
  /** 省份聚焦信息（视觉中心 + 适配范围） */
  provinceFocusInfo(adcode: number): ProvinceFocusInfo | null;
  /** 设置瑶族相关省（2 位 adcode）：决定配色语义（有数据=统一玫红强调，无数据=中性灰弱化） */
  setYaoProvinceAdcodes(adcodes: string[]): void;
  /** 设置各省统计（供悬停信息卡显示"瑶族相关县 / 机构数"，与 2D tooltip 对齐） */
  setProvinceStats(stats: Map<string, ProvinceStat>): void;
  /** 设置草药点位（对齐 2D 草药标记层） */
  setHerbPois(items: PoiItem[]): void;
  /** 设置瑶族县点位（聚焦某省时显示，对齐 2D 县级药丸标记） */
  setCountyPois(items: PoiItem[]): void;
  dispose(): void;
}

/* ------------------------------------------------------------------ 常量 */

/** 边界线相对地表的抬升量（世界单位），避免与地形表面 z-fighting */
const LINE_OFFSET = 0.34;
/**
 * 每省线条的微小高度错开（按要素索引循环取值）。
 * 相邻省份会各自绘制共享边界，两条线共面时逐像素深度相等 → LEQUAL 结果随机，
 * 视觉上表现为"花斑/虚线"。给每省一个确定的高度台阶即可让上层线稳定胜出，且台阶远小于视觉分辨率。
 */
const PROVINCE_Y_STEP = 0.02;
const PROVINCE_Y_CYCLE = 6;
/** 下级区划线整体再抬高一点，保证压在所有省界之上 */
const CITY_Y_OFFSET = 0.12;

/** 描边外壳相对主线的额外线宽（像素） */
const CASING_EXTRA = 1;
/** 描边外壳的不透明度系数（相对主线） */
const CASING_OPACITY = 0.85;
/** 描边色 = 本省主线色的暗化版（而不是近黑）：缺口处只呈现"同色略暗"，不会形成刺眼黑点 */
const CASING_DARKEN = 0.45;

/**
 * 省界线宽承担"有无瑶族数据"的业务语义（与配色同源）：
 *   有数据 → 明显加粗；无数据 → 细线主动让位。
 * 注意必须与 `OVERVIEW_OPACITY_SCALE` 的"接近不透明"配合：靠粗细而非透明做区分，
 * 否则半透明线在 LineSegments2 的逐段重叠处会出现明暗交替的"串珠/虚线"感。
 */
const PROVINCE_WIDTH_YAO = 1.6;
const PROVINCE_WIDTH_NEUTRAL = 0.75;
const PROVINCE_HOVER_WIDTH = 2.2;
const PROVINCE_SELECT_WIDTH = 2.6;
/** 聚焦时非选中省份的压暗透明度 */
const PROVINCE_DIM_OPACITY = 0.24;
/**
 * 全国总览时的线条弱化：整块模型尽收眼底时 34 省边界会争夺注意力，因此按相机距离分级。
 *
 * 注意这里刻意**不用低透明度**来实现"弱化"：LineSegments2 的每段是独立四边形，
 * 相邻段互相重叠，半透明线在重叠处会多叠加一次 alpha → 沿线出现明暗交替的"串珠/虚线"感。
 * 改为"细线 + 收敛的饱和度 + 接近不透明"，重叠叠加差异被压到看不出，线条变得干净均匀。
 */
const OVERVIEW_WIDTH_SCALE = 0.8;
const OVERVIEW_OPACITY_SCALE = 0.96;

const CITY_WIDTH = 1.2;
/** 下级区划同样用"接近不透明"避免线段重叠处的明暗不均 */
const CITY_OPACITY = 0.97;
const CITY_COLOR = new THREE.Color('#fff3d6');

const PROVINCE_FADE_MS = 340;
const CITY_FADE_MS = 280;

/** 常显省名标注：字号与估算内边距（用于屏幕空间去重叠） */
const AREA_LABEL_FONT = 11;
const AREA_LABEL_PAD_X = 4;
const AREA_LABEL_PAD_Y = 3;
/** 下级区划名称标注字号（次级信息，比省名小一档以拉开层级） */
const CITY_LABEL_FONT = 10;
/** 悬停/选中时显示的大号省名 */
const HOVER_LABEL_FONT = 13;
/** 标注之间的最小安全间距（px）：过小会"贴脸"，过大则大量标注被挤掉 */
const LABEL_GAP = 3;

/* CSS2DRenderer 的层叠次序（越大越靠上）：名称 < 草药点 < 县级药丸 < 悬停/选中信息卡 */
const POI_ORDER_HERB = 1;
const POI_ORDER_COUNTY = 2;
const ORDER_HOVER_LABEL = 3;

/**
 * 县级药丸在"文字占位"里的优先级。
 * 必须高于地级市名 —— 市名优先级是 2 + area/2000(≤0.9)，最大 2.9，
 * 原来药丸只有 2.5，于是省内视图里大地级市会把瑶族县挤掉（实测广东 5 个县只显出 1 个）。
 */
const PRIORITY_COUNTY_POI = 3.2;

/** 标注占位优先级（越大越先占位）：下级区划是聚焦后的主要信息，优先于省名 */
const PRIORITY_CITY_LABEL = 2;
const PRIORITY_PROVINCE_LABEL = 1;

/** 一个自动摆放的中文标注（省名或下级区划名） */
interface AutoLabel {
  label: CSS2DObject;
  /** 世界坐标，随地形起伏/相机变化更新 */
  world: THREE.Vector3;
  /** 估算的屏幕矩形（像素），用于去重叠 */
  width: number;
  height: number;
  priority: number;
  /** 省份标注对应的 adcode；下级区划为 null */
  adcode: number | null;
  /** 原始文本（省名短名），挂统计数字时据此还原 */
  baseText: string;
  /** 字号，用于改文本后重算去重叠宽度 */
  fontSize: number;
  /** 是否为下级区划标注（受淡入系数影响） */
  isCity: boolean;
  /** 最近一次写入的不透明度（用于避免每帧无谓改 DOM） */
  opacity: number;
}

/**
 * UI 面板占用区（名称一律不得落入）。
 *
 * 用**锚点 + 尺寸**而不是绝对像素矩形来描述：面板都是贴着容器某一边/角定位的
 * （控制台右上、图例左下、数据来源右下、加载提示上中），
 * 这样在任意视口尺寸下都能由当前画布尺寸实时换算出正确位置 ——
 * 即使窗口缩放事件被漏掉，也不会出现"预留区还是缩放前旧矩形"导致文字压面板的问题。
 */
export interface ReservedRect {
  /** 面板锚定的位置 */
  corner: 'tl' | 'tr' | 'bl' | 'br' | 'tc';
  /** 面板尺寸（CSS 像素） */
  w: number;
  h: number;
  /** 距锚定边的内边距（CSS 像素） */
  inset: number;
}

/* ---------------------------------------------- 点位（POI）与省份统计 */

/** 点位类型：草药（对齐 2D 的草药点位层）/ 瑶族县（对齐 2D 的县级药丸标记） */
export type PoiKind = 'herb' | 'county';

/** 一个点位：由 React 侧从业务数据构造，覆盖层只负责摆放与交互 */
export interface PoiItem {
  id: string;
  kind: PoiKind;
  /** 显示名（县名 / 草药名） */
  name: string;
  lon: number;
  lat: number;
  /** 悬停信息卡的行文本 */
  info: string[];
  /** 主题色（渐变起止），县级按 category 配色 */
  accent: string;
  accent2: string;
  /** 县名药丸左侧圆点是否显示（草药点为纯圆点） */
  pill: boolean;
  /** 药丸右侧的小徽标文本（县级用于显示瑶医机构数），缺省则不显示 */
  badge?: string;
}

/** 省份统计（对齐 2D tooltip：瑶族相关县数 / 机构数 / 暂无瑶族数据） */
export interface ProvinceStat {
  isYao: boolean;
  countyCount: number;
  institutions: number;
  herbs: number;
}

const SELECT_COLOR = new THREE.Color('#fff1b8');

/* 渲染次序：外壳在主线之下先画，主线后画覆盖中部 → 形成描边效果 */
const ORDER_CASING = 1;
const ORDER_MAIN = 2;
const ORDER_CITY = 3;

/* ------------------------------------------------------------------ 工具 */

/** 省名 → 短名（用于标注） */
export function shortProvinceName(name: string): string {
  const fixed: Array<[string, string]> = [
    ['内蒙古自治区', '内蒙古'],
    ['广西壮族自治区', '广西'],
    ['新疆维吾尔自治区', '新疆'],
    ['宁夏回族自治区', '宁夏'],
    ['西藏自治区', '西藏'],
    ['香港特别行政区', '香港'],
    ['澳门特别行政区', '澳门'],
  ];
  for (const [full, short] of fixed) if (name === full) return short;
  return name.replace(/(省|市|自治区)$/, '');
}

/**
 * 省份配色语义：**有瑶族数据 = 统一青碧强调，无数据 = 中性灰蓝弱化**。
 *
 * 为什么放弃原来的玫红（#e11d48）：
 *   玫红虽然对比强，但在「绿低地 → 棕山地 → 白雪山」的分层设色上属于暖红压暖棕，
 *   山地丘陵段与底图棕黄贴得很近；整屏看下来红色线段体量偏重，会抢地形主体的注意力。
 *
 * 为什么选青碧（#2f6b7a）：
 *   1. 与底图主要色相（绿 / 棕 / 白 / 海面灰蓝）同时具备明度差与冷暖分离，三类背景上均可辨；
 *   2. 与页面主色蜜炙黄（#D4AC6A）构成冷暖互补，整体更雅，不破坏中式配色基调；
 *   3. 细线用冷色在绿底上更"安静"，不会压过地形起伏。
 * 语义上仍要求「所有有瑶族数据的省统一同色」（不逐省分配色相），
 * 让观者一眼识别"哪些省有瑶族分布"，而不是去分辨各省之间的细微色差。
 */
const YAO_PROVINCE_COLOR_HEX = '#2f6b7a';
const YAO_PROVINCE_COLOR = new THREE.Color(YAO_PROVINCE_COLOR_HEX);

/** 省主线配色：有瑶族数据 → 统一强调色；无数据 → 中性灰蓝（主动让位） */
function provinceMainColor(isYao: boolean): THREE.Color {
  return isYao ? YAO_PROVINCE_COLOR.clone() : neutralProvinceColor();
}

/** 非瑶族省：低饱和中性灰蓝，视觉上让位给有数据的省 */
function neutralProvinceColor(): THREE.Color {
  return new THREE.Color().setHSL(0.55, 0.06, 0.6, THREE.SRGBColorSpace);
}

/**
 * 省域配色图例（供 UI 直接使用）：与线条配色**同源**，避免图例写死色值后与实现漂移。
 */
export function provinceColorLegend(): { yao: string; neutral: string } {
  return {
    yao: YAO_PROVINCE_COLOR_HEX,
    neutral: `#${neutralProvinceColor().getHexString()}`,
  };
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** 创建中文标注元素（不参与拾取，仅作展示） */
function createLabelElement(text: string, fontSize: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'tr-area-label'; // 便于测试与样式定位
  el.textContent = text;
  el.style.cssText = [
    'position:absolute',
    'pointer-events:none',
    'white-space:nowrap',
    'font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif',
    'font-weight:600',
    'color:#ffffff',
    // 阴影收窄：原来 6px 的辉光在 11px 字号上等于给每个字套了一圈毛边，观感发虚
    'text-shadow:0 1px 2px rgba(0,0,0,.85),0 0 3px rgba(0,0,0,.5)',
    `font-size:${fontSize}px`,
    // 小字号下加字距会让字形落到非整数像素上，和"半像素定位"叠加后更糊
    'letter-spacing:0',
    'text-rendering:optimizeLegibility',
    'transition:opacity 260ms ease',
  ].join(';');
  return el;
}

/** 取出要素的全部外环（MultiPolygon 的每个多边形取第 0 个环） */
function extractRings(geometry: GeoFeature['geometry']): Array<Array<[number, number]>> {
  const rings: Array<Array<[number, number]>> = [];
  if (!geometry) return rings;
  if (geometry.type === 'Polygon') {
    const poly = geometry.coordinates as number[][][];
    if (poly[0]) rings.push(poly[0] as Array<[number, number]>);
  } else if (geometry.type === 'MultiPolygon') {
    const mp = geometry.coordinates as number[][][][];
    for (const poly of mp) if (poly[0]) rings.push(poly[0] as Array<[number, number]>);
  }
  return rings;
}

/* ------------------------------------------------------------ 覆盖层实现 */

/** 由同一份顶点缓冲支撑的若干条叠层线段（例如：描边外壳 + 主线） */
interface LineStack {
  objects: LineSegments2[];
  geometries: LineSegmentsGeometry[];
  materials: LineMaterial[];
  /** 共享顶点缓冲：[x,y,z, x,y,z, ...]，每两个顶点构成一段 */
  positions: Float32Array;
  /** 每顶点归一化高程 */
  normHeight: Float32Array;
  /** 该叠层相对地表的基础抬升量（含每省错开台阶） */
  yOffset: number;
  anchor: { lon: number; lat: number } | null;
}

interface ProvinceEntry {
  adcode: number;
  name: string;
  stack: LineStack;
  main: LineMaterial;
  casing: LineMaterial;
  baseColor: THREE.Color;
  /** 基础线宽（像素）：有瑶族数据 = 加粗强调，无数据 = 细线让位 */
  baseWidth: number;
  /** 视觉中心（要素 centroid / center） */
  center: { lon: number; lat: number };
  /** 用于相机适配的范围（取面积最大的一环，并裁剪到模型覆盖范围） */
  focusBounds: LonLatBounds;
  /** 全部保留环的并集包围盒，仅用于命中预筛 */
  bboxAll: LonLatBounds;
  /** 用于点击命中的原始外环（与绘制几何同源） */
  rings: Array<Array<[number, number]>>;
}

export function createBoundaryOverlay(options: BoundaryOverlayOptions): BoundaryOverlay {
  const { scene, projection, sampleNormHeight, getReliefHeight, densifyStep } = options;
  const geoBound = projection.bounds;

  const root = new THREE.Group();
  root.name = 'boundary-overlay';
  scene.add(root);

  const provinceGroup = new THREE.Group();
  provinceGroup.name = 'province-boundaries';
  root.add(provinceGroup);

  const cityGroup = new THREE.Group();
  cityGroup.name = 'city-boundaries';
  root.add(cityGroup);

  const labelGroup = new THREE.Group();
  labelGroup.name = 'boundary-labels';
  root.add(labelGroup);

  const materials: LineMaterial[] = [];
  const provinces: ProvinceEntry[] = [];
  const provinceByCode = new Map<number, ProvinceEntry>();

  /** 最近一次视口尺寸：后创建的材质也要立即拿到，否则 LineMaterial 分辨率为 0 → 线不可见 */
  let viewportW = 1;
  let viewportH = 1;

  let hovered: number | null = null;
  let selected: number | null = null;
  let provinceOpacityScale = 1;
  let provinceFadeStart = 0;
  /** 视角距离分级系数（0=全国总览 / 1=贴近观察），由外部按相机距离驱动 */
  let emphasis = 0;

  let cityStack: LineStack | null = null;
  /** 下级区划淡入系数（0~1），同时驱动区划线与其名称 */
  let cityFadeK = 0;
  let cityFadeStart = 0;

  let hoverLabel: CSS2DObject | null = null;

  /** 全部自动摆放的中文标注（省名 + 下级区划名），统一做去重叠与避让 */
  let autoLabels: AutoLabel[] = [];
  /** 开关状态由外部持有（并持久化），这里只负责渲染；控制省名与下级区划名 */
  let provinceLabelsVisible = false;
/**
 * 省名后面是否附省级统计数字（如「广西 ·24」）。
 * 与"药田晕染"图层联动开关：只在该图层开启时显示，避免平时干扰读图。
 */
let provinceStatLabelsVisible = false;
  /** UI 面板占用区（画布像素）：名称一律不得落入 */
  let reservedRects: ReservedRect[] = [];
  /** 最近一次布局用的相机（供悬停标注判断是否落进面板区） */
  let layoutCamera: THREE.Camera | null = null;
  /** 高亮（悬停/选中）标注当前是否可见 */
  let hoverLabelVisible = false;
  /** 高亮标注的估算尺寸（用于让它优先占位，避免被城市名压住） */
  let hoverLabelW = 0;
  let hoverLabelH = 0;

  /** 有瑶族数据的省（2 位 adcode） */
  const yaoAdcodeSet = new Set<string>();
  /** 各省统计（悬停信息卡用） */
  let provinceStats: Map<string, ProvinceStat> = new Map();

  /** 点位层（草药 / 瑶族县）：DOM 标记 + hover 信息卡 + 点击回调 */
  interface PoiEntry {
    item: PoiItem;
    label: CSS2DObject;
    el: HTMLDivElement;
    world: THREE.Vector3;
    /** 估算的屏幕半宽/半高（像素）：避让 UI 面板时要按"整块标记"算，而不是只看锚点 */
    halfW: number;
    halfH: number;
    /** 当前是否已加隐藏类（必须与 DOM 初始状态一致：创建时未加类 = 可见） */
    hidden: boolean;
    /** 当前是否已收起文字（仅县药丸会用到） */
    labelHidden: boolean;
  }
  let herbPois: PoiEntry[] = [];
  let countyPois: PoiEntry[] = [];
  const onPoiSelect: ((item: PoiItem) => void) | null = options.onPoiSelect ?? null;

  /* ---------------- 点位层样式（:hover 信息卡需要真 CSS，故注入一次） ---------------- */
  const POI_STYLE_ID = 'tr-terrain-poi-style';
  function ensurePoiStyle(): void {
    if (typeof document === 'undefined' || document.getElementById(POI_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = POI_STYLE_ID;
    style.textContent = `
.tr-poi{position:absolute;pointer-events:auto;cursor:pointer;white-space:nowrap;
  font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;
  transition:opacity 200ms ease;}
.tr-poi-hidden{opacity:0 !important;pointer-events:none !important;}
/* 草药点位：手绘图标记（16 张随机取用），用 drop-shadow 描一圈白色轮廓以在地形上分离 */
/* 草药点位：白色圆形底牌 + 手绘图标。
   线稿直接压在地形上几乎看不见，加白底牌才能"跳"出来；
   外圈深色描边保证在浅色地形上也有边界，白色投影保证在深色地形上也有分离。 */
.tr-poi .tr-poi-dot{display:inline-flex;align-items:center;justify-content:center;
  width:34px;height:34px;border-radius:50%;
  background:#fdfefb;
  border:2px solid rgba(46,84,40,.92);
  box-shadow:0 3px 10px rgba(10,24,12,.45), 0 0 0 2px rgba(255,255,255,.75);}
.tr-poi .tr-poi-dot img{width:23px;height:23px;object-fit:contain;display:block;pointer-events:none;}
.tr-poi-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 6px 3px 8px;border-radius:9999px;
  color:#fff;font-size:11.5px;font-weight:600;letter-spacing:0;text-rendering:optimizeLegibility;
  border:1px solid rgba(255,255,255,.55);
  box-shadow:0 3px 10px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.30);}
.tr-poi-pill .tr-poi-bullet{display:inline-block;width:5px;height:5px;border-radius:50%;
  background:rgba(255,255,255,.95);box-shadow:0 0 5px rgba(255,255,255,.85);}
/* 县级药丸右侧的机构数小徽标：让"有多少家瑶医机构"一眼可读，而不是全靠 hover */
.tr-poi-pill .tr-poi-count{display:inline-flex;align-items:center;justify-content:center;
  min-width:16px;height:16px;padding:0 5px;border-radius:9999px;
  background:rgba(255,255,255,.94);color:#1f3d17;font-size:10px;font-weight:800;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);}
.tr-poi .tr-tip{display:none;position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);
  min-width:118px;max-width:200px;padding:6px 8px;border-radius:6px;white-space:normal;
  background:rgba(255,255,255,.97);border:1px solid rgba(74,124,58,.35);
  box-shadow:0 5px 16px rgba(0,0,0,.2);color:#33463a;font-size:10px;line-height:1.55;
  font-weight:400;pointer-events:none;text-align:left;}
.tr-poi .tr-tip b{color:#1f3d17;font-size:12px;}
.tr-poi:hover{z-index:20;}
.tr-poi:hover .tr-tip{display:block;}
/* 标记落在 UI 面板下方时：只收起文字，保留圆点（文字不得压控制台，但点位仍可点） */
.tr-poi-label-hidden .tr-poi-name{display:none;}
.tr-poi-label-hidden .tr-poi-pill{padding:3px;gap:0;}`;
    document.head.appendChild(style);
  }

  /** 构造点位 DOM（草药 = 圆点；瑶族县 = category 配色药丸 + 机构数徽标），信息卡随 hover 显示 */
  function createPoiElement(item: PoiItem): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'tr-poi';
    const tip = `<div class="tr-tip"><b>${item.name}</b><br/>${item.info.join('<br/>')}</div>`;
    if (item.pill) {
      const count = item.badge ? `<span class="tr-poi-count">${item.badge}</span>` : '';
      el.innerHTML =
        `<span class="tr-poi-pill" style="background:linear-gradient(135deg,${item.accent} 0%,${item.accent2} 100%)">` +
        `<span class="tr-poi-bullet"></span><span class="tr-poi-name">${item.name}</span>${count}</span>${tip}`;
    } else {
      // 草药点：每次创建时随机取一张手绘图标（避免整片点位长得一模一样），
      // 图标放在白色圆牌里——线稿直接贴地形几乎不可见
      const icon = pickHerbMarkerIcon();
      el.innerHTML = `<span class="tr-poi-dot"><img src="${icon}" alt="" /></span>${tip}`;
    }
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onPoiSelect?.(item);
    });
    return el;
  }

  function setPois(current: PoiEntry[], items: PoiItem[]): PoiEntry[] {
    for (const entry of current) labelGroup.remove(entry.label);
    const next: PoiEntry[] = items.map((item) => {
      const el = createPoiElement(item);
      const label = new CSS2DObject(el);
      // CSS2DRenderer 按 renderOrder（其次按到相机距离）分配 z-index：
      // 县级药丸是聚焦后的主要信息，必须压在草药圆点之上，否则点药丸会命中上层圆点。
      label.renderOrder = item.kind === 'county' ? POI_ORDER_COUNTY : POI_ORDER_HERB;
      labelGroup.add(label);
      // 估算标记在屏幕上的占位（不读 offsetWidth，避免每帧强制回流）
      const badgeW = item.badge ? 22 : 0;
      const halfW = item.pill ? (item.name.length * 11.2 + 26 + badgeW) / 2 : 18;
      const halfH = item.pill ? 12 : 18;
      return { item, el, label, world: new THREE.Vector3(), halfW, halfH, hidden: false, labelHidden: false };
    });
    placePois(next);
    return next;
  }

  ensurePoiStyle();

  /** 点位布局已并入统一的 `updateLabelLayout`（与名称共用一次贪心占位），此处不再单独实现 */

  /** 把"锚点 + 尺寸"换算成当前画布尺寸下的绝对矩形（含安全余量） */
  function reservedAbsRects(): Array<{ x: number; y: number; w: number; h: number }> {
    const w = viewportW;
    const h = viewportH;
    const pad = 4; // 安全余量：测量稍旧时也不会让文字贴边
    return reservedRects.map((r) => {
      const inset = r.inset;
      let x = inset;
      let y = inset;
      if (r.corner === 'tr') x = w - inset - r.w;
      else if (r.corner === 'bl') y = h - inset - r.h;
      else if (r.corner === 'br') {
        x = w - inset - r.w;
        y = h - inset - r.h;
      } else if (r.corner === 'tc') x = (w - r.w) / 2;
      return { x: x - pad, y: y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
    });
  }

  /* ---------------- 地表高度 ---------------- */

  /** 世界 Y = 归一化高程 × 起伏高度 + 抬升量 */
  function worldYAt(lon: number, lat: number): number {
    const { u, v } = projection.toUV(lon, lat);
    return sampleNormHeight(u, v) * getReliefHeight() + LINE_OFFSET;
  }

  /** 把归一化高程写回共享顶点 Y（绝对赋值，可反复调用） */
  function writeHeights(stack: LineStack): void {
    const relief = getReliefHeight();
    const arr = stack.positions;
    const yOff = stack.yOffset;
    const n = stack.normHeight.length;
    for (let i = 0; i < n; i++) arr[i * 3 + 1] = stack.normHeight[i] * relief + yOff;
    for (const g of stack.geometries) {
      const attr = g.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
      if (attr && attr.data) attr.data.needsUpdate = true;
    }
  }

  /** 环加密：按世界长度把每条边细分到不超过 step，保证线条能贴合网格起伏 */
  function densifyRing(ring: Array<[number, number]>): Array<[number, number]> {
    const n = ring.length;
    if (n < 3) return ring;
    const out: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      const pa = projection.toModel(a[0], a[1]);
      const pb = projection.toModel(b[0], b[1]);
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
      const parts = Math.max(1, Math.min(Math.ceil(len / densifyStep), 64));
      for (let k = 0; k < parts; k++) {
        const t = k / parts;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }

  /** 由（已加密的）环列表构建一条多叠层线段 */
  function buildStack(
    rings: Array<Array<[number, number]>>,
    layers: Array<{ material: LineMaterial; renderOrder: number }>,
    anchor: { lon: number; lat: number } | null,
    group: THREE.Group,
    yOffset: number,
  ): LineStack | null {
    let vertexCount = 0;
    for (const ring of rings) vertexCount += ring.length * 2;
    if (vertexCount === 0) return null;

    const positions = new Float32Array(vertexCount * 3);
    const normHeight = new Float32Array(vertexCount);
    let vi = 0;
    for (const ring of rings) {
      const n = ring.length;
      for (let i = 0; i < n; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % n];
        for (const p of [a, b]) {
          const { x, z } = projection.toModel(p[0], p[1]);
          const { u, v } = projection.toUV(p[0], p[1]);
          positions[vi * 3] = x;
          positions[vi * 3 + 2] = z;
          normHeight[vi] = sampleNormHeight(u, v);
          vi++;
        }
      }
    }

    const stack: LineStack = {
      objects: [],
      geometries: [],
      materials: [],
      positions,
      normHeight,
      yOffset,
      anchor,
    };

    for (const layer of layers) {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(positions); // 直接引用共享缓冲，便于原地改 Y
      const object = new LineSegments2(geometry, layer.material);
      object.frustumCulled = false; // 顶点会被原地修改，禁用包围球剔除
      object.renderOrder = layer.renderOrder;
      group.add(object);
      layer.material.resolution.set(viewportW, viewportH);
      materials.push(layer.material);
      stack.objects.push(object);
      stack.geometries.push(geometry);
      stack.materials.push(layer.material);
    }

    writeHeights(stack);
    return stack;
  }

  /** 环 bbox 是否与模型覆盖范围相交（不相交的环如南海诸岛远在覆盖区外，直接忽略） */
  function ringIntersectsModel(ring: Array<[number, number]>): boolean {
    let a = Infinity;
    let b = Infinity;
    let c = -Infinity;
    let d = -Infinity;
    for (const [lon, lat] of ring) {
      if (lon < a) a = lon;
      if (lon > c) c = lon;
      if (lat < b) b = lat;
      if (lat > d) d = lat;
    }
    return !(c < geoBound.west || a > geoBound.east || d < geoBound.south || b > geoBound.north);
  }

  /* ---------------- 省级边界 ---------------- */

  function applyProvinceStyle(entry: ProvinceEntry): void {
    const { adcode, main, casing, baseColor, baseWidth } = entry;
    // 距离分级：emphasis 0=全国总览（细而淡），1=贴近观察（常规强度）
    const wScale = OVERVIEW_WIDTH_SCALE + (1 - OVERVIEW_WIDTH_SCALE) * emphasis;
    const oScale = OVERVIEW_OPACITY_SCALE + (1 - OVERVIEW_OPACITY_SCALE) * emphasis;
    const baseOpacity = provinceOpacityScale * oScale;

    let width = baseWidth;
    let color = baseColor;
    let opacity = baseOpacity;

    if (adcode === selected) {
      width = PROVINCE_SELECT_WIDTH;
      color = SELECT_COLOR;
      opacity = provinceOpacityScale;
    } else if (adcode === hovered) {
      width = PROVINCE_HOVER_WIDTH;
      color = baseColor.clone().offsetHSL(0, 0.05, 0.14);
      opacity = provinceOpacityScale;
    } else if (selected !== null) {
      opacity = baseOpacity * PROVINCE_DIM_OPACITY;
    }

    main.color.copy(color);
    main.linewidth = width * wScale;
    main.opacity = opacity;

    casing.linewidth = (width + CASING_EXTRA) * wScale;
    casing.opacity = opacity * CASING_OPACITY;
  }

  function applyAllProvinceStyles(): void {
    for (const p of provinces) applyProvinceStyle(p);
  }

  /** 视角距离分级：0=全国总览、1=贴近；变化超过阈值才重刷样式 */
  function setEmphasis(value: number): boolean {
    const next = Math.min(Math.max(value, 0), 1);
    if (Math.abs(next - emphasis) < 0.02) return false;
    emphasis = next;
    applyAllProvinceStyles();
    return true;
  }

  function disposeProvinces(): void {
    for (const p of provinces) {
      for (let i = 0; i < p.stack.objects.length; i++) {
        provinceGroup.remove(p.stack.objects[i]);
        p.stack.geometries[i].dispose();
      }
      for (const m of p.stack.materials) {
        const idx = materials.indexOf(m);
        if (idx >= 0) materials.splice(idx, 1);
        m.dispose();
      }
    }
    provinces.length = 0;
    provinceByCode.clear();
    removeAutoLabels((item) => item.adcode !== null);
  }

  /** 移除符合条件的自动标注（并从场景摘除） */
  function removeAutoLabels(pred: (item: AutoLabel) => boolean): void {
    const keep: AutoLabel[] = [];
    for (const item of autoLabels) {
      if (pred(item)) labelGroup.remove(item.label);
      else keep.push(item);
    }
    autoLabels = keep;
  }

  /** 按当前地形起伏摆放全部自动标注（省名锚点 = 要素质心） */
  function placeAutoLabels(): void {
    const relief = getReliefHeight();
    for (const item of autoLabels) {
      const lift = LINE_OFFSET + (item.isCity
        ? Math.max(0.55, relief * 0.1)
        : Math.max(0.9, relief * 0.16));
      const anchor = item.label.userData.anchor as { lon: number; lat: number } | undefined;
      if (!anchor) continue;
      const { u, v } = projection.toUV(anchor.lon, anchor.lat);
      const { x, z } = projection.toModel(anchor.lon, anchor.lat);
      item.world.set(x, sampleNormHeight(u, v) * relief + lift, z);
      item.label.position.copy(item.world);
    }
  }

  /** 摆放点位到地表（随起伏同步升降） */
  function placePois(entries: PoiEntry[]): void {
    const relief = getReliefHeight();
    const lift = LINE_OFFSET + Math.max(0.7, relief * 0.12);
    for (const entry of entries) {
      const { u, v } = projection.toUV(entry.item.lon, entry.item.lat);
      const { x, z } = projection.toModel(entry.item.lon, entry.item.lat);
      entry.world.set(x, sampleNormHeight(u, v) * relief + lift, z);
      entry.label.position.copy(entry.world);
    }
  }

  /** 创建一个自动标注 */
  function createAutoLabel(
    text: string,
    fontSize: number,
    anchor: { lon: number; lat: number },
    priority: number,
    adcode: number | null,
    isCity: boolean,
  ): AutoLabel {
    const el = createLabelElement(text, fontSize);
    el.style.opacity = '0';
    const label = new CSS2DObject(el);
    label.userData.anchor = anchor;
    labelGroup.add(label);
    const item: AutoLabel = {
      label,
      world: new THREE.Vector3(),
      width: text.length * fontSize + AREA_LABEL_PAD_X * 2,
      height: fontSize + AREA_LABEL_PAD_Y,
      priority,
      adcode,
      isCity,
      baseText: text,
      fontSize,
      opacity: 0,
    };
    autoLabels.push(item);
    return item;
  }

  function setProvinces(fc: GeoFeatureCollection | null): void {
    disposeProvinces();
    if (!fc) return;

    fc.features.forEach((feature, index) => {
      const adcode = Number(feature.properties?.adcode);
      if (!Number.isFinite(adcode)) return; // 跳过九段线等异常要素

      const rawRings = extractRings(feature.geometry).filter(ringIntersectsModel);
      if (!rawRings.length) return;

      // 同时计算：全部环的并集包围盒（命中预筛）与面积最大的一环（相机适配范围）
      let mainRing = rawRings[0];
      let mainSpan = -1;
      let ba = Infinity;
      let bb = Infinity;
      let bc = -Infinity;
      let bd = -Infinity;
      for (const ring of rawRings) {
        let a = Infinity;
        let b = Infinity;
        let c = -Infinity;
        let d = -Infinity;
        for (const [lon, lat] of ring) {
          if (lon < a) a = lon;
          if (lon > c) c = lon;
          if (lat < b) b = lat;
          if (lat > d) d = lat;
        }
        if (a < ba) ba = a;
        if (b < bb) bb = b;
        if (c > bc) bc = c;
        if (d > bd) bd = d;
        const span = (c - a) * (d - b);
        if (span > mainSpan) {
          mainSpan = span;
          mainRing = ring;
        }
      }
      const bboxAll: LonLatBounds = { minLon: ba, minLat: bb, maxLon: bc, maxLat: bd };

      const clampLon = (v: number) => Math.min(Math.max(v, geoBound.west), geoBound.east);
      const clampLat = (v: number) => Math.min(Math.max(v, geoBound.south), geoBound.north);
      let fa = Infinity;
      let fb = Infinity;
      let fc2 = -Infinity;
      let fd = -Infinity;
      for (const [lon, lat] of mainRing) {
        if (lon < fa) fa = lon;
        if (lon > fc2) fc2 = lon;
        if (lat < fb) fb = lat;
        if (lat > fd) fd = lat;
      }
      const focusBounds: LonLatBounds = {
        minLon: clampLon(fa),
        minLat: clampLat(fb),
        maxLon: clampLon(fc2),
        maxLat: clampLat(fd),
      };

      const anchorProp = feature.properties?.centroid ?? feature.properties?.center ?? null;
      const center = anchorProp
        ? { lon: anchorProp[0], lat: anchorProp[1] }
        : { lon: (focusBounds.minLon + focusBounds.maxLon) / 2, lat: (focusBounds.minLat + focusBounds.maxLat) / 2 };

      // 配色语义：有瑶族数据 = 统一玫红强调（高对比、跨省一致）；无数据 = 中性灰蓝弱化
      const adcode2 = String(adcode).substring(0, 2);
      const isYao = yaoAdcodeSet.has(adcode2);
      const baseColor = provinceMainColor(isYao);
      const baseWidth = isYao ? PROVINCE_WIDTH_YAO : PROVINCE_WIDTH_NEUTRAL;
      const main = new LineMaterial({
        color: baseColor.getHex(),
        linewidth: baseWidth,
        transparent: true,
        opacity: 1,
        worldUnits: false,
        dashed: false,
      });
      const casing = new LineMaterial({
        // 同色暗化版：既有轮廓分离度，又不会在缺口处形成黑色点状伪影
        color: baseColor.clone().multiplyScalar(CASING_DARKEN).getHex(),
        linewidth: baseWidth + CASING_EXTRA,
        transparent: true,
        opacity: CASING_OPACITY,
        worldUnits: false,
        dashed: false,
      });
      // 描边外壳与主线共面：若写深度会与主线逐像素争抢深度 → 出现"虚线/串珠"观感。
      // 关掉外壳的深度写入，使其只做深度测试（仍被地形正确遮挡），主线后画即可干净覆盖。
      casing.depthWrite = false;

      const rings = rawRings.map(densifyRing);
      const provinceYOffset = LINE_OFFSET + (index % PROVINCE_Y_CYCLE) * PROVINCE_Y_STEP;
      const stack = buildStack(
        rings,
        [
          { material: casing, renderOrder: ORDER_CASING },
          { material: main, renderOrder: ORDER_MAIN },
        ],
        center,
        provinceGroup,
        provinceYOffset,
      );
      if (!stack) {
        main.dispose();
        casing.dispose();
        return;
      }

      const entry: ProvinceEntry = {
        adcode,
        name: String(feature.properties?.name ?? ''),
        stack,
        main,
        casing,
        baseColor,
        baseWidth,
        center,
        focusBounds,
        bboxAll,
        rings: rawRings,
      };
      provinces.push(entry);
      provinceByCode.set(adcode, entry);
      applyProvinceStyle(entry);

      // 省份名称标注（常显层的可见性由开关 + 去重叠 + 面板避让共同决定）
      const labelText = shortProvinceName(entry.name);
      const spanArea = (focusBounds.maxLon - focusBounds.minLon) * (focusBounds.maxLat - focusBounds.minLat);
      createAutoLabel(
        labelText,
        AREA_LABEL_FONT,
        center,
        // 面积大的省优先占位（附加项 < 1，保证仍低于下级区划标注的优先级）
        PRIORITY_PROVINCE_LABEL + Math.min(Math.max(spanArea, 0) / 1000, 0.9),
        adcode,
        false,
      );
    });

    placeAutoLabels();
    provinceOpacityScale = 0;
    provinceFadeStart = performance.now();
  }

  /* ---------------- 下级区划（城市/区县） ---------------- */

  function disposeCities(): void {
    if (cityStack) {
      for (let i = 0; i < cityStack.objects.length; i++) {
        cityGroup.remove(cityStack.objects[i]);
        cityStack.geometries[i].dispose();
      }
      for (const m of cityStack.materials) {
        const idx = materials.indexOf(m);
        if (idx >= 0) materials.splice(idx, 1);
        m.dispose();
      }
      cityStack = null;
    }
    removeAutoLabels((item) => item.isCity);
    cityFadeK = 0;
    cityFadeStart = 0;
  }

  function setCities(fc: GeoFeatureCollection | null): void {
    disposeCities();
    if (!fc) return;

    const material = new LineMaterial({
      color: CITY_COLOR.getHex(),
      linewidth: CITY_WIDTH,
      transparent: true,
      opacity: 0,
      worldUnits: false,
      dashed: false,
    });

    const allRings: Array<Array<[number, number]>> = [];
    const labelAnchors: Array<{ text: string; lon: number; lat: number; area: number }> = [];

    for (const feature of fc.features) {
      const rings = extractRings(feature.geometry).filter(ringIntersectsModel);
      if (!rings.length) continue;
      for (const ring of rings) allRings.push(densifyRing(ring));

      const anchorProp = feature.properties?.centroid ?? feature.properties?.center ?? null;
      const name = String(feature.properties?.name ?? '');
      if (name && anchorProp) {
        // 用体量（环顶点数）粗估优先级，保证大城市在密集区域优先占位
        let verts = 0;
        for (const ring of rings) verts += ring.length;
        labelAnchors.push({ text: name, lon: anchorProp[0], lat: anchorProp[1], area: verts });
      }
    }
    if (!allRings.length) {
      material.dispose();
      return;
    }

    cityStack = buildStack(
      allRings,
      [{ material, renderOrder: ORDER_CITY }],
      null,
      cityGroup,
      LINE_OFFSET + CITY_Y_OFFSET,
    );

    for (const item of labelAnchors) {
      createAutoLabel(
        item.text,
        CITY_LABEL_FONT,
        { lon: item.lon, lat: item.lat },
        PRIORITY_CITY_LABEL + Math.min(item.area / 2000, 0.9),
        null,
        true,
      );
    }
    placeAutoLabels();

    cityFadeStart = performance.now();
  }

  /* ---------------- 悬停 / 选中 ---------------- */

  function updateHoverLabel(): void {
    // 只在"悬停"时显示信息卡。
    // 改前是 `hovered ?? selected`：点进省份后 selected 一直存在，
    // 白色信息卡就常驻在省中心，把后面的县名药丸/草药点全挡住了。
    // 冻结省份的统计已由左下角的省域速览卡承担，这里不必重复。
    const target = hovered;
    const entry = target === null ? null : provinceByCode.get(target) ?? null;
    // 名称显示关闭时，高亮标注也一并隐藏（保持"关闭即无名称"的一致语义）
    if (!entry || !provinceLabelsVisible) {
      hoverLabelVisible = false;
      if (hoverLabel) (hoverLabel.element as HTMLElement).style.opacity = '0';
      return;
    }
    // 名称层已经显示该省名称时，不再在同一锚点叠加一个大号同名标注（否则文字重影）
    const areaShown = (autoLabels.find((a) => a.adcode === target)?.opacity ?? 0) > 0.5;
    const text = shortProvinceName(entry.name);
    // 信息卡内容对齐 2D tooltip：有数据 → 瑶族相关县 / 机构数；无数据 → 暂无瑶族数据
    const stat = provinceStats.get(String(target).substring(0, 2));
    const statText = stat && stat.isYao
      ? `${stat.countyCount} 县 · ${stat.institutions} 机构`
      : '暂无瑶族数据';
    // 轻量单行胶囊（浅底 + 细边 + 柔和投影）：与整站 UI 的浅色语言一致。
    // 原来是一块半透明深色大方块压在画面中央，观感很重、也容易挡住地形与药丸。
    const html =
      `<div style="display:inline-flex;align-items:center;gap:7px;padding:3px 10px;border-radius:9999px;` +
      `background:rgba(255,255,255,.96);border:1px solid rgba(74,124,58,.28);` +
      `box-shadow:0 4px 14px rgba(16,32,20,.20)">` +
      `<span style="font-size:${HOVER_LABEL_FONT}px;font-weight:700;line-height:1.2;color:#1f3d17">${text}</span>` +
      `<span style="width:1px;height:11px;background:rgba(74,124,58,.28)"></span>` +
      `<span style="font-size:10.5px;font-weight:600;line-height:1.2;color:#4b6b52">${statText}</span></div>`;
    if (!hoverLabel) {
      hoverLabel = new CSS2DObject(createLabelElement('', HOVER_LABEL_FONT));
      hoverLabel.renderOrder = ORDER_HOVER_LABEL; // 始终压在所有标注/点位之上
      (hoverLabel.element as HTMLElement).style.opacity = '0';
      labelGroup.add(hoverLabel);
    }
    const el = hoverLabel.element as HTMLElement;
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
    // 尺寸估算：单行胶囊 = 省名 + 分隔线 + 统计，估宽需覆盖两段文字
    hoverLabelW = text.length * HOVER_LABEL_FONT + statText.length * 10.5 + 46;
    hoverLabelH = HOVER_LABEL_FONT + 12;
    const { x, z } = projection.toModel(entry.center.lon, entry.center.lat);
    // 抬高锚点：卡片浮在省域上方，尽量不压住省内的县名药丸
    const y = worldYAt(entry.center.lon, entry.center.lat) + Math.max(1.2, getReliefHeight() * 0.3);
    hoverLabel.position.set(x, y, z);
    // 聚焦某省后，鼠标在该省境内移动会持续命中它：
    // 此时卡片只会遮挡省内的县名药丸，而省内统计已由左下的速览卡呈现 → 直接不显示。
    const overFocused = selected !== null && target === selected;
    // 整块信息卡（含宽度）都不得落在 UI 面板上：只判锚点会让宽卡片伸进控制台
    const visible = !areaShown && !overFocused && !isBoxInsideReserved(hoverLabel.position, hoverLabelW, hoverLabelH);
    hoverLabelVisible = visible;
    el.style.opacity = visible ? '1' : '0';
  }

  /** 以"锚点 + 尺寸"判断整块UI（信息卡）是否与面板预留区相交 */
  function isBoxInsideReserved(world: THREE.Vector3, width: number, height: number): boolean {
    if (!layoutCamera) return false;
    const rects = reservedAbsRects();
    if (!rects.length) return false;
    const box = projectBox(world, width, height, layoutCamera);
    if (!box) return false;
    for (const r of rects) {
      if (boxesIntersect(box, { x: r.x + r.w / 2, y: r.y + r.h / 2, hw: r.w / 2, hh: r.h / 2 }, 2)) {
        return true;
      }
    }
    return false;
  }

  function setHover(adcode: number | null): void {
    if (hovered === adcode) return;
    const prev = hovered;
    hovered = adcode;
    if (prev !== null) {
      const p = provinceByCode.get(prev);
      if (p) applyProvinceStyle(p);
    }
    if (adcode !== null) {
      const p = provinceByCode.get(adcode);
      if (p) applyProvinceStyle(p);
    }
    updateHoverLabel();
  }

  function setSelected(adcode: number | null): void {
    if (selected === adcode) return;
    selected = adcode;
    applyAllProvinceStyles();
    updateHoverLabel();
  }

  /* ---------------- 高度 / 分辨率 / 过渡 ---------------- */

  function refreshHeights(): void {
    for (const p of provinces) writeHeights(p.stack);
    if (cityStack) writeHeights(cityStack);
    placeAutoLabels(); // 全部名称标注随起伏同步升降
    placePois(herbPois); // 点位同样贴合起伏
    placePois(countyPois);
    if (hoverLabel) {
      const target = hovered ?? selected;
      const entry = target === null ? null : provinceByCode.get(target) ?? null;
      if (entry) {
        const { x, z } = projection.toModel(entry.center.lon, entry.center.lat);
        hoverLabel.position.set(
          x,
          worldYAt(entry.center.lon, entry.center.lat) + Math.max(1.2, getReliefHeight() * 0.18),
          z,
        );
      }
    }
  }

  function setResolution(width: number, height: number): void {
    viewportW = width;
    viewportH = height;
    for (const m of materials) m.resolution.set(width, height);
  }

  /* ---------------- 名称标注层（省名 + 下级区划名） ---------------- */

  function setProvinceLabelsVisible(on: boolean): void {
    if (provinceLabelsVisible === on) return;
    provinceLabelsVisible = on;
    if (!on) {
      // 关闭时立即隐藏，无需等下一帧
      for (const item of autoLabels) {
        if (item.opacity > 0) {
          (item.label.element as HTMLElement).style.opacity = '0';
          item.opacity = 0;
        }
      }
      updateHoverLabel();
    }
  }

  /** 上报 UI 面板占用区：名称标注一律避让，避免文字压到控制台/图例上 */
  function setReservedRects(rects: ReservedRect[]): void {
    reservedRects = rects.slice();
  }

  /** 设置瑶族相关省（2 位 adcode）：影响省份配色语义 */
  function setYaoProvinceAdcodes(adcodes: string[]): void {
    yaoAdcodeSet.clear();
    for (const a of adcodes) yaoAdcodeSet.add(a);
  }

  /** 设置各省统计（悬停信息卡显示"瑶族相关县 / 机构数"，对齐 2D tooltip） */
  function setProvinceStats(stats: Map<string, ProvinceStat>): void {
    provinceStats = stats;
    // 统计晚到（React 在 viewer ready 后一次性灌入）：拿到数据后立刻回写到已建好的省名标签
    applyProvinceLabelStats();
  }

  /**
   * 把省级统计写到省名标签上：`广西 ·24`（数字 = 瑶医机构数）。
   *
   * 为什么"附加"而不是新建图层：省名本来就常显，把数字挂在同一行文字里
   * 不新增任何 DOM 标记，视觉上也不会像"贴纸"。
   * 数字带 · 分隔，与省名形成主次；关闭晕染图层时自动还原为纯省名。
   */
  function applyProvinceLabelStats(): void {
    for (const item of autoLabels) {
      if (item.isCity || item.adcode === null) continue;
      const key = String(item.adcode).substring(0, 2);
      const stat = provinceStats.get(key);
      // 只给"确实有瑶医机构"的省挂数字：`宁夏 ·0` 这类是纯噪音，会稀释重点
      const show = provinceStatLabelsVisible && !!stat && stat.institutions > 0;
      const text = show ? `${item.baseText} ·${stat.institutions}` : item.baseText;
      const el = item.label.element as HTMLDivElement | undefined;
      if (el && el.textContent !== text) el.textContent = text;
      item.width = text.length * item.fontSize + AREA_LABEL_PAD_X * 2;
    }
  }

  /** 开关省名统计数字（与药田晕染图层联动） */
  function setProvinceStatLabels(on: boolean): void {
    if (provinceStatLabelsVisible === on) return;
    provinceStatLabelsVisible = on;
    applyProvinceLabelStats();
    placeAutoLabels();
  }

  function setHerbPois(items: PoiItem[]): void {
    herbPois = setPois(herbPois, items);
  }

  function setCountyPois(items: PoiItem[]): void {
    countyPois = setPois(countyPois, items);
  }

  /* ---------------- 统一标注布局（名称 + 点位文字共用一次贪心占位） ---------------- */

  interface ScreenBox {
    x: number;
    y: number;
    hw: number;
    hh: number;
  }

  const _boxProj = new THREE.Vector3();
  /** 世界坐标 → 屏幕矩形；超出视锥或远离视口时返回 null（即不可见） */
  function projectBox(
    world: THREE.Vector3,
    width: number,
    height: number,
    camera: THREE.Camera,
  ): ScreenBox | null {
    _boxProj.copy(world).project(camera);
    if (_boxProj.z <= -1 || _boxProj.z >= 1) return null;
    const x = (_boxProj.x * 0.5 + 0.5) * viewportW;
    const y = (-_boxProj.y * 0.5 + 0.5) * viewportH;
    const hw = width / 2;
    const hh = height / 2;
    if (x < -hw * 3 || x > viewportW + hw * 3 || y < -hh * 3 || y > viewportH + hh * 3) return null;
    return { x, y, hw, hh };
  }

  function boxesIntersect(a: ScreenBox, b: ScreenBox, gap: number): boolean {
    return Math.abs(a.x - b.x) < a.hw + b.hw + gap && Math.abs(a.y - b.y) < a.hh + b.hh + gap;
  }

  /**
   * 统一的标注布局：把**所有会显示文字的元素**放进同一次贪心占位里竞争，
   * 从根上解决"城市名压药丸、药丸互相压、悬停卡压一切"的拥挤问题。
   *
   * 优先级（高 → 低）：悬停/选中信息卡(3) > 县级药丸(2.5) > 城市名(2) > 省名(1+面积权重)
   * 密度预算：可见**文字**数量按画布面积设上限（小屏自动降密度）；窄屏加大最小间距，避免"贴脸"。
   * 取舍：文字放不下时—— 县级药丸**收起文字、保留可点圆点**（不丢功能入口）；
   *      名称类直接隐藏（缩放/平移后位置变化会自然重新显现，即渐进式披露，信息不丢失）。
   */
  function updateLabelLayout(camera: THREE.Camera): boolean {
    layoutCamera = camera;
    let changed = false;

    const w = viewportW;
    const h = viewportH;
    const area = Math.max(w * h, 1);
    // 文字预算：约每 26000 px² 容纳 1 个文字标注，夹取 [10, 30]（小屏自动降密度）
    const budget = Math.max(10, Math.min(30, Math.round(area / 26000)));
    // 最小间距：窄屏加大，进一步拉开呼吸感
    const gap = w < 820 ? LABEL_GAP + 1 : LABEL_GAP;

    // ① 预置"已占用"：UI 面板（锚点换算，随尺寸自动跟随）+ 悬停/选中信息卡（最高优先级）
    const occupied: ScreenBox[] = [];
    for (const r of reservedAbsRects()) {
      occupied.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, hw: r.w / 2, hh: r.h / 2 });
    }
    if (hoverLabelVisible && hoverLabel) {
      const b = projectBox(hoverLabel.position, hoverLabelW + 6, hoverLabelH + 6, camera);
      if (b) occupied.push(b);
    }

    // ② 收集候选：名称类（省名 / 城市名）与县级药丸文字
    interface Candidate {
      priority: number;
      box: ScreenBox;
      /** 是否计入"文字密度预算"（药丸是业务入口，只在冲突时收起文字，不占预算） */
      countsBudget: boolean;
      /** 应用"是否显示文字"，返回是否发生变化 */
      apply: (show: boolean) => boolean;
    }
    const candidates: Candidate[] = [];

    for (const item of autoLabels) {
      const setOpacity = (v: number): boolean => {
        if (Math.abs(v - item.opacity) <= 0.01) return false;
        (item.label.element as HTMLElement).style.opacity = String(v);
        item.opacity = v;
        return true;
      };
      // 名称总开关关闭 → 全部收起
      if (!provinceLabelsVisible) {
        if (setOpacity(0)) changed = true;
        continue;
      }
      // 悬停/选中的省份由大号信息卡接管，名称层让位（避免同一位置两套文字重影）
      if (item.adcode !== null && (item.adcode === selected || item.adcode === hovered)) {
        if (setOpacity(0)) changed = true;
        continue;
      }
      const b = projectBox(item.world, item.width, item.height, camera);
      if (!b) {
        if (setOpacity(0)) changed = true;
        continue;
      }
      const target = item.isCity ? cityFadeK : provinceOpacityScale;
      candidates.push({
        priority: item.priority,
        box: b,
        countsBudget: true,
        apply: (show) => setOpacity(show ? target : 0),
      });
    }

    for (const entry of countyPois) {
      const b = projectBox(entry.world, entry.halfW * 2, entry.halfH * 2, camera);
      if (!b) {
        // 视口外：整块标记隐藏（同时关掉指针事件，避免"看不见却可点"）
        if (!entry.hidden) {
          entry.el.classList.add('tr-poi-hidden');
          entry.hidden = true;
          changed = true;
        }
        continue;
      }
      if (entry.hidden) {
        entry.el.classList.remove('tr-poi-hidden');
        entry.hidden = false;
        changed = true;
      }
      candidates.push({
        priority: PRIORITY_COUNTY_POI,
        box: b,
        countsBudget: false,
        apply: (show) => {
          const collapsed = !show;
          if (collapsed === entry.labelHidden) return false;
          entry.el.classList.toggle('tr-poi-label-hidden', collapsed);
          entry.labelHidden = collapsed;
          return true;
        },
      });
    }

    // ③ 贪心占位：高优先级先占；文字预算用尽后，名称类退出、药丸收起文字（保留圆点）
    candidates.sort((a, b) => b.priority - a.priority);
    let textCount = 0;
    for (const c of candidates) {
      let show = true;
      for (const k of occupied) {
        if (boxesIntersect(c.box, k, gap)) {
          show = false;
          break;
        }
      }
      if (show && c.countsBudget && textCount >= budget) show = false;
      if (show) {
        occupied.push(c.box);
        if (c.countsBudget) textCount += 1;
      }
      if (c.apply(show)) changed = true;
    }

    // ④ 草药圆点与"已收起文字的药丸圆点"：只做视口剔除，不参与占位（体量小，始终可见）
    for (const entry of herbPois) {
      const b = projectBox(entry.world, entry.halfW * 2, entry.halfH * 2, camera);
      const wantHidden = !b;
      if (wantHidden !== entry.hidden) {
        entry.el.classList.toggle('tr-poi-hidden', wantHidden);
        entry.hidden = wantHidden;
        changed = true;
      }
    }

    if (changed) updateHoverLabel(); // 可见集变化会影响"重影让位"的判断
    return changed;
  }

  function update(now: number): boolean {
    let changed = false;

    if (provinceFadeStart > 0) {
      const t = Math.min((now - provinceFadeStart) / PROVINCE_FADE_MS, 1);
      provinceOpacityScale = easeOut(t);
      applyAllProvinceStyles();
      if (t >= 1) provinceFadeStart = 0;
      changed = true;
    }

    if (cityFadeStart > 0) {
      const t = Math.min((now - cityFadeStart) / CITY_FADE_MS, 1);
      cityFadeK = easeOut(t);
      if (cityStack) {
        for (const m of cityStack.materials) m.opacity = cityFadeK * CITY_OPACITY;
      }
      if (t >= 1) cityFadeStart = 0;
      changed = true;
    }

    return changed;
  }

  /* ---------------- 命中测试 ---------------- */

  function hitTest(lon: number, lat: number): ProvincePick | null {
    for (const p of provinces) {
      const b = p.bboxAll;
      if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) continue;
      for (const ring of p.rings) {
        if (pointInRing(lon, lat, ring)) return { adcode: p.adcode, name: p.name };
      }
    }
    return null;
  }

  function provinceFocusInfo(adcode: number): ProvinceFocusInfo | null {
    const p = provinceByCode.get(adcode);
    if (!p) return null;
    return { center: p.center, bounds: p.focusBounds, rings: p.rings };
  }

  function dispose(): void {
    disposeCities();
    disposeProvinces();
    setHerbPois([]);
    setCountyPois([]);
    if (hoverLabel) {
      labelGroup.remove(hoverLabel);
      hoverLabel = null;
    }
    scene.remove(root);
    materials.length = 0;
  }

  return {
    setProvinces,
    setCities,
    setHover,
    setSelected,
    refreshHeights,
    setResolution,
    update,
    setEmphasis,
    setProvinceLabelsVisible,
    setProvinceStatLabels,
    setReservedRects,
    updateLabelLayout,
    hitTest,
    provinceFocusInfo,
    setYaoProvinceAdcodes,
    setProvinceStats,
    setHerbPois,
    setCountyPois,
    dispose,
  };
}
