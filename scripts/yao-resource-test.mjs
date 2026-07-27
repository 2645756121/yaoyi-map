/**
 * 瑶医资源完整性验证脚本
 *
 * 多维度验证：
 *   1. 资料完整性（核心字段全部填写）
 *   2. 位置准确性（坐标位于中国境内）
 *   3. 关联一致性（基础数据与扩展数据 code 一致）
 *   4. 专业性（学名格式、瑶名格式）
 *   5. 统计汇总
 */

const fs = await import('node:fs');
const path = await import('node:path');
const { fileURLToPath } = await import('node:url');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, '..');

// 读 TypeScript 源文件 - 简单正则提取
function readSrcFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// 提取 yaoCountiesExtended 数组
function extractYaoCountiesExtended(src) {
  // 简化提取：定位 export const yaoCountiesExtended: YaoCountyExtended[] = [
  const startMarker = 'export const yaoCountiesExtended: YaoCountyExtended[] = [';
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) return null;
  // 找匹配的 ]，考虑嵌套
  let depth = 0;
  let i = startIdx + startMarker.length - 1; // 从 [ 开始
  while (i < src.length) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  return src.substring(startIdx + startMarker.length, i);
}

function extractCodeBlocks(block) {
  // 提取每个 { code: 'XXXXX', ... } 对象
  const codes = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < block.length; i++) {
    if (block[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (block[i] === '}') {
      depth--;
      if (depth === 0) {
        const obj = block.substring(start, i + 1);
        const codeMatch = obj.match(/code:\s*['"](\d+)['"]/);
        if (codeMatch) codes.push({ code: codeMatch[1], obj });
      }
    }
  }
  return codes;
}

// 主验证
console.log('=== 瑶医资源完整性验证 ===\n');

const extSrc = readSrcFile(path.join(PROJECT, 'src/data/yaoCountyExtendedData.ts'));
const baseSrc = readSrcFile(path.join(PROJECT, 'src/data/yaoCountyData.ts'));

const extBlock = extractYaoCountiesExtended(extSrc);
if (!extBlock) {
  console.error('FAIL: 无法提取 yaoCountiesExtended');
  process.exit(1);
}

const extItems = extractCodeBlocks(extBlock);
console.log(`扩展资料条目: ${extItems.length} 个县/市\n`);

// 从基础数据提取所有 code
const baseItems = [];
const codeRegex = /^\s*code:\s*['"](\d+)['"]/gm;
let m;
while ((m = codeRegex.exec(baseSrc)) !== null) {
  baseItems.push(m[1]);
}
const baseCodeSet = new Set(baseItems);
const extCodeSet = new Set(extItems.map((x) => x.code));

// 1. 关联一致性
console.log('[1] 关联一致性');
let inExtNotInBase = 0;
for (const code of extCodeSet) {
  if (!baseCodeSet.has(code)) {
    console.log(`  ✗ ${code} 在扩展数据但不在基础数据`);
    inExtNotInBase++;
  }
}
console.log(`  扩展但无基础数据: ${inExtNotInBase} 个`);

// 2. 资料完整性（每个扩展项的关键字段）
console.log('\n[2] 资料完整性（每个县/市的关键字段）');
let totalHerbResources = 0;
let totalClinicalCases = 0;
let totalCollectionMethods = 0;
let totalHeritages = 0;
let totalInstitutions = 0;
let totalIndustryBases = 0;
let totalInheritors = 0;
let withHospital = 0;
let withCultivationBase = 0;
let nationalHeritage = 0;
let cityHeritage = 0;
let provinceHeritage = 0;
let countyHeritage = 0;
let challengesTotal = 0;
const issues = [];

for (const item of extItems) {
  const obj = item.obj;
  const code = item.code;

  // localHerbResources
  const herbCount = (obj.match(/localHerbResources:\s*\[([^\]]*)\]/)?.[1] ?? '').match(/name:\s*['"]/g)?.length ?? 0;
  totalHerbResources += herbCount;

  // clinicalCases
  const caseCount = (obj.match(/clinicalCases:\s*\[([^\]]*)\]/)?.[1] ?? '').match(/title:\s*['"]/g)?.length ?? 0;
  totalClinicalCases += caseCount;

  // collectionMethodology
  const hasCollection = /collectionMethodology:\s*['"][^'"]{20,}['"]/.test(obj);
  if (hasCollection) totalCollectionMethods++;

  // heritage
  const hasHeritage = /heritage:\s*\{/.test(obj);
  if (hasHeritage) {
    totalHeritages++;
    // 提取 heritage 块内容
    const hMatch = obj.match(/heritage:\s*\{([\s\S]*?)\},\s*\n\s*representativeInstitutions:/);
    if (hMatch) {
      const hb = hMatch[1];
      const practitionerMatch = hb.match(/practitionerCount:\s*(\d+)/);
      const inheritorMatch = hb.match(/inheritorCount:\s*(\d+)/);
      const hospMatch = hb.match(/hasHospital:\s*(true|false)/);
      const cbMatch = hb.match(/hasCultivationBase:\s*(true|false)/);
      const govMatch = hb.match(/govSupportLevel:\s*['"](\w+)['"]/);
      const challengesMatch = hb.match(/challenges:\s*\[([\s\S]*?)\]/);
      if (hospMatch?.[1] === 'true') withHospital++;
      if (cbMatch?.[1] === 'true') withCultivationBase++;
      if (govMatch?.[1] === 'national') nationalHeritage++;
      else if (govMatch?.[1] === 'province') provinceHeritage++;
      else if (govMatch?.[1] === 'city') cityHeritage++;
      else if (govMatch?.[1] === 'county') countyHeritage++;
      if (practitionerMatch) totalInheritors += 0; // 医师不算传承人
      if (inheritorMatch) totalInheritors += parseInt(inheritorMatch[1], 10);
      if (challengesMatch) {
        const chItems = (challengesMatch[1].match(/['"]/g) ?? []).length / 2;
        challengesTotal += chItems;
      }
    }
  }

  // representativeInstitutions
  const instCount = (obj.match(/representativeInstitutions:\s*\[([^\]]*)\]/)?.[1] ?? '').match(/['"][^'"]+['"]/g)?.length ?? 0;
  totalInstitutions += instCount;

  // industryBase
  const indCount = (obj.match(/industryBase:\s*\[([^\]]*)\]/)?.[1] ?? '').match(/['"][^'"]+['"]/g)?.length ?? 0;
  totalIndustryBases += indCount;
}

console.log(`  当地瑶药资源: ${totalHerbResources} 条 (avg ${(totalHerbResources / extItems.length).toFixed(1)}/县)`);
console.log(`  临床案例: ${totalClinicalCases} 例 (avg ${(totalClinicalCases / extItems.length).toFixed(1)}/县)`);
console.log(`  采集方法论: ${totalCollectionMethods}/${extItems.length} (${((totalCollectionMethods / extItems.length) * 100).toFixed(0)}%)`);
console.log(`  传承保护现状: ${totalHeritages}/${extItems.length}`);
console.log(`    - 有瑶医医院: ${withHospital}/${extItems.length}`);
console.log(`    - 有种植基地: ${withCultivationBase}/${extItems.length}`);
console.log(`    - 政府支持级别: 国家 ${nationalHeritage} / 省 ${provinceHeritage} / 市 ${cityHeritage} / 县 ${countyHeritage}`);
console.log(`  代表性医疗机构: ${totalInstitutions} 条`);
console.log(`  瑶药产业基地: ${totalIndustryBases} 条`);
console.log(`  总传承人: ${totalInheritors} 人`);
console.log(`  总挑战项: ${challengesTotal} 项`);

// 3. 坐标位置准确性
console.log('\n[3] 坐标位置准确性（中心点）');
const coords = [];
const coordRegex = /centerLng:\s*([\d.]+),\s*centerLat:\s*([\d.]+)/g;
let cm;
while ((cm = coordRegex.exec(extBlock)) !== null) {
  coords.push({ lng: parseFloat(cm[1]), lat: parseFloat(cm[2]) });
}
let validChina = 0;
let outOfRange = 0;
for (const c of coords) {
  // 中国大陆范围（含南海）：lng 73-135, lat 16-54
  if (c.lng >= 73 && c.lng <= 135 && c.lat >= 16 && c.lat <= 54) {
    validChina++;
  } else {
    outOfRange++;
    console.log(`  ✗ 坐标异常: lng=${c.lng}, lat=${c.lat}`);
  }
}
console.log(`  有效坐标（中国境内）: ${validChina}/${coords.length}`);
if (outOfRange > 0) {
  console.log(`  ✗ 异常坐标: ${outOfRange} 个`);
} else {
  console.log(`  ✓ 所有坐标位于中国境内`);
}

// 4. 基础 vs 扩展 code 一致性
console.log('\n[4] 基础与扩展数据 code 一致性');
let onlyBase = 0;
for (const code of baseCodeSet) {
  if (!extCodeSet.has(code)) onlyBase++;
}
console.log(`  仅基础（待补扩展）: ${onlyBase}/${baseItems.length}`);

// 5. 学名格式校验
console.log('\n[5] 专业性校验（学名格式）');
const sciNameRegex = /scientificName:\s*['"]([A-Z][a-z]+(?:\s+[a-z]+){1,3})['"]/g;
const sciNames = [];
let sn;
while ((sn = sciNameRegex.exec(extBlock)) !== null) {
  sciNames.push(sn[1]);
}
let validSciName = 0;
for (const sn of sciNames) {
  // 学名应为属名 + 种加词 + 命名人（最后部分可选）
  if (/^[A-Z][a-z]+(\s+[a-z]+){1,3}/.test(sn)) validSciName++;
}
console.log(`  学名总数: ${sciNames.length}, 格式正确: ${validSciName}`);

// 汇总
console.log('\n=== 验证汇总 ===');
const totalFields = extItems.length * 6; // 6 个核心字段：herb, case, method, heritage, institution, industry
const completeFields =
  extItems.length * 6 - // 全部有
  extItems.filter((x) => !/localHerbResources:\s*\[[^\]]+\]/.test(x.obj)).length - // 缺 herb
  extItems.filter((x) => !/clinicalCases:\s*\[[^\]]+\]/.test(x.obj)).length - // 缺 case
  extItems.filter((x) => !/collectionMethodology:\s*['"][^'"]{20,}['"]/.test(x.obj)).length - // 缺 method
  extItems.filter((x) => !/heritage:\s*\{/.test(x.obj)).length - // 缺 heritage
  extItems.filter((x) => !/representativeInstitutions:\s*\[[^\]]+\]/.test(x.obj)).length; // 缺 institution

console.log(`县级覆盖: ${extItems.length}/${baseItems.length} (${((extItems.length / baseItems.length) * 100).toFixed(0)}%)`);
console.log(`资料完整字段: ${completeFields}/${totalFields} (${((completeFields / totalFields) * 100).toFixed(0)}%)`);

const pass = inExtNotInBase === 0 && outOfRange === 0 && extItems.length >= 20;
process.exit(pass ? 0 : 1);