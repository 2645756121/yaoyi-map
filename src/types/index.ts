export interface Region {
  id: string;
  name: string;
  nameEn: string;
  location: string;
  description: string;
  color: string;
  density: number;
  herbs: string[];
  therapies: string[];
  history: string;
  modernDevelopment: string;
  historyPeriods: string[];
}

/**
 * 瑶医分布县级分类：用于在地图上按颜色区分不同瑶医瑶药发展程度的县域。
 *
 *  - core        瑶医传承核心区：拥有百年以上传承历史的县域
 *  - development 瑶医发展区：现有正规瑶医医疗机构的县域
 *  - production  瑶药主产区：规模化种植或原生瑶药资源丰富的县域
 *
 * 注意：同一县可能兼具多重角色，分类以主导属性为准。
 */
export type YaoCategory = 'core' | 'development' | 'production';

export const YAO_CATEGORY_META: Record<YaoCategory, { label: string; color: string; desc: string }> = {
  core: {
    label: '瑶医传承核心区',
    color: '#166534',
    desc: '拥有百年以上传承历史的县域，瑶医药文化积淀深厚',
  },
  development: {
    label: '瑶医发展区',
    color: '#22c55e',
    desc: '现有正规瑶医医疗机构的县域',
  },
  production: {
    label: '瑶药主产区',
    color: '#fbbf24',
    desc: '规模化种植或原生瑶药资源丰富的县域',
  },
};

/**
 * 县级瑶医瑶药信息：来自全国瑶医诊疗机构、瑶药传承基地、原生种植区域的县级单位。
 *
 *  - institutionCount 县域内瑶医诊疗机构数量
 *  - herbVarieties    主要瑶药品种（与 mockData.herbs 中 id 对应）
 *  - schools          县域内主要传承流派
 *  - since            瑶医在该县传承的起始年份（仅核心区有意义）
 */
export interface YaoCounty {
  code: string;        // 行政区划代码（6 位数字）
  name: string;
  nameEn: string;
  province: string;    // 所属省份（中文名）
  provinceCode: string;
  centerLng: number;
  centerLat: number;
  category: YaoCategory;
  institutionCount: number;
  herbVarieties: string[];
  schools: string[];
  since?: number;
  note?: string;
}

/**
 * 区域特有瑶药资源详情
 */
export interface YaoHerbResource {
  /** 药材名称（中文） */
  name: string;
  /** 学名（拉丁名） */
  scientificName: string;
  /** 瑶文/瑶族俗称 */
  nameYao?: string;
  /** 药材来源类型：野生 / 栽培 */
  source: 'wild' | 'cultivated' | 'both';
  /** 当地药用部位 */
  medicinalPart: string;
  /** 药用功效 */
  efficacy: string;
  /** 当地临床应用案例（简述） */
  clinicalApplication: string;
  /** 当地具体产地（乡镇/山区） */
  habitat: string;
  /** 当地采集方法（季节/手法） */
  collectionMethod: string;
  /** 当地年产量估算 */
  yieldEstimate?: string;
}

/**
 * 临床应用案例（针对该县/市）
 */
export interface YaoClinicalCase {
  /** 案例名称/标题 */
  title: string;
  /** 患者信息（脱敏） */
  patientInfo: string;
  /** 诊断 */
  diagnosis: string;
  /** 治疗过程 */
  treatmentProcess: string;
  /** 疗效 */
  outcome: string;
  /** 案例日期（年） */
  year: number;
}

/**
 * 传承保护现状
 */
export interface HeritageStatus {
  /** 是否有瑶医医院/门诊 */
  hasHospital: boolean;
  /** 瑶医医师数量估算 */
  practitionerCount: number;
  /** 非遗项目数量 */
  intangibleHeritageCount: number;
  /** 传承人数量（含国家级/省级/市级） */
  inheritorCount: number;
  /** 是否有瑶药种植基地（规模以上） */
  hasCultivationBase: boolean;
  /** 政府支持级别（县/市/省/国家） */
  govSupportLevel: 'county' | 'city' | 'province' | 'national';
  /** 现状描述 */
  description: string;
  /** 主要挑战 */
  challenges: string[];
}

/**
 * 扩展后的县级瑶医资料
 * （在原 YaoCounty 基础上增加特有瑶药资源、临床案例、传承保护等详情）
 */
export interface YaoCountyExtended extends YaoCounty {
  /** 该县/市特有的瑶药资源详情（不可与 herbVarieties 重复，herbVarieties 引用 mockData.herbs） */
  localHerbResources: YaoHerbResource[];
  /** 当地代表性临床案例 */
  clinicalCases: YaoClinicalCase[];
  /** 当地瑶药采集方法总论 */
  collectionMethodology: string;
  /** 传承保护现状 */
  heritage: HeritageStatus;
  /** 代表性研究/医疗机构 */
  representativeInstitutions: string[];
  /** 当地瑶药市场/产业基地（如有） */
  industryBase?: string[];
  /** 经度（兼容） */
  lng: number;
  /** 纬度（兼容） */
  lat: number;
}

export interface Herb {
  id: string;
  name: string;
  nameEn: string;
  nameYao: string;
  scientificName: string;
  image: string;
  taste: string;
  meridian: string;
  efficacy: string;
  usage: string;
  medicinalPart: string;
  collectionSeason: string;
  distributionArea: string;
  modernPharmacology: string;
  regionId: string;
  therapyIds: string[];
  /**
   * 概念地图坐标（ChinaMap SVG viewBox 内的像素位置，0-900 / 0-600）。
   * 保留以兼容旧版本展示；新代码应使用 lng/lat。
   */
  mapPosition?: { x: number; y: number };
  /**
   * 真实地理坐标（用于 Leaflet MapBoard 标记）。
   * 替代 mapPosition 作为主要坐标来源。
   */
  lng?: number;
  lat?: number;
  botanicalFeatures?: string;
  yaoMedicineHistory?: string;
  activeIngredients?: string;
}

export interface Therapy {
  id: string;
  name: string;
  nameEn: string;
  system: string;
  applicableConditions: string[];
  operationFlow: string;
  precautions: string[];
  inheritors: string[];
  clinicalCases: ClinicalCase[];
  relatedHerbs: string[];
  relatedHistoryPeriods: string[];
  regionId: string;
  description: string;
}

export interface ClinicalCase {
  id: string;
  caseName: string;
  patientInfo: string;
  diagnosis: string;
  treatmentProcess: string;
  outcome: string;
  date: string;
}

export interface HistoryPeriod {
  id: string;
  periodName: string;
  timeRange: string;
  importantEvents: string[];
  culturalBackground: string;
  majorSchools: string[];
  inheritanceLineage: string[];
  representativeWorks: string[];
  regionId: string;
  description: string;
  relatedTherapies: string[];
}

export interface Province {
  id: string;
  name: string;
  nameEn: string;
  regionId?: string;
  path?: string;
  center: { x: number; y: number };
}

export interface SearchResult {
  type: 'herb' | 'therapy' | 'history';
  id: string;
  name: string;
  description: string;
  regionId: string;
}

/**
 * 监控上报事件载荷
 *
 * 与 src/lib/monitoring.ts 配合使用。所有字段均可选，便于灵活上报
 */
export interface MonitorEvent {
  /** 事件类型 */
  kind: 'error' | 'unhandledrejection' | 'perf' | 'custom';
  /** 事件简短描述 */
  message: string;
  /** 错误堆栈（仅错误类事件） */
  stack?: string;
  /** 触发源文件 URL */
  source?: string;
  /** 行号 */
  lineno?: number;
  /** 列号 */
  colno?: number;
  /** 自定义元数据 */
  meta?: Record<string, unknown>;
}
