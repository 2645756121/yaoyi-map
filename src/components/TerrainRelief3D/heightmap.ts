/**
 * heightmap.ts —— 高程数据加载与采样
 *
 * 数据格式（由 scripts/export_relief_heightmap.py 生成）：
 *   <name>.png   Terrarium 编码高程图：h(米) = R*256 + G + B/256 - 32768
 *   <name>.json  元数据：经纬范围 / 尺寸 / 纵横比 / 高程极值 …
 *
 * 为什么用 Terrarium(RGB) 而不是 16 位灰度 PNG：
 *   浏览器 canvas 2D 只能可靠读回 8 位/通道，16 位灰度会被降级 → 高程出现"梯田"台阶。
 *   Terrarium 用三通道承载 1/256 m 精度，canvas 可直接读回并逐像素解码。
 */

export interface HeightmapMeta {
  name: string;
  encoding: 'terrarium';
  projection: 'mercator';
  /** [west, south, east, north]（WGS84 经纬度） */
  bounds: [number, number, number, number];
  width: number;
  height: number;
  /** 墨卡托宽高比（width/height），用于保证模型纵横比例不失真 */
  aspect: number;
  minElevation: number;
  maxElevation: number;
  meanElevation: number;
  seaPixelRatio: number;
  source: string;
  generatedBy: string;
}

export interface Heightmap {
  meta: HeightmapMeta;
  width: number;
  height: number;
  /** 高程（米），行优先，第 0 行为北边缘 */
  data: Float32Array;
}

/** 加载图片元素（onload 后若支持 decode() 再等一次解码完成，避免 getImageData 卡长帧） */
function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (typeof img.decode === 'function') {
        // decode() 失败（例如已解码/被中断）不视为加载失败，仍按 onload 结果继续
        img.decode().then(
          () => resolve(img),
          () => resolve(img),
        );
      } else {
        resolve(img);
      }
    };
    img.onerror = () => reject(new Error(`高程图加载失败: ${url}`));
    img.src = url;
  });
}

/**
 * 加载高程图 + 元数据并解码为高程数组。
 * @param baseUrl 不含扩展名的资源路径，例如 /relief/china-heightmap
 */
export async function loadHeightmap(baseUrl: string): Promise<Heightmap> {
  const metaResp = await fetch(`${baseUrl}.json`);
  if (!metaResp.ok) throw new Error(`高程元数据加载失败（HTTP ${metaResp.status}）: ${baseUrl}.json`);
  const meta = (await metaResp.json()) as HeightmapMeta;

  const img = await loadImageElement(`${baseUrl}.png`);
  // 尺寸为 0 时下面的 getImageData 会抛 IndexSizeError（信息量极低），
  // 这里提前给出可定位的错误。
  if (!img.naturalWidth || !img.naturalHeight) {
    throw new Error(`高程图尺寸无效（${img.naturalWidth}×${img.naturalHeight}）: ${baseUrl}.png`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  // willReadFrequently：声明会频繁 getImageData，避免浏览器选择昂贵的 GPU 回读路径
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('无法创建 2D 画布上下文，无法解码高程图');
  ctx.drawImage(img, 0, 0);

  const { width, height } = canvas;
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const data = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    // Terrarium 解码：h = R*256 + G + B/256 - 32768（0.1 m 级精度）
    data[i] = rgba[p] * 256 + rgba[p + 1] + rgba[p + 2] / 256 - 32768;
  }

  return { meta, width, height, data };
}

/**
 * 按归一化纹理坐标做双线性采样。
 * @param u 0=西边缘，1=东边缘
 * @param v 0=北边缘，1=南边缘
 */
export function sampleElevation(hm: Heightmap, u: number, v: number): number {
  const fx = Math.min(Math.max(u, 0), 1) * (hm.width - 1);
  const fy = Math.min(Math.max(v, 0), 1) * (hm.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, hm.width - 1);
  const y1 = Math.min(y0 + 1, hm.height - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const d = hm.data;
  const w = hm.width;
  const top = d[y0 * w + x0] * (1 - tx) + d[y0 * w + x1] * tx;
  const bot = d[y1 * w + x0] * (1 - tx) + d[y1 * w + x1] * tx;
  return top * (1 - ty) + bot * ty;
}

/**
 * 由高程图生成法线贴图数据（RGBA8，可直接喂给 THREE.DataTexture）。
 *
 * 目的：把**亚网格级**的地形细节补到着色上。网格段数翻倍只能让轮廓更圆滑，
 * 而法线贴图能让山脊、沟谷在原网格上就出现细密的明暗过渡，代价远低于加面。
 *
 * @param maxSize 长边上限（默认 1024）。原图 2048 对法线贴图过剩，降采样更省显存。
 * @param strength 起伏强度（米/像素 → 法线缩放），默认 0.03。
 */
export function buildNormalMapData(
  hm: Heightmap,
  maxSize = 1024,
  strength = 0.03,
): { width: number; height: number; data: Uint8Array } {
  const step = Math.max(1, Math.ceil(Math.max(hm.width, hm.height) / maxSize));
  const w = Math.floor((hm.width - 1) / step) + 1;
  const h = Math.floor((hm.height - 1) / step) + 1;
  const data = new Uint8Array(w * h * 4);
  const src = hm.data;

  const at = (x: number, y: number): number => {
    const sx = Math.min(hm.width - 1, x * step);
    const sy = Math.min(hm.height - 1, y * step);
    return src[sy * hm.width + sx];
  };

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(w - 1, x + 1);
      // 网格 uv 为 (u, 1 - v)：u 向东增，uv.y 向北增
      const dHdu = at(x1, y) - at(x0, y);
      const dHdv = at(x, y1) - at(x, y0);
      let nx = -dHdu * strength;
      let ny = dHdv * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const p = (y * w + x) * 4;
      data[p] = Math.round((nx * 0.5 + 0.5) * 255);
      data[p + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[p + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[p + 3] = 255;
    }
  }

  return { width: w, height: h, data };
}
