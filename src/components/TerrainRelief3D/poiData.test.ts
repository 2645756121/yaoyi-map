/**
 * poiData.test.ts —— 点位数据构建（纯函数）的单元测试
 * 覆盖：草药按省分桶、异常分支（无坐标/未知 region/NaN）、瑶族县点位与兜底路径。
 */
import { describe, it, expect } from 'vitest';
import {
  buildHerbPoisByProvince,
  buildCountyPois,
  COUNTY_CATEGORY_COLORS,
  HERB_ACCENT,
} from './poiData';
import { aggregateToHierarchy, type AdminHierarchy } from '../../lib/adminAggregator';
import { yaoCounties } from '../../data/mockData';
import type { Herb } from '../../types';

function makeHerb(id: string, regionId?: string): Herb {
  return { id, name: id, regionId } as unknown as Herb;
}

describe('buildHerbPoisByProvince：默认数据分桶', () => {
  const { byProvince, byId } = buildHerbPoisByProvince();

  it('恰好 9 个省份桶，桶内合计 49 味草药', () => {
    expect(byProvince.size).toBe(9);
    const total = [...byProvince.values()].reduce((s, list) => s + list.length, 0);
    expect(total).toBe(49);
  });

  it('各桶数量与省份归属一致', () => {
    const expected: Record<string, number> = {
      '45': 5, // 广西
      '44': 5, // 广东
      '43': 7, // 湖南
      '53': 7, // 云南
      '52': 5, // 贵州
      '36': 5, // 江西
      '46': 5, // 海南
      '50': 4, // 重庆
      '51': 6, // 四川
    };
    expect(new Set(byProvince.keys())).toEqual(new Set(Object.keys(expected)));
    for (const [adcode, n] of Object.entries(expected)) {
      expect(byProvince.get(adcode), `省 ${adcode}`).toHaveLength(n);
    }
  });

  it('每个点位字段正确：kind=herb、pill=false、accent 主题色、末行含「点击查看详情」', () => {
    for (const list of byProvince.values()) {
      for (const item of list) {
        expect(item.kind).toBe('herb');
        expect(item.pill).toBe(false);
        expect(item.accent).toBe(HERB_ACCENT);
        expect(item.info[item.info.length - 1]).toContain('点击查看详情');
        expect(Number.isFinite(item.lon)).toBe(true);
        expect(Number.isFinite(item.lat)).toBe(true);
      }
    }
  });

  it('点位 id 全局唯一，且 byId 数量等于草药总数', () => {
    const ids = [...byProvince.values()].flat().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(byId.size).toBe(49);
    for (const id of ids) expect(byId.has(id)).toBe(true);
  });
});

describe('buildHerbPoisByProvince：异常分支', () => {
  it('解析器恒返回 null → 全部跳过（0 桶、byId 为空）', () => {
    const res = buildHerbPoisByProvince(
      [makeHerb('a', 'guangxi'), makeHerb('b', 'hunan'), makeHerb('c', 'yunnan')],
      () => null,
    );
    expect(res.byProvince.size).toBe(0);
    expect(res.byId.size).toBe(0);
  });

  it('未知 regionId → 进入 byId 但不进入任何桶', () => {
    const res = buildHerbPoisByProvince([makeHerb('x', 'atlantis')], () => ({ lng: 100, lat: 30 }));
    expect(res.byId.size).toBe(1);
    expect(res.byId.has('herb-x')).toBe(true);
    expect(res.byProvince.size).toBe(0);
  });

  it('解析出 NaN 坐标 → 完全跳过（不进 byId、不进桶）', () => {
    const res = buildHerbPoisByProvince(
      [makeHerb('a', 'guangxi'), makeHerb('b', 'guangxi')],
      (h) => (h.id === 'a' ? { lng: Number.NaN, lat: 30 } : { lng: 100, lat: Number.NaN }),
    );
    expect(res.byId.size).toBe(0);
    expect(res.byProvince.size).toBe(0);
  });
});

describe('buildCountyPois：瑶族县点位', () => {
  const hierarchy = aggregateToHierarchy(yaoCounties);

  it('广西（45）返回 11 个县，全部为药丸样式且配色与分类一致', () => {
    const { items, byId } = buildCountyPois('45', hierarchy);
    expect(items).toHaveLength(11);
    expect(byId.size).toBe(11);

    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of items) {
      expect(item.pill).toBe(true);
      expect(item.kind).toBe('county');
      expect(item.info[0]).toContain('瑶族机构');
      expect(item.info[1]).toContain('瑶药');

      const county = byId.get(item.id)!;
      const [a, b] = COUNTY_CATEGORY_COLORS[county.category];
      expect(item.accent).toBe(a);
      expect(item.accent2).toBe(b);
    }

    // 至少覆盖 core / development / production 三类
    const cats = new Set([...byId.values()].map((c) => c.category));
    expect(cats.has('core')).toBe(true);
    expect(cats.has('development')).toBe(true);
    expect(cats.has('production')).toBe(true);
  });

  it('无数据省份（99）返回空集合且不抛错', () => {
    const { items, byId } = buildCountyPois('99', hierarchy);
    expect(items).toHaveLength(0);
    expect(byId.size).toBe(0);
  });

  it('兜底分支：聚合结果缺失时按 provinceCode 前缀过滤出广西各县', () => {
    const emptyHierarchy = { byProvinceAdcode: new Map() } as unknown as AdminHierarchy;
    const { items, byId } = buildCountyPois('45', emptyHierarchy, yaoCounties);
    expect(items).toHaveLength(11);
    expect(byId.size).toBe(11);
    for (const item of items) {
      expect(item.id.startsWith('county-45') || item.id.startsWith('county-450')).toBe(true);
    }
  });
});
