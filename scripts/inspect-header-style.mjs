import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5186/';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise((r) => setTimeout(r, 5000));

const info = await page.evaluate(() => {
  const header = document.querySelector('header');
  if (!header) return { found: false };
  const cs = getComputedStyle(header);
  // 列出实际生效的 className
  return {
    className: header.className,
    background: cs.background,
    backgroundImage: cs.backgroundImage,
    backgroundColor: cs.backgroundColor,
    color: cs.color,
    width: header.getBoundingClientRect().width,
    height: header.getBoundingClientRect().height,
    // 找到 document head 中的样式表，统计包含 "from-primary-700" 的规则数
    cssHasPrimaryGradient: Array.from(document.styleSheets).some((sheet) => {
      try {
        return Array.from(sheet.cssRules || []).some((rule) =>
          (rule.cssText || '').includes('from-primary-700'),
        );
      } catch (e) {
        return false;
      }
    }),
    cssHasGradientToR: Array.from(document.styleSheets).some((sheet) => {
      try {
        return Array.from(sheet.cssRules || []).some((rule) =>
          (rule.cssText || '').includes('bg-gradient-to-r'),
        );
      } catch (e) {
        return false;
      }
    }),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();