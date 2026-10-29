/**
 * tourOverlay.ts —— 旅游路线在浮雕上的三维叠加层
 *
 * 组成：
 *   1. 路线丝带：贴合地形的带状网格（Catmull-Rom 平滑 → 逐点采样地形高度），
 *      丝带上叠加一张"箭头流光"纹理并逐帧平移，形成行进方向动画；
 *   2. 节点标记：CSS2D 圆形序号徽标（始终可见）+ 名称胶囊（屏幕空间贪心避让，放不下才隐藏）。
 *
 * 关键约定：
 *   - 路线在 **UV（归一化纹理坐标）空间**里做平滑，再由 u/v 反算模型 XZ：
 *     x=(u-0.5)*W、z=(v-0.5)*D（与 geoProjection.toModel 完全一致），
 *     这样高度采样 sampleNormHeight(u,v) 与几何位置天然同源，路线不会悬空或切入山体；
 *   - 丝带抬升一个很小的 Y 偏移并关闭 depthWrite，避免与地表共面闪烁；
 *   - 标记根元素是 0×0 的锚点（CSS2DRenderer 把它的左上角对到投影点），
 *     徽标/名称都用绝对定位挂在锚点上 → 无论名称放到哪一侧，序号圆点始终钉在地点上；
 *   - 名称位置由 `updateLabelLayout(camera)` 在屏幕空间试排（右/左/上/下/四个斜角），
 *     与已放置的胶囊、画布边界冲突就换下一个位置，全部放不下才隐藏名称（序号仍可见）。
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Projection } from './geoProjection';
import {
  CATEGORY_COLORS,
  TOUR_NODES,
  TOUR_NODE_BY_ID,
  TOUR_ROUTES,
  tourBounds,
  type TourNode,
} from './tourData';

/** 丝带基础宽度（世界单位；模型宽 100，路线视图下约 10~12px） */
const RIBBON_WIDTH = 0.06;
/** 丝带相对地表的抬升（避免 z-fighting，又不显"悬浮"） */
const RIBBON_Y_OFFSET = 0.03;
/** 节点标记相对地表的抬升 */
const MARKER_Y_OFFSET = 0.05;
/** 每个节点段的平滑采样数 */
const SAMPLES_PER_SEGMENT = 26;
/** 流光纹理在世界坐标里的重复周期（越小箭头越密） */
const FLOW_PERIOD = 0.5;
/** 流光速度（周期/秒） */
const FLOW_SPEED = 0.55;
/** 行进亮头的循环速度（全线/秒）：约 11 秒走完全程，与"拖尾流光"叠加 */
const HEAD_SPEED = 0.09;
/** 亮头光晕 / 白色核心的屏幕尺寸（世界单位） */
const HEAD_GLOW_SIZE = 0.46;
const HEAD_CORE_SIZE = 0.16;
/** 名称避让重排的最小间隔（ms），避免每帧读布局 */
const LABEL_LAYOUT_INTERVAL = 70;
/** 名称胶囊与徽标/画布的最小间隙 */
const CHIP_GAP = 6;
/** 徽标半径（22px 直径） */
const BADGE_R = 11;

const MARKER_STYLE_ID = 'tr-tour-style';

export interface TourOverlayOptions {
  scene: THREE.Scene;
  projection: Projection;
  /** 与渲染网格一致的地表高度采样（0~1） */
  sampleNormHeight: (u: number, v: number) => number;
  /** 当前起伏高度（世界单位） */
  getReliefHeight: () => number;
  /** 画布尺寸（标注避让用） */
  getViewport: () => { width: number; height: number };
  onNodeClick?: (node: TourNode) => void;
}

export interface TourBoundsRect {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface TourOverlay {
  setVisible(on: boolean): void;
  isVisible(): boolean;
  /** 起伏高度变化后重写所有顶点 Y 与标记高度 */
  refreshHeights(): void;
  /** 每帧调用：推进流光动画；返回是否需要重绘 */
  update(now: number): boolean;
  /** 相机/视口变化后重排节点名称（屏幕空间贪心避让） */
  updateLabelLayout(camera: THREE.Camera, now: number): void;
  /** 高亮当前打开的节点（徽标放大 + 光晕），null 取消 */
  setActiveNode(id: string | null): void;
  /** 全部节点的经纬包围盒（供相机适配） */
  bounds(): TourBoundsRect;
  dispose(): void;
}

/** 绘制"箭头流光"纹理：白色箭头 + 方向性拖尾，由材质 color 染色 */
function createFlowTexture(): THREE.CanvasTexture {
  const w = 96;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const tail = ctx.createLinearGradient(0, 0, w * 0.74, 0);
  tail.addColorStop(0, 'rgba(255,255,255,0)');
  tail.addColorStop(0.55, 'rgba(255,255,255,0.32)');
  tail.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = tail;
  ctx.fillRect(0, h * 0.36, w * 0.74, h * 0.28);

  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.beginPath();
  ctx.moveTo(w * 0.64, h * 0.14);
  ctx.lineTo(w * 0.92, h * 0.5);
  ctx.lineTo(w * 0.64, h * 0.86);
  ctx.lineTo(w * 0.74, h * 0.5);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 绘制"发光亮头"纹理：中心白、向外快速衰减，用于叠加混合的行进光点 */
function createHeadTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.34)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 注入节点标记样式（只注入一次） */
function ensureMarkerStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(MARKER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MARKER_STYLE_ID;
  style.textContent = `
.tr-tour-marker{position:absolute;width:0;height:0;pointer-events:none;
  font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;}
.tr-tour-badge{position:absolute;left:${-BADGE_R}px;top:${-BADGE_R}px;
  width:${BADGE_R * 2}px;height:${BADGE_R * 2}px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  color:#fff;font-size:11px;font-weight:700;line-height:1;
  border:2px solid rgba(255,255,255,.95);z-index:2;pointer-events:auto;cursor:pointer;
  box-shadow:0 2px 8px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.35);
  transition:transform 300ms cubic-bezier(.34,1.25,.64,1);}
.tr-tour-badge:hover{transform:scale(1.18);}
/* 选中（点击进入节点详情）：放大 + 外扩光晕，320ms 平滑过渡 */
.tr-tour-badge.is-active{transform:scale(1.55);z-index:5;
  box-shadow:0 0 0 5px rgba(255,255,255,.30), 0 4px 16px rgba(0,0,0,.55);}
.tr-tour-badge.is-active::after{animation-duration:1.6s;opacity:.7;}
.tr-tour-badge::after{content:'';position:absolute;inset:-5px;border-radius:50%;
  border:2px solid var(--c);opacity:0;animation:tr-tour-ping 2.4s ease-out infinite;}
@keyframes tr-tour-ping{0%{opacity:.55;transform:scale(.8)}70%{opacity:0;transform:scale(1.5)}100%{opacity:0}}
.tr-tour-name{position:absolute;white-space:nowrap;font-size:10px;font-weight:600;color:#fff;
  letter-spacing:.2px;padding:2px 7px;border-radius:9999px;background:rgba(22,32,26,.8);
  border:1px solid rgba(255,255,255,.28);box-shadow:0 2px 6px rgba(0,0,0,.32);
  z-index:1;pointer-events:auto;cursor:pointer;transition:opacity 150ms ease;}
.tr-tour-marker:hover .tr-tour-name{background:rgba(22,32,26,.92);}
`;
  document.head.appendChild(style);
}

/** UV 空间中的一个采样点 */
interface Lathe {
  u: number;
  v: number;
  x: number;
  z: number;
  nx: number;
  nz: number;
  /** 沿路线的纹理坐标（按世界距离累积） */
  tu: number;
}

interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: ScreenBox, b: ScreenBox, gap: number): boolean {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

export function createTourOverlay(options: TourOverlayOptions): TourOverlay {
  const { scene, projection, sampleNormHeight, getReliefHeight, getViewport, onNodeClick } =
    options;

  // 从投影四至推出模型宽/深（与 toModel 的映射完全一致）
  const pNW = projection.toModel(projection.bounds.west, projection.bounds.north);
  const pSE = projection.toModel(projection.bounds.east, projection.bounds.south);
  const MODEL_W = pSE.x - pNW.x;
  const MODEL_D = pSE.z - pNW.z;
  const toX = (u: number) => (u - 0.5) * MODEL_W;
  const toZ = (v: number) => (v - 0.5) * MODEL_D;

  const group = new THREE.Group();
  group.name = 'tour-overlay';
  group.visible = false;
  scene.add(group);

  ensureMarkerStyle();
  const flowTexture = createFlowTexture();
  const headTexture = createHeadTexture();

  interface RouteEntry {
    material: THREE.MeshBasicMaterial;
    geometry: THREE.BufferGeometry;
    glowMaterial: THREE.MeshBasicMaterial;
    glowGeometry: THREE.BufferGeometry;
    head: THREE.Sprite;
    core: THREE.Sprite;
    headMaterial: THREE.SpriteMaterial;
    coreMaterial: THREE.SpriteMaterial;
    lathes: Lathe[];
  }
  const routes: RouteEntry[] = [];

  interface MarkerEntry {
    node: TourNode;
    object: CSS2DObject;
    element: HTMLDivElement;
    badgeEl: HTMLSpanElement;
    nameEl: HTMLSpanElement;
    chipW: number;
    chipH: number;
  }
  const markers: MarkerEntry[] = [];

  /* ---------------- 采样：UV 空间 Catmull-Rom ---------------- */
  function buildRouteSamples(nodeIds: string[]): Lathe[] {
    const uvPts: THREE.Vector3[] = [];
    for (const id of nodeIds) {
      const node = TOUR_NODE_BY_ID.get(id);
      if (!node) continue;
      const uv = projection.toUV(node.lon, node.lat);
      uvPts.push(new THREE.Vector3(uv.u, 0, uv.v));
    }
    if (uvPts.length < 2) return [];

    const curve = new THREE.CatmullRomCurve3(uvPts, false, 'centripetal', 0.5);
    const count = Math.max(24, (uvPts.length - 1) * SAMPLES_PER_SEGMENT);
    const raw = curve.getPoints(count);

    const out: Lathe[] = [];
    let dist = 0;
    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      const prev = raw[Math.max(i - 1, 0)];
      const next = raw[Math.min(i + 1, raw.length - 1)];
      const x = toX(p.x);
      const z = toZ(p.z);
      const px = toX(prev.x);
      const pz = toZ(prev.z);
      const nxWorld = toX(next.x);
      const nzWorld = toZ(next.z);
      const tx = nxWorld - px;
      const tz = nzWorld - pz;
      const len = Math.hypot(tx, tz) || 1;
      if (i > 0) dist += Math.hypot(x - px, z - pz);
      out.push({ u: p.x, v: p.z, x, z, nx: -tz / len, nz: tx / len, tu: dist / FLOW_PERIOD });
    }
    return out;
  }

  /* ---------------- 几何写入 ---------------- */
  function writeRibbon(geometry: THREE.BufferGeometry, lathes: Lathe[], halfWidth: number): void {
    const n = lathes.length;
    if (n < 2) return;
    const relief = getReliefHeight();
    const positions = new Float32Array(n * 2 * 3);
    const uvs = new Float32Array(n * 2 * 2);
    for (let i = 0; i < n; i++) {
      const s = lathes[i];
      const y = sampleNormHeight(s.u, s.v) * relief + RIBBON_Y_OFFSET;
      const lx = s.x + s.nx * halfWidth;
      const lz = s.z + s.nz * halfWidth;
      const rx = s.x - s.nx * halfWidth;
      const rz = s.z - s.nz * halfWidth;
      positions[i * 6 + 0] = lx;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = lz;
      positions[i * 6 + 3] = rx;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = rz;
      uvs[i * 4 + 0] = s.tu;
      uvs[i * 4 + 1] = 0;
      uvs[i * 4 + 2] = s.tu;
      uvs[i * 4 + 3] = 1;
    }
    const indices: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, d, a, d, c);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
  }

  /* ---------------- 构建路线 ---------------- */
  for (const route of TOUR_ROUTES) {
    const lathes = buildRouteSamples(route.nodeIds);
    if (lathes.length < 2) continue;
    const color = new THREE.Color(route.color);

    const geometry = new THREE.BufferGeometry();
    const routeTexture = flowTexture.clone();
    routeTexture.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({
      map: routeTexture,
      color,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    writeRibbon(geometry, lathes, RIBBON_WIDTH);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    mesh.name = `tour-route-${route.id}`;

    const glowGeometry = new THREE.BufferGeometry();
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    writeRibbon(glowGeometry, lathes, RIBBON_WIDTH * 3.2);
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.renderOrder = 2;
    glow.frustumCulled = false;

    // 行进亮头（对应参考视频的"拖尾轨迹 + 头部高光"）：光晕 + 白色核心
    const headMaterial = new THREE.SpriteMaterial({
      map: headTexture,
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const head = new THREE.Sprite(headMaterial);
    head.scale.setScalar(HEAD_GLOW_SIZE);
    head.renderOrder = 5;
    head.frustumCulled = false;

    const coreMaterial = new THREE.SpriteMaterial({
      map: headTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const core = new THREE.Sprite(coreMaterial);
    core.scale.setScalar(HEAD_CORE_SIZE);
    core.renderOrder = 6;
    core.frustumCulled = false;

    group.add(glow);
    group.add(mesh);
    group.add(head);
    group.add(core);
    routes.push({
      material,
      geometry,
      glowMaterial,
      glowGeometry,
      head,
      core,
      headMaterial,
      coreMaterial,
      lathes,
    });
  }

  /* ---------------- 构建节点标记 ---------------- */
  for (const node of TOUR_NODES) {
    const color = CATEGORY_COLORS[node.category];
    const el = document.createElement('div');
    el.className = 'tr-tour-marker';
    el.innerHTML =
      `<span class="tr-tour-badge" style="--c:${color};background:${color}">${node.order}</span>` +
      `<span class="tr-tour-name" style="opacity:0" title="${node.name}">${node.shortName}</span>`;
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onNodeClick?.(node);
    });
    const nameEl = el.querySelector('.tr-tour-name') as HTMLSpanElement;
    const badgeEl = el.querySelector('.tr-tour-badge') as HTMLSpanElement;
    const object = new CSS2DObject(el);
    object.renderOrder = 2.8; // 高于县级药丸(2)，低于悬停卡(3)
    object.visible = false;
    group.add(object);
    // 名称宽度先按"中文字宽 ≈ 10px + 内边距"估算，首次进入 DOM 后再实测修正
    markers.push({
      node,
      object,
      element: el,
      badgeEl,
      nameEl,
      chipW: node.shortName.length * 10 + 14,
      chipH: 16,
    });
  }

  /** 重写节点标记的世界坐标 */
  function placeMarkers(): void {
    const relief = getReliefHeight();
    for (const m of markers) {
      const uv = projection.toUV(m.node.lon, m.node.lat);
      const y = sampleNormHeight(uv.u, uv.v) * relief + MARKER_Y_OFFSET;
      m.object.position.set(toX(uv.u), y, toZ(uv.v));
    }
  }

  /** 重写所有丝带的 Y（起伏变化后调用） */
  function refreshRoutes(): void {
    for (const r of routes) {
      writeRibbon(r.geometry, r.lathes, RIBBON_WIDTH);
      writeRibbon(r.glowGeometry, r.lathes, RIBBON_WIDTH * 3.2);
    }
  }

  /**
   * 把亮头放到路线进度 p（0~1）处：在相邻采样点间线性插值，
   * 高度仍用 sampleNormHeight 现算，因此起伏调参/相机远近都不会让光点脱离地表。
   */
  function placeHead(entry: RouteEntry, p: number): void {
    const lathes = entry.lathes;
    const n = lathes.length;
    if (n < 2) return;
    const totalCycles = Math.max(lathes[n - 1].tu, 1e-6);
    const target = Math.min(Math.max(p, 0), 1) * totalCycles;
    let i = 0;
    while (i < n - 2 && lathes[i + 1].tu < target) i++;
    const a = lathes[i];
    const b = lathes[i + 1];
    const span = Math.max(b.tu - a.tu, 1e-6);
    const k = Math.min(Math.max((target - a.tu) / span, 0), 1);
    const u = a.u + (b.u - a.u) * k;
    const v = a.v + (b.v - a.v) * k;
    const x = a.x + (b.x - a.x) * k;
    const z = a.z + (b.z - a.z) * k;
    const y = sampleNormHeight(u, v) * getReliefHeight() + RIBBON_Y_OFFSET * 1.8;
    entry.head.position.set(x, y, z);
    entry.core.position.set(x, y, z);
  }

  placeMarkers();

  let visible = false;
  let lastLayoutAt = -1e9;
  const _proj = new THREE.Vector3();

  /** 屏幕空间贪心排布名称：右 → 左 → 上 → 下 → 右上 → 左下；都冲突则隐藏名称 */
  function layoutLabels(camera: THREE.Camera, now: number): void {
    if (now - lastLayoutAt < LABEL_LAYOUT_INTERVAL) return;
    lastLayoutAt = now;
    const vp = getViewport();
    const placed: ScreenBox[] = [];
    const inset = 4;

    for (const m of markers) {
      // 实测一次胶囊尺寸（元素进入 DOM 后 offsetWidth 才有效）
      if (m.chipW <= 0 && m.nameEl.offsetWidth > 0) {
        m.chipW = m.nameEl.offsetWidth;
        m.chipH = m.nameEl.offsetHeight;
      }
      _proj.copy(m.object.position).project(camera);
      if (_proj.z > 1) {
        m.nameEl.style.opacity = '0';
        continue;
      }
      const sx = (_proj.x * 0.5 + 0.5) * vp.width;
      const sy = (-_proj.y * 0.5 + 0.5) * vp.height;
      const w = m.chipW;
      const h = m.chipH;

      const candidates = [
        // 近距四个方向
        { left: BADGE_R + 4, top: -Math.round(h / 2) },
        { left: -(w + BADGE_R + 4), top: -Math.round(h / 2) },
        { left: -Math.round(w / 2), top: -(BADGE_R + h + 6) },
        { left: -Math.round(w / 2), top: BADGE_R + 5 },
        // 斜角
        { left: BADGE_R + 4, top: -(BADGE_R + h + 2) },
        { left: -(w + BADGE_R + 4), top: BADGE_R + 2 },
        // 远距兜底（密集节点区用）
        { left: BADGE_R + 26, top: -Math.round(h / 2) },
        { left: -(w + BADGE_R + 26), top: -Math.round(h / 2) },
        { left: -Math.round(w / 2), top: -(BADGE_R + h + 26) },
        { left: -Math.round(w / 2), top: BADGE_R + 25 },
      ];

      let chosen: { left: number; top: number; box: ScreenBox } | null = null;
      for (const c of candidates) {
        const box: ScreenBox = { x: sx + c.left, y: sy + c.top, w, h };
        if (
          box.x < inset ||
          box.y < inset ||
          box.x + box.w > vp.width - inset ||
          box.y + box.h > vp.height - inset
        ) {
          continue;
        }
        let clash = false;
        for (const p of placed) {
          if (overlaps(box, p, CHIP_GAP)) {
            clash = true;
            break;
          }
        }
        if (clash) continue;
        chosen = { left: c.left, top: c.top, box };
        break;
      }

      if (chosen) {
        m.nameEl.style.left = `${chosen.left}px`;
        m.nameEl.style.top = `${chosen.top}px`;
        m.nameEl.style.opacity = '1';
        placed.push(chosen.box);
      } else {
        m.nameEl.style.opacity = '0';
      }
    }
  }

  return {
    setVisible(on: boolean) {
      visible = on;
      group.visible = on;
      for (const m of markers) m.object.visible = on;
      lastLayoutAt = -1e9; // 重新显示时立刻排一次
    },
    isVisible() {
      return visible;
    },
    refreshHeights() {
      placeMarkers();
      refreshRoutes();
    },
    update(now: number) {
      if (!visible) return false;
      // 流光：沿路线方向匀速平移（每条线独立纹理，避免 offset 互相覆盖）
      const t = now / 1000;
      for (let i = 0; i < routes.length; i++) {
        const tex = routes[i].material.map;
        if (tex) tex.offset.x = -((t * FLOW_SPEED + i * 0.21) % 1);
        // 亮头沿线循环行进（叠加拖尾流光，形成参考视频中的"发光轨迹"观感）
        placeHead(routes[i], (t * HEAD_SPEED + i * 0.37) % 1);
      }
      return true;
    },
    updateLabelLayout(camera: THREE.Camera, now: number) {
      if (!visible) return;
      layoutLabels(camera, now);
    },
    setActiveNode(id: string | null) {
      for (const m of markers) {
        m.badgeEl.classList.toggle('is-active', m.node.id === id);
      }
    },
    bounds() {
      return tourBounds();
    },
    dispose() {
      scene.remove(group);
      for (const r of routes) {
        r.geometry.dispose();
        r.glowGeometry.dispose();
        r.material.map?.dispose();
        r.material.dispose();
        r.glowMaterial.dispose();
        r.headMaterial.dispose();
        r.coreMaterial.dispose();
      }
      flowTexture.dispose();
      headTexture.dispose();
      for (const m of markers) m.element.remove();
      routes.length = 0;
      markers.length = 0;
    },
  };
}
