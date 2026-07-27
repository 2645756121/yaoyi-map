/**
 * 视觉巡检 · 多场景自动截图脚本
 *
 * 截图节点：
 *   1. 首页初始
 *   2. 搜索栏打开下拉
 *   3. 县市详情面板（点击 county marker）
 *   4. 草药 Modal
 *   5. 瑶医基础知识 Modal
 *   6. 草药目录面板
 *   7. 移动端首页
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5186/';

mkdirSync('logs/inspection', { recursive: true });

const SCENARIOS = [
  {
    name: '01_home_desktop_1920',
    viewport: { width: 1920, height: 1080 },
    actions: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  {
    name: '02_home_desktop_1366',
    viewport: { width: 1366, height: 768 },
    actions: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  {
    name: '03_search_dropdown',
    viewport: { width: 1280, height: 720 },
    actions: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      const input = await page.$('header input[type="text"]');
      await input.click();
      await page.keyboard.type('yao', { delay: 30 });
      await new Promise((r) => setTimeout(r, 500));
    },
  },
  {
    name: '04_county_modal',
    viewport: { width: 1280, height: 720 },
    actions: async (page) => {
      await page.evaluate(() => {
        const store = window.__MAP_STORE__;
        if (store) {
          store.set((s) => ({
            ...s,
            selectedCounty: {
              code: '451324', name: '金秀瑶族自治县', nameEn: 'Jinxiu Yao Autonomous County',
              category: 'core', centerLng: 110.18, centerLat: 24.13, centerX: 0, centerY: 0,
              institutionCount: 4, schools: [], herbVarieties: [],
              province: '广西壮族自治区',
              since: 1644,
            },
            isCountyModalOpen: true,
            isHerbModalOpen: false,
            isPanelOpen: false,
          }));
        }
      });
      await new Promise((r) => setTimeout(r, 700));
    },
  },
  {
    name: '05_herb_modal',
    viewport: { width: 1280, height: 720 },
    actions: async (page) => {
      await page.evaluate(() => {
        const store = window.__MAP_STORE__;
        if (store) {
          const firstHerb = {
            id: 'yaoshanjujuan',
            name: '瑶山杜鹃',
            nameEn: 'Yao Mountain Rhododendron',
            nameYao: 'Nzhangx Ndongh',
            scientificName: 'Rhododendron yaoshanicum',
            image: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=beautiful+red+rhododendron+flower+in+mountain+forest+natural+herb&image_size=portrait_4_3',
            taste: '辛、温', meridian: '归肺、肝经',
            efficacy: '祛风散寒，活血通络，止咳平喘。主治风寒感冒，咳嗽气喘，风湿痹痛，跌打损伤。',
            usage: '内服：煎汤，6-12g；或浸酒。外用：适量，捣敷；或煎水洗。',
            medicinalPart: '花、叶、根',
            collectionSeason: '春季采花，夏季采叶，秋季采根',
            distributionArea: '广西中部和东部（金秀瑶族自治县等地），生于密林中',
            modernPharmacology: '现代研究表明杜鹃花属植物多含有黄酮类化合物，具有抗炎、抗氧化等药理活性。',
            regionId: 'guangxi',
            therapyIds: ['yaoyutangfa', 'zhenjiubaguan', 'caoyaoneifu'],
            botanicalFeatures: '常绿灌木，高1-3米。',
            yaoMedicineHistory: '瑶山杜鹃是大瑶山瑶族世代使用的经典瑶药。',
            activeIngredients: '主要含黄酮类化合物、挥发油、三萜类成分。',
          };
          store.set((s) => ({
            ...s,
            selectedHerb: firstHerb,
            isHerbModalOpen: true,
            isCountyModalOpen: false,
            isPanelOpen: false,
          }));
        }
      });
      await new Promise((r) => setTimeout(r, 800));
    },
  },
  {
    name: '06_yao_knowledge_modal',
    viewport: { width: 1280, height: 720 },
    actions: async (page) => {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('open-yao-knowledge'));
      });
      await new Promise((r) => setTimeout(r, 700));
    },
  },
  {
    name: '07_herb_catalog_open',
    viewport: { width: 1280, height: 720 },
    actions: async (page) => {
      // 先关闭 YaoKnowledge Modal
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const closeBtn = btns.find((b) => b.getAttribute('aria-label') === '\u5173\u95ed\u7476\u533b\u57fa\u7840\u77e5\u8bc6');
        closeBtn?.click();
      });
      await new Promise((r) => setTimeout(r, 400));
      // 打开草药目录
      const opened = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const cat = btns.find((b) => /草药.*目录/.test(b.textContent || '') || /草药分类目录/.test(b.textContent || ''));
        if (cat) {
          cat.click();
          return true;
        }
        return false;
      });
      if (!opened) {
        // 退而求其次：滚动到目录按钮
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          for (const b of btns) {
            if (/目录/.test(b.textContent || '')) {
              b.click();
              break;
            }
          }
        });
      }
      await new Promise((r) => setTimeout(r, 700));
    },
  },
  {
    name: '08_home_mobile_390',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    actions: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
];

(async () => {
  console.log('======================================');
  console.log('  Visual Inspection · 多场景自动截图');
  console.log('======================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const results = [];

  for (const sc of SCENARIOS) {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: sc.viewport.width, height: sc.viewport.height });
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // 等待稳定（依赖 store 的 Modal/视图加载）
      await new Promise((r) => setTimeout(r, 4500));
      await sc.actions(page);

      const file = `logs/inspection/${sc.name}.png`;
      await page.screenshot({ path: file, fullPage: false });

      // 收集页面诊断信息（DOM 异常、滚动条、外溢等）
      const diag = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        return {
          scrollW: body.scrollWidth,
          clientW: body.clientWidth,
          htmlScrollW: html.scrollWidth,
          htmlClientW: html.clientWidth,
          hScroll: body.scrollWidth > body.clientWidth + 1,
          iframeCount: document.querySelectorAll('iframe').length,
          svgPaths: document.querySelectorAll('svg path').length,
          modalLayers: document.querySelectorAll('.modal-layer').length,
          leafletControls: document.querySelectorAll('.leaflet-control').length,
          errors: (window.__PAGE_ERRORS__ || []).slice(-3),
        };
      });

      console.log(`\n[${sc.name}] ${sc.viewport.width}x${sc.viewport.height}`);
      console.log(`  saved: ${file}`);
      console.log(`  diag: ${JSON.stringify(diag)}`);
      results.push({ name: sc.name, ...diag, file });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  writeFileSync(
    'scripts/visual-inspection-report.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)
  );
  console.log('\nReport saved to scripts/visual-inspection-report.json');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});