/**
 * 行政区域三级聚合（省 → 市 → 县）
 *
 * 目的：将零散的县级数据按 adcode 前缀自动归并到所属市级/省级，
 *       建立"省-市-县"完整关联链路，供地图三级钻取使用。
 *
 * adcode 规则（GB/T 2260）：
 *   - 省级：前 2 位（11=北京, 45=广西, ...）
 *   - 市级：前 4 位（4513=广西·来宾市）
 *   - 县级：前 6 位（451324=广西·来宾·金秀瑶族自治县）
 */

import type { YaoCounty } from '../types';

/** 省级 adcode → 名称映射（前 2 位 → 中文） */
export const PROVINCE_ADCODES: Record<string, string> = {
  '11': '北京市',
  '12': '天津市',
  '13': '河北省',
  '14': '山西省',
  '15': '内蒙古自治区',
  '21': '辽宁省',
  '22': '吉林省',
  '23': '黑龙江省',
  '31': '上海市',
  '32': '江苏省',
  '33': '浙江省',
  '34': '安徽省',
  '35': '福建省',
  '36': '江西省',
  '37': '山东省',
  '41': '河南省',
  '42': '湖北省',
  '43': '湖南省',
  '44': '广东省',
  '45': '广西壮族自治区',
  '46': '海南省',
  '50': '重庆市',
  '51': '四川省',
  '52': '贵州省',
  '53': '云南省',
  '54': '西藏自治区',
  '61': '陕西省',
  '62': '甘肃省',
  '63': '青海省',
  '64': '宁夏回族自治区',
  '65': '新疆维吾尔自治区',
  '71': '台湾省',
  '81': '香港特别行政区',
  '82': '澳门特别行政区',
};

/** adcode 前 2 位 → 省级 */
export function getProvinceAdcodeFromCounty(code: string): string {
  return code.substring(0, 2);
}

/** adcode 前 4 位 → 市级 adcode */
export function getCityAdcodeFromCounty(code: string): string {
  return code.substring(0, 4);
}

/** 县级 adcode 前 2 位 → 省级名称（未知则返回 '未知'） */
export function getProvinceNameFromCounty(code: string): string {
  return PROVINCE_ADCODES[getProvinceAdcodeFromCounty(code)] ?? '未知';
}

/** 市级单元（虚拟，按县级聚合） */
export interface AggregatedCity {
  /** 市级 adcode（前 4 位） */
  adcode: string;
  /** 市级名称（合并县名而成） */
  name: string;
  /** 上级省级 adcode */
  provinceAdcode: string;
  /** 上级省级名称 */
  provinceName: string;
  /** 该市下辖县级数 */
  countyCount: number;
  /** 该市累计机构数 */
  totalInstitutions: number;
  /** 该市所有瑶药种类（去重） */
  uniqueHerbs: string[];
  /** 该市下辖县级列表 */
  counties: YaoCounty[];
  /** 平均经度（用于标记中心） */
  centerLng: number;
  /** 平均纬度（用于标记中心） */
  centerLat: number;
}

/** 省级单元（聚合自所有县级） */
export interface AggregatedProvince {
  /** 省级 adcode（前 2 位） */
  adcode: string;
  /** 省级名称 */
  name: string;
  /** 是否为瑶族相关省（已有县级数据） */
  hasYaoData: boolean;
  /** 该省下辖市级数 */
  cityCount: number;
  /** 该省下辖县级数 */
  countyCount: number;
  /** 该省累计机构数 */
  totalInstitutions: number;
  /** 该省所有瑶药种类（去重） */
  uniqueHerbs: string[];
  /** 该省下辖市级列表 */
  cities: AggregatedCity[];
  /** 该省所有县级列表（平铺） */
  counties: YaoCounty[];
  /** 平均经度（用于省级中心标记） */
  centerLng: number;
  /** 平均纬度 */
  centerLat: number;
}

/** 省级 → 市级 → 县级三级层次结构 */
export interface AdminHierarchy {
  provinces: AggregatedProvince[];
  /** 按省级 adcode 索引 */
  byProvinceAdcode: Map<string, AggregatedProvince>;
  /** 按市级 adcode 索引 */
  byCityAdcode: Map<string, AggregatedCity>;
  /** 按县级 code 索引 */
  byCountyCode: Map<string, YaoCounty>;
  /** 总统计 */
  total: {
    provinces: number;
    cities: number;
    counties: number;
    institutions: number;
    herbs: number;
  };
}

/**
 * 将县级数据聚合成三级层次结构
 */
export function aggregateToHierarchy(counties: YaoCounty[]): AdminHierarchy {
  const provinceMap = new Map<string, AggregatedProvince>();
  const byProvinceAdcode = new Map<string, AggregatedProvince>();
  const byCityAdcode = new Map<string, AggregatedCity>();
  const byCountyCode = new Map<string, YaoCounty>();

  // 1. 先建所有省级（即使没有瑶族数据，也建空壳用于地图显示）
  for (const [adcode, name] of Object.entries(PROVINCE_ADCODES)) {
    const province: AggregatedProvince = {
      adcode,
      name,
      hasYaoData: false,
      cityCount: 0,
      countyCount: 0,
      totalInstitutions: 0,
      uniqueHerbs: [],
      cities: [],
      counties: [],
      centerLng: 0,
      centerLat: 0,
    };
    provinceMap.set(adcode, province);
    byProvinceAdcode.set(adcode, province);
  }

  // 2. 按 (省, 市) 二级聚合县级
  const cityBuckets = new Map<string, YaoCounty[]>();
  for (const county of counties) {
    const provinceAdcode = getProvinceAdcodeFromCounty(county.code);
    const cityAdcode = getCityAdcodeFromCounty(county.code);
    const key = `${provinceAdcode}-${cityAdcode}`;
    if (!cityBuckets.has(key)) cityBuckets.set(key, []);
    cityBuckets.get(key)!.push(county);
    byCountyCode.set(county.code, county);
  }

  // 3. 构建市级单元
  for (const [key, cityCounties] of cityBuckets.entries()) {
    const [provinceAdcode, cityAdcode] = key.split('-');
    const provinceName = PROVINCE_ADCODES[provinceAdcode] ?? '未知';
    const province = provinceMap.get(provinceAdcode);
    if (!province) continue;

    // 市级名称：取第一个县的"省+市"前缀，或直接 adcode
    const firstCounty = cityCounties[0];
    const cityName =
      firstCounty.provinceCode === cityAdcode
        ? `${provinceName}·市级聚合`
        : `${provinceName}·${cityAdcode}`;

    // 计算市级中心（加权平均）
    const totalLng = cityCounties.reduce((s, c) => s + c.centerLng, 0);
    const totalLat = cityCounties.reduce((s, c) => s + c.centerLat, 0);

    // 收集市级所有瑶药
    const herbSet = new Set<string>();
    let totalInst = 0;
    for (const c of cityCounties) {
      totalInst += c.institutionCount;
      c.herbVarieties.forEach((h) => herbSet.add(h));
    }

    const city: AggregatedCity = {
      adcode: cityAdcode,
      name: cityName,
      provinceAdcode,
      provinceName,
      countyCount: cityCounties.length,
      totalInstitutions: totalInst,
      uniqueHerbs: Array.from(herbSet),
      counties: cityCounties,
      centerLng: totalLng / cityCounties.length,
      centerLat: totalLat / cityCounties.length,
    };

    province.cities.push(city);
    byCityAdcode.set(cityAdcode, city);
  }

  // 4. 构建省级汇总
  const totalInstitutions = counties.reduce((s, c) => s + c.institutionCount, 0);
  const herbSet = new Set<string>();
  counties.forEach((c) => c.herbVarieties.forEach((h) => herbSet.add(h)));

  for (const province of provinceMap.values()) {
    province.hasYaoData = province.cities.length > 0;
    province.cityCount = province.cities.length;
    province.countyCount = province.cities.reduce((s, c) => s + c.countyCount, 0);
    province.totalInstitutions = province.cities.reduce((s, c) => s + c.totalInstitutions, 0);
    province.uniqueHerbs = Array.from(new Set(province.cities.flatMap((c) => c.uniqueHerbs)));
    province.counties = province.cities.flatMap((c) => c.counties);

    if (province.counties.length > 0) {
      province.centerLng =
        province.counties.reduce((s, c) => s + c.centerLng, 0) / province.counties.length;
      province.centerLat =
        province.counties.reduce((s, c) => s + c.centerLat, 0) / province.counties.length;
    }
  }

  // 5. 转换为数组（按省级 adcode 排序）
  const provinces = Array.from(provinceMap.values()).sort((a, b) =>
    a.adcode.localeCompare(b.adcode)
  );

  return {
    provinces,
    byProvinceAdcode,
    byCityAdcode,
    byCountyCode,
    total: {
      provinces: provinces.length,
      cities: byCityAdcode.size,
      counties: counties.length,
      institutions: totalInstitutions,
      herbs: herbSet.size,
    },
  };
}

/**
 * 获取省级 adcode 对应的省级名称（同名反向查询）
 */
export function getProvinceAdcodeFromName(name: string): string | undefined {
  for (const [adcode, n] of Object.entries(PROVINCE_ADCODES)) {
    if (n === name) return adcode;
  }
  return undefined;
}

/**
 * 获取"有瑶族相关数据"的省份列表（用于高亮）
 */
export function getYaoProvinces(hierarchy: AdminHierarchy): AggregatedProvince[] {
  return hierarchy.provinces.filter((p) => p.hasYaoData);
}

/**
 * 验证数据完整性：检查县级数据是否都有有效 adcode
 */
export function validateAdminData(counties: YaoCounty[]): {
  valid: number;
  invalid: { code: string; name: string; reason: string }[];
} {
  const invalid: { code: string; name: string; reason: string }[] = [];
  let valid = 0;

  for (const county of counties) {
    if (!/^\d{6}$/.test(county.code)) {
      invalid.push({
        code: county.code,
        name: county.name,
        reason: 'adcode 不是 6 位数字',
      });
      continue;
    }
    const provinceName = getProvinceNameFromCounty(county.code);
    if (provinceName === '未知' || !provinceName) {
      invalid.push({
        code: county.code,
        name: county.name,
        reason: `无法识别省级（前2位=${county.code.substring(0, 2)}）`,
      });
      continue;
    }
    if (county.province && provinceName !== county.province) {
      invalid.push({
        code: county.code,
        name: county.name,
        reason: `adcode(${provinceName}) 与 province(${county.province}) 不一致`,
      });
      continue;
    }
    valid++;
  }

  return { valid, invalid };
}