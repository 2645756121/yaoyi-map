import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  TOUR_NODES,
  TOUR_NODE_BY_ID,
  TOUR_ROUTES,
  tourBounds,
  tourNodeImages,
} from './tourData';

/** 线段相交判定（不含端点接触），用于检查路线是否自交 */
function segIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return false; // 平行/共线
  const qpx = cx - ax;
  const qpy = cy - ay;
  const t = (qpx * sy - qpy * sx) / den;
  const u = (qpx * ry - qpy * rx) / den;
  return t > 1e-4 && t < 1 - 1e-4 && u > 1e-4 && u < 1 - 1e-4;
}

describe('tourData：单条线性旅游路线', () => {
  it('只有一条路线，且按顺序包含全部节点、每个节点恰好一次（无分支）', () => {
    expect(TOUR_ROUTES).toHaveLength(1);
    const route = TOUR_ROUTES[0];
    expect(route.nodeIds).toEqual(TOUR_NODES.map((n) => n.id));
    expect(new Set(route.nodeIds).size).toBe(TOUR_NODES.length);
  });

  it('节点 id 唯一、序号连续且与路线顺序一致', () => {
    const ids = TOUR_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    TOUR_NODES.forEach((n, i) => {
      expect(n.order).toBe(i + 1);
      expect(TOUR_NODE_BY_ID.get(n.id)).toBe(n);
    });
  });

  it('类别齐全（红色文化 / 生态康养 / 瑶医风情 / 集散中心）', () => {
    const cats = new Set(TOUR_NODES.map((n) => n.category));
    expect(cats).toEqual(new Set(['red', 'scenic', 'yao', 'hub']));
    for (const c of ['red', 'scenic', 'yao', 'hub'] as const) {
      expect(CATEGORY_COLORS[c]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(CATEGORY_LABELS[c].length).toBeGreaterThan(0);
    }
  });

  it('路线折线（含样条采样）无自交，且不折返重复经过同一段', () => {
    // 拓扑检查在经纬度空间近似进行：墨卡托非线性不会改变"是否交叉"的结论
    const pts = TOUR_NODES.map((n) => new THREE.Vector3(n.lon, 0, n.lat));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const samples = curve.getPoints(80);

    let crossings = 0;
    for (let i = 0; i < samples.length - 1; i++) {
      for (let j = i + 2; j < samples.length - 1; j++) {
        const a = samples[i];
        const b = samples[i + 1];
        const c = samples[j];
        const d = samples[j + 1];
        if (segIntersect(a.x, a.z, b.x, b.z, c.x, c.z, d.x, d.z)) crossings++;
      }
    }
    expect(crossings).toBe(0);
  });

  it('起终点是全线的两个极端（珠玑最东、连山最西），避免中途折返', () => {
    const first = TOUR_NODES[0];
    const last = TOUR_NODES[TOUR_NODES.length - 1];
    const minLon = Math.min(...TOUR_NODES.map((n) => n.lon));
    const maxLon = Math.max(...TOUR_NODES.map((n) => n.lon));
    expect(first.lon).toBe(minLon);
    expect(last.lon).toBe(maxLon);
  });

  it('所有节点位于粤北（韶关 / 清远连阳）实际地理范围内', () => {
    for (const n of TOUR_NODES) {
      expect(n.lon).toBeGreaterThan(111.5);
      expect(n.lon).toBeLessThan(115.0);
      expect(n.lat).toBeGreaterThan(23.5);
      expect(n.lat).toBeLessThan(26.0);
    }
  });

  it('路线包围盒完整包住所有节点，且留有取景余量', () => {
    const b = tourBounds();
    for (const n of TOUR_NODES) {
      expect(n.lon).toBeGreaterThan(b.minLon);
      expect(n.lon).toBeLessThan(b.maxLon);
      expect(n.lat).toBeGreaterThan(b.minLat);
      expect(n.lat).toBeLessThan(b.maxLat);
    }
    expect(b.maxLon - b.minLon).toBeGreaterThan(1);
  });

  it('每个节点都有完整的图文展示字段', () => {
    for (const n of TOUR_NODES) {
      expect(n.name.length).toBeGreaterThan(0);
      // 地图标签用短名，控制在 6 字以内，避免密集区互相挤占
      expect(n.shortName.length).toBeGreaterThan(0);
      expect(n.shortName.length).toBeLessThanOrEqual(6);
      expect(n.region).toMatch(/^[\u4e00-\u9fa5]+ · [\u4e00-\u9fa5]+$/);
      expect(n.subtitle.length).toBeGreaterThan(0);
      expect(n.intro.length).toBeGreaterThan(30);
      expect(n.highlights).toHaveLength(3);
      expect(n.motif.length).toBeGreaterThan(0);
    }
  });

  it('每个节点都有 2~3 个分维度详解（人文 / 红色基地 / 瑶医非遗 / 自然康养）', () => {
    const allowed = new Set(['人文', '红色基地', '瑶医非遗', '自然', '徒步与康养', '康养', '交通与集散', '文物与禅法', '迁徙与寻根', '建筑与展陈', '人文与建筑', '线路衔接', '线路收束', '生态康养', '瑶医视角', '交通与衔接']);
    for (const n of TOUR_NODES) {
      expect(Array.isArray(n.sections)).toBe(true);
      expect(n.sections.length).toBeGreaterThanOrEqual(2);
      expect(n.sections.length).toBeLessThanOrEqual(3);
      const titles = new Set<string>();
      for (const s of n.sections) {
        expect(s.title.length).toBeGreaterThan(0);
        expect(allowed.has(s.title)).toBe(true);
        expect(s.body.length).toBeGreaterThan(40);
        // 标题去重：同一节点不应出现两个同名维度
        expect(titles.has(s.title)).toBe(false);
        titles.add(s.title);
      }
    }
  });

  it('事实性字段已按公开资料校正（石塘镇 / 六个篇章）', () => {
    const fort = TOUR_NODES.find((n) => n.id === 'shuangfeng');
    expect(fort?.region).toContain('石塘');
    expect(fort?.intro).toContain('石塘镇');

    const hall = TOUR_NODES.find((n) => n.id === 'chengkou');
    expect(hall?.intro).toContain('六个篇章');
  });

  it('配图字段：文件存在、体积受控、署名合规（含画廊额外图）', () => {
    // public/ 与测试文件相对位置固定；引用了不存在的文件就是断图
    let total = 0;
    for (const n of TOUR_NODES) {
      for (const im of tourNodeImages(n)) {
        const file = path.resolve(__dirname, '../../../public', im.src);
        expect(fs.existsSync(file)).toBe(true);
        // 体积上限：单张卡片图不应超过 600 KB（web 展示无需更大）
        expect(fs.statSync(file).size).toBeLessThan(600 * 1024);
        // CC BY / CC BY-SA 要求标注作者与许可；政府/文旅授权图记为「授权使用」
        expect(im.license).toMatch(/^(Public domain|CC0|CC BY|CC BY-SA|授权使用)/);
        expect(im.author.length).toBeGreaterThan(0);
        total++;
      }
    }
    expect(total).toBeGreaterThanOrEqual(9);
  });

  it('画廊：至少若干站点拥有多张配图（保证自动下滑不名不副实）', () => {
    const multi = TOUR_NODES.filter((n) => tourNodeImages(n).length >= 2);
    expect(multi.length).toBeGreaterThanOrEqual(3);
  });
});
