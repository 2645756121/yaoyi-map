/**
 * terrainViewer.ts —— Three.js 地形浮雕查看器（框架无关的纯 TS 模块）
 *
 * 职责划分（与 React 完全解耦，便于单测与复用）：
 *   1. 场景 / 渲染器 / 相机 / 控制器（OrbitControls：拖拽旋转、滚轮缩放、平移）
 *   2. 光照系统：环境光 + 方向光（含阴影）+ 半球光，营造起伏立体感
 *   3. 地形网格：高度图 → 顶点位移 → 顶点高程着色 → 法线重算，得到真实浮雕曲面
 *   4. 暗色台座：模拟实体模型底托，强化"一块地形"的形体感
 *   5. 行政区划：省级边界框选（不同色相区分）、悬停/选中高亮、下级区划与中文标注
 *   6. 交互拾取：射线在高度场上行进求交 → 省份点击 → 平滑聚焦（420ms）；CSS2D 标注
 *   7. 视角预设与平滑过渡、按需渲染（无变化不重绘）、FPS 统计、正确的资源释放
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { elevationToRgb, type Rgb } from './palette';
import { buildTintField, sampleTint, mixTint, type TintField, type TintPoint } from './terrainTint';
import { sampleElevation, buildNormalMapData, type Heightmap } from './heightmap';
import { createProjection } from './geoProjection';
import {
  createBoundaryOverlay,
  type GeoFeatureCollection,
  type PoiItem,
  type ProvinceFocusInfo,
  type ProvincePick,
  type ProvinceStat,
  type ReservedRect,
} from './boundaryOverlay';
import {
  FOCUS_PATCH_FADE_MS,
  FOCUS_PATCH_MAX_SEGMENTS,
  computeFocusGlobalSegments,
  computePatchGrid,
  type FocusLodState,
} from './focusLod';
import { createTourOverlay, type TourOverlay } from './tourOverlay';
import type { TourNode } from './tourData';

/* ------------------------------------------------------------------ 类型 */

export type ViewPresetName = 'top' | 'overview' | 'front' | 'southwest' | 'southeast' | 'low';

export interface ViewerStats {
  fps: number;
  triangles: number;
  /** 当前**全局**网格段数（聚焦降级时会变小） */
  globalSegments: number;
  /** 焦点省高精度补片分段（未聚焦为 null） */
  patchSegX: number | null;
  patchSegY: number | null;
}

export interface TerrainViewerOptions {
  container: HTMLElement;
  heightmap: Heightmap;
  /** 起伏高度 / 模型宽度（如 0.06 = 最高峰为宽度的 6%） */
  reliefRatio?: number;
  /** 网格分段数（越大越细，三角面越多） */
  segments?: number;
  wireframe?: boolean;
  /** 周期性统计回调（约每 0.5s 一次） */
  onStats?: (s: ViewerStats) => void;
  /** 点击省份回调；点中空白/海洋时 pick 为 null */
  onProvinceClick?: (pick: ProvincePick | null) => void;
  /** 点位（草药 / 瑶族县）被点击回调：与 2D 地图一致，用于打开对应详情弹窗 */
  onPoiSelect?: (item: PoiItem) => void;
  /** 旅游路线节点被点击回调：由 React 打开该地点的图文展示面板 */
  onTourNodeClick?: (node: TourNode) => void;
  /** 相机方位角变化回调（罗盘方位角：0=正北、90=正东、180=正南；约 8 次/秒） */
  onCameraChange?: (bearingDeg: number) => void;
  /** 路线模式下用户把相机拉远到明显离开路线区域：请求上层自动退出路线 */
  onTourAutoExit?: () => void;
}

export interface TerrainViewerApi {
  setReliefRatio(v: number): void;
  setSegments(n: number): void;
  /**
   * 专题晕染（"药田晕染"）：传入核点（经纬度 + 0~1 权重）即在地表叠一层淡色场；
   * 传 null 关闭。会强制重建网格（一次性开销 ~几十毫秒）。
   */
  setTintLayer(points: Array<{ lon: number; lat: number; weight: number }> | null): void;
  setWireframe(on: boolean): void;
  setAutoRotate(on: boolean): void;
  applyPreset(name: ViewPresetName): void;
  resetView(): void;
  /** 按倍率缩放（>1 拉远、<1 推近），用于对齐 2D 地图的 +/- 缩放控件 */
  zoomBy(factor: number): void;
  /** 设置省级行政边界（FeatureCollection，adcode/name 必填） */
  setProvinceFeatures(fc: GeoFeatureCollection | null): void;
  /** 设置当前聚焦省份的下级区划边界（城市/区县） */
  setCityFeatures(fc: GeoFeatureCollection | null): void;
  /** 省份名称常显开关（此开关状态由 React 侧持有并持久化；同时控制下级区划名称） */
  setProvinceLabelsVisible(on: boolean): void;
  /** 省名后附省级统计数字（与药田晕染联动） */
  setProvinceStatLabels(on: boolean): void;
  /** 上报 UI 面板占用的矩形（画布坐标系像素），名称标注一律避让，避免文字压到控制台上 */
  setReservedRects(rects: ReservedRect[]): void;
  /** 设置瑶族相关省（2 位 adcode）：决定省份配色语义（有数据=绿系 / 无数据=灰） */
  setYaoProvinceAdcodes(adcodes: string[]): void;
  /** 设置各省统计（悬停信息卡用，对齐 2D tooltip 内容） */
  setProvinceStats(stats: Map<string, ProvinceStat>): void;
  /** 设置草药点位（对齐 2D 草药标记层） */
  setHerbPois(items: PoiItem[]): void;
  /** 设置瑶族县点位（聚焦某省时显示，对齐 2D 县级药丸标记） */
  setCountyPois(items: PoiItem[]): void;
  /** 平滑聚焦到指定省份；返回是否命中该省 */
  focusProvince(adcode: number): boolean;
  /** 开关旅游路线层；开启时自动平滑飞至路线范围。
   *  keepView=true 时关闭仅隐藏图层、不重置相机 —— 用于"点省份顺带退出路线"，
   *  避免把紧接着的省份聚焦镜头冲掉。 */
  setTourVisible(on: boolean, keepView?: boolean): void;
  /** 旅游路线层是否可见 */
  isTourVisible(): boolean;
  /** 飞入路线节点：420ms 推近 + 切换到节点级高精度地形；insetRight 为右侧详情面板宽度（px） */
  focusTourNode(node: TourNode, insetRight: number): void;
  /** 退出节点取景：补片淡出并回到路线总览 */
  exitTourNode(): void;
  /** 高亮当前打开的路线节点（徽标放大动画），null 取消 */
  setTourActiveNode(id: string | null): void;
  /** 飞回整条路线的总览视角（不清除节点高亮，由 React 侧决定） */
  showTourOverview(): void;
  /** 当前相机罗盘方位角（0=正北、90=正东、180=正南） */
  getCameraBearing(): number;
  /** 当前聚焦 LOD 状态（全局段数 / 焦点省补片分段），用于 UI 展示细节等级 */
  getFocusLodState(): FocusLodState;
  dispose(): void;
}

/* ------------------------------------------------------------------ 常量 */

/** 模型宽度（世界单位）；深度按高度图墨卡托纵横比推导，保证不变形 */
const MODEL_WIDTH = 100;
const DEFAULT_RELIEF_RATIO = 0.06;
/** 网格分段默认值：512 段 ≈ 39 万三角面，细节与性能的平衡点 */
const DEFAULT_SEGMENTS = 512;
const CAMERA_FOV = 45;
/** 视角预设切换动画时长（毫秒）；需求要求聚焦动画控制在 300~500ms */
const TRANSITION_MS = 420;
/** 路线模式下拉远自动退出的距离倍数（相对取景距离） */
const TOUR_AUTO_EXIT_FACTOR = 2.2;

/**
 * 专题晕染的采样器（UV → 0~1）。null = 关闭。
 *
 * 为什么放在模块作用域：`buildTerrainGeometry` 是模块级函数，逐顶点上色时需要读它；
 * 由 `createTerrainViewer()` 内的 `setTintLayer()` 负责构建与清空。
 */
let activeTint: ((u: number, v: number) => number) | null = null;
/** 保留场本身，便于聚焦补片等其它几何体复用同一次采样 */
let activeTintField: TintField | null = null;
/** 点击省份的聚焦动画时长（毫秒） */
const FOCUS_MS = 420;
const DEG2RAD = Math.PI / 180;

/**
 * 视角预设。
 *   bearing —— 相机所在位置的**罗盘方位角**（0°=正北、90°=正东、180°=正南、270°=正西）；
 *              模型坐标中北为 -Z、东为 +X，故相机方向 = (sin b, sin el, -cos b) 归一化。
 *   el      —— 相机仰角（0°=贴地平视、90°=正上方俯视）。
 *   factor  —— 相对"完整容纳整块模型"的距离倍率（1.0 = 刚好框满 + 6% 边距）。
 *
 * 取向原则（常规工程/制图查看习惯）：
 *   1. 相机一律布置在目标的**南侧半空间**（bearing 在 90°~270° 之间），
 *      three 的 lookAt 会以 (0,1,0) 为 up 解算相机基向量，只有南侧布置才能得到
 *      "**北朝上、东朝右**"的正向地图朝向；
 *   2. 若把相机放到正北（bearing≈0），up 会退化成"南朝上、东朝左"——即整幅图上下颠倒（历史缺陷）。
 *      因此不再提供"从北向南看"的预设，改为工程上更常用的"正南前视"。
 */
const PRESETS: Record<ViewPresetName, { bearing: number; el: number; factor: number }> = {
  // 顶视图（正俯视）：相机略偏南、近垂直俯视 → 北朝上、东朝右，等价于常规平面地图
  top: { bearing: 180, el: 88, factor: 1.0 },
  // 国土总览（**默认初始视角**）：正南方向、取消偏航 + 抬升仰角。
  //   与等轴测相比：版图长边与画面横轴对齐（不再按对角线取景）、南北向投影压缩由 sin35°≈0.57
  //   提升到 sin58°≈0.85 → 可读尺度显著提高、省名可容纳数量更多；
  //   仰角 58° 仍保留明确的光影起伏，兼顾"业务可读"与"浮雕质感"。
  overview: { bearing: 180, el: 58, factor: 1.0 },
  // 前视图（正南前视）：相机在正南、中等仰角向北看 → 看整体轮廓与主剖面，最接近翻看纸质图/模型正面的习惯
  front: { bearing: 180, el: 28, factor: 1.0 },
  // 西南等轴测：兼顾平面格局与高度起伏，最能体现三维质感的通用查看角度
  southwest: { bearing: 225, el: 35, factor: 1.0 },
  // 东南等轴测：与西南镜像，便于观察东侧海岸线、平原与丘陵
  southeast: { bearing: 135, el: 35, factor: 1.0 },
  // 低角度侧视：近水平，突出山脉剪影与起伏节奏
  low: { bearing: 210, el: 9, factor: 1.04 },
};

/** 缓动：ease-in-out cubic */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 镜头过渡用 smoothstep（三次 Hermite）：两端一阶导为 0，中段峰值速度仅 1.5 倍。
 *
 * 曾试过 quintic（16t^5）：它的 ease-in 过强 —— t=0.3 时只走了 3.9% 的距离，
 * 逐帧录制里表现为「先几乎不动、再猛地窜进去」，反而更生硬。
 * smoothstep 在 t=0.3 已走 21.6%，起步即响应、中段匀速感更强、收尾自然减速。
 */
function easeInOutSmooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/* ------------------------------------------------- 地形几何构建（核心） */

interface TerrainGeometryResult {
  geometry: THREE.BufferGeometry;
  /** 每个顶点的高程（米），用于仅更新高度时快速重建 */
  elevations: Float32Array;
  /** 每个顶点的归一化高程（0~1，1 = 最高峰）；写回 Y 时用它乘系数，保证反复调参幂等 */
  normHeights: Float32Array;
}

/**
 * 由高度图生成地形曲面几何：
 *   - 顶点按「墨卡托等距」在 XZ 平面上铺开，Y 取自高度图双线性采样
 *   - 逐顶点写入高程分层设色（顶点色）
 *   - 保证三角面绕序使法线朝上，避免被背面剔除
 *
 * 注意：Y 在此处写入的是**归一化高程**（0~1），实际起伏由 applyRelief() 乘系数写入，
 * 这样「地形高度缩放」反复调整不会累积相乘。
 */
function buildTerrainGeometry(
  hm: Heightmap,
  segX: number,
  segY: number,
  depth: number,
  maxElevation: number,
): TerrainGeometryResult {
  const cols = segX + 1;
  const rows = segY + 1;
  const count = cols * rows;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const elevations = new Float32Array(count);
  const normHeights = new Float32Array(count);
  const rgb: Rgb = [0, 0, 0];
  const color = new THREE.Color();
  // 谷地压暗（廉价 AO 近似）的采样步长与深度归一化尺度
  const aoStep = 1.5 / Math.max(segX, segY);
  const aoScale = Math.max(60, maxElevation * 0.012);

  for (let iy = 0; iy < rows; iy++) {
    const v = iy / segY; // 0 = 北边缘
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / segX; // 0 = 西边缘
      const idx = iy * cols + ix;
      const elev = sampleElevation(hm, u, v);
      const norm = Math.max(elev, 0) / maxElevation;

      positions[idx * 3] = (u - 0.5) * MODEL_WIDTH;
      positions[idx * 3 + 1] = norm; // 归一化高度，缩放时只乘系数
      positions[idx * 3 + 2] = (v - 0.5) * depth;

      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = 1 - v;

      elevations[idx] = elev;
      normHeights[idx] = norm;

      // 顶点色：高程分层设色（sRGB → Three 线性工作空间）
      elevationToRgb(elev, rgb);
      // 专题晕染（"药田晕染"）：关闭时 activeTint 为 null，零额外开销
      if (activeTint) {
        const tv = activeTint(u, v);
        if (tv > 0.02) mixTint(rgb, tv);
      }

      // 谷地压暗：中心低于四邻均值时按凹陷深度压暗，给沟谷补上体积感
      // （只做 4 次采样，相对逐顶点光照几乎无开销）
      const around =
        (sampleElevation(hm, u + aoStep, v) +
          sampleElevation(hm, u - aoStep, v) +
          sampleElevation(hm, u, v + aoStep) +
          sampleElevation(hm, u, v - aoStep)) /
        4;
      const concavity = Math.max(0, (around - elev) / aoScale);
      // 山谷 AO 只保留很轻的一层（0.10 上限），此前 0.24 会让沟谷连成灰棕斑块、显"脏"
      const ao = 1 - Math.min(0.1, concavity * 0.1);

      color.setRGB(
        (rgb[0] / 255) * ao,
        (rgb[1] / 255) * ao,
        (rgb[2] / 255) * ao,
        THREE.SRGBColorSpace,
      );
      colors[idx * 3] = color.r;
      colors[idx * 3 + 1] = color.g;
      colors[idx * 3 + 2] = color.b;
    }
  }

  // 索引：每个网格单元两个三角面
  const indices: number[] = [];
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // 校验绕序：若首面法线朝下则整体翻转，保证正面朝上（从上方可见）
  {
    // 只需要 X/Z 分量参与叉积的 Y 分量计算，Y 分量无需读取
    const [i0, i1, i2] = [indices[0], indices[1], indices[2]];
    const ax = positions[i0 * 3], az = positions[i0 * 3 + 2];
    const bx = positions[i1 * 3], bz = positions[i1 * 3 + 2];
    const cx = positions[i2 * 3], cz = positions[i2 * 3 + 2];
    // 叉积 (b-a) × (c-a) 的 Y 分量
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (ny < 0) {
      for (let i = 0; i < indices.length; i += 3) {
        const t = indices[i + 1];
        indices[i + 1] = indices[i + 2];
        indices[i + 2] = t;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.userData.elevations = elevations;
  geometry.userData.normHeights = normHeights;
  return { geometry, elevations, normHeights };
}

/**
 * 按归一化高程 × 起伏系数写回顶点 Y，并重算法线。
 * 使用**绝对赋值**（而不是在当前 Y 上再乘系数），因此反复调节缩放不会累积相乘导致地形畸变。
 */
function applyRelief(
  geometry: THREE.BufferGeometry,
  normHeights: Float32Array,
  reliefHeight: number,
): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let k = 0; k < normHeights.length; k++) {
    arr[k * 3 + 1] = normHeights[k] * reliefHeight;
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

/* ------------------------------------------------------- 查看器主入口 */

export function createTerrainViewer(options: TerrainViewerOptions): TerrainViewerApi {
  const { container, heightmap, onStats, onProvinceClick, onPoiSelect } = options;
  const maxElevation = Math.max(heightmap.meta.maxElevation, 1);
  const depth = MODEL_WIDTH / heightmap.meta.aspect;

  let reliefRatio = options.reliefRatio ?? DEFAULT_RELIEF_RATIO;
  let segments = options.segments ?? DEFAULT_SEGMENTS;
  const reliefHeight = () => MODEL_WIDTH * reliefRatio;

  // 按需渲染标记：任何会改变画面的操作都置 true（必须在 applyPreset/resize 之前声明）
  let needsRender = true;

  // 统计刷新标记：网格段数/焦点补片变化时置 true，让统计面板立刻反映实际精度，
  // 而不是等最多 500ms 的周期上报（否则会出现"下拉显示 512、统计仍显示旧值"的滞后）
  let statsDirty = false;

  /* ---------- 渲染器 ---------- */
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  // three r186 已移除 PCFSoftShadowMap，改用 PCFShadowMap（软阴影由外部模糊近似）
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  /* ---------- 场景与相机 ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef2);
  scene.fog = new THREE.Fog(0xe9eef2, MODEL_WIDTH * 2.6, MODEL_WIDTH * 6);

  // near 取模型尺度的千分之一：既能贴近观察澳门这类极小区域，又不会让深度精度崩坏（far/near ≈ 1.2万）
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, MODEL_WIDTH * 0.001, MODEL_WIDTH * 12);

  /* ---------- 光照系统：环境光 + 半球光 + 方向光（带阴影） ---------- */
  // 关键配比：环境光只负责"不死黑"，塑形交给方向光。
  // 环境光过高会让法线失去作用、整块地形显得扁平（旧值 1.05 即属此列）。
  const ambient = new THREE.AmbientLight(0xffffff, 0.86);
  scene.add(ambient);

  // 半球光：天空偏冷 / 地面偏暖，增强大面积起伏的方向感
  const hemi = new THREE.HemisphereLight(0xeaf2ff, 0x77836f, 0.5);
  scene.add(hemi);

  // 方向光：自西北上方照射，用"伪阴影"式的明暗差异体现立体感。
  // 注意：不再投射实时阴影 —— 单张 2048 阴影贴图覆盖全国，落到局部就是块状噪点（视觉"脏"的主因）；
  // 立体感改由法线贴图 + 半球光 + 方向光共同提供，观感干净且不受缩放影响。
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-MODEL_WIDTH * 0.7, MODEL_WIDTH * 1.05, -MODEL_WIDTH * 0.55);
  sun.castShadow = false;
  scene.add(sun);

  /**
   * CSS2D 标注的像素对齐 —— 两级，缺一不可。
   *
   * ① 位置：CSS2DRenderer 追加的坐标是连续浮点值（`translate(123.456px, ...)`），
   *    落在半像素上时文字会被抗锯齿糊开。
   * ② 居中：它固定使用 `translate(-50%,-50%)`；而药丸宽度带小数（11.5px 字号 + 内边距），
   *    百分比居中同样会产生 0.5px 偏移。**这是"只对齐位置后依然发虚"的残留原因。**
   *    这里改为按元素实测尺寸做整像素居中，彻底消除分数偏移。
   *
   * 尺寸按"内容签名"缓存，只有文字变化时才重新测量；另外每 30 帧强制复测一次，
   * 兼容字体加载完成后宽度变化的情况。静止帧不写 style，不产生额外重排。
   */
  const labelBoxCache = new WeakMap<HTMLElement, { w: number; h: number; sig: string }>();
  const labelSig = (el: HTMLElement): string => {
    const t = el.textContent ?? '';
    return `${t.length}|${t.charCodeAt(0) || 0}|${t.charCodeAt(t.length - 1) || 0}`;
  };
  let snapFrame = 0;

  function snapLabelTransforms(): void {
    const dpr = window.devicePixelRatio || 1;
    const forceRemeasure = snapFrame++ % 30 === 0;
    const kids = labelRenderer.domElement.children;
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i] as HTMLElement;
      const t = el.style.transform;
      if (!t) continue;
      // 真实格式：translate(-50%, -50%) translate(1188.31px, 360.47px) rotate(0rad)
      // 注意逗号后带空格、且末尾还有 rotate(...)，所以不能用"以 px 结尾"锚定。
      const m = /translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/.exec(t);
      if (!m) continue;
      const rot = /rotate\([^)]*\)/.exec(t);

      const sig = labelSig(el);
      let box = labelBoxCache.get(el);
      if (!box || box.sig !== sig || forceRemeasure) {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        // offsetWidth 为 0 说明还没布局（或已隐藏）：先跳过本帧，别把 0 写进缓存
        if (w === 0 || h === 0) continue;
        box = { w, h, sig };
        labelBoxCache.set(el, box);
      }

      const nx = Math.round(parseFloat(m[1]) * dpr) / dpr;
      const ny = Math.round(parseFloat(m[2]) * dpr) / dpr;
      const cx = Math.round(box.w / 2);
      const cy = Math.round(box.h / 2);
      const next =
        `translate(${-cx}px, ${-cy}px) translate(${nx}px, ${ny}px)` + (rot ? ` ${rot[0]}` : '');
      if (next !== t) el.style.transform = next;
    }
  }

  /* ---------- 暗色台座：模拟实体地形块底托 ---------- */
  const plinthH = MODEL_WIDTH * 0.035;
  const plinthGeo = new THREE.BoxGeometry(MODEL_WIDTH, plinthH, depth);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x2f3438,
    roughness: 0.88,
    metalness: 0.06,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  // 顶面略低于海平面，避免与水面共面产生 z-fighting
  plinth.position.y = -plinthH / 2 - 0.02;
  plinth.receiveShadow = true;
  scene.add(plinth);

  /* ---------- 地形网格 ---------- */
  // 法线贴图：把亚网格级起伏补进着色（比提高网格段数便宜得多），
  // 纹理坐标与几何自带的 uv 一致，可直接映射。
  const normalMapData = buildNormalMapData(heightmap);
  const normalTex = new THREE.DataTexture(
    normalMapData.data,
    normalMapData.width,
    normalMapData.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  normalTex.wrapS = THREE.ClampToEdgeWrapping;
  normalTex.wrapT = THREE.ClampToEdgeWrapping;
  normalTex.magFilter = THREE.LinearFilter;
  // 关键：法线贴图必须开 mipmap。
  // DataTexture 默认不生成 mipmap，而全国视角下这张 1024² 贴图被大幅缩小采样，
  // 会退化成高频闪烁噪点（观感就是"地形发脏/发麻"）。
  // 开三线性 + 各向异性后，远景按 mip 级别采样，表面立刻干净很多。
  normalTex.generateMipmaps = true;
  normalTex.minFilter = THREE.LinearMipmapLinearFilter;
  normalTex.anisotropy = 4;
  normalTex.needsUpdate = true;

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
    wireframe: options.wireframe ?? false,
    normalMap: normalTex,
    // 强度收一档：0.6 在远景会放大贴图噪点，0.45 既保留细节又不"麻"
    normalScale: new THREE.Vector2(0.45, 0.45),
  });

  // 说明：高程原始值随 geometry 一同存放于 geometry.userData.elevations，
  // 由 terrain.geometry.dispose() 与 mesh 引用释放一并回收，此处无需单独持有引用。
  let { geometry, normHeights } = buildTerrainGeometry(heightmap, segments, Math.round(segments / heightmap.meta.aspect), depth, maxElevation);
  applyRelief(geometry, normHeights, reliefHeight());
  const terrain = new THREE.Mesh(geometry, terrainMat);
  // 已关闭实时阴影（立体感改由法线贴图 + 半球光提供），这两个开关不再有实际作用
  terrain.castShadow = false;
  terrain.receiveShadow = false;
  scene.add(terrain);

  /* ---------- 聚焦 LOD（细节分级）状态 ----------
   * 用户设定的全局网格段数（下拉框）与"实际生效"的段数分开：
   * 聚焦某省时全局网格降到较低档、同时叠加该省的高精度补片，退出时恢复。
   */
  let baseSegments = segments;
  /** 当前是否存在聚焦补片 */
  let focusPatch: {
    mesh: THREE.Mesh;
    geometry: THREE.BufferGeometry;
    material: THREE.MeshStandardMaterial;
    alphaTexture: THREE.Texture;
    normHeights: Float32Array;
    segX: number;
    segY: number;
    opacity: number;
    fading: 'in' | 'out' | null;
    fadeStart: number;
  } | null = null;
  let focusedAdcode: number | null = null;
  /**
   * 待执行的 LOD 动作：**延后到渲染循环里执行**。
   * 重建全局网格 + 构建高精度补片是同步的重活（数十毫秒），若放在点击事件里会拖慢交互响应；
   * 延后一帧后，"点击 → 相机开始聚焦 + 面板更新"仍是同步完成的（<100ms），
   * 而细节增强会在补片的 260ms 淡入中自然呈现。
   */
  let pendingLodAction:
    | { kind: 'focus'; adcode: number; info: ProvinceFocusInfo }
    | { kind: 'clear' }
    | null = null;

  /* ---------- 地理投影 + 行政区划覆盖层 ---------- */
  const [bw, bs, be, bn] = heightmap.meta.bounds;
  const projection = createProjection({ west: bw, south: bs, east: be, north: bn }, MODEL_WIDTH, depth);

  /** 当前网格的纵向分段数 */
  const rowsOf = (segX: number) => Math.max(1, Math.round(segX / heightmap.meta.aspect));

  /**
   * 归一化地表高度（0~1）采样 —— **复刻渲染网格的插值方式**：
   * 先在 (segX, segY) 网格顶点上取高度（顶点高度来自高度图双线性采样），
   * 再在网格单元内做双线性插值。这样"边界线/拾取"与"实际渲染出的曲面"完全一致，
   * 不会出现线条悬空或穿入山体。
   */
  function sampleNormHeight(u: number, v: number): number {
    const cu = Math.min(Math.max(u, 0), 1);
    const cv = Math.min(Math.max(v, 0), 1);
    const segY = rowsOf(segments);
    const gx = cu * segments;
    const gy = cv * segY;
    const i = Math.min(Math.floor(gx), segments - 1);
    const j = Math.min(Math.floor(gy), segY - 1);
    const fx = gx - i;
    const fy = gy - j;
    const vert = (ix: number, iy: number) =>
      Math.max(sampleElevation(heightmap, ix / segments, iy / segY), 0) / maxElevation;
    const h00 = vert(i, j);
    const h10 = vert(i + 1, j);
    const h01 = vert(i, j + 1);
    const h11 = vert(i + 1, j + 1);
    const top = h00 * (1 - fx) + h10 * fx;
    const bot = h01 * (1 - fx) + h11 * fx;
    return top * (1 - fy) + bot * fy;
  }

  /** 模型 XZ 平面 → 地表世界 Y（与网格位移共用同一套高度函数，保证贴合） */
  function surfaceHeightAt(x: number, z: number): number {
    return sampleNormHeight(x / MODEL_WIDTH + 0.5, z / depth + 0.5) * reliefHeight();
  }

  /* ------------------------------------------------ 聚焦 LOD（细节分级） */

  /** 补片相对地表的微小抬升：始终压在全局网格之上，避免共面 z-fighting */
  const PATCH_Y_OFFSET = 0.03;

  /** 以指定段数重建**全局**网格（聚焦降级 / 退出恢复共用一条路径） */
  function rebuildTerrainMesh(segX: number, force = false): void {
    const next = Math.max(64, Math.min(Math.round(segX), 1024));
    if (next === segments && !force) return;
    const rebuilt = buildTerrainGeometry(heightmap, next, rowsOf(next), depth, maxElevation);
    terrain.geometry.dispose();
    geometry = rebuilt.geometry;
    normHeights = rebuilt.normHeights;
    // ⚠️ 必须同步 segments：它同时决定"当前网格的插值网格"（sampleNormHeight），
    //    漏掉这一步会导致边界线/拾取仍按旧段数插值（与网格不一致），且退出聚焦时无法恢复。
    segments = next;
    applyRelief(geometry, normHeights, reliefHeight());
    terrain.geometry = geometry;
    statsDirty = true;
    needsRender = true;
  }

  /** 把补片顶点 Y 按当前起伏系数写回（与全局网格同一套绝对赋值逻辑） */
  function applyPatchRelief(patch: NonNullable<typeof focusPatch>): void {
    const pos = patch.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const relief = reliefHeight();
    for (let k = 0; k < patch.normHeights.length; k++) {
      arr[k * 3 + 1] = patch.normHeights[k] * relief + PATCH_Y_OFFSET;
    }
    pos.needsUpdate = true;
    patch.geometry.computeVertexNormals();
    patch.geometry.computeBoundingSphere();
  }

  /** 立即销毁补片（切换省份 / 组件卸载时用） */
  function disposeFocusPatch(): void {
    if (!focusPatch) return;
    scene.remove(focusPatch.mesh);
    focusPatch.geometry.dispose();
    focusPatch.material.dispose();
    focusPatch.alphaTexture.dispose();
    focusPatch = null;
    statsDirty = true;
    needsRender = true;
  }

  /**
   * 构造局部高精度地形补片（省域聚焦 / 路线节点共用）：
   *   - 顶点 XZ 铺在给定包围盒内，Y 直接**精细采样源高程图**（不经过全局网格插值），
   *     因此起伏细节远高于全局网格（等价于"切换到更高精度的地形瓦片"）；
   *   - `rings` 非空时按这些外环光栅化成 alphaMap（省域形状）；
   *     `rings` 为 null 时改用**软边椭圆**遮罩（节点取景），补片边缘渐隐、与全局网格无缝衔接；
   *   - 顶点色沿用高程分层设色；材质 opacity 由淡入过渡驱动。
   */
  function buildAreaPatch(
    bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number },
    rings: Array<Array<[number, number]>> | null,
    minSegments: number,
  ): void {
    disposeFocusPatch();
    if (rings && rings.length === 0) return;

    const nw = projection.toModel(bounds.minLon, bounds.maxLat);
    const se = projection.toModel(bounds.maxLon, bounds.minLat);
    const x0 = Math.min(nw.x, se.x);
    const x1 = Math.max(nw.x, se.x);
    const z0 = Math.min(nw.z, se.z);
    const z1 = Math.max(nw.z, se.z);
    const spanX = Math.max(x1 - x0, MODEL_WIDTH * 0.004);
    const spanZ = Math.max(z1 - z0, MODEL_WIDTH * 0.004);

    const uv0 = projection.toUV(bounds.minLon, bounds.maxLat);
    const uv1 = projection.toUV(bounds.maxLon, bounds.minLat);
    const uMin = Math.min(uv0.u, uv1.u);
    const uMax = Math.max(uv0.u, uv1.u);
    const vMin = Math.min(uv0.v, uv1.v);
    const vMax = Math.max(uv0.v, uv1.v);
    const spanU = Math.max(uMax - uMin, 1e-6);
    const spanV = Math.max(vMax - vMin, 1e-6);

    // 补片分段不超过**源高程图在该省范围内的像素数**：再高也只是重复采样同一像素，
    // 既无视觉收益又白增顶点/构建耗时（这是把首帧耗时压到可接受范围的关键）。
    const srcCells = Math.max(spanU * heightmap.width, spanV * heightmap.height, 1);
    const patchMaxSeg = Math.max(
      minSegments,
      Math.min(FOCUS_PATCH_MAX_SEGMENTS, Math.ceil(srcCells)),
    );
    const { segX, segY } = computePatchGrid(spanX, spanZ, patchMaxSeg);

    const cols = segX + 1;
    const rows = segY + 1;
    const count = cols * rows;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    const norm = new Float32Array(count);
    const rgb: Rgb = [0, 0, 0];
    const color = new THREE.Color();

    for (let j = 0; j < rows; j++) {
      const tz = j / segY;
      const z = z0 + tz * spanZ;
      const v = z / depth + 0.5;
      for (let i = 0; i < cols; i++) {
        const tx = i / segX;
        const x = x0 + tx * spanX;
        const u = x / MODEL_WIDTH + 0.5;
        const idx = j * cols + i;
        const elev = Math.max(sampleElevation(heightmap, u, v), 0); // 精细采样源高程图
        const n = elev / maxElevation;
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = n;
        positions[idx * 3 + 2] = z;
        uvs[idx * 2] = (u - uMin) / spanU;
        uvs[idx * 2 + 1] = 1 - (v - vMin) / spanV;
        norm[idx] = n;
        elevationToRgb(elev, rgb);
        // 聚焦补片同样应用专题晕染，保证省内放大后色斑与全国视角连续
        if (activeTint) {
          const tv = activeTint(u, v);
          if (tv > 0.02) mixTint(rgb, tv);
        }
        color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
      }
    }

    const indices: number[] = [];
    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < segX; i++) {
        const a = j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);

    // 省界遮罩：把外环按 uv 光栅化到画布（白=省域内），作为 alphaMap
    const maskSize = Math.max(256, Math.min(1024, Math.round(Math.max(segX, segY) * 3)));
    const canvas = document.createElement('canvas');
    canvas.width = maskSize;
    canvas.height = maskSize;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, maskSize, maskSize);
      if (rings) {
        // 省域遮罩：把外环按 uv 光栅化（白=省域内）
        ctx.fillStyle = '#ffffff';
        for (const ring of rings) {
          if (ring.length < 3) continue;
          ctx.beginPath();
          for (let i = 0; i < ring.length; i++) {
            const p = projection.toUV(ring[i][0], ring[i][1]);
            const px = ((p.u - uMin) / spanU) * maskSize;
            const py = ((p.v - vMin) / spanV) * maskSize;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // 节点取景：软边椭圆遮罩（中心不透明 → 外缘透明），补片与全局网格渐隐衔接
        const c = maskSize / 2;
        const g = ctx.createRadialGradient(c, c, maskSize * 0.2, c, c, maskSize * 0.5);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.7, '#ffffff');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, maskSize, maskSize);
      }
    }
    const alphaTexture = new THREE.CanvasTexture(canvas);
    alphaTexture.needsUpdate = true;

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.02,
      alphaMap: alphaTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0, // 由淡入过渡驱动
    });
    const mesh = new THREE.Mesh(geom, material);
    mesh.receiveShadow = true;
    scene.add(mesh);

    focusPatch = {
      mesh,
      geometry: geom,
      material,
      alphaTexture,
      normHeights: norm,
      segX,
      segY,
      opacity: 0,
      fading: 'in',
      fadeStart: performance.now(),
    };
    applyPatchRelief(focusPatch);
    needsRender = true;
  }

  /** 省域聚焦补片：按省界外环裁形 */
  function buildFocusPatch(info: ProvinceFocusInfo): void {
    buildAreaPatch(info.bounds, info.rings, 0);
  }

  /** 进入聚焦（立即执行）：全局降级 + 焦点省补片（同一省重复聚焦不重复构建） */
  function applyFocusLodNow(adcode: number, info: ProvinceFocusInfo): void {
    if (focusedAdcode === adcode && focusPatch) return;
    focusedAdcode = adcode;
    rebuildTerrainMesh(computeFocusGlobalSegments(baseSegments));
    buildFocusPatch(info);
  }

  /** 退出聚焦（立即执行）：先恢复全局细节，再把补片淡出销毁（平滑过渡，无闪烁） */
  function clearFocusLodNow(): void {
    if (focusedAdcode === null && !focusPatch) return;
    focusedAdcode = null;
    rebuildTerrainMesh(baseSegments);
    if (focusPatch) {
      focusPatch.fading = 'out';
      focusPatch.fadeStart = performance.now();
      needsRender = true;
    }
  }

  /** 请求进入聚焦 LOD（延后一帧执行，保证点击响应速度） */
  function requestFocusLod(adcode: number, info: ProvinceFocusInfo): void {
    if (focusedAdcode === adcode && focusPatch) return;
    focusedAdcode = adcode; // 状态先落地，UI 立即能读到正确的"聚焦中/LOD 目标"
    pendingLodAction = { kind: 'focus', adcode, info };
    needsRender = true;
  }

  /** 请求退出聚焦 LOD（延后一帧执行） */
  function requestClearFocusLod(): void {
    if (focusedAdcode === null && !focusPatch && !pendingLodAction) return;
    focusedAdcode = null;
    pendingLodAction = { kind: 'clear' };
    needsRender = true;
  }

  const overlay = createBoundaryOverlay({
    scene,
    projection,
    sampleNormHeight,
    getReliefHeight: reliefHeight,
    // 加密步长取"约 256 段网格单元"的尺度：既能保证长直边贴合网格起伏，
    // 又不会把环拆得过碎（过碎会放大任何逐段描边伪影、让线条看起来"密集杂乱"）
    densifyStep: MODEL_WIDTH / 256,
    onPoiSelect,
  });

  /* ---------- 旅游路线层（红色文化 / 康养 / 瑶医 三条主题线） ----------
   * 默认隐藏；开启时由 React 侧调用 setTourVisible(true)，这里负责展示 + 相机适配。
   * 路线高度采样与地形网格同源（sampleNormHeight），因此贴合地表。
   */
  const tour: TourOverlay = createTourOverlay({
    scene,
    projection,
    sampleNormHeight,
    getReliefHeight: reliefHeight,
    getViewport: () => ({
      width: container.clientWidth || 1,
      height: container.clientHeight || 1,
    }),
    onNodeClick: options.onTourNodeClick,
  });

  /* ---------- CSS2D 标注渲染器（中文名称标注，不参与拾取） ---------- */
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  /* ---------- 相机控制：拖拽旋转 / 滚轮缩放 / 平移 ---------- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 0.9;
  controls.maxPolarAngle = Math.PI * 0.495; // 不允许钻到模型下方
  // 距离范围按模型尺度直接给定：下限允许贴近到澳门这类极小区域，上限避免缩到看不见模型
  controls.minDistance = MODEL_WIDTH * 0.0012;
  controls.maxDistance = MODEL_WIDTH * 3;
  controls.autoRotateSpeed = 0.55;

  function clampDistance(d: number): number {
    return Math.min(Math.max(d, controls.minDistance), controls.maxDistance);
  }

  /** 全国总览的目标点：模型中心略高于地表，避免贴地俯视 */
  function nationalTarget(): THREE.Vector3 {
    return new THREE.Vector3(0, surfaceHeightAt(0, 0) + reliefHeight() * 0.15, 0);
  }

  controls.target.copy(nationalTarget());

  /** 由罗盘方位角与仰角求"相机相对目标点"的单位方向 */
  function dirFromBearing(bearingDeg: number, elDeg: number): THREE.Vector3 {
    const b = bearingDeg * DEG2RAD;
    const e = elDeg * DEG2RAD;
    return new THREE.Vector3(Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e)).normalize();
  }

  /** 相机基向量与视场角正切（取景与适配共用） */
  function cameraFrame(dir: THREE.Vector3) {
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir);
    if (right.lengthSq() < 1e-8) right.set(0, 0, 1);
    right.normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();
    const tanV = Math.tan((CAMERA_FOV * DEG2RAD) / 2);
    const tanH = tanV * Math.max(camera.aspect, 0.25);
    return { right, camUp, tanV, tanH };
  }

  /** 模型包围盒 8 个角点（用于精确取景） */
  function modelCorners(): THREE.Vector3[] {
    const halfW = MODEL_WIDTH / 2;
    const halfD = depth / 2;
    const hMax = Math.max(reliefHeight(), 1e-3);
    const out: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const sy of [0, 1]) out.push(new THREE.Vector3(sx * halfW, sy * hMax, sz * halfD));
      }
    }
    return out;
  }

  /**
   * 全国总览取景：求解"完整容纳模型包围盒**且在画面中居中**"的目标点与距离。
   *
   * 1) 距离：把 8 个角点投到相机平面，竖直/水平两个方向分别求所需距离取最大值
   *    （旧实现固定用包围球半径，时而过远、时而过近）；
   * 2) 居中：透视投影下近端会被放大，投影范围的**中心并不落在目标点上**
   *    （实测前视图/等轴测会明显偏下、偏左，上方留出大片空白）。
   *    因此迭代地把目标点沿相机平面平移，直到投影范围的中心回到画面中心。
   */
  function frameModel(dir: THREE.Vector3, margin = 1.06): { target: THREE.Vector3; dist: number } {
    const { right, camUp, tanV, tanH } = cameraFrame(dir);
    const corners = modelCorners();
    const target = nationalTarget();
    let dist = 0;

    for (let iter = 0; iter < 3; iter++) {
      // (1) 所需距离
      let need = 0;
      for (const c of corners) {
        const rx = c.x - target.x;
        const ry = c.y - target.y;
        const rz = c.z - target.z;
        const along = rx * dir.x + ry * dir.y + rz * dir.z;
        const xOff = Math.abs(rx * right.x + ry * right.y + rz * right.z);
        const yOff = Math.abs(rx * camUp.x + ry * camUp.y + rz * camUp.z);
        need = Math.max(need, along + xOff / tanH, along + yOff / tanV);
      }
      dist = need;

      // (2) 投影范围中心（归一化，±1 = 画面半宽/半高）
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const c of corners) {
        const rx = c.x - target.x;
        const ry = c.y - target.y;
        const rz = c.z - target.z;
        const along = rx * dir.x + ry * dir.y + rz * dir.z;
        const depth = Math.max(dist - along, MODEL_WIDTH * 1e-4);
        const xn = (rx * right.x + ry * right.y + rz * right.z) / (tanH * depth);
        const yn = (rx * camUp.x + ry * camUp.y + rz * camUp.z) / (tanV * depth);
        if (xn < minX) minX = xn;
        if (xn > maxX) maxX = xn;
        if (yn < minY) minY = yn;
        if (yn > maxY) maxY = yn;
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      if (Math.abs(cx) < 0.002 && Math.abs(cy) < 0.002) break;

      // 目标点沿相机平面同向平移：模型偏上/偏右时把目标点也上移/右移，从而把投影中心拉回画面中心
      target.addScaledVector(right, cx * tanH * dist);
      target.addScaledVector(camUp, cy * tanV * dist);
    }

    return { target, dist: clampDistance(dist * margin) };
  }

  /**
   * 依据预设求相机位置与目标点。
   * 预设即"全国总览视角"：同时确定方向（方位角/俯仰角）、缩放级别与目标中心。
   */
  function positionFor(name: ViewPresetName): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const p = PRESETS[name];
    const dir = dirFromBearing(p.bearing, p.el);
    const { target, dist } = frameModel(dir, 1.06 * p.factor);
    return { pos: target.clone().addScaledVector(dir, dist), target };
  }

  /* ---------- 视角平滑过渡 ----------
   * 相机位移在**球坐标**下插值（半径 / 天顶角 / 方位角），而不是把起止位置直接做直线插值：
   *   1. 直线插值走的是弦，切换"正俯视 ↔ 低角度侧视"这类大角度时相机会**穿过模型上方并忽近忽远**，
   *      观感是"撞过去"而不是"转过去"；
   *   2. 球坐标插值让相机绕目标点**公转 + 推拉**，半径单独缓动 → 全程构图稳定、无穿模。
   * 方位角按**最短路径**取角（差值归一到 ±π），避免绕远路。
   */
  let transition: {
    fromTgt: THREE.Vector3; toTgt: THREE.Vector3;
    fromSph: THREE.Spherical; toSph: THREE.Spherical;
    start: number;
    duration: number;
  } | null = null;

  /**
   * 路线模式的"自动退出"阈值：取景距离的两倍以上即认为已离开路线区域。
   * tourExitArmAt 把检查推迟到取景过渡结束之后 —— 过渡期间相机从全国视角一路收拢，
   * 初始距离必然大于阈值，不延后就会刚开启就立刻退出。
   */
  let tourExitDistance = 0;
  let tourExitArmAt = 0;

  // 复用的临时对象，避免过渡期间每帧新建
  const _tTgt = new THREE.Vector3();
  const _tOffset = new THREE.Vector3();
  const _tSph = new THREE.Spherical();

  /** 相机位置（相对目标点）→ 球坐标 */
  function toSpherical(pos: THREE.Vector3, target: THREE.Vector3): THREE.Spherical {
    return new THREE.Spherical().setFromVector3(_tOffset.copy(pos).sub(target));
  }

  /**
   * 启动一段相机/视点平滑过渡。
   *
   * **时长按跨度自适应**：固定 420ms 在"全国 → 某景区"或"景区 A → 景区 B"这类大跨度切换时，
   * 等于要求镜头在 0.4 秒内跨越几十公里并同时缩放，观感就是"嗖一下窜过去"。
   * 这里用「角度变化 + 距离变化 + 目标点位移」估一个负载系数，把时长在 0.85x ~ 2.2x 之间伸缩。
   */
  function startTransition(pos: THREE.Vector3, target: THREE.Vector3, durationMs: number): void {
    const fromTgt = controls.target.clone();
    const fromSph = toSpherical(camera.position, fromTgt);
    const toSph = toSpherical(pos, target);
    // 方位角取最短路径：差值归一到 (-π, π]，避免"绕远路"转一大圈
    let dTheta = toSph.theta - fromSph.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    toSph.theta = fromSph.theta + dTheta;

    // ---- 跨度 → 时长 ----
    const base = Math.max(120, durationMs);
    const dAng = Math.abs(dTheta) + Math.abs(toSph.phi - fromSph.phi);
    const maxR = Math.max(fromSph.radius, toSph.radius, 1e-3);
    const dR = Math.abs(toSph.radius - fromSph.radius) / maxR;
    const dT = fromTgt.distanceTo(target) / Math.max(MODEL_WIDTH, 1);
    const load = Math.min(1.6, dAng / 2.2 + dR + dT * 1.6);
    const duration = Math.min(base * 2.4, Math.max(base * 0.85, base * (0.85 + 0.85 * load)));

    transition = {
      fromTgt,
      toTgt: target.clone(),
      fromSph,
      toSph,
      start: performance.now(),
      duration,
    };
    needsRender = true;
  }

  /** 推进过渡（每帧一次）：目标点线性移动，相机按球坐标缓动绕行 */
  function stepTransition(now: number): void {
    if (!transition) return;
    const t = Math.min((now - transition.start) / transition.duration, 1);
    const k = easeInOutSmooth(t);
    const { fromTgt, toTgt, fromSph, toSph } = transition;
    _tTgt.lerpVectors(fromTgt, toTgt, k);
    _tSph.set(
      fromSph.radius + (toSph.radius - fromSph.radius) * k,
      fromSph.phi + (toSph.phi - fromSph.phi) * k,
      fromSph.theta + (toSph.theta - fromSph.theta) * k,
    );
    camera.position.copy(_tTgt).add(_tOffset.setFromSpherical(_tSph));
    controls.target.copy(_tTgt);
    if (t >= 1) transition = null;
    needsRender = true;
  }

  function applyPreset(name: ViewPresetName): void {
    const { pos, target } = positionFor(name);
    startTransition(pos, target, TRANSITION_MS);
  }

  // 初始落位延后到首次 resize 之后：取景距离依赖 camera.aspect，必须等画布尺寸确定再算
  /* ---------- 尺寸自适应 ---------- */
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // 线宽以 CSS 像素为单位，需同步解析度；标注层也要同步尺寸
    overlay.setResolution(w, h);
    labelRenderer.setSize(w, h);
    needsRender = true;
  };
  resize();

  // 首次尺寸确定后再落位初始视角（不走动画）：默认用「国土总览」（正南俯瞰），
  // 版图长边对齐画面横轴、南北压缩小，首屏即可读清省域分布
  {
    const v = positionFor('overview');
    camera.position.copy(v.pos);
    controls.target.copy(v.target);
    controls.update();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);

  /* ---------- 渲染循环（按需渲染 + FPS 统计） ---------- */
  let rafId = 0;
  let disposed = false;
  let frames = 0;
  let lastStatsAt = performance.now();
  let lastFps = 0;
  /** 待应用的起伏系数：滑条高频触发时合并为每帧一次，避免逐事件重算法线造成卡顿 */
  let pendingReliefRatio: number | null = null;

  /** 应用起伏缩放：网格顶点 + 视点高度 + 边界线高度同步更新（绝对赋值，可反复调用） */
  function applyReliefRatio(ratio: number): void {
    reliefRatio = ratio;
    applyRelief(geometry, normHeights, reliefHeight());
    if (focusPatch) applyPatchRelief(focusPatch); // 焦点省补片同步升降，避免与全局网格错层
    // 视点跟随地表抬升/下沉，避免调参后视角相对地形漂移
    controls.target.y = surfaceHeightAt(controls.target.x, controls.target.z) + reliefHeight() * 0.15;
    overlay.refreshHeights();
    tour.refreshHeights(); // 旅游路线同步升降，避免起伏调参后路线悬空/埋入地表
    needsRender = true;
  }

  /**
   * 相机罗盘方位角（0=正北、90=正东、180=正南、270=正西）。
   * 模型坐标北为 -Z、东为 +X，故 atan2(dx, -dz) 即为相机相对目标点的罗盘方位。
   */
  function cameraBearing(): number {
    const dx = camera.position.x - controls.target.x;
    const dz = camera.position.z - controls.target.z;
    if (Math.hypot(dx, dz) < 1e-6) return 180;
    const deg = (Math.atan2(dx, -dz) * 180) / Math.PI;
    return (deg + 360) % 360;
  }
  /** 罗盘回调节流（约 8 次/秒；角度变化小于 0.3° 不回调） */
  let lastBearingAt = -1e9;
  let lastBearing = Number.NaN;

  const tick = () => {
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    const now = performance.now();

    if (pendingReliefRatio !== null) {
      const ratio = pendingReliefRatio;
      pendingReliefRatio = null;
      applyReliefRatio(ratio);
    }

    // 聚焦 LOD 的重活（重建全局网格 + 构建补片）：延后到此帧执行，避免拖慢点击响应
    if (pendingLodAction) {
      const act = pendingLodAction;
      pendingLodAction = null;
      if (act.kind === 'clear') clearFocusLodNow();
      else applyFocusLodNow(act.adcode, act.info);
    }

    // 焦点省补片的淡入/淡出过渡（退出聚焦时平滑消散，避免细节层级切换闪烁）
    if (focusPatch) {
      const patch = focusPatch;
      if (patch.fading) {
        const t = Math.min((now - patch.fadeStart) / FOCUS_PATCH_FADE_MS, 1);
        const k = easeInOut(t);
        patch.opacity = patch.fading === 'in' ? k : 1 - k;
        patch.material.opacity = patch.opacity;
        needsRender = true;
        if (t >= 1) {
          if (patch.fading === 'out') disposeFocusPatch();
          else patch.fading = null;
        }
      }
    }

    // 视角过渡动画（球坐标轨道式；时长由调用方指定：预设 420ms / 聚焦 420ms / 缩放 252ms）
    stepTransition(now);

    // 行政区划覆盖层的淡入过渡（返回 true 表示仍在变化）
    if (overlay.update(now)) needsRender = true;

    // 旅游路线流光动画（仅在开启时持续重绘）
    if (tour.update(now)) needsRender = true;
    // 路线节点名称：屏幕空间贪心避让（内部按 ~70ms 节流）
    tour.updateLabelLayout(camera, now);

    // 视角距离分级：全国总览时线条更细更淡，拉近后回到常规强度（避免"线条密集杂乱"）
    const camDist = camera.position.distanceTo(controls.target);
    const emphasis = (MODEL_WIDTH * 0.9 - camDist) / (MODEL_WIDTH * 0.9 - MODEL_WIDTH * 0.25);
    if (overlay.setEmphasis(emphasis)) needsRender = true;

    // 阻尼/自动旋转期间 update() 返回 true，需要持续重绘
    const cameraMoved = controls.update();

    // 路线模式：用户把相机拉远到明显离开路线区域 → 请求上层自动退出路线。
    // 只在取景过渡结束后判定；触发一次即清零，避免每帧重复回调。
    if (tourExitDistance > 0 && tour.isVisible() && now > tourExitArmAt) {
      if (camera.position.distanceTo(controls.target) > tourExitDistance) {
        tourExitDistance = 0;
        options.onTourAutoExit?.();
      }
    }

    // 罗盘方位回调：只在开启路线（React 侧渲染了指北针）时才有订阅者，开销可忽略
    if (options.onCameraChange) {
      const bearing = cameraBearing();
      if (now - lastBearingAt >= 120 && !(Math.abs(bearing - lastBearing) < 0.3)) {
        lastBearingAt = now;
        lastBearing = bearing;
        options.onCameraChange(bearing);
      }
    }

    // 省份名称常显层：需要最新的相机矩阵才能算准屏幕位置（render 内部才刷新 matrixWorldInverse）
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    if (overlay.updateLabelLayout(camera)) needsRender = true;

    if (cameraMoved || needsRender) {
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera); // CSS2D 中文标注随相机同步
      snapLabelTransforms();
      needsRender = false;
    }

    // FPS 统计（每 0.5s 上报一次）
    frames++;
    const due = now - lastStatsAt >= 500;
    if (due) {
      lastFps = Math.round((frames * 1000) / (now - lastStatsAt));
      frames = 0;
      lastStatsAt = now;
    }
    // 网格段数/补片变化时立即补发一次，使统计与实际精度同步（不等最多 500ms 的周期）
    if (due || statsDirty) {
      statsDirty = false;
      onStats?.({
        fps: lastFps,
        triangles: (geometry.index?.count ?? 0) / 3,
        globalSegments: segments,
        patchSegX: focusPatch?.segX ?? null,
        patchSegY: focusPatch?.segY ?? null,
      });
    }
  };
  rafId = requestAnimationFrame(tick);

  /* ---------- 拾取：射线在高度场上行进求交 ----------
   * 直接对 22 万三角面做 Raycaster 逐面求交会明显卡顿，这里利用"地形是高度场"的特点，
   * 沿射线以固定步长行进、比较采样高度与射线高度，命中后二分精修 → 每次拾取仅数百次采样。
   */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const HALF_W = MODEL_WIDTH / 2;
  const HALF_D = depth / 2;

  /** 求射线与模型 XZ 包围盒的交集参数区间 */
  function clipToBox(o: THREE.Vector3, d: THREE.Vector3): { tMin: number; tMax: number } | null {
    let tMin = 0;
    let tMax = camera.far;
    const axes: Array<[number, number, number, number]> = [
      [o.x, d.x, -HALF_W, HALF_W],
      [o.z, d.z, -HALF_D, HALF_D],
    ];
    for (const [origin, dir, lo, hi] of axes) {
      if (Math.abs(dir) < 1e-6) {
        if (origin < lo || origin > hi) return null;
        continue;
      }
      let t1 = (lo - origin) / dir;
      let t2 = (hi - origin) / dir;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }
    return { tMin, tMax };
  }

  /** 沿射线行进，返回与地表首个交点的世界坐标 */
  function marchHeightfield(o: THREE.Vector3, d: THREE.Vector3): THREE.Vector3 | null {
    const span = clipToBox(o, d);
    if (!span) return null;

    const step = MODEL_WIDTH / 360;
    const startDiff = o.y + d.y * span.tMin - surfaceHeightAt(o.x + d.x * span.tMin, o.z + d.z * span.tMin);
    if (startDiff <= 0) return o.clone().addScaledVector(d, span.tMin); // 起点已在地表之下

    let prevT = span.tMin;
    for (let t = span.tMin + step; t <= span.tMax; t += step) {
      const diff = o.y + d.y * t - surfaceHeightAt(o.x + d.x * t, o.z + d.z * t);
      if (diff <= 0) {
        // 二分精修穿越点
        let lo = prevT;
        let hi = t;
        for (let k = 0; k < 20; k++) {
          const mid = (lo + hi) * 0.5;
          const m = o.y + d.y * mid - surfaceHeightAt(o.x + d.x * mid, o.z + d.z * mid);
          if (m > 0) lo = mid;
          else hi = mid;
        }
        return o.clone().addScaledVector(d, (lo + hi) * 0.5);
      }
      prevT = t;
    }
    return null;
  }

  /** 屏幕坐标 → 经纬度（未命中地形返回 null） */
  function pickLonLat(clientX: number, clientY: number): { lon: number; lat: number } | null {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = marchHeightfield(raycaster.ray.origin, raycaster.ray.direction);
    if (!hit) return null;
    return projection.toLonLat(hit.x, hit.z);
  }

  /** 屏幕坐标 → 省份（命中判定与绘制的多边形数据完全一致） */
  function resolveProvince(clientX: number, clientY: number): ProvincePick | null {
    const ll = pickLonLat(clientX, clientY);
    return ll ? overlay.hitTest(ll.lon, ll.lat) : null;
  }

  /* ---------- 指针交互：悬停高亮 + 点击聚焦 ---------- */
  const canvas = renderer.domElement;
  canvas.style.cursor = 'grab';
  canvas.style.touchAction = 'none';

  let isPointerDown = false;
  let downInfo: { x: number; y: number; t: number } | null = null;
  let hoverRaf = 0;
  let pendingHover: { x: number; y: number } | null = null;
  let hoveredAdcode: number | null = null;
  let selectedAdcode: number | null = null;

  function onPointerMove(ev: PointerEvent): void {
    pendingHover = { x: ev.clientX, y: ev.clientY };
    if (hoverRaf) return;
    // 合并到每帧一次，避免高频 mousemove 造成重复拾取
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const p = pendingHover;
      pendingHover = null;
      if (!p || isPointerDown || disposed) return;
      const pick = resolveProvince(p.x, p.y);
      const adcode = pick ? pick.adcode : null;
      if (adcode !== hoveredAdcode) {
        hoveredAdcode = adcode;
        overlay.setHover(adcode);
        needsRender = true;
      }
      canvas.style.cursor = pick ? 'pointer' : 'grab';
    });
  }

  function onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    isPointerDown = true;
    downInfo = { x: ev.clientX, y: ev.clientY, t: performance.now() };
  }

  function onPointerUp(ev: PointerEvent): void {
    isPointerDown = false;
    const info = downInfo;
    downInfo = null;
    if (!info || ev.button !== 0) return;
    // 位移或时长超阈值 → 视为拖拽/长按，不触发点击（避免误触发）
    if (Math.hypot(ev.clientX - info.x, ev.clientY - info.y) > 6) return;
    if (performance.now() - info.t > 900) return;

    const pick = resolveProvince(ev.clientX, ev.clientY);
    selectedAdcode = pick ? pick.adcode : null;
    overlay.setSelected(selectedAdcode);
    needsRender = true;
    onProvinceClick?.(pick);
  }

  function onPointerLeave(): void {
    isPointerDown = false;
    downInfo = null;
    if (hoveredAdcode !== null) {
      hoveredAdcode = null;
      overlay.setHover(null);
      needsRender = true;
    }
    canvas.style.cursor = 'grab';
  }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  /* ---------- 省份聚焦：精准居中 + 平滑缩放 ---------- */
  /**
   * 把省份精准居中并完整框入视口。
   *  - 目标点用**要素质心**（视觉中心），而不是经纬包围盒中心：海南（含远海岛礁）、
   *    甘肃、内蒙古等因形状狭长或含离岛，包围盒中心明显偏离省域主体，
   *    直接用它会让聚焦后的省份偏离视口中心。
   *  - 适配范围用"主体环"包围盒：避免远海岛礁把范围撑大导致过度缩小。
   */
  function focusProvince(adcode: number): boolean {
    const info = overlay.provinceFocusInfo(adcode);
    if (!info) return false;

    const c = projection.toModel(info.center.lon, info.center.lat);
    const target = new THREE.Vector3(c.x, surfaceHeightAt(c.x, c.z), c.z);

    const nw = projection.toModel(info.bounds.minLon, info.bounds.maxLat);
    const se = projection.toModel(info.bounds.maxLon, info.bounds.minLat);
    const halfW = Math.max(Math.abs(se.x - nw.x) / 2, MODEL_WIDTH * 0.004);
    const halfD = Math.max(Math.abs(se.z - nw.z) / 2, MODEL_WIDTH * 0.004);

    // 保持当前观察方向；仰角过平则抬高，避免聚焦时贴地俯冲
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.copy(dirFromBearing(PRESETS.southwest.bearing, PRESETS.southwest.el));
    dir.normalize();
    if (dir.y < 0.32) dir.set(dir.x, 0.32, dir.z).normalize();

    // 与"全国适配"同一套角点法：以目标点为中心，取省域在 XZ 上的半宽半深与竖直高度，
    // 分别按竖直/水平视场角求所需距离，取最大值 → 任意屏幕宽高比都能完整框住
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir);
    if (right.lengthSq() < 1e-8) right.set(0, 0, 1);
    right.normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();
    const tanV = Math.tan((CAMERA_FOV * DEG2RAD) / 2);
    const tanH = tanV * Math.max(camera.aspect, 0.25);
    const hHalf = Math.max(reliefHeight() - target.y, target.y, MODEL_WIDTH * 0.002);

    let need = 0;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const rx = sx * halfW;
          const ry = sy * hHalf;
          const rz = sz * halfD;
          const along = rx * dir.x + ry * dir.y + rz * dir.z;
          const xOff = Math.abs(rx * right.x + ry * right.y + rz * right.z);
          const yOff = Math.abs(rx * camUp.x + ry * camUp.y + rz * camUp.z);
          need = Math.max(need, along + xOff / tanH, along + yOff / tanV);
        }
      }
    }

    const dist = clampDistance(need * 1.25);
    startTransition(target.clone().addScaledVector(dir, dist), target, FOCUS_MS);
    // 切入聚焦 LOD（全局降级 + 该省高精度补片）：本帧只登记请求，重活延后一帧执行，
    // 从而保证"点击 → 相机开始聚焦 / 面板更新"的响应时间远小于 100ms
    requestFocusLod(adcode, info);
    return true;
  }

  /**
   * 平滑聚焦到任意经纬包围盒（旅游路线取景用）。
   *
   * 与 focusProvince 共用"角点法"求距离，但方向固定为「正南俯瞰」（读图习惯最好），
   * 并把边距放大到 1.55 倍：路线只占画面中部约一半，四周保留山体语境，
   * 避免整屏都是路线而失去"这是粤北山区"的空间感。
   */
  function focusLonLatBounds(bounds: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  }): number {
    const nw = projection.toModel(bounds.minLon, bounds.maxLat);
    const se = projection.toModel(bounds.maxLon, bounds.minLat);
    const cx = (nw.x + se.x) / 2;
    const cz = (nw.z + se.z) / 2;
    const midUv = projection.toUV(
      (bounds.minLon + bounds.maxLon) / 2,
      (bounds.minLat + bounds.maxLat) / 2,
    );
    const relief = reliefHeight();
    const target = new THREE.Vector3(
      cx,
      sampleNormHeight(midUv.u, midUv.v) * relief + relief * 0.15,
      cz,
    );
    const halfW = Math.max(Math.abs(se.x - nw.x) / 2, MODEL_WIDTH * 0.004);
    const halfD = Math.max(Math.abs(se.z - nw.z) / 2, MODEL_WIDTH * 0.004);

    const dir = dirFromBearing(PRESETS.overview.bearing, PRESETS.overview.el);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();
    const tanV = Math.tan((CAMERA_FOV * DEG2RAD) / 2);
    const tanH = tanV * Math.max(camera.aspect, 0.25);
    // 局部取景只需容纳该区域自身的起伏量级，不能沿用"全国起伏高"（否则相机被推得很远）
    const hHalf = Math.max(relief * 0.25, MODEL_WIDTH * 0.002);

    let need = 0;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const rx = sx * halfW;
          const ry = sy * hHalf;
          const rz = sz * halfD;
          const along = rx * dir.x + ry * dir.y + rz * dir.z;
          const xOff = Math.abs(rx * right.x + ry * right.y + rz * right.z);
          const yOff = Math.abs(rx * camUp.x + ry * camUp.y + rz * camUp.z);
          need = Math.max(need, along + xOff / tanH, along + yOff / tanV);
        }
      }
    }

    const dist = clampDistance(need * 1.22);
    startTransition(target.clone().addScaledVector(dir, dist), target, TRANSITION_MS);
    return dist;
  }

  /* ---------------- 路线节点取景（点击节点 → 推近 + 高精度地形） ---------------- */

  /** 节点取景的经度跨度（°）：约 85 km，兼顾"看得清地形"与"保留周边语境" */
  const NODE_SPAN_LON = 0.85;
  /** 节点取景的纬度跨度（°） */
  const NODE_SPAN_LAT = 0.64;
  /** 节点补片的最小分段：在源像素之上做过采样，用于消除全局网格的块状感 */
  const NODE_PATCH_MIN_SEG = 96;

  /**
   * 平滑飞入单个路线节点，并切换到**节点级地形精度**：
   *   - 相机 420ms 推近到约 85km 视野（满足 300~500ms 的过渡要求）；
   *   - 同步生成局部高精度补片（Y 精细采样源高程图 + 软边椭圆遮罩），淡入后替换该区域的粗糙三角面；
   *   - `insetRight` 是右侧详情面板宽度（px）：把目标点沿相机右向量平移，
   *     使节点落在面板左侧可视区的中心，而不是被面板盖住。
   */
  function focusTourNode(node: TourNode, insetRight: number): void {
    const uv = projection.toUV(node.lon, node.lat);
    const m = projection.toModel(node.lon, node.lat);
    const relief = reliefHeight();
    const target = new THREE.Vector3(
      m.x,
      sampleNormHeight(uv.u, uv.v) * relief + relief * 0.08,
      m.z,
    );

    const west = projection.toModel(node.lon - NODE_SPAN_LON / 2, node.lat);
    const east = projection.toModel(node.lon + NODE_SPAN_LON / 2, node.lat);
    const north = projection.toModel(node.lon, node.lat + NODE_SPAN_LAT / 2);
    const south = projection.toModel(node.lon, node.lat - NODE_SPAN_LAT / 2);
    const halfW = Math.max(Math.abs(east.x - west.x) / 2, MODEL_WIDTH * 0.002);
    const halfD = Math.max(Math.abs(south.z - north.z) / 2, MODEL_WIDTH * 0.002);

    const dir = dirFromBearing(PRESETS.overview.bearing, 52);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();
    const tanV = Math.tan((CAMERA_FOV * DEG2RAD) / 2);
    const tanH = tanV * Math.max(camera.aspect, 0.25);
    const hHalf = Math.max(relief * 0.12, MODEL_WIDTH * 0.002);

    let need = 0;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const rx = sx * halfW;
          const ry = sy * hHalf;
          const rz = sz * halfD;
          const along = rx * dir.x + ry * dir.y + rz * dir.z;
          const xOff = Math.abs(rx * right.x + ry * right.y + rz * right.z);
          const yOff = Math.abs(rx * camUp.x + ry * camUp.y + rz * camUp.z);
          need = Math.max(need, along + xOff / tanH, along + yOff / tanV);
        }
      }
    }
    const dist = clampDistance(need);

    // 右侧面板遮挡补偿
    if (insetRight > 0) {
      const divW = Math.max(container.clientWidth, 1);
      const frac = Math.min(insetRight / 2 / divW, 0.4);
      const viewW = 2 * dist * tanH;
      target.addScaledVector(right, frac * viewW);
    }

    startTransition(target.clone().addScaledVector(dir, dist), target, TRANSITION_MS);

    // 节点级地形精度：局部高精度补片（淡入）
    buildAreaPatch(
      {
        minLon: node.lon - NODE_SPAN_LON / 2,
        maxLon: node.lon + NODE_SPAN_LON / 2,
        minLat: node.lat - NODE_SPAN_LAT / 2,
        maxLat: node.lat + NODE_SPAN_LAT / 2,
      },
      null,
      NODE_PATCH_MIN_SEG,
    );
  }

  /** 退出节点取景：补片淡出 + 回到整条路线的总览取景 */
  /**
   * 退出单站取景（关闭详情）。
   *
   * 改前：直接 `focusLonLatBounds(tour.bounds())` 把镜头拉回整条路线的总览。
   * 于是"看完 A 站 → 切到 B 站"实际是「拉远到全线 → 再推近到 B」的来回镜头，
   * 两次大跨度过渡叠在一起，观感就是生硬、像被拽走。
   *
   * 改后：**保持当前视线与目标点**，只把距离轻微拉远 18% 作为"松开"的手感。
   * 需要回到全线总览时走显式的「全景」按钮（showTourOverview），语义更清楚。
   */
  function exitTourNode(): void {
    if (focusPatch) {
      focusPatch.fading = 'out';
      focusPatch.fadeStart = performance.now();
      needsRender = true;
    }
    const tgt = controls.target.clone();
    const offset = camera.position.clone().sub(tgt);
    if (offset.lengthSq() < 1e-8) return; // 退化保护：相机与目标点重合时不做过渡
    const dist = clampDistance(offset.length() * 1.18);
    startTransition(tgt.clone().addScaledVector(offset.normalize(), dist), tgt, TRANSITION_MS * 0.8);
  }

  /* ---------- 对外 API ---------- */
  return {
    setReliefRatio(v: number) {
      // 滑条高频触发：只记录最新值，由渲染循环每帧合并应用一次
      pendingReliefRatio = Math.min(Math.max(v, 0.005), 0.25);
      needsRender = true;
    },
    setSegments(n: number) {
      const next = Math.max(64, Math.min(Math.round(n), 1024));
      baseSegments = next;
      // 聚焦中：全局网格保持降级档（用户的新设定在退出聚焦时生效），避免"看起来没反应"
      rebuildTerrainMesh(focusedAdcode !== null ? computeFocusGlobalSegments(next) : next);
    },
    setTintLayer(points) {
      const uvPts: TintPoint[] = [];
      if (!points || points.length === 0) {
        activeTintField = null;
        activeTint = null;
      } else {
        for (const p of points) {
          if (!p || !Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
          const { u, v } = projection.toUV(p.lon, p.lat);
          uvPts.push({ u, v, weight: p.weight });
        }
        activeTintField = uvPts.length ? buildTintField(uvPts) : null;
        const field = activeTintField;
        activeTint = field ? (u, v) => sampleTint(field, u, v) : null;
      }
      // 强制重建：颜色写在顶点属性里，不重建不会生效
      rebuildTerrainMesh(segments, true);
      needsRender = true;
    },
    setWireframe(on: boolean) {
      terrainMat.wireframe = on;
      needsRender = true;
    },
    setAutoRotate(on: boolean) {
      controls.autoRotate = on;
      needsRender = true;
    },
    applyPreset,
    setProvinceFeatures(fc: GeoFeatureCollection | null) {
      overlay.setProvinces(fc);
      needsRender = true;
    },
    setCityFeatures(fc: GeoFeatureCollection | null) {
      overlay.setCities(fc);
      needsRender = true;
    },
    setProvinceLabelsVisible(on: boolean) {
      overlay.setProvinceLabelsVisible(on);
      needsRender = true; // 打开后需重绘一帧以便布局层算出可见集
    },
    setProvinceStatLabels(on: boolean) {
      overlay.setProvinceStatLabels(on);
      needsRender = true; // 文本变长会改变去重叠结果
    },
    setReservedRects(rects: ReservedRect[]) {
      overlay.setReservedRects(rects);
      needsRender = true; // 会让部分名称让位，需要重绘
    },
    setYaoProvinceAdcodes(adcodes: string[]) {
      overlay.setYaoProvinceAdcodes(adcodes);
    },
    setProvinceStats(stats: Map<string, ProvinceStat>) {
      overlay.setProvinceStats(stats);
      needsRender = true; // 悬停信息卡内容变化
    },
    setHerbPois(items: PoiItem[]) {
      overlay.setHerbPois(items);
      needsRender = true;
    },
    setCountyPois(items: PoiItem[]) {
      overlay.setCountyPois(items);
      needsRender = true;
    },
    focusProvince,
    setTourVisible(on: boolean, keepView = false) {
      if (on === tour.isVisible()) return; // 幂等：避免挂载时的初次 false 触发无谓的视角过渡
      tour.setVisible(on);
      if (on) {
        // 开启：直接平滑飞至路线范围（正南俯瞰），并记录"拉远退出"的阈值
        const d = focusLonLatBounds(tour.bounds());
        tourExitDistance = d * TOUR_AUTO_EXIT_FACTOR;
        tourExitArmAt = performance.now() + TRANSITION_MS + 350;
      } else {
        tourExitDistance = 0;
        // 关闭：回到全国总览的默认视角。
        // 注意：因"点省份"而退出路线时调用方会传 keepView=true，
        // 否则这里的 applyPreset 会把刚发起的省份聚焦镜头覆盖掉。
        if (!keepView) applyPreset('overview');
      }
      needsRender = true;
    },
    isTourVisible() {
      return tour.isVisible();
    },
    focusTourNode,
    exitTourNode,
    setTourActiveNode(id: string | null) {
      tour.setActiveNode(id);
    },
    showTourOverview() {
      focusLonLatBounds(tour.bounds());
    },
    getCameraBearing() {
      return cameraBearing();
    },
    zoomBy(factor: number) {
      // 保持当前观察方向，仅按倍率改变到目标点的距离（对齐 2D 地图缩放控件的行为）
      const offset = camera.position.clone().sub(controls.target);
      if (offset.lengthSq() < 1e-8) return;
      const dist = clampDistance(offset.length() * factor);
      const target = controls.target.clone();
      startTransition(target.clone().addScaledVector(offset.normalize(), dist), target, TRANSITION_MS * 0.6);
    },
    resetView() {
      // 返回全国：清除选中/悬停状态、退出聚焦 LOD，并回到默认初始视角（国土总览）
      requestClearFocusLod();
      overlay.setSelected(null);
      overlay.setHover(null);
      hoveredAdcode = null;
      selectedAdcode = null;
      applyPreset('overview');
    },
    getFocusLodState(): FocusLodState {
      return {
        focused: focusedAdcode !== null,
        globalSegments: segments,
        patchSegX: focusPatch?.segX ?? null,
        patchSegY: focusPatch?.segY ?? null,
      };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      disposeFocusPatch(); // 释放焦点省补片的几何/材质/遮罩纹理
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      controls.dispose();
      overlay.dispose();
      tour.dispose();
      geometry.dispose();
      terrainMat.dispose();
      normalTex.dispose();
      plinthGeo.dispose();
      plinthMat.dispose();
      renderer.dispose();
      // WebGL 上下文不会随 dispose() 自动释放。2D / 地形浮雕 切换是"卸载 + 重新挂载"，
      // 若不显式丢弃上下文，每次切换都会留下一个活动上下文；浏览器上限约 8~16 个，
      // 超限后最旧的上下文被强制丢弃，表现为画布突然空白或黑屏。
      try {
        renderer.forceContextLoss();
      } catch {
        // 宿主缺少 WEBGL_lose_context 扩展时忽略（不影响其余资源释放）
      }
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      if (labelRenderer.domElement.parentNode === container) {
        container.removeChild(labelRenderer.domElement);
      }
    },
  };
}

