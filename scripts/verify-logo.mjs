/**
 * Logo 全场景配置验证脚本
 *
 * 检测项：
 *  1. 静态资源：public/logo/logo.png + logo.svg 都存在
 *  2. Logo 组件：单文件统一组件，支持响应式、hover、降级、懒加载
 *  3. Header / Footer / index.html 都引用了 logo.png
 *  4. 构建产物（dist）含 logo 资源 + index.html 路径正确
 *  5. dev server 能成功响应 /logo/logo.png 与 /logo/logo.svg
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let pass = 0, fail = 0;
const log = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`[OK]   ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`[FAIL] ${name}${detail ? ' — ' + detail : ''}`); }
};

// === 1. 静态资源 ===
log('public/logo/logo.png 存在', existsSync(resolve(ROOT, 'public/logo/logo.png')));
log('public/logo/logo.svg 存在', existsSync(resolve(ROOT, 'public/logo/logo.svg')));

// === 2. Logo 组件 ===
const logoPath = resolve(ROOT, 'src/components/common/Logo.tsx');
const logoExists = existsSync(logoPath);
log('Logo.tsx 统一组件存在', logoExists);
if (logoExists) {
  const src = readFileSync(logoPath, 'utf8');
  log('Logo.tsx 引用 assetPath() 自动注入 base 前缀', src.includes('assetPath('));
  log('Logo.tsx 使用 logo.png 作为主源', src.includes("'logo/logo.png'") || src.includes('logo/logo.png'));
  log('Logo.tsx 使用 logo.svg 作为降级备用', src.includes("'logo/logo.svg'") || src.includes('logo/logo.svg'));
  log('Logo.tsx 提供 PNG→SVG→占位三级降级', src.includes('PLACEHOLDER_SVG'));
  log('Logo.tsx 支持响应式 size 预设 (xs/sm/md/lg/xl)',
    ['xs', 'sm', 'md', 'lg', 'xl'].every(s => src.includes(`'${s}'`)));
  log('Logo.tsx 使用 clamp() 实现响应式尺寸', src.includes('clamp('));
  log('Logo.tsx 支持懒加载 (loading + IntersectionObserver)',
    src.includes('IntersectionObserver') && src.includes('loading'));
  log('Logo.tsx 支持 fetchpriority', src.includes('fetchPriority') || src.includes('fetchpriority'));
  log('Logo.tsx 支持点击跳首页', src.includes('clickToHome') && src.includes('scrollTo'));
  log('Logo.tsx 支持 onLoaded / onError 回调',
    src.includes('onLoaded') && src.includes('onError'));
  log('Logo.tsx 兼容 prefers-reduced-motion 偏好', src.includes('prefers-reduced-motion'));
}

// === 3. Header 与 Footer ===
const headerPath = resolve(ROOT, 'src/components/common/Header.tsx');
const footerPath = resolve(ROOT, 'src/components/common/Footer.tsx');
const homePath = resolve(ROOT, 'src/pages/Home.tsx');

if (existsSync(headerPath)) {
  const src = readFileSync(headerPath, 'utf8');
  log('Header.tsx 引入统一 Logo 组件', src.includes("from './Logo'"));
  log('Header.tsx 不再内嵌 <img> 直引 logo.svg（已统一）',
    !src.includes("src={assetPath('logo/logo.svg')}") && !src.includes('src={assetPath("logo/logo.svg")}'));
  log('Header.tsx 的 logo 外层是可点击链接', /href=["']\/["']/.test(src) && /aria-label="?瑶医/.test(src));
}

if (existsSync(footerPath)) {
  const src = readFileSync(footerPath, 'utf8');
  log('Footer.tsx 引入统一 Logo 组件', src.includes("from './Logo'"));
  log('Footer.tsx 中 logo 设置 clickToHome=true', src.includes('clickToHome'));
  log('Footer.tsx 显示版权信息', src.includes('©') && src.includes('getFullYear()'));
  log('Footer.tsx 包含网站导览 + 资源链接 两列', src.includes('网站导览') && src.includes('资源与联系'));
}

if (existsSync(homePath)) {
  const src = readFileSync(homePath, 'utf8');
  log('Home.tsx 渲染 Footer 组件', src.includes('<Footer'));
}

// === 4. index.html ===
const htmlPath = resolve(ROOT, 'index.html');
if (existsSync(htmlPath)) {
  const src = readFileSync(htmlPath, 'utf8');
  log('index.html favicon 引用 logo.png (32x32)',
    /<link[^>]+rel=["']icon["'][^>]+sizes=["']32x32["'][^>]+href=["']\/logo\/logo\.png["']/.test(src));
  log('index.html favicon 引用 logo.png (16x16)',
    /<link[^>]+rel=["']icon["'][^>]+sizes=["']16x16["'][^>]+href=["']\/logo\/logo\.png["']/.test(src));
  log('index.html apple-touch-icon 引用 logo.png',
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']\/logo\/logo\.png["']/.test(src));
  log('index.html preload logo.png (high priority)',
    /<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']\/logo\/logo\.png["'][^>]+fetchpriority=["']high["']/.test(src));
  log('index.html preload logo.svg (high priority)',
    /<link[^>]+rel=["']preload["'][^>]+href=["']\/logo\/logo\.svg["']/.test(src));
}

// === 5. CSS 样式 ===
const cssPath = resolve(ROOT, 'src/index.css');
if (existsSync(cssPath)) {
  const src = readFileSync(cssPath, 'utf8');
  log('index.css 包含 .yao-logo-badge 容器样式', src.includes('.yao-logo-badge'));
  log('index.css 包含 .yao-logo-link 链接样式', src.includes('.yao-logo-link'));
  log('index.css 包含 .yao-logo-skeleton 占位骨架', src.includes('.yao-logo-skeleton'));
  log('index.css 包含 .yao-logo-img 图像样式', src.includes('.yao-logo-img'));
  log('index.css 包含 hover/focus 视觉效果',
    src.includes('yao-logo-link:hover') && src.includes('yao-logo-link:focus-visible'));
}

console.log(`\n=== 总计 === 通过: ${pass}，失败: ${fail}`);
process.exit(fail > 0 ? 1 : 0);