/**
 * 验证省份瑶医瑶药详细资料的注入情况（基于 TypeScript AST 简化思路）
 *
 * 直接基于源码字符串分析：每个 region 应包含 `yaoMedicineProfile` 配置块，
 * 该块内应包含 5 个字符串维度和 5 个数组维度。
 *
 * 简化策略：
 *   - 用 `node --experimental-strip-types` 直接读 .ts → 不可，我们用正则
 *   - 字符串字段定位到第一个 `'`，再扫描到下一个未转义的 `'`，捕获之间内容
 *   - 数组字段用括号配对定位 + 顶层项计数
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = resolve(__dirname, '../src/data/mockData.ts');
const src = readFileSync(mockPath, 'utf8');

let pass = 0;
let fail = 0;
const log = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`[OK]   ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`[FAIL] ${name}${detail ? ' — ' + detail : ''}`); }
};

const expectedIds = ['guangxi', 'guangdong', 'hunan', 'yunnan', 'guizhou', 'jiangxi', 'hainan', 'chongqing', 'sichuan'];

const stringDimensions = [
  ['corePhilosophy', '核心诊疗理念', 80],
  ['inheritanceLineage', '传承发展脉络', 80],
  ['resourceDistribution', '资源分布特点', 80],
  ['processingCraft', '传统炮制工艺', 80],
  ['modernApplications', '现代应用成果', 80],
];
const arrayDimensions = [
  ['philosophyPoints', '诊疗理念要点', 3],
  ['representativeTechniques', '代表性诊疗技法', 3],
  ['authenticHerbs', '常用道地药材品种', 4],
  ['processingPoints', '炮制要点', 3],
  ['modernHighlights', '现代应用亮点', 3],
];

/**
 * 提取字符串字面量内容（跳过转义引号）
 */
function extractStringLiteral(text, startPos) {
  // startPos 应当是第一个 ' 所在位置
  if (text[startPos] !== "'") return null;
  let i = startPos + 1;
  let out = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      // 转义 - 读下一个字符（保留字面）
      out += ch + text[i + 1];
      i += 2;
      continue;
    }
    if (ch === "'") {
      return { value: out, end: i };
    }
    out += ch;
    i++;
  }
  return null;
}

/**
 * 在 region 块字符串中按 key 解析字段
 */
function parseField(regionBlock, key) {
  // 字段缩进是 6 个空格（在 yaoMedicineProfile 对象内）
  const prefix = '      '; // 6 spaces indent
  const fullMarker = prefix + key + ': ';
  const idx = regionBlock.indexOf(fullMarker);
  if (idx < 0) return null;
  const valueStart = idx + fullMarker.length;
  const firstCh = regionBlock[valueStart];
  if (firstCh === "'") {
    const r = extractStringLiteral(regionBlock, valueStart);
    return r ? { type: 'string', value: r.value, end: r.end } : null;
  } else if (firstCh === '[') {
    let depth = 0;
    let end = -1;
    for (let i = valueStart; i < regionBlock.length; i++) {
      const ch = regionBlock[i];
      if (ch === "'") {
        i++;
        while (i < regionBlock.length && regionBlock[i] !== "'") {
          if (regionBlock[i] === '\\') i += 2;
          else i++;
        }
        continue;
      }
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) return null;
    const arr = regionBlock.slice(valueStart, end + 1);
    return { type: 'array', value: arr, end };
  }
  return null;
}

/**
 * 统计数组字面量顶层项数量
 */
function countTopArrayItems(arrLiteral) {
  let count = 0;
  let inStr = false;
  let strCh = null;
  let brace = 0;
  let prevComma = true;
  for (let i = 1; i < arrLiteral.length - 1; i++) {
    const ch = arrLiteral[i];
    if (inStr) {
      if (ch === strCh && arrLiteral[i-1] !== '\\') inStr = false;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      if (prevComma && brace === 0) {
        count++;
        prevComma = false;
      }
      inStr = true;
      strCh = ch;
      continue;
    }
    if (ch === '{') {
      brace++;
      if (brace === 1 && prevComma) {
        count++;
        prevComma = false;
      }
      continue;
    }
    if (ch === '}') { brace--; continue; }
    if (ch === ',' && brace === 0) { prevComma = true; continue; }
    if (/\s/.test(ch)) continue;
    if (brace === 0 && prevComma) {
      count++;
      prevComma = false;
    }
  }
  return count;
}

expectedIds.forEach((id) => {
  const idMarker = `id: '${id}'`;
  const idIdx = src.indexOf(idMarker);
  if (idIdx < 0) {
    log(`region ${id} 存在`, false);
    return;
  }
  const startIdx = idIdx;
  let endIdx = src.length;
  const restAfter = src.slice(idIdx + idMarker.length);
  const nextRegion = restAfter.match(/,\s*\n\s*\{\s*\n\s*id:\s*'([\w-]+)'/);
  if (nextRegion && nextRegion.index !== undefined) {
    endIdx = idIdx + idMarker.length + nextRegion.index;
  }

  const regionBlock = src.slice(startIdx, endIdx);
  log(`region ${id} 含 yaoMedicineProfile 配置`, regionBlock.includes('yaoMedicineProfile:'));

  stringDimensions.forEach(([key, label, minLen]) => {
    const r = parseField(regionBlock, key);
    if (!r || r.type !== 'string') {
      log(`  ${id} - ${label}`, false, '缺失或非字符串');
      return;
    }
    if (r.value.length < minLen) {
      log(`  ${id} - ${label}`, false, `长度 ${r.value.length} < ${minLen}`);
    } else {
      log(`  ${id} - ${label}`, true, `${r.value.length} 字`);
    }
  });

  arrayDimensions.forEach(([key, label, minLen]) => {
    const r = parseField(regionBlock, key);
    if (!r || r.type !== 'array') {
      log(`  ${id} - ${label}`, false, '缺失或非数组');
      return;
    }
    const count = countTopArrayItems(r.value);
    if (count < minLen) {
      log(`  ${id} - ${label}`, false, `${count} 项 < ${minLen}`);
    } else {
      log(`  ${id} - ${label}`, true, `${count} 项`);
    }
  });
});

console.log(`\n=== 总计 === 通过: ${pass}，失败: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
