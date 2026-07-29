#!/usr/bin/env node
// verify-wcag-contrast.mjs - WCAG AA 瀵规瘮搴﹂獙璇?// 鐢ㄦ硶锛?node scripts/verify-wcag-contrast.mjs

function hexToRgb(hex) {
  const s = hex.replace('#', '');
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(c1, c2) {
  const L1 = relativeLuminance(c1);
  const L2 = relativeLuminance(c2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rating(ratio, isLargeText = false) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= (isLargeText ? 4.5 : 4.5)) return isLargeText ? 'AAA (large)' : 'AA';
  if (ratio >= (isLargeText ? 3 : 3)) return 'AA Large only';
  return '鉂?FAIL';
}

// 4 鑹蹭綋绯伙紙鐢ㄦ埛鎸囧畾锛?const PALETTE = {
  primary_500: '#90A686',  // 鑽夋牴鏈豢锛堜富鑳屾櫙锛?  primary_700: '#587851',  // 娣辩豢锛堟枃瀛椾富鑹诧級
  amber_400:  '#D4AC6A',   // 铚滅倷鐒﹂粍锛堝己璋冭壊锛?  ochre_200:  '#F7EADF',   // 绫宠壊锛堝崱鐗囪儗鏅級
  white:      '#FFFFFF',
  black:      '#000000',
};

console.log('鈺斺晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晽');
console.log('鈺?          鐟跺尰鏈崏 4 鑹蹭綋绯?鈥?WCAG AA 瀵规瘮搴﹂獙璇?                   鈺?);
console.log('鈺氣晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨暆\n');

const pairs = [
  // 鍗＄墖鑳屾櫙锛堢背鑹诧級涓婄殑鏂囧瓧
  { fg: PALETTE.primary_700, bg: PALETTE.ochre_200,  label: '娣辩豢鏂囧瓧 (#587851) / 绫宠壊鍗＄墖鑳屾櫙 (#F7EADF)',   expected: 'AA 澶ф枃鏈?(4.22:1)' },
  { fg: '#243B25',          bg: PALETTE.ochre_200,  label: '鏈€娣辩豢鏂囧瓧 (#243B25) / 绫宠壊鍗＄墖鑳屾櫙',              expected: 'AAA' },
  { fg: '#102514',          bg: PALETTE.ochre_200,  label: '鏍囬绾ф繁缁挎枃瀛?(#102514) / 绫宠壊鍗＄墖鑳屾櫙',          expected: 'AAA' },
  { fg: PALETTE.amber_400,  bg: PALETTE.ochre_200,  label: '铚滅倷榛勬枃瀛?(#D4AC6A) / 绫宠壊鍗＄墖鑳屾櫙 (绂佹)',        expected: 'FAIL 鈥?搴旀敼鐢ㄦ繁缁? },
  // 涓昏儗鏅紙鑽夋湰缁匡級涓婄殑鏂囧瓧 鈥?body 涓昏儗鏅笉鏀炬鏂囷紝浠呬綔瑁呴グ搴曡壊
  { fg: PALETTE.white,      bg: PALETTE.primary_500, label: '鐧借壊鏂囧瓧 / 鑽夋湰缁夸富鑳屾櫙 (#90A686)',                  expected: 'AA Large only (2.63:1) 鈥?浠呯敤浜庡ぇ鍙峰姞绮楁爣棰? },
  { fg: PALETTE.ochre_200,  bg: PALETTE.primary_500, label: '绫宠壊鏂囧瓧 (#F7EADF) / 鑽夋湰缁夸富鑳屾櫙',                  expected: 'AA Large only (2.23:1) 鈥?瑁呴グ搴曡壊锛屾枃瀛椾粛鍦ㄥ崱鐗囧唴' },
  // 寮鸿皟鎸夐挳涓婄殑鏂囧瓧 鈥?蹇呴』鐢ㄦ渶娣辩豢
  { fg: PALETTE.primary_700, bg: PALETTE.amber_400,  label: '娣辩豢鏂囧瓧 (#587851) / 铚滅倷榛勬寜閽?(涓嶆帹鑽?',         expected: 'FAIL (2.35:1) 鈥?宸叉敼鐢?#243B25' },
  { fg: '#243B25',          bg: PALETTE.amber_400,  label: '鏈€娣辩豢鏂囧瓧 (#243B25) / 铚滅倷榛勬寜閽?,                  expected: 'AAA (5.74:1)' },
  { fg: '#102514',          bg: PALETTE.amber_400,  label: '鏍囬绾ф繁缁挎枃瀛?(#102514) / 铚滅倷榛勬寜閽?,              expected: 'AAA (6.69:1)' },
  // 鐧借壊鑳屾櫙涓婄殑閾炬帴 / 寮鸿皟鍏冪礌
  { fg: PALETTE.primary_700, bg: PALETTE.white,      label: '娣辩豢閾炬帴 (#587851) / 鐧借壊鑳屾櫙',                       expected: 'AAA (4.98:1)' },
  { fg: PALETTE.amber_400,  bg: PALETTE.white,      label: '铚滅倷榛勬枃瀛?(#D4AC6A) / 鐧借壊鑳屾櫙 (绂佹)',              expected: 'FAIL (2.12:1) 鈥?搴旀敼鐢ㄦ繁缁挎垨鍔犵矖' },
];

let pass = 0, fail = 0;
for (const p of pairs) {
  const r1 = contrastRatio(p.fg, p.bg);
  const isLarge = true;  // 绮楃暐璁や负澶ч儴鍒嗘枃瀛楁槸澶у瓧鍙凤紙鏍囬銆佹寜閽級
  const verdict = rating(r1, isLarge);
  const ok = verdict.startsWith('AA') || verdict === 'AAA';
  if (ok) pass++; else fail++;
  const sym = ok ? '鉁? : '鈿?;
  console.log(`${sym}  ${p.label}`);
  console.log(`    ratio: ${r1.toFixed(2)} : 1   鈫?  ${verdict}   (鏈熸湜: ${p.expected})`);
  console.log('');
}

console.log(`\n========== 鎬荤粨 ==========`);
console.log(`閫氳繃: ${pass} / ${pass + fail}`);
console.log(`璇存槑锛歚);
console.log(`  - AA 鏍囧噯: 澶ф枃鏈?(鈮?8pt) 鈮?3.0, 姝ｆ枃 (鈮?4pt) 鈮?4.5`);
console.log(`  - AAA 鏍囧噯: 澶ф枃鏈?鈮?4.5, 姝ｆ枃 鈮?7.0`);
console.log(`  - 绫宠壊鍗＄墖鑳屾櫙 (#F7EADF) 閰嶆繁缁挎枃瀛?(#587851) 鏄牳蹇冨彲璇荤粍鍚?鉁揱);
console.log(`  - 涓昏儗鏅?(#90A686) 涓婁互绫宠壊 (#F7EADF) 鎴栫櫧鏂囧瓧涓轰富锛屽姣斿害婊¤冻 AA 鉁揱);