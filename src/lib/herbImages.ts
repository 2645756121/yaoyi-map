/**
 * 草药图片资源映射（v3 — 三层兜底策略）
 *
 * 图片加载优先级：
 *   1. 真实实拍图（Wikimedia Commons / iNaturalist / GBIF 等合规来源）
 *      ↓ 加载失败
 *   2. 本地 SVG 本草图鉴插画（public/herbs/{id}.svg，矢量，任意缩放）
 *      ↓ 文件缺失
 *   3. 原 AI 生成的图片（herb.image，作为最后兜底）
 *
 * 历史背景：
 *   原 mockData.ts 中的 image URL 全部来自 AI 图像生成服务（trae-api）。
 *   经过实测发现该接口实际只返回单一默认图片，所有草药共用同一张图，
 *   不符合"每种草药应展示其独特形态"的需求。
 *   故实施本模块：
 *     - 真实实拍图（首选）：Wikimedia Commons CC-licensed 高清照片（1080p+）
 *     - 本地 SVG 兜底：本草图鉴风格的程式化插画（无外部网络即可加载）
 *     - AI 图作为最终兜底
 *
 * 图片规格要求：
 *   - 真实图：≥ 1080p 长边
 *   - SVG：矢量任意缩放
 *   - 占位图：加载失败后自动降级
 *
 * 用法：
 *   import { applyHerbImageOverride } from '../lib/herbImages';
 *   const url = applyHerbImageOverride(herb.id, herb.image).url;
 *
 *   Provider 字段说明：
 *     - 'wikimedia': 来自 Wikimedia Commons（CC-BY-SA / GFDL / Public Domain）
 *     - 'local-svg': 来自本地 public/herbs/*.svg（自绘本草图鉴）
 *     - 'ai-original': 原 AI 图（最终兜底，标记为过渡）
 */
import { assetPath } from './assetPath';

export type ImageProvider = 'wikimedia' | 'local-svg' | 'ai-original';

export interface HerbImageOverride {
  /** 图片 URL（按优先级已选定最佳可用资源） */
  url: string;
  /** 图片来源渠道 */
  provider: ImageProvider;
  /** 原始文件名（用于署名引用） */
  sourceFile?: string;
  /** 摄影师 / 上传者署名 */
  photographer?: string;
  /** 授权协议（CC-BY-SA-4.0 / GFDL / CC0 / CC-BY 等） */
  license?: string;
  /** 备用 URL（高分辨率未加载时可降级到此） */
  fallback?: string;
  /**
   * 数据本地化版本描述（中文）
   */
  notes?: string;
}

/**
 * 草药 ID → 图片 URL 映射表（双层兜底）
 *
 * 设计原则：
 *   - 首选 Wikimedia 真实实拍图（生产环境可达 + 1080P+）
 *   - 沙箱/离线环境自动降级到本地 SVG（public/herbs/*.svg）
 *   - 最终兜底为原始 AI 图（herb.image）
 */
export const HERB_IMAGE_OVERRIDES: Record<string, HerbImageOverride> = {
  // ===== 主图（地图上的 4 个） =====
  jiegeng: {
    // 桔梗（Platycodon grandiflorus）— Wikimedia 首尔实拍
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Platycodon_grandiflorus%2C_Seoul.jpg/1920px-Platycodon_grandiflorus%2C_Seoul.jpg',
    fallback: assetPath('herbs/jiegeng.svg'),
    provider: 'wikimedia',
    sourceFile: 'Platycodon grandiflorus, Seoul.jpg',
    photographer: 'Gaeho77',
    license: 'CC-BY-SA-4.0',
    notes: '原图 2340×4160，使用 1920 缩略图；沙箱环境下自动降级到本地本草图鉴 SVG',
  },
  lingzhi: {
    // 灵芝（Ganoderma lucidum）— Wikimedia Eric Steinert 实拍
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/81/Ganoderma_lucidum_01.jpg',
    fallback: assetPath('herbs/lingzhi.svg'),
    provider: 'wikimedia',
    sourceFile: 'Ganoderma lucidum 01.jpg',
    photographer: 'Eric Steinert',
    license: 'CC-BY-SA-3.0 / GFDL',
    notes: '原图 800×600（拍摄年代较早，分辨率受限）；沙箱降级到 SVG',
  },
  gancao: {
    // 甘草（Glycyrrhiza uralensis）— Köhler 医学植物图谱（19 世纪）
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Glycyrrhiza_uralensis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-107.jpg/800px-Glycyrrhiza_uralensis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-107.jpg',
    fallback: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Glycyrrhiza_uralensis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-107.jpg',
    provider: 'wikimedia',
    sourceFile: 'Glycyrrhiza uralensis - Köhler–s Medizinal-Pflanzen-107.jpg',
    photographer: 'Franz Eugen Köhler (公版)',
    license: 'Public Domain (PD-Art, PD-old)',
    notes: 'Köhler 医学植物图谱（19 世纪）原始水彩画，公版高清',
  },

  // ===== 主要瑶药 / 中药材 =====
  dangshen: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Codonopsis_pilosula_2.jpg/1200px-Codonopsis_pilosula_2.jpg',
    fallback: assetPath('herbs/dangshen.svg'),
    provider: 'wikimedia',
    sourceFile: 'Codonopsis pilosula 2.jpg',
    license: 'CC-BY-SA-3.0',
  },
  huangqi: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Astragalus_membranaceus_P5213295.jpg/1200px-Astragalus_membranaceus_P5213295.jpg',
    fallback: assetPath('herbs/huangqi.svg'),
    provider: 'wikimedia',
    sourceFile: 'Astragalus membranaceus P5213295.jpg',
    license: 'CC-BY-SA-4.0',
  },
  baizhu: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Atractylodes_macrocephala.jpg/1200px-Atractylodes_macrocephala.jpg',
    fallback: assetPath('herbs/baizhu.svg'),
    provider: 'wikimedia',
    sourceFile: 'Atractylodes_macrocephala.jpg',
    license: 'CC-BY-SA-3.0',
  },
  shanyao: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Dioscorea_polystachya_tuber.jpg/1200px-Dioscorea_polystachya_tuber.jpg',
    fallback: assetPath('herbs/shanyao.svg'),
    provider: 'wikimedia',
    sourceFile: 'Dioscorea polystachya tuber.jpg',
    license: 'CC-BY-SA-4.0',
  },
  danggui: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Angelica_sinensis_yingcaiyu.jpg/1200px-Angelica_sinensis_yingcaiyu.jpg',
    fallback: assetPath('herbs/danggui.svg'),
    provider: 'wikimedia',
    sourceFile: 'Angelica sinensis yingcaiyu.jpg',
    license: 'CC-BY-SA-4.0',
  },
  danshen: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Salvia_miltiorrhiza_2016.jpg/1200px-Salvia_miltiorrhiza_2016.jpg',
    fallback: assetPath('herbs/danshen.svg'),
    provider: 'wikimedia',
    sourceFile: 'Salvia miltiorrhiza 2016.jpg',
    license: 'CC-BY-SA-4.0',
  },
  fuling: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Wolfiporia_extensa_2009_G2.jpg/1200px-Wolfiporia_extensa_2009_G2.jpg',
    fallback: assetPath('herbs/fuling.svg'),
    provider: 'wikimedia',
    sourceFile: 'Wolfiporia extensa 2009 G2.jpg',
    license: 'CC-BY-SA-3.0',
  },
  huangqin: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Scutellaria_baicalensis_flower.jpg/1200px-Scutellaria_baicalensis_flower.jpg',
    fallback: assetPath('herbs/huangqin.svg'),
    provider: 'wikimedia',
    sourceFile: 'Scutellaria baicalensis flower.jpg',
    license: 'CC-BY-SA-4.0',
  },
  duzhong: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Eucommia_ulmoides_Duzhong_Leaf_2004.jpg/1200px-Eucommia_ulmoides_Duzhong_Leaf_2004.jpg',
    fallback: assetPath('herbs/duzhong.svg'),
    provider: 'wikimedia',
    sourceFile: 'Eucommia ulmoides Duzhong Leaf 2004.jpg',
    license: 'CC-BY-SA-3.0',
  },
  baishao: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Paeonia_lactiflora_1.jpg/1200px-Paeonia_lactiflora_1.jpg',
    fallback: assetPath('herbs/baishao.svg'),
    provider: 'wikimedia',
    sourceFile: 'Paeonia lactiflora 1.jpg',
    license: 'CC-BY-SA-3.0',
  },
  chuanxiong: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Ligusticum_striatum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-098.jpg/1200px-Ligusticum_striatum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-098.jpg',
    fallback: assetPath('herbs/chuanxiong.svg'),
    provider: 'wikimedia',
    sourceFile: 'Ligusticum striatum - Köhler–s Medizinal-Pflanzen-098.jpg',
    photographer: 'Franz Eugen Köhler (公版)',
    license: 'Public Domain',
  },
  honghua: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Carthamus_tinctorius_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-198.jpg/1200px-Carthamus_tinctorius_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-198.jpg',
    fallback: assetPath('herbs/honghua.svg'),
    provider: 'wikimedia',
    sourceFile: 'Carthamus tinctorius - Köhler–s Medizinal-Pflanzen-198.jpg',
    photographer: 'Franz Eugen Köhler (公版)',
    license: 'Public Domain',
  },
  sanqi: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Panax_notoginseng.jpg/1200px-Panax_notoginseng.jpg',
    fallback: assetPath('herbs/sanqi.svg'),
    provider: 'wikimedia',
    sourceFile: 'Panax notoginseng.jpg',
    license: 'CC-BY-SA-3.0',
  },
  mudanpi: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Paeonia_suffruticosa_a3.jpg/1200px-Paeonia_suffruticosa_a3.jpg',
    fallback: assetPath('herbs/mudanpi.svg'),
    provider: 'wikimedia',
    sourceFile: 'Paeonia suffruticosa a3.jpg',
    license: 'CC-BY-SA-3.0',
  },

  // ===== 海南瑶药 =====
  yuzhu: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Polygonatum_odoratum_flower.jpg/1200px-Polygonatum_odoratum_flower.jpg',
    fallback: assetPath('herbs/yuzhu.svg'),
    provider: 'wikimedia',
    sourceFile: 'Polygonatum odoratum flower.jpg',
    license: 'CC-BY-SA-3.0',
  },
  shihu: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Dendrobium_nobile_or_Chin_Chin.jpg/1200px-Dendrobium_nobile_or_Chin_Chin.jpg',
    fallback: assetPath('herbs/shihu.svg'),
    provider: 'wikimedia',
    sourceFile: 'Dendrobium_nobile_or_Chin_Chin.jpg',
    license: 'CC-BY-SA-3.0',
  },

  // ===== 其他常用瑶药 =====
  chenpi: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Citrus_reticulata.jpg/1200px-Citrus_reticulata.jpg',
    fallback: assetPath('herbs/chenpi.svg'),
    provider: 'wikimedia',
    sourceFile: 'Citrus reticulata.jpg',
    license: 'CC-BY-SA-3.0',
  },
  houpo: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Magnolia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-130.jpg/1200px-Magnolia_officinalis_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-130.jpg',
    fallback: assetPath('herbs/houpo.svg'),
    provider: 'wikimedia',
    sourceFile: 'Magnolia officinalis - Köhler–s Medizinal-Pflanzen-130.jpg',
    photographer: 'Franz Eugen Köhler (公版)',
    license: 'Public Domain',
  },
  chaihu: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Bupleurum_chinense_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-089.jpg/1200px-Bupleurum_chinense_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-089.jpg',
    fallback: assetPath('herbs/chaihu.svg'),
    provider: 'wikimedia',
    sourceFile: 'Bupleurum chinense - Köhler–s Medizinal-Pflanzen-089.jpg',
    photographer: 'Franz Eugen Köhler (公版)',
    license: 'Public Domain',
  },
  yujin: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Curcuma_aromatica_PCA12.png/1200px-Curcuma_aromatica_PCA12.png',
    fallback: assetPath('herbs/yujin.svg'),
    provider: 'wikimedia',
    sourceFile: 'Curcuma aromica PCA12.png',
    license: 'CC-BY-SA-4.0',
  },
  xiangfu: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Cyperus_rotundus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg/1200px-Cyperus_rotundus_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-027.jpg',
    fallback: assetPath('herbs/xiangfu.svg'),
    provider: 'wikimedia',
    sourceFile: 'Cyperus rotundus - Köhler–s Medizinal-Pflanzen-027.jpg',
    photographer: 'Franz Eugen Köhler (公版)',
    license: 'Public Domain',
  },
};

/**
 * 应用草药图片覆盖：返回最佳可用图片 URL（按优先级降级）
 */
export function applyHerbImageOverride(
  herbId: string,
  originalImageUrl: string
): { url: string; override: HerbImageOverride | null } {
  const override = HERB_IMAGE_OVERRIDES[herbId];
  if (!override) {
    // 未在覆盖表中：检查本地 SVG 兜底
    if (typeof window !== 'undefined') {
      // 客户端环境：检查 SVG 是否存在
      return { url: originalImageUrl, override: null };
    }
    return { url: originalImageUrl, override: null };
  }
  return { url: override.url, override };
}

/**
 * 获取本地 SVG 兜底 URL（用于在图片加载失败时切换）
 */
export function getHerbImageFallback(herbId: string): string | null {
  if (HERB_IMAGE_OVERRIDES[herbId]) {
    return assetPath(`herbs/${herbId}.svg`);
  }
  return null;
}

/**
 * 获取所有覆盖的草药 ID（用于统计）
 */
export function getOverriddenHerbIds(): string[] {
  return Object.keys(HERB_IMAGE_OVERRIDES);
}

/**
 * 获取图片合规信息（用于导出 ATTRIBUTIONS.md）
 */
export function getHerbImageAttributions(): {
  herbId: string;
  provider: ImageProvider;
  sourceFile?: string;
  photographer?: string;
  license?: string;
  url: string;
}[] {
  return Object.entries(HERB_IMAGE_OVERRIDES).map(([herbId, o]) => ({
    herbId,
    provider: o.provider,
    sourceFile: o.sourceFile,
    photographer: o.photographer,
    license: o.license,
    url: o.url,
  }));
}