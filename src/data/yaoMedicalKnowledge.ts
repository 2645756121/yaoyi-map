/**
 * 瑶医瑶药权威资料库
 *
 * 数据来源（合规审核）：
 *   1. 国家中医药管理局《全国中医药传承创新发展》
 *   2. 中国民族医药学会瑶医药分会公开资料
 *   3. 《瑶医药学》（覃迅云主编，民族出版社）
 *   4. 瑶医药国家级非物质文化遗产代表性项目名录
 *   5. 各省/市/县非物质文化遗产保护中心
 *   6. 全国第四次中药资源普查瑶药专项报告
 *
 * 数据分类：
 *   1. 瑶医基础理论（瑶医"三元和谐"理论）
 *   2. 特色诊疗方法（庞桶药浴、磨刀诊脉、瑶医正骨等）
 *   3. 常用瑶药材性味功效（"五虎九牛十八钻七十二风"经典分类）
 *   4. 瑶医药传统文化传承（非遗传承人、流派分布）
 *
 * 注意：本资料仅用于教学与科普展示，不构成医疗建议。
 *       实际诊疗请咨询具备瑶医执业资格的医疗机构。
 */

export interface YaoMedicalTheory {
  /** 理论名称 */
  name: string;
  /** 拼音/瑶语名 */
  pinyin?: string;
  /** 详细说明 */
  description: string;
  /** 核心理念列表 */
  keyPoints: string[];
}

export interface YaoDiagnosticMethod {
  /** 诊法名称 */
  name: string;
  /** 来源/典籍 */
  origin: string;
  /** 适用症/主治 */
  indications: string[];
  /** 操作步骤 */
  procedure: string;
}

export interface YaoHerbEfficacy {
  /** 性味（瑶医四性五味） */
  nature: '热' | '温' | '平' | '凉' | '寒';
  /** 味 */
  flavor: string;
  /** 归经 */
  meridian: string;
  /** 主治功效 */
  efficacy: string[];
  /** 临床应用 */
  clinicalUse: string;
  /** 用法用量参考 */
  dosage: string;
  /** 禁忌 */
  contraindications?: string[];
}

export interface YaoHerbCategory {
  /** 分类名称（瑶医经典分类） */
  category: string;
  /** 瑶语名 */
  nameYao: string;
  /** 含义/解释 */
  meaning: string;
  /** 代表性药材 */
  representatives: string[];
  /** 主要功效 */
  mainEffects: string;
}

/** 瑶医基础理论 */
export const YAO_MEDICAL_THEORIES: YaoMedicalTheory[] = [
  {
    name: '三元和谐论',
    pinyin: 'Sān Yuán Hé Xié Lùn',
    description:
      '瑶医核心理论，认为人体由"天、地、人"三元构成。三元和谐则健康，三元失衡则疾病丛生。瑶医诊疗的根本目的是恢复三元平衡。',
    keyPoints: [
      '天元主气（呼吸之气、宇宙之气）',
      '地元主血（饮食精微、土地滋养）',
      '人元主神（意识、精神、生命力）',
      '三元失衡的六种病机：盈、亏、阻、滞、毒、结',
    ],
  },
  {
    name: '盈亏平衡论',
    pinyin: 'Yíng Kuī Píng Héng Lùn',
    description:
      '瑶医认为疾病本质是"盈亏失衡"：气血精津偏盛则为盈（实证），偏衰则为亏（虚证）。治疗原则为"补其不足，泻其有余"。',
    keyPoints: [
      '气盈：胸闷、气喘、面赤',
      '血盈：肿痛、瘀血、出血',
      '气亏：乏力、气短、声低',
      '血亏：面色苍白、心悸失眠',
    ],
  },
  {
    name: '百病百因论',
    pinyin: 'Bǎi Bìng Bǎi Yīn Lùn',
    description:
      '瑶医认为每一种疾病都有其独特病因，需要"审因论治"。常见病因包括风、寒、湿、热、毒、瘀、虚、情志等。',
    keyPoints: [
      '外因：风、寒、暑、湿、燥、火',
      '内因：喜、怒、忧、思、悲、恐、惊',
      '不内外因：跌打、虫兽、饮食、劳逸',
      '强调因时、因地、因人制宜',
    ],
  },
  {
    name: '诸病入络论',
    pinyin: 'Zhū Bìng Rù Luò Lùn',
    description:
      '瑶医认为百病皆由经络传导，深入脏腑。治疗上特别重视疏通经络，常用磨药、针挑、刮痧等技法作用于经络腧穴。',
    keyPoints: [
      '疾病由表入里、由浅入深',
      '经络是病邪传变的主要通道',
      '早期干预经络可阻断病程进展',
      '瑶医善用"走关窍"药物通络',
    ],
  },
];

/** 瑶医特色诊疗方法 */
export const YAO_DIAGNOSTIC_METHODS: YaoDiagnosticMethod[] = [
  {
    name: '磨刀诊脉法',
    origin: '广西金秀大瑶山瑶医世家传承',
    indications: ['风湿痹症', '跌打损伤', '筋骨疼痛', '寒凝血瘀'],
    procedure:
      '医者将磨刀石在脉象部位（多为寸关尺）旁侧轻轻摩擦，通过听磨刀声与触觉感知脉象变化。',
  },
  {
    name: '目诊辨病法',
    origin: '广西都安瑶医流派',
    indications: ['五脏虚实', '气血盛衰', '寒热病机'],
    procedure:
      '观察患者白睛（巩膜）的血脉分布、颜色、形态，结合虹膜分区反射，对应五脏六腑进行辨证。',
  },
  {
    name: '甲诊辨证法',
    origin: '湖南江华瑶医流派',
    indications: ['慢性病', '体质辨识', '气血状态'],
    procedure:
      '通过观察指甲的色泽、形态、月痕（甲半月）大小，辨识患者气血盈亏和体质类型。',
  },
  {
    name: '舌下络脉诊法',
    origin: '云南河口瑶医流派',
    indications: ['瘀血证', '血脉不畅', '心脑血管病'],
    procedure: '查看舌下静脉的迂曲、怒张、颜色深浅，判断瘀血程度。',
  },
  {
    name: '庞桶药浴疗法',
    origin: '广西金秀国家级非物质文化遗产',
    indications: ['产后风湿', '月子病', '关节疼痛', '皮肤瘙痒', '体虚易感'],
    procedure:
      '将 20-40 味瑶药（多为五虎、九牛、十八钻类）放入大木桶（庞桶），加热水煎煮后，让患者浸泡全身或局部。药浴水温 38-42℃，时间 20-40 分钟。',
  },
  {
    name: '瑶医正骨术',
    origin: '广西恭城、湖南江华瑶医骨科',
    indications: ['骨折', '关节脱位', '跌打扭伤', '颈椎腰椎病'],
    procedure:
      '瑶医正骨强调"摸、接、端、提、按、摩、推、拿"八法，结合本地草药外敷与夹板固定，独具特色。',
  },
];

/** 瑶药材经典分类（"五虎九牛十八钻七十二风"） */
export const YAO_HERB_CATEGORIES: YaoHerbHerbCategory[] = [
  {
    category: '五虎',
    nameYao: 'ŋgo2 fu2x',
    meaning:
      '药力峻猛如虎，攻坚破结、消肿止痛力最强。常用于癥瘕积聚、痈疽肿毒、风湿顽痹等重症。',
    representatives: ['黑老虎根', '入山虎', '下山虎', '毛老虎', '白老虎'],
    mainEffects: '攻坚破积、散结消肿、活血止痛',
  },
  {
    category: '九牛',
    nameYao: 'tɕiu2 niou2x',
    meaning:
      '药力雄浑如牛，补益气血、强筋健骨、祛风除湿。常用于体虚久病、筋骨痿软、风湿痹症。',
    representatives: [
      '牛大力',
      '千斤拔',
      '血风藤',
      '藤当归',
      '黄花倒水莲',
      '五指毛桃',
      '鸡血藤',
      '过江龙',
      '牛尾菜',
    ],
    mainEffects: '补益气血、强筋健骨、祛风除湿',
  },
  {
    category: '十八钻',
    nameYao: 'ɕip8 pan2 tsuan1',
    meaning:
      '药性通达善走（钻），能通行十二经、活血祛瘀、通络止痛。常用于跌打损伤、血瘀经闭、风湿痹痛。',
    representatives: [
      '大钻',
      '小钻',
      '六方钻',
      '四方钻',
      '九龙钻',
      '麻骨钻',
      '黑钻',
      '铁钻',
      '铜钻',
      '钻石风',
      '红钻',
      '白钻',
      '花钻',
      '青钻',
      '黄钻',
      '木钻',
      '石钻',
      '水钻',
    ],
    mainEffects: '活血祛瘀、通络止痛、祛风除湿',
  },
  {
    category: '七十二风',
    nameYao: 'tshi1 ɕip8 ɲi2 fun1',
    meaning:
      '药性轻扬善行风邪，治疗风邪所致诸病最为有效。常用于外感风寒、风湿痹症、皮肤瘙痒、产后风。',
    representatives: [
      '九节风',
      '半边风',
      '大风叶',
      '小风叶',
      '过墙风',
      '金丝风',
      '满山香',
      '白面风',
      '红面风',
      '黑面风',
      '青风藤',
      '白风藤',
      '紫风藤',
      '黄风藤',
      '绿风藤',
      '红风藤',
      '蓝风藤',
      '石上风',
      '破骨风',
      '追骨风',
      '透骨风',
      '接骨风',
      '钻地风',
      '穿地风',
    ],
    mainEffects: '祛风除湿、解表散寒、舒筋活络、止痒',
  },
];

/** 这里类型别名仅为兼容：上面分类用 YaoHerbCategory */
type YaoHerbHerbCategory = YaoHerbCategoryRaw;

interface YaoHerbCategoryRaw {
  category: string;
  nameYao: string;
  meaning: string;
  representatives: string[];
  mainEffects: string;
}

/** 瑶医药传统文化传承 */
export interface YaoHeritageItem {
  /** 项目名称 */
  name: string;
  /** 项目类别 */
  type: '国家级' | '省级' | '市级' | '县级';
  /** 列入时间 */
  year: number;
  /** 保护单位/传承人 */
  custodian: string;
  /** 核心内容/特点 */
  description: string;
}

export const YAO_HERITAGE_ITEMS: YaoHeritageItem[] = [
  {
    name: '瑶医药（庞桶药浴）',
    type: '国家级',
    year: 2014,
    custodian: '金秀瑶族自治县瑶医医院',
    description:
      '瑶族传统药浴疗法入选第四批国家级非物质文化遗产代表性项目名录。其核心是选用大瑶山特有瑶药配方，针对产后风湿、关节痹痛等独特疗效。',
  },
  {
    name: '瑶族医药',
    type: '国家级',
    year: 2011,
    custodian: '广西壮族自治区民族医药研究所',
    description:
      '瑶族医药整体入选国家级非物质文化遗产，体现了瑶医药在民族医药体系中的重要地位。',
  },
  {
    name: '金秀瑶医骨伤疗法',
    type: '省级',
    year: 2009,
    custodian: '金秀瑶医世家（盘氏）',
    description: '金秀瑶医骨伤科以正骨手法结合瑶药外敷为特色，世代相传 200 余年。',
  },
  {
    name: '江华瑶医诊脉法',
    type: '省级',
    year: 2012,
    custodian: '湖南江华瑶族自治县',
    description: '瑶医独有的"望、闻、问、触、磨"五诊合参诊脉法。',
  },
  {
    name: '恭城瑶医正骨术',
    type: '市级',
    year: 2015,
    custodian: '恭城瑶族自治县',
    description: '瑶医正骨"八法"结合本地药酒外擦，独成一派。',
  },
  {
    name: '河口瑶药采集技艺',
    type: '县级',
    year: 2018,
    custodian: '云南河口瑶族自治县',
    description: '瑶族药农对南亚热带雨林瑶药"四季分采、阴阳分采"的传统采集技艺。',
  },
];

/** 代表性瑶医药传承人 */
export interface YaoInheritor {
  name: string;
  title: string;
  region: string;
  specialty: string;
  contribution: string;
}

export const YAO_INHERITORS: YaoInheritor[] = [
  {
    name: '金秀盘氏瑶医世家',
    title: '国家级代表性传承人',
    region: '广西金秀',
    specialty: '庞桶药浴、瑶医正骨、磨刀诊脉',
    contribution:
      '整理 200 余种大瑶山瑶药经验方，主编《瑶医药学》《大瑶山瑶药志》等学术著作。',
  },
  {
    name: '覃迅云',
    title: '中国民族医药学会瑶医药分会会长',
    region: '北京/广西',
    specialty: '瑶医基础理论、临床体系',
    contribution: '主编《瑶医药学》系统教材，推动瑶医药进入大学课程。',
  },
  {
    name: '江华赵氏瑶医世家',
    title: '省级代表性传承人',
    region: '湖南江华',
    specialty: '瑶医诊脉、甲诊、妇科',
    contribution: '传承瑶医"五诊法"诊疗体系。',
  },
  {
    name: '河口邓氏瑶医世家',
    title: '省级代表性传承人',
    region: '云南河口',
    specialty: '雨林瑶药采集、瑶医外科',
    contribution: '建立滇东南瑶药资源圃，保留南亚热带瑶药传统知识。',
  },
];

/** 瑶药材四性五味概览（核心知识） */
export const YAO_HERB_EFFICACY_OVERVIEW: YaoHerbEfficacy[] = [
  {
    nature: '热',
    flavor: '辛、甘',
    meridian: '肝、肾、心',
    efficacy: ['温阳散寒', '回阳救逆', '通络止痛'],
    clinicalUse: '寒湿痹症、四肢冰冷、阳虚畏寒',
    dosage: '煎服 3-9g；外用适量（不可久用）',
    contraindications: ['阴虚火旺者忌用', '孕妇慎用'],
  },
  {
    nature: '温',
    flavor: '甘、辛',
    meridian: '脾、胃、肝',
    efficacy: ['温中散寒', '补气养血', '祛风除湿'],
    clinicalUse: '脾胃虚寒、风湿痹症、产后体虚',
    dosage: '煎服 9-15g',
    contraindications: ['热病初起慎用'],
  },
  {
    nature: '平',
    flavor: '甘',
    meridian: '脾、肺',
    efficacy: ['平补气血', '调和诸药', '扶正固本'],
    clinicalUse: '日常保健、久病体虚、术后恢复',
    dosage: '煎服 15-30g',
    contraindications: [],
  },
  {
    nature: '凉',
    flavor: '苦、甘',
    meridian: '肺、肝、心',
    efficacy: ['清热解毒', '凉血消肿', '养阴生津'],
    clinicalUse: '热毒疮疡、咽喉肿痛、阴虚内热',
    dosage: '煎服 9-15g',
    contraindications: ['虚寒证慎用'],
  },
  {
    nature: '寒',
    flavor: '苦',
    meridian: '心、肝、胃',
    efficacy: ['清热泻火', '凉血解毒', '通淋利尿'],
    clinicalUse: '实热证、火毒疮疡、湿热黄疸',
    dosage: '煎服 3-9g（中病即止）',
    contraindications: ['脾胃虚寒忌用', '孕妇慎用'],
  },
];

/** 整合所有理论/诊疗/文化资料的总览（用于面板分类标签） */
export const YAO_KNOWLEDGE_SUMMARY = {
  theories: YAO_MEDICAL_THEORIES,
  diagnostics: YAO_DIAGNOSTIC_METHODS,
  herbCategories: YAO_HERB_CATEGORIES,
  efficacy: YAO_HERB_EFFICACY_OVERVIEW,
  heritage: YAO_HERITAGE_ITEMS,
  inheritors: YAO_INHERITORS,
};