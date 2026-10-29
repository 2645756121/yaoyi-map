/**
 * 本地草药图鉴 SVG 可用清单（自动生成，请勿手工编辑）
 *
 * 生成方式：扫描 public/herbs/*.svg 的文件名（不含扩展名），共 53 个。
 * 生成脚本：`node scripts/gen-herb-svg-availability.mjs`（在 public/herbs/ 增删 SVG 后需重新运行）。
 *
 * 为什么需要这份清单：
 *   `getHerbImageFallback()` 必须在远程图加载失败时给出本地兜底 URL，
 *   但浏览器端无法同步探测文件是否存在。此前该函数只对存在于
 *   HERB_IMAGE_OVERRIDES 中的 id 返回兜底，导致**另外 27 味已自备 SVG 的草药**
 *   白白退化成占位图标。改为对照本清单后，兜底覆盖全部实际存在的 SVG。
 */
export const AVAILABLE_HERB_SVGS: ReadonlySet<string> = new Set([
  'baiji',
  'baishao',
  'baizhi',
  'baizhu',
  'chaihu',
  'chenpi',
  'chonglou',
  'chuanbeimu',
  'chuanhuangbai',
  'chuanhuanglian',
  'chuanxiong',
  'danggui',
  'dangshen',
  'danshen',
  'duzhong',
  'fangfeng',
  'fuling',
  'gancao',
  'heifengteng',
  'heshouwu',
  'honghua',
  'houpo',
  'huangjing',
  'huangqi',
  'huangqin',
  'jiangxiangru',
  'jiegeng',
  'jixueteng',
  'juhua',
  'kuangtong',
  'leigongteng',
  'lingxiaohua',
  'lingzhi',
  'mangguo',
  'maoxiancao',
  'mudanpi',
  'notoginseng',
  'nvzhenzi',
  'sanqi',
  'shanyao',
  'sharen',
  'shihu',
  'tianqi',
  'touguancao',
  'xiakucao',
  'xiangfu',
  'yaoshanjujuan',
  'yeju',
  'yizhi',
  'yujin',
  'yunhuanglian',
  'yuzhu',
  'zhuru',
]);
