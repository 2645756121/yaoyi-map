# -*- coding: utf-8 -*-
"""导出「中国地形浮雕」单张高程图（Terrarium 编码 RGB PNG）+ 元数据，供 Three.js 查看器使用。

为什么用 Terrarium(RGB) 而不是 16 位灰度 PNG？
    浏览器 canvas 2D 只能可靠读回 8 位/通道，16 位灰度会被降级为 8 位 → 高程精度丢失出现"梯田"。
    Terrarium 用 RGB 三通道承载 1/256 m 精度，canvas 可直接读回并逐像素解码。

数据来源：
    AWS Open Data「Terrain Tiles」（Mapzen 维护，CloudFront 加速）
    https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
    编码 Terrarium（height = R*256 + G + B/256 - 32768），源自 SRTM / ASTER GDEM 等公开数据，
    许可 CC-BY 4.0（需署名）。源瓦片按需下载并缓存到本地临时目录，重复运行不再下载。

输出：
    public/relief/china-heightmap.png    Terrarium 编码高程图（墨卡托等距网格）
    public/relief/china-heightmap.json   元数据（经纬范围/尺寸/编码/高程极值/来源）

用法：
    python scripts/export_relief_heightmap.py
"""
import os
import json
import math
import time
import tempfile
import urllib.request
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(HERE)

# ---------------------------------------------------------------- 目标区域
# 中国本土（含台湾、海南），四周略留余量；west, south, east, north（WGS84 经纬度）
BOUNDS = (73.0, 17.5, 135.5, 54.0)
OUT_W = 2048          # 输出宽度（像素）；高度按墨卡托纵横比自动推导，保证模型不变形
OUT_DIR = os.path.join(PROJECT_ROOT, "public", "relief")
PNG_PATH = os.path.join(OUT_DIR, "china-heightmap.png")
META_PATH = os.path.join(OUT_DIR, "china-heightmap.json")

# ---------------------------------------------------------------- DEM 源瓦片
# 精细栅格拼装级别：z7 覆盖 62°E~148°E / 4°S~60°N，与目标区域同投影、1:1 原生清晰
MOSAIC_ZOOM = 7
TILE_BOUNDS = (62.0, -4.0, 148.0, 60.0)
TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
TILE_SIZE = 256
# 原始瓦片缓存（与任何输出严格分离，避免"生成结果覆盖原始数据"导致后续运行不可复现）
RAW_DIR = os.path.join(tempfile.gettempdir(), "yaoyi_terrain_raw")


# ---------------------------------------------------------------- Mercator 工具
def merc_x(lng):
    return (lng + 180.0) / 360.0


def merc_y(lat):
    r = math.radians(lat)
    return (1.0 - math.log(math.tan(r) + 1.0 / math.cos(r)) / math.pi) / 2.0


def tiles_bbox(z):
    """返回该级别下与 TILE_BOUNDS 相交的瓦片清单。"""
    w, s, e, n = TILE_BOUNDS
    nt = 2 ** z
    x0 = max(0, int(math.floor(merc_x(w) * nt)))
    x1 = min(nt - 1, int(math.floor(merc_x(e) * nt)))
    y0 = max(0, int(math.floor(merc_y(n) * nt)))
    y1 = min(nt - 1, int(math.floor(merc_y(s) * nt)))
    return [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]


# ---------------------------------------------------------------- Terrarium 编解码
def decode_terrarium(path):
    """读取 Terrarium PNG，返回 float32 高程数组（米）。"""
    with Image.open(path) as im:
        arr = np.asarray(im.convert("RGB"), dtype=np.float32)
    return arr[:, :, 0] * 256.0 + arr[:, :, 1] + arr[:, :, 2] / 256.0 - 32768.0


def encode_terrarium(elev):
    """将高程(m)编码为 Terrarium PNG 数组（uint8 RGB）。"""
    total = np.round((np.clip(elev, -32768.0, 32767.0) + 32768.0) * 256.0).astype(np.int64)
    total = np.clip(total, 0, 0xFFFFFF)
    r = ((total >> 16) & 0xFF).astype(np.uint8)
    g = ((total >> 8) & 0xFF).astype(np.uint8)
    b = (total & 0xFF).astype(np.uint8)
    return np.dstack([r, g, b])


# ---------------------------------------------------------------- 下载与栅格
def download_tile(z, x, y, retries=3):
    """下载单个 Terrarium 瓦片到原始缓存目录；返回本地路径或 None。
    路径结构固定为 {z}/{x}/{y}.png（与瓦片网格严格一致）。
    """
    out_dir = os.path.join(RAW_DIR, str(z), str(x))
    out_path = os.path.join(out_dir, f"{y}.png")
    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        return out_path
    url = TILE_URL.format(z=z, x=x, y=y)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            os.makedirs(out_dir, exist_ok=True)
            with open(out_path, "wb") as f:
                f.write(data)
            return out_path
        except Exception as exc:  # noqa: BLE001
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
            else:
                print(f"  [skip] {z}/{x}/{y}: {exc}")
                return None


def ensure_tiles(z):
    """确保该级别所需瓦片已缓存（已存在则跳过），返回成功数量。"""
    os.makedirs(RAW_DIR, exist_ok=True)
    jobs = tiles_bbox(z)
    total = len(jobs)
    ready = sum(
        1 for (x, y) in jobs
        if os.path.exists(os.path.join(RAW_DIR, str(z), str(x), f"{y}.png"))
    )
    if ready == total:
        print(f"[download] z{z} 瓦片已全部缓存（{total} 个）-> {RAW_DIR}")
        return total
    print(f"[download] z{z} 需缓存 {total} 个 DEM 瓦片（已有 {ready}）-> {RAW_DIR}")
    ok = ready
    with ThreadPoolExecutor(max_workers=16) as ex:
        futs = [ex.submit(download_tile, z, x, y) for (x, y) in jobs]
        for i, fut in enumerate(as_completed(futs), 1):
            if fut.result():
                ok += 1
            if i % 200 == 0 or i == total:
                print(f"  进度 {i}/{total}")
    print(f"[download] 完成，可用 {min(ok, total)}/{total}")
    return ok


def build_mosaic(zoom, tiles, label):
    """按给定级别与瓦片清单拼出墨卡托高程栅格（海洋负高程截断为 0）。

    返回 (栅格数组, 左上角瓦片 x, 左上角瓦片 y, 级别)。
    """
    xs = [t[0] for t in tiles]
    ys = [t[1] for t in tiles]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    width = (x1 - x0 + 1) * TILE_SIZE
    height = (y1 - y0 + 1) * TILE_SIZE
    mosaic = np.zeros((height, width), dtype=np.float32)
    filled = np.zeros((height, width), dtype=bool)
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            p = os.path.join(RAW_DIR, str(zoom), str(x), f"{y}.png")
            if not os.path.exists(p):
                continue
            blk = decode_terrarium(p)
            # 海洋（负高程，海底地形）截断为 0，避免出现海底巨坑
            blk = np.maximum(blk, 0.0)
            r0 = (y - y0) * TILE_SIZE
            c0 = (x - x0) * TILE_SIZE
            mosaic[r0:r0 + TILE_SIZE, c0:c0 + TILE_SIZE] = blk
            filled[r0:r0 + TILE_SIZE, c0:c0 + TILE_SIZE] = True
    print(f"[mosaic:{label}] z{zoom} 栅格 {width}x{height}，覆盖 {100.0*filled.mean():.1f}%")
    v = mosaic[filled]
    if v.size:
        print(f"[mosaic:{label}] 高程 {v.min():.0f} ~ {v.max():.0f} m")
    return mosaic, x0, y0, zoom


def sample_bilinear(arr, xs, ys):
    """在 arr 上按浮点像素坐标做双线性采样，越界返回 0。"""
    h, w = arr.shape
    x0 = np.floor(xs).astype(np.int32)
    y0 = np.floor(ys).astype(np.int32)
    fx = xs - x0
    fy = ys - y0
    x1 = x0 + 1
    y1 = y0 + 1
    oob = (x0 < 0) | (y0 < 0) | (x1 > w - 1) | (y1 > h - 1)
    x0c = np.clip(x0, 0, w - 1); x1c = np.clip(x1, 0, w - 1)
    y0c = np.clip(y0, 0, h - 1); y1c = np.clip(y1, 0, h - 1)
    top = arr[y0c, x0c] * (1 - fx) + arr[y0c, x1c] * fx
    bot = arr[y1c, x0c] * (1 - fx) + arr[y1c, x1c] * fx
    val = top * (1 - fy) + bot * fy
    val[oob] = 0.0
    return val


def main():
    z = MOSAIC_ZOOM

    # 1) 确保 DEM 源瓦片已缓存，并拼装精细栅格
    ensure_tiles(z)
    mosaic, mx0, my0, mz = build_mosaic(z, tiles_bbox(z), "relief-export")
    if float(mosaic.max()) <= 0.0:
        raise SystemExit("栅格为空：DEM 瓦片下载失败，请检查网络后重试")

    # 2) 目标经纬范围 → 墨卡托像素范围（与瓦片同一投影，模型不会南北拉伸）
    per_axis = 256.0 * (2 ** z)                      # 该级别全球墨卡托像素总数
    ox, oy = mx0 * 256.0, my0 * 256.0                # 栅格左上角对应的全局像素
    left = merc_x(BOUNDS[0]) * per_axis - ox
    right = merc_x(BOUNDS[2]) * per_axis - ox
    top = merc_y(BOUNDS[3]) * per_axis - oy
    bot = merc_y(BOUNDS[1]) * per_axis - oy

    out_w = OUT_W
    out_h = int(round(out_w * (bot - top) / (right - left)))
    print("[export] 目标 %dx%d（墨卡托等距，纵横比 %.4f）" % (out_w, out_h, (right - left) / (bot - top)))

    # 3) 双线性采样 → 高程（米）
    xs = left + (np.arange(out_w) + 0.5) * (right - left) / out_w
    ys = top + (np.arange(out_h) + 0.5) * (bot - top) / out_h
    gx, gy = np.meshgrid(xs, ys)
    elev = sample_bilinear(mosaic, gx, gy).astype(np.float32)
    elev[~np.isfinite(elev)] = 0.0
    elev = np.maximum(elev, 0.0)                     # 海洋/域外 → 0

    # 4) 编码为 Terrarium RGB 并落盘
    os.makedirs(OUT_DIR, exist_ok=True)
    Image.fromarray(encode_terrarium(elev), "RGB").save(PNG_PATH, "PNG", optimize=True)

    meta = {
        "name": "china-relief",
        "encoding": "terrarium",                     # h = R*256 + G + B/256 - 32768（单位：米）
        "projection": "mercator",                    # 像素行按墨卡托等距分布
        "bounds": list(BOUNDS),                      # west, south, east, north（WGS84）
        "width": out_w,
        "height": out_h,
        "aspect": round((right - left) / (bot - top), 6),   # 模型宽高比（用于保持不变形）
        "minElevation": int(elev.min()),
        "maxElevation": int(elev.max()),
        "meanElevation": int(elev.mean()),
        "seaPixelRatio": round(float((elev <= 0.5).mean()), 4),
        "source": "AWS Terrain Tiles (Mapzen) / SRTM+ASTER (CC-BY 4.0)",
        "generatedBy": "scripts/export_relief_heightmap.py",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    size_mb = os.path.getsize(PNG_PATH) / 1024 / 1024
    print("[export] 高程图 %.1f MB -> %s" % (size_mb, PNG_PATH))
    print("[export] 高程范围 %d ~ %d m（均值 %d），海面占比 %.1f%%"
          % (meta["minElevation"], meta["maxElevation"], meta["meanElevation"],
             meta["seaPixelRatio"] * 100))
    print("[export] 元数据 -> %s" % META_PATH)


if __name__ == "__main__":
    main()
