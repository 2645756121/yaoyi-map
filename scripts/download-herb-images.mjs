/**
 * 下载真实草药图片到本地 public 目录
 */
import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC_HERBS = resolve(ROOT, 'public/herbs');
mkdirSync(PUBLIC_HERBS, { recursive: true });

const HERB_IMAGE_URLS = {
  jiegeng: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Platycodon_grandiflorus%2C_Seoul.jpg/1920px-Platycodon_grandiflorus%2C_Seoul.jpg',
  lingzhi: 'https://upload.wikimedia.org/wikipedia/commons/8/81/Ganoderma_lucidum_01.jpg',
  gancao: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Glycyrrhiza_uralensis_-_Koehlers_Medizinal-Pflanzen-107.jpg',
  dangshen: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Codonopsis_pilosula_2.jpg',
  huangqi: 'https://upload.wikimedia.org/wikipedia/commons/c/c2/Astragalus_membranaceus_P5213295.jpg',
  baizhu: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Atractylodes_macrocephala.jpg',
  shanyao: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Dioscorea_polystachya_tuber.jpg',
  danggui: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Angelica_sinensis_yingcaiyu.jpg',
  danshen: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Salvia_miltiorrhiza_2016.jpg',
  fuling: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Wolfiporia_extensa_2009_G2.jpg',
  huangqin: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Scutellaria_baicalensis_flower.jpg',
  duzhong: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Eucommia_ulmoides_Duzhong_Leaf_2004.jpg',
  baishao: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Paeonia_lactiflora_1.jpg',
  sanqi: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Panax_notoginseng.jpg',
  mudanpi: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Paeonia_suffruticosa_a3.jpg',
  yuzhu: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Polygonatum_odoratum_flower.jpg',
  shihu: 'https://upload.wikimedia.org/wikipedia/commons/8/80/Dendrobium_nobile_or_Chin_Chin.jpg',
  chenpi: 'https://upload.wikimedia.org/wikipedia/commons/0/06/Citrus_reticulata.jpg',
  chaihu: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Bupleurum_chinense_-_Koehlers_Medizinal-Pflanzen-089.jpg',
  yujin: 'https://upload.wikimedia.org/wikipedia/commons/0/02/Curcuma_aromatica_PCA12.png',
};

function download(url, destPath, depth = 0) {
  return new Promise((resolveP, rejectP) => {
    if (depth > 5) return rejectP(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; YaoYiMapBot/1.0; +https://example.com/bot)',
        'Accept': 'image/*,*/*',
      },
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        return download(response.headers.location, destPath, depth + 1).then(resolveP, rejectP);
      }
      if (response.statusCode !== 200) {
        response.resume();
        return rejectP(new Error(`HTTP ${response.statusCode}`));
      }
      const file = createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolveP());
      });
    }).on('error', rejectP);
  });
}

async function main() {
  console.log(`Downloading ${Object.keys(HERB_IMAGE_URLS).length} herb images...`);
  let success = 0, failed = 0;

  for (const [herbId, url] of Object.entries(HERB_IMAGE_URLS)) {
    const ext = url.toLowerCase().includes('.png') ? 'png' : 'jpg';
    const destPath = resolve(PUBLIC_HERBS, `${herbId}.${ext}`);
    if (existsSync(destPath)) {
      console.log(`  [SKIP] ${herbId}.${ext}`);
      success++;
      continue;
    }
    try {
      process.stdout.write(`  [GET]  ${herbId}.${ext} ... `);
      await download(url, destPath);
      console.log('OK');
      success++;
    } catch (e) {
      console.log(`FAIL (${e.message})`);
      failed++;
    }
  }

  console.log(`\n${success} succeeded, ${failed} failed`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });