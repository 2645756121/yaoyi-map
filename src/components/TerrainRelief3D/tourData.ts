/**
 * tourData.ts —— 「红色文化 + 康养 + 瑶医」粤北旅游路线的数据层（纯数据，便于单测）
 *
 * 一条**连贯、无分支**的线性路线（自西向东）：
 *   连山 → 连南 → 乳源 → 广东大峡谷 → 南华寺 → 韶关 → 丹霞山 → 双峰寨 → 城口 → 珠玑古巷
 *
 * 排序原则（保证"不交叉、少折返"）：
 *   · 珠玑古巷是全线最东端、连山是最西端 → 两端作为起终点，避免在中间折返；
 *   · 西段先沿瑶族聚居区向东（连山→连南→乳源），再南下到乳源大布的大峡谷，
 *     然后转向东北经南华寺、韶关，最后沿仁化—南雄一线北上东行（丹霞山→双峰寨→城口→珠玑）。
 *
 * 坐标说明（节点经纬度均取自公开地理资料，非杜撰）：
 *   - 丹霞山：113°36′25″–113°47′53″E / 24°51′48″–25°04′12″N（韶关市政府/省文旅厅文件），取中部 113.72/24.97
 *   - 南华寺：113.6371E / 24.6458N（高德地图 POI）
 *   - 红军长征粤北纪念馆：113.7325E / 25.3202N（POI 数据）
 *   - 双峰寨：仁化县**石塘镇**石塘村（县城西 19 km），寨址位于镇域内
 *   - 珠玑古巷：114.3594E / 25.1864N
 *   - 广东大峡谷：113.1426E / 24.5044N（POI 数据）
 *   - 乳源 / 连南 / 连山：直接复用项目 `data/yaoCountyData.ts` 中已有的县域中心坐标
 *     （113.2744/24.7761、112.2906/24.7258、112.0800/24.5700）
 *
 * 内容来源与口径（各节点的 sections 均按此核对）：
 *   - 瑶族医药（药浴疗法）列入国家级非遗代表性项目名录（中国非物质文化遗产网·传统医药类）
 *   - 瑶族刺绣（国家级非遗）主要分布在乳源必背、游溪、东坪三镇；当地瑶族属"勉语系"过山瑶
 *   - 瑶族盘王节（国家级非遗，申报地区：广东省韶关市）
 *   - 连南林下中药材种植 2.6 万亩、5 个瑶药示范基地；连南瑶医瑶药花都体验展示中心获评
 *     广东省中医药文化宣传教育基地；县第十批县级非遗含"排瑶药膳疗法""万应瑶药酒"
 *   - 连山县级以上非遗 63 项（国家级 1、省级 4、市级 21）；壮锦、壮家戏水节、瑶族小长鼓舞、"牛王诞"
 *   - 必背镇保留 3 项国家级、3 项省级、6 项市级非遗，两度入选"广东省民间文化艺术之乡"
 *   - 双峰寨：原名荣阳寨、俗称石塘寨，位于石塘镇石塘村；1899 年动工、历时 12 年建成，
 *     占地 9486.6 ㎡；1928 年 3—11 月双峰寨（石塘寨）保卫战，农军坚守 9 个月
 *   - 红军长征粤北纪念馆：2019 年 10 月开馆；主题展《长征·粤北突围》**6 个篇章**
 *   - 丹霞山：总面积 292 km²，5 个园区 + 锦江/浈江风光带，680 多座红色砂砾岩石峰，
 *     最高峰巴寨 619.2 m，1928 年首次研究命名丹霞地貌，2010 年列入世界自然遗产
 *   - 珠玑巷：南起驷马桥、北至凤凰桥，全长约 1.5 km，三街四巷，巷道宽 4–5 m，原名敬宗巷
 */

export type TourCategory = 'red' | 'scenic' | 'yao' | 'hub';

/**
 * 节点素材类型（motif）：当前详情面板统一使用占位符，此字段保留为"后续替换实拍/主题素材"时的
 * 选图依据（同一 motif 的节点可复用同一套素材），不影响现有渲染。
 */
export type TourMotif =
  | 'hub'
  | 'fort'
  | 'monument'
  | 'oldstreet'
  | 'danxia'
  | 'temple'
  | 'canyon'
  | 'yao';

/** 一个维度的详解（人文 / 红色基地 / 瑶医非遗 / 自然康养 …） */
export interface TourSection {
  /** 维度标题（如「人文」「红色基地」「瑶医非遗」） */
  title: string;
  /** 详解正文（2~4 句，客观陈述，数字均来自公开资料） */
  body: string;
}

export interface TourNode {
  id: string;
  /** 展示序号（1 起，即路线上的行进顺序） */
  order: number;
  name: string;
  /** 地图标注用的短名（2~5 字，避免标签过长互相挤占；全名见 name / 弹窗） */
  shortName: string;
  category: TourCategory;
  /** WGS84 经纬度 */
  lon: number;
  lat: number;
  /** 所在行政区（卡片副标题用，如「韶关 · 仁化城口」） */
  region: string;
  /** 一句话标签（副标题） */
  subtitle: string;
  /** 详细介绍（2~3 句，客观陈述） */
  intro: string;
  /** 3 条要点 */
  highlights: string[];
  /** 分维度详解：按"人文 / 红色基地 / 瑶医非遗"三个视角补充，天然不适用该维度的节点不强凑 */
  sections: TourSection[];
  /** 站点配图（相对 public 的路径，如 tour/danxia.jpg）；缺省时渲染占位图 */
  image?: string;
  /** 配图署名：CC BY / CC BY-SA 要求标注作者、许可与来源 */
  imageCredit?: { title: string; author: string; license: string; source: string };
  /** 额外配图（自动下滑画廊用）；首图始终是 image 字段那张 */
  gallery?: TourImage[];
  motif: TourMotif;
}

/** 一张站点配图及其署名（CC BY / CC BY-SA 的标注要求） */
export interface TourImage {
  /** 相对 public 的路径，如 tour/danxia.jpg */
  src: string;
  /** 原文件名（便于追溯） */
  title: string;
  author: string;
  license: string;
}

/** 取某站点的全部配图：主图在前，其后是 gallery 里的额外图（自动去重、丢弃空项） */
export function tourNodeImages(node: TourNode): TourImage[] {
  const out: TourImage[] = [];
  const seen = new Set<string>();
  if (node.image) {
    out.push({
      src: node.image,
      title: node.imageCredit?.title ?? node.name,
      author: node.imageCredit?.author ?? '',
      license: node.imageCredit?.license ?? '',
    });
    seen.add(node.image);
  }
  for (const g of node.gallery ?? []) {
    if (!g?.src || seen.has(g.src)) continue;
    seen.add(g.src);
    out.push(g);
  }
  return out;
}

export interface TourRoute {
  id: string;
  name: string;
  /** 依次经过的节点 id（与数组顺序一致，构成唯一一条无分支路线） */
  nodeIds: string[];
  /** 路线主色 */
  color: string;
  /** 路线说明 */
  summary: string;
}

/* ------------------------------------------------------------------ 配色 */

/** 三类主题 + 集散中心的统一色（节点标记、类别图例共用） */
export const CATEGORY_COLORS: Record<TourCategory, string> = {
  // 强调色都要在"绿低地 / 棕山地"的底图上可辨，因此避开绿、黄系（会与底图混色）：
  // 朱红(9°) / 靛蓝(220°) / 紫罗兰(280°) 在色相环上彼此拉开；集散中心用品牌深绿以示"枢纽"。
  red: '#e8482c',
  scenic: '#2f6fe0',
  yao: '#8f3fd6',
  hub: '#3f6b31',
};

export const CATEGORY_LABELS: Record<TourCategory, string> = {
  red: '红色文化',
  scenic: '生态康养',
  yao: '瑶医风情',
  hub: '集散中心',
};

/** 路线主色（单条线性路线统一用朱红，与参考图的"红色路线"一致） */
export const ROUTE_COLOR = '#e8482c';

/* ------------------------------------------------------------------ 节点 */

export const TOUR_NODES: TourNode[] = [
  {
    id: 'lianshan',
    order: 1,
    name: '连山壮族瑶族自治县',
    shortName: '连山',
    category: 'yao',
    lon: 112.08,
    lat: 24.57,
    region: '清远 · 连山',
    subtitle: '壮瑶聚居 · 连山瑶药派',
    intro:
      '连山是广东唯一的壮族瑶族自治县，壮、瑶两族聚居，山地梯田广布。当地以“连山瑶药派”传承瑶药种植与配伍经验，与乳源、连南共同构成粤北瑶医药走廊，是本次线路的西端起点。',
    highlights: ['广东唯一壮族瑶族自治县', '县级以上非遗 63 项', '连山瑶药派'],
    sections: [
      {
        title: '人文',
        body:
          '壮、瑶两族世代杂居，形成“壮锦 + 瑶族小长鼓舞”并存的非遗版图：全县县级以上非遗项目 63 项，其中国家级 1 项、省级 4 项、市级 21 项。壮家戏水节（“七月香”）、瑶族盘王节是当地最具代表性的民族节庆，也常被用作非遗旅游的品牌活动。',
      },
      {
        title: '瑶医非遗',
        body:
          '连山把传统医药列入非遗保护重点：县“十四五”非遗保护规划明确提出“发挥壮瑶医药非遗项目作用”，推动壮瑶医药在基层医疗卫生机构中的运用。山地梯田与林下环境为瑶药种植提供了垂直气候条件，“连山瑶药派”即在此基础上形成。',
      },
      {
        title: '生态康养',
        body:
          '县域以山地为主、梯田层叠，是粤北少见的连片壮瑶聚居高寒山区之一。相对凉爽的山地气候与较低的人口密度，使它适合作为整条线路“慢进”的第一站——先适应海拔与气候，再进入瑶医主题更集中的连南、乳源。',
      },
    ],
    gallery: [
      { src: 'tour/lianshan-2.jpg', title: "金子山/欧家梯田 官方景区图 14", author: "连山壮族瑶族自治县人民政府（金子山/欧家梯田景区页）", license: "授权使用" },
      { src: 'tour/lianshan-3.jpg', title: "金子山/欧家梯田 官方景区图 4", author: "连山壮族瑶族自治县人民政府（金子山/欧家梯田景区页）", license: "授权使用" },
      { src: 'tour/lianshan-4.jpg', title: "金子山/欧家梯田 官方景区图 5", author: "连山壮族瑶族自治县人民政府（金子山/欧家梯田景区页）", license: "授权使用" },
      { src: 'tour/lianshan-5.jpg', title: "金子山/欧家梯田 官方景区图 18", author: "连山壮族瑶族自治县人民政府（金子山/欧家梯田景区页）", license: "授权使用" },
      { src: 'tour/lianshan-6.jpg', title: "金子山/欧家梯田 官方景区图 19", author: "连山壮族瑶族自治县人民政府（金子山/欧家梯田景区页）", license: "授权使用" },
      { src: 'tour/lianshan-7.jpg', title: "金子山/欧家梯田 官方景区图 23", author: "连山壮族瑶族自治县人民政府（金子山/欧家梯田景区页）", license: "授权使用" },
      { src: 'tour/lianshan-8.jpg', title: "金子山/欧家梯田 官方景区图 3", author: "连山壮族瑶族自治县人民政府（金子山/欧家梯田景区页）", license: "授权使用" },
    ],
    image: 'tour/lianshan.jpg',
    imageCredit: { title: '金子山/欧家梯田 官方景区图', author: '连山壮族瑶族自治县人民政府', license: '授权使用', source: '连山县政府门户网站' },
    motif: 'yao',
  },
  {
    id: 'liannan',
    order: 2,
    name: '连南瑶族自治县',
    shortName: '连南',
    category: 'yao',
    lon: 112.2906,
    lat: 24.7258,
    region: '清远 · 连南',
    subtitle: '广东瑶族重要聚居地 · 连南瑶医派',
    intro:
      '连南是广东瑶族人口最集中的地区之一，境内有南岗千年瑶寨等瑶族古村落。当地以“连南瑶医派”为核心，设有瑶医药研究机构，是瑶医药资源最密集的县域之一。',
    highlights: ['南岗千年瑶寨', '瑶药种植 2.6 万亩', '排瑶药膳疗法'],
    sections: [
      {
        title: '人文',
        body:
          '南岗千年瑶寨坐落于三排镇，始建于隋唐、延续一千四百余年，寨门海拔 808 米，被誉为“世界瑶族第一寨”，并列入中国历史文化名村。油岭一带的“还盘王愿”仪式要连续举行七天七夜，含《盘王大歌》二十四段套曲与三十二种祭祀舞蹈；瑶族盘王节本身是国家级非遗（申报地区为韶关市）。',
      },
      {
        title: '瑶医非遗',
        body:
          '连南是粤北瑶药资源最密集的县域：林下中药材种植面积 2.6 万亩，建成 5 个瑶药示范基地；县第十批县级非遗中，传统医药类已收录“排瑶药膳疗法”“万应瑶药酒”等项目。连南瑶医瑶药花都体验展示中心获评广东省中医药文化宣传教育基地，是瑶医药走出县域的展示窗口。',
      },
      {
        title: '线路衔接',
        body:
          '连南向东即接乳源，两县同属瑶族聚居带。若时间有限，可把连南作为“瑶医深度站”（瑶药基地 + 药膳）、乳源作为“瑶族文化站”（瑶绣 + 过山瑶村落），两者内容互补而不重复。',
      },
    ],
    image: 'tour/liannan.jpg',
    imageCredit: { title: '1964年 广东连南瑶族自治县', author: '《人民画报》（1964）', license: 'Public domain', source: 'Wikimedia Commons' },
    gallery: [
      { src: 'tour/liannan-2.jpg', title: "Delivering rice wine continuously from a height to guests using bamboo tubes.jpg", author: "Pauloleong2002", license: "CC BY-SA 4.0" },
      { src: 'tour/liannan-3.jpg', title: "千年瑶寨南岗排20151004 - panoramio.jpg", author: "Qiu Mao", license: "CC BY 3.0" },
      { src: 'tour/liannan-4.jpg', title: "千年瑶寨南岗排20151004 - panoramio (56).jpg", author: "Qiu Mao", license: "CC BY 3.0" },
      { src: 'tour/liannan-5.jpg', title: "千年瑶寨南岗排20151004 - panoramio (59).jpg", author: "Qiu Mao", license: "CC BY 3.0" },
      { src: 'tour/liannan-6.jpg', title: "千年瑶寨南岗排20151004 - panoramio (52).jpg", author: "Qiu Mao", license: "CC BY 3.0" },
      { src: 'tour/liannan-7.jpg', title: "千年瑶寨南岗排20151004 - panoramio (49).jpg", author: "Qiu Mao", license: "CC BY 3.0" },
      { src: 'tour/liannan-8.jpg', title: "千年瑶寨南岗排20151004 - panoramio (90).jpg", author: "Qiu Mao", license: "CC BY 3.0" },
    ],
    motif: 'yao',
  },
  {
    id: 'ruyuan',
    order: 3,
    name: '乳源瑶族自治县',
    shortName: '乳源',
    category: 'yao',
    lon: 113.2744,
    lat: 24.7761,
    region: '韶关 · 乳源',
    subtitle: '韶关唯一瑶族自治县 · 乳源瑶医派',
    intro:
      '乳源是韶关唯一的瑶族自治县，瑶族聚居于必背、东坪等山区乡镇。县域以“乳源瑶医派”为代表，保留瑶药种植与瑶族传统诊疗方式，是瑶医康养线路的核心节点。',
    highlights: ['瑶族刺绣（国家级非遗）', '必背过山瑶村寨', '乳源瑶医派'],
    sections: [
      {
        title: '人文',
        body:
          '乳源瑶族属“勉语系”过山瑶，隋唐时期自北方迁来，因“耕作一山、则移一山”的游耕传统而得名。瑶族刺绣是国家级非遗，主要分布在必背、游溪、东坪三镇；必背镇至今保留 3 项国家级、3 项省级、6 项市级非遗，并两度入选“广东省民间文化艺术之乡”。',
      },
      {
        title: '瑶医非遗',
        body:
          '瑶族医药（药浴疗法）已列入国家级非遗代表性项目名录，是瑶族传统医药中辨识度最高的技艺形式。乳源以“乳源瑶医派”为代表，山区瑶寨保留瑶药种植、采药与药浴等传统诊疗方式，是线路上“看得见过程”的瑶医现场。',
      },
      {
        title: '交通与衔接',
        body:
          '乳源县城距韶关丹霞机场约 35 公里、韶关高铁站约 30 公里，是全线交通条件最好的瑶族县域。由乳源南下可直达大布镇的广东大峡谷，向东则接曲江南华寺，适合作为“瑶医 + 山水”两日行程的落脚点。',
      },
    ],
    image: 'tour/ruyuan.jpg',
    imageCredit: { title: '韶关 乳源必背 - panoramio', author: '牛糞', license: 'CC BY-SA 3.0', source: 'Wikimedia Commons' },
    gallery: [
      { src: 'tour/ruyuan-2.jpg', title: "View from train for Shenzhen North Station near Ruyuan, Guangdong.jpg", author: "そらみみ", license: "CC BY-SA 4.0" },
      { src: 'tour/ruyuan-3.jpg', title: "小黄山 - panoramio.jpg", author: "fsyzh", license: "CC BY 3.0" },
      { src: 'tour/ruyuan-4.jpg', title: "南岭小黄山 - panoramio.jpg", author: "fsyzh", license: "CC BY 3.0" },
      { src: 'tour/ruyuan-5.jpg', title: "Gdgv05.JPG", author: "me ([1])", license: "CC BY-SA 3.0" },
      { src: 'tour/ruyuan-6.jpg', title: "乳源县必背瑶乡之桥.jpg", author: "岭南浪人", license: "CC BY-SA 3.0" },
      { src: 'tour/ruyuan-7.jpg', title: "FULL SIGHT for Ruyuan Yao Autonomous County.jpg", author: "PQ77wd", license: "CC BY-SA 4.0" },
    ],
    motif: 'yao',
  },
  {
    id: 'daxiagu',
    order: 4,
    name: '广东大峡谷',
    shortName: '大峡谷',
    category: 'scenic',
    lon: 113.1426,
    lat: 24.5044,
    region: '韶关 · 乳源大布',
    subtitle: '乳源大布 · 广东最大峡谷',
    intro:
      '广东大峡谷位于乳源瑶族自治县大布镇，地处岭南山脉深处的高寒石灰岩山区。峡谷深切、溪瀑成群，是粤北山地徒步与避暑康养的代表性目的地。',
    highlights: ['广东省最大峡谷', '腾龙大瀑布落差 220 余米', '1386 级“天梯”石阶'],
    sections: [
      {
        title: '自然',
        body:
          '又称粤北大峡谷，是广东省最大的峡谷。谷面宽约 600 米，大布河自东南向西北蜿蜒流过，至此突然腾空冲下形成瀑布；主瀑腾龙大瀑布落差 220 余米，沿近 90° 的崖壁跌落，是广东规模最大的峡谷瀑布。',
      },
      {
        title: '徒步与康养',
        body:
          '景区以“雄、奇、险、秀”著称，设有高达 1386 级的陡峭“天梯”石阶，垂直落差带来明显的体感强度，属于中等偏上难度的山地徒步。大布镇一带为高寒石灰岩山区，夏季气温低于韶关市区，适合作为整条线路的避暑与体能调节点。',
      },
      {
        title: '瑶医视角',
        body:
          '峡谷所在的乳源大布一带仍是瑶族活动区域，山区湿热、多雨雾，瑶族传统上重视祛湿、解暑类的草药与药浴用法——这也是把“山地徒步 + 瑶药浴”组合成康养产品的自然接口。',
      },
    ],
    image: 'tour/daxiagu.jpg',
    imageCredit: { title: '2006 韶关 乳源大峡谷 - panoramio', author: '张元柏', license: 'CC BY-SA 3.0', source: 'Wikimedia Commons' },
    gallery: [
      { src: 'tour/daxiagu-2.jpg', title: "广东乳源大峡谷 官方景区图 3", author: "韶关市人民政府·文旅专栏", license: "授权使用" },
      { src: 'tour/daxiagu-3.jpg', title: "广东乳源大峡谷 官方景区图 1", author: "韶关市人民政府·文旅专栏", license: "授权使用" },
      { src: 'tour/daxiagu-4.jpg', title: "广东乳源大峡谷 官方景区图 2", author: "韶关市人民政府·文旅专栏", license: "授权使用" },
      { src: 'tour/daxiagu-5.jpg', title: "2006 韶关 乳源大峡谷 - panoramio (1).jpg", author: "张元柏", license: "CC BY-SA 3.0" },
      { src: 'tour/daxiagu-6.jpg', title: "2006 韶关 乳源大峡谷 - panoramio (2).jpg", author: "张元柏", license: "CC BY-SA 3.0" },
    ],
    motif: 'canyon',
  },
  {
    id: 'nanhua',
    order: 5,
    name: '南华寺',
    shortName: '南华寺',
    category: 'scenic',
    lon: 113.6371,
    lat: 24.6458,
    region: '韶关 · 曲江',
    subtitle: '曲江 · 禅宗六祖道场',
    intro:
      '南华寺坐落于曲江区马坝镇东南的曹溪之畔，距韶关市区约 25 公里，是禅宗六祖惠能的弘法地、南宗禅法的发源地。寺内保存六祖真身等大批珍贵文物，是岭南重要的佛教道场。',
    highlights: ['六祖祖庭（曹溪祖庭）', '南宗禅法发源地', '广东六大名寺之一'],
    sections: [
      {
        title: '人文',
        body:
          '南华寺是禅宗六祖惠能弘法之地，被视为“南宗禅法”的发源地，故称“六祖祖庭”，俗称“曹溪祖庭”，并列为广东六大名寺之一。寺院坐北朝南、呈阶梯式中轴对称布局，寺域约 42.5 万平方米、主体建筑群约 1.2 万平方米，中轴线自曹溪门起依次展开。',
      },
      {
        title: '文物与禅法',
        body:
          '六祖真身是南华寺最重要的文物。南宗自惠能起采用“夹纻法”全身葬法、保留真身入龛，与天竺火葬取舍利的传统形成明显区别——这也是研究禅宗丧葬制度与佛教中国化的重要实物线索。',
      },
      {
        title: '线路衔接',
        body:
          '南华寺位于韶关市区以南约 25 公里、曲江马坝镇一带，是从乳源向东进入韶关盆地后的第一站。寺院环境清幽、步行强度低，适合安排在峡谷徒步之后作为“静”的一段，与丹霞山的“动”形成节奏对比。',
      },
    ],
    image: 'tour/nanhua.jpg',
    imageCredit: { title: '南华寺钟楼', author: 'Emitchan', license: 'Public domain', source: 'Wikimedia Commons' },
    gallery: [
      { src: 'tour/nanhua-2.jpg', title: "南华寺进口.JPG", author: "Emitchan", license: "Public domain" },
      { src: 'tour/nanhua-3.jpg', title: "南华寺鼓楼.JPG", author: "Emitchan", license: "Public domain" },
      { src: 'tour/nanhua-4.jpg', title: "Nanhua Temple 1.jpg", author: "関野貞", license: "Public domain" },
      { src: 'tour/nanhua-5.jpg', title: "A hall in Nanhua Temple, Shaoguang, Guangdong.jpg", author: "Singchron", license: "CC BY-SA 4.0" },
      { src: 'tour/nanhua-6.jpg', title: "韶关市 南华寺 里面的石柱 - By 科技小辛 - panoramio.jpg", author: "科技小辛", license: "CC BY-SA 3.0" },
      { src: 'tour/nanhua-7.jpg', title: "韶关市 南华寺大门 - By 科技小辛 - panoramio.jpg", author: "科技小辛", license: "CC BY-SA 3.0" },
      { src: 'tour/nanhua-8.jpg', title: "韶关市 南华寺 里面 - By 科技小辛 - panoramio.jpg", author: "科技小辛", license: "CC BY-SA 3.0" },
    ],
    motif: 'temple',
  },
  {
    id: 'hub',
    order: 6,
    name: '韶关·集散中心',
    shortName: '韶关',
    category: 'hub',
    lon: 113.597,
    lat: 24.81,
    region: '韶关 · 市区',
    subtitle: '粤北门户 · 线路中枢',
    intro:
      '韶关位于粤北、南岭山脉南麓，是本次线路的中枢节点：西接乳源、连南、连山，东连丹霞山与仁化红色旧址群，南面可达曲江南华寺。高铁与高速在此交汇，可作为整条线路的上下车点。',
    highlights: ['高铁与高速交汇', '线路中枢，可分段上下车', '南岭山地气候凉爽'],
    sections: [
      {
        title: '人文',
        body:
          '韶关地处南岭山脉南麓，是中原经梅关古道进入岭南的北大门，珠玑巷—梅关古道这条千年迁徙通道即在市域东北的南雄境内。市域内同时汇聚禅宗祖庭（南华寺）、丹霞地貌命名地（丹霞山）与仁化红色旧址群，形成“一条线串三类遗产”的格局。',
      },
      {
        title: '交通与集散',
        body:
          '韶关站为高铁枢纽，韶关丹霞机场位于乳源境内（乳源县城距机场约 35 公里、距高铁站约 30 公里）。以韶关市区为轴，西可至乳源/连南/连山，东北可至仁化（丹霞山、双峰寨、城口），南可至曲江（南华寺），适合按日程分段上下车。',
      },
      {
        title: '康养',
        body:
          '南岭山地海拔与植被带来较市区更凉爽的夏季体感，是粤北“避暑 + 康养”的天然支点。作为线路中枢，韶关更适合承担住宿、补给与医疗后备的功能，把瑶药浴、山地徒步等强度活动分配在周边县域。',
      },
    ],
    image: 'tour/hub.jpg',
    imageCredit: { title: 'Shaoguanyijing', author: 'Zhuwq（中文维基）', license: 'CC BY-SA 3.0', source: 'Wikimedia Commons' },
    gallery: [
      { src: 'tour/hub-2.jpg', title: "浈江 南韶高速韶关东站收费站.jpg", author: "Liuxingy", license: "CC BY-SA 4.0" },
      { src: 'tour/hub-3.jpg', title: "浈江 在曲江桥上望浈江 02.jpg", author: "Liuxingy", license: "CC BY-SA 4.0" },
      { src: 'tour/hub-4.jpg', title: "浈江 在曲江桥上望浈江 01.jpg", author: "Liuxingy", license: "CC BY-SA 4.0" },
      { src: 'tour/hub-5.jpg', title: "浈江 大学路上的专用线平交道口.jpg", author: "Liuxingy", license: "CC BY-SA 4.0" },
      { src: 'tour/hub-6.jpg', title: "浈江 城区景象.jpg", author: "Liuxingy", license: "CC BY-SA 4.0" },
      { src: 'tour/hub-7.jpg', title: "Zhongshan Park in Shaoguan.jpg", author: "汀海岸上", license: "CC BY-SA 4.0" },
      { src: 'tour/hub-8.jpg', title: "The intersection of two rivers in Shaoguan.jpg", author: "汀海岸上", license: "CC BY-SA 4.0" },
    ],
    motif: 'hub',
  },
  {
    id: 'danxia',
    order: 7,
    name: '丹霞山',
    shortName: '丹霞山',
    category: 'scenic',
    lon: 113.72,
    lat: 24.97,
    region: '韶关 · 仁化',
    subtitle: '仁化 · 世界自然遗产、丹霞地貌命名地',
    intro:
      '丹霞山位于韶关市仁化县，是广东省唯一的世界自然遗产，有“中国红石公园”之称。景区总面积 292 平方公里，丹霞地貌集中分布约 180 平方公里，最高峰巴寨海拔 619.2 米。',
    highlights: ['世界自然遗产（2010）', '丹霞地貌命名地', '最高峰巴寨 619.2 m'],
    sections: [
      {
        title: '自然',
        body:
          '丹霞山是“丹霞地貌”的命名地——1928 年该地貌在此首次被研究并命名，如今已是国际通用的地貌术语。景区总面积 292 平方公里，由丹霞、韶石、巴寨、飞花水、仙人迹 5 个园区与锦江、浈江两条风光带组成，全山有 680 多座红色砂砾岩石峰，最高峰巴寨海拔 619.2 米。',
      },
      {
        title: '人文',
        body:
          '“色若渥丹，灿若明霞”，丹霞山因这句形容而得名，被视为世界低海拔山岳型风景区的杰出代表。它并非纯自然保护地，而是“以丹霞地貌景观为主的自然与人文并重的风景区”，2010 年作为“中国丹霞”组成部分列入世界自然遗产。',
      },
      {
        title: '线路衔接',
        body:
          '丹霞山与双峰寨相距约 23 公里、同属仁化县，是线路上“自然遗产 + 红色遗址”最紧凑的一段。建议上午走丹霞山（长老峰或阳元山线路），下午转双峰寨与城口，可避免重复往返。',
      },
    ],
    image: 'tour/danxia.jpg',
    imageCredit: { title: '20251102 Danxia Shan (150149)', author: 'Yumeto', license: 'CC BY-SA 4.0', source: 'Wikimedia Commons' },
    gallery: [
      { src: 'tour/danxia-2.jpg', title: "20251102 Danxia Shan (152721).jpg", author: "Yumeto", license: "CC BY-SA 4.0" },
      { src: 'tour/danxia-3.jpg', title: "20251102 Danxia Shan (153940).jpg", author: "Yumeto", license: "CC BY-SA 4.0" },
      { src: 'tour/danxia-4.jpg', title: "20251102 Danxia Shan (150403).jpg", author: "Yumeto", license: "CC BY-SA 4.0" },
      { src: 'tour/danxia-5.jpg', title: "20251102 Danxia Shan (144402).jpg", author: "Yumeto", license: "CC BY-SA 4.0" },
      { src: 'tour/danxia-6.jpg', title: "20251102 Danxia Shan (154758).jpg", author: "Yumeto", license: "CC BY-SA 4.0" },
      { src: 'tour/danxia-7.jpg', title: "20251102 Danxia Shan (155445).jpg", author: "Yumeto", license: "CC BY-SA 4.0" },
      { src: 'tour/danxia-8.jpg', title: "20251102 Danxia Shan (154648).jpg", author: "Yumeto", license: "CC BY-SA 4.0" },
    ],
    motif: 'danxia',
  },
  {
    id: 'shuangfeng',
    order: 8,
    name: '双峰寨',
    shortName: '双峰寨',
    category: 'red',
    lon: 113.632,
    lat: 25.075,
    region: '韶关 · 仁化石塘',
    subtitle: '仁化石塘 · 寨堡式红色遗址',
    intro:
      '双峰寨位于仁化县石塘镇石塘村（县城西约 19 公里），原名荣阳寨、俗称石塘寨，是一座以石墙与护城河环绕的寨堡式建筑。1928 年仁化暴动期间，当地农军依托寨堡进行了著名的双峰寨保卫战，是粤北重要的红色革命遗址。',
    highlights: ['寨堡式围楼建筑', '1928 年双峰寨保卫战', '距丹霞山约 23 km'],
    sections: [
      {
        title: '红色基地',
        body:
          '1928 年 3 月至 11 月，中共仁化县委领导的农民自卫军在双峰寨（石塘寨）坚守抗击国民党反动武装，历时九个月，史称双峰寨保卫战（又称石塘寨保卫战）。寨堡的石墙、护城河与围楼结构让这场防御战持续了远超常规的时间，也使遗址保留了较完整的战场形态。',
      },
      {
        title: '人文与建筑',
        body:
          '双峰寨原名荣阳寨，俗称石塘寨，由乡绅李自胜为防范匪患筹银三万，于清光绪二十五年（1899 年）动工、历时十二年建成，占地面积 9486.6 平方米。它与相邻的石塘古村共同构成“寨—村”一体的粤北防御性聚落样本。',
      },
      {
        title: '线路衔接',
        body:
          '双峰寨位于仁化县城西约 19 公里、距丹霞山约 23 公里，与丹霞山同属仁化县，是线路上“自然遗产 + 红色遗址”衔接最自然的一站；由此继续北上即达城口镇的红军长征粤北纪念馆。',
      },
    ],
    image: 'tour/shuangfeng.jpg',
    imageCredit: { title: 'Renhua Shuangfeng Zhai 2013.12.08', author: 'Zhangzhugang', license: 'CC BY-SA 3.0', source: 'Wikimedia Commons' },
    gallery: [
      { src: 'tour/shuangfeng-2.jpg', title: "Renhua Shuangfeng Zhai 2013.12.08 14-52-35.jpg", author: "Zhangzhugang", license: "CC BY-SA 3.0" },
      { src: 'tour/shuangfeng-3.jpg', title: "Renhua Shuangfeng Zhai 2013.12.08 14-49-53.jpg", author: "Zhangzhugang", license: "CC BY-SA 3.0" },
      { src: 'tour/shuangfeng-4.jpg', title: "Dayu Bay - Shitang Cun - P1210525.JPG", author: "User:Vmenkov", license: "CC BY-SA 3.0" },
      { src: 'tour/shuangfeng-5.jpg', title: "Dayu Bay - Shitang Cun - P1210526.JPG", author: "User:Vmenkov", license: "CC BY-SA 3.0" },
      { src: 'tour/shuangfeng-6.jpg', title: "Dayu Bay - Shitang Cun - P1210523.JPG", author: "User:Vmenkov", license: "CC BY-SA 3.0" },
      { src: 'tour/shuangfeng-7.jpg', title: "Dayu Bay - Shitang Cun - P1210521.JPG", author: "User:Vmenkov", license: "CC BY-SA 3.0" },
      { src: 'tour/shuangfeng-8.jpg', title: "Dayu Bay - Shitang Cun - P1210522.JPG", author: "User:Vmenkov", license: "CC BY-SA 3.0" },
    ],
    motif: 'fort',
  },
  {
    id: 'chengkou',
    order: 9,
    name: '红军长征粤北纪念馆',
    shortName: '粤北纪念馆',
    category: 'red',
    lon: 113.7325,
    lat: 25.3202,
    region: '韶关 · 仁化城口',
    subtitle: '仁化城口 · 广东唯一长征主题纪念馆',
    intro:
      '纪念馆位于仁化县城口镇锦江河畔，2019 年 10 月建成开馆。主体以“穿越封锁”为意象呈纪念碑造型，主题展《长征·粤北突围》分六个篇章，系统展示中央红军长征过境粤北的历史。',
    highlights: ['2019 年 10 月开馆', '主题展分 6 个篇章', '城口镇锦江河畔'],
    sections: [
      {
        title: '红色基地',
        body:
          '这是广东唯一以红军长征为主题的纪念馆。《长征·粤北突围》按六个篇章展开：“星火燎原耀南粤”“取道粤北突重围”“奔袭城口破封锁”“山高路远勇向前”“绝命后卫阻强敌”“三年游击展旌旗”，完整串起中央红军过境粤北、突破封锁与后续三年游击战争。',
      },
      {
        title: '建筑与展陈',
        body:
          '纪念馆主体以“穿越封锁”为意象，呈纪念碑式造型，坐落于城口镇锦江河畔。展陈以时间为轴、以战役与路线为节点，配合实物与场景复原，是理解“长征如何穿过南岭”的最直观一站。',
      },
      {
        title: '人文',
        body:
          '城口镇是红军长征过境粤北的重要节点，镇上的老街小巷仍保留当年的空间尺度。近年随着纪念馆焕新开放，城口从“过境地”逐步转为红色研学与乡村旅游的目的地，红色资源与古村风貌在此叠加。',
      },
    ],
    image: 'tour/chengkou.jpg',
    imageCredit: { title: '城口镇公园 - panoramio', author: '刘冰', license: 'CC BY-SA 3.0', source: 'Wikimedia Commons' },
    gallery: [
      { src: 'tour/chengkou-2.jpg', title: "红军长征粤北纪念馆 官方图", author: "韶关市人民政府·文旅专栏", license: "授权使用" },
      { src: 'tour/chengkou-3.jpg', title: "城口镇", author: "Wikimedia Commons · panoramio", license: "CC BY-SA 3.0" },
      { src: 'tour/chengkou-4.jpg', title: "城口镇大桥", author: "Wikimedia Commons · panoramio", license: "CC BY-SA 3.0" },
    ],
    motif: 'monument',
  },
  {
    id: 'zhuji',
    order: 10,
    name: '珠玑古巷',
    shortName: '珠玑古巷',
    category: 'red',
    lon: 114.3594,
    lat: 25.1864,
    region: '韶关 · 南雄',
    subtitle: '南雄 · 梅关古道南端的寻根地',
    intro:
      '珠玑古巷位于南雄市珠玑镇珠玑村，全长约 1.5 公里，南起驷马桥、北至凤凰桥，是古代五岭南北梅关古道的必经之路。巷内三街四巷的格局保存至今，是众多广府民系后裔的寻根地，也是本次线路的东端终点。',
    highlights: ['梅关古驿道南端', '三街四巷古格局', '广府民系寻根地'],
    sections: [
      {
        title: '人文',
        body:
          '珠玑巷原名敬宗巷，位于南雄市珠玑镇珠玑村，地处梅关古道南端、大庾岭南麓。巷南起驷马桥、北至凤凰桥，全长约 1.5 公里，由珠玑街、棋盘街、马仔街三条街与洙泗巷、黄茅巷、铁炉巷、腊巷四条巷构成“三街四巷”，巷道以鹅卵石与花岗石铺砌，路面宽约 4 至 5 米，被誉为“广东第一巷”。',
      },
      {
        title: '迁徙与寻根',
        body:
          '唐代以后，中原移民经梅关古道南下珠三角，珠玑巷是这条通道上最重要的集散地之一，也因此成为广府民系与众多岭南族谱中的“祖居地”。今天的珠玑古巷以寻根文化为核心，与梅关古道共同构成国家 AAAA 级旅游景区（2012 年评定）。',
      },
      {
        title: '线路收束',
        body:
          '作为全线最东端的终点，珠玑古巷把行程从“瑶医与红色”收束到更宏观的迁徙史：从连山的壮瑶聚居、仁化的红色旧址，到这里的中原南迁通道，粤北在一条线路上呈现出“民族—革命—移民”三层历史纵深。',
      },
    ],
    image: 'tour/zhuji.jpg',
    imageCredit: { title: 'Nanxiong Zhuji 2014.01.12', author: 'Zhangzhugang', license: 'CC BY-SA 4.0', source: 'Wikimedia Commons' },
    gallery: [
      { src: 'tour/zhuji-2.jpg', title: "珠玑古巷 官方景区图 6", author: "韶关市人民政府·文旅专栏", license: "授权使用" },
      { src: 'tour/zhuji-3.jpg', title: "珠玑古巷 官方景区图 4", author: "韶关市人民政府·文旅专栏", license: "授权使用" },
      { src: 'tour/zhuji-4.jpg', title: "珠玑古巷 官方景区图 1", author: "韶关市人民政府·文旅专栏", license: "授权使用" },
      { src: 'tour/zhuji-5.jpg', title: "珠玑古巷 官方景区图 5", author: "韶关市人民政府·文旅专栏", license: "授权使用" },
      { src: 'tour/zhuji-6.jpg', title: "珠玑古巷 官方景区图 3", author: "韶关市人民政府·文旅专栏", license: "授权使用" },
      { src: 'tour/zhuji-7.jpg', title: "珠玑古巷 官方景区图 2", author: "韶关市人民政府·文旅专栏", license: "授权使用" },
      { src: 'tour/zhuji-8.jpg', title: "Nanxiong Zhuji 2014.01.12 10-31-02.jpg", author: "Zhangzhugang", license: "CC BY-SA 4.0" },
    ],
    motif: 'oldstreet',
  },
];

export const TOUR_NODE_BY_ID: Map<string, TourNode> = new Map(
  TOUR_NODES.map((n) => [n.id, n]),
);

/* ------------------------------------------------------------------ 路线 */

export const TOUR_ROUTES: TourRoute[] = [
  {
    id: 'yuebei-line',
    name: '粤北红色康养瑶医线',
    nodeIds: TOUR_NODES.map((n) => n.id),
    color: ROUTE_COLOR,
    summary: '连山 → 连南 → 乳源 → 广东大峡谷 → 南华寺 → 韶关 → 丹霞山 → 双峰寨 → 城口 → 珠玑古巷',
  },
];

/* ------------------------------------------------------------------ 范围 */

export interface TourBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** 全部节点的经纬包围盒（已含少量余量），用于相机适配与自动取景 */
export function tourBounds(extraDeg = 0.1): TourBounds {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const n of TOUR_NODES) {
    if (n.lon < minLon) minLon = n.lon;
    if (n.lat < minLat) minLat = n.lat;
    if (n.lon > maxLon) maxLon = n.lon;
    if (n.lat > maxLat) maxLat = n.lat;
  }
  return {
    minLon: minLon - extraDeg,
    minLat: minLat - extraDeg,
    maxLon: maxLon + extraDeg,
    maxLat: maxLat + extraDeg,
  };
}
