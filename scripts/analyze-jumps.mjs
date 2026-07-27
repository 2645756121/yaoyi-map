/**
 * 全面分析所有面板的内容跳跃问题
 * 扫描 mockData / yaoCountyExtendedData / yaoMedicalKnowledge 数据
 * 检测哪些模态的章节会因为数据缺失导致编号跳跃
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// 提取 yaoCountyExtendedData 的所有 code
const extendedSrc = readFileSync(resolve(ROOT, 'src/data/yaoCountyExtendedData.ts'), 'utf8');
const countyBlocks = extendedSrc.split(/(?=\n  \{\n    code: ')/);

const issues = [];

countyBlocks.forEach((block) => {
  const codeMatch = block.match(/code:\s*'([0-9]+)'/);
  const nameMatch = block.match(/name:\s*'([^']+)'/);
  if (!codeMatch) return;
  const code = codeMatch[1];
  const name = nameMatch ? nameMatch[1] : '?';

  // 检测每一节数据是否缺失
  const hasIndustryBase = /industryBase:\s*\[/.test(block);
  const hasInstitutions = /representativeInstitutions:\s*\[/.test(block);
  const hasCollectionMethodology = /collectionMethodology:/.test(block);
  const hasHeritage = /heritage:\s*\{/.test(block);
  const hasLocalHerb = /localHerbResources:\s*\[/.test(block);
  const hasClinicalCases = /clinicalCases:\s*\[/.test(block);

  // 计算 CountyInfoModal 实际显示的章节
  // 一（localHerb）、二（clinicalCases）、三（collectionMethodology）、四（heritage）、
  // 五（representativeInstitutions）、六（industryBase）、七（always）、八（herbs from mockData）、九（since）
  // 注：八、九来自 countyData（不在 extendedData 中）

  const missingSections = [];
  if (!hasLocalHerb) missingSections.push('一、特有瑶药资源');
  if (!hasClinicalCases) missingSections.push('二、临床应用案例');
  if (!hasCollectionMethodology) missingSections.push('三、采集方法论');
  if (!hasHeritage) missingSections.push('四、传承保护现状');
  if (!hasInstitutions) missingSections.push('五、代表性医疗机构');
  if (!hasIndustryBase) missingSections.push('六、瑶药产业基地'); // 主因

  if (missingSections.length > 0) {
    issues.push({
      panel: 'CountyInfoModal',
      county: `${name} (${code})`,
      missing: missingSections,
      severity: !hasIndustryBase && hasInstitutions ? 'HIGH（五→七跳跃）' : 'MEDIUM',
    });
  }
});

console.log('\n=== CountyInfoModal 数据缺失分析 ===\n');
console.log(`共 ${issues.length} 个县级存在章节缺失\n`);
issues.slice(0, 30).forEach((i) => {
  console.log(`[${i.severity}] ${i.county}`);
  console.log(`  缺失: ${i.missing.join(', ')}`);
});

console.log('\n=== TherapyModal 章节跳跃分析 ===\n');
const mockSrc = readFileSync(resolve(ROOT, 'src/data/mockData.ts'), 'utf8');

// 从 mockData 提取 therapies
const therapyBlocks = mockSrc.split(/(?=\{\s*\n\s*id:\s*'[a-z_]+_therapy)/);
let therapyJumps = 0;
therapyBlocks.forEach((block) => {
  const idMatch = block.match(/id:\s*'([a-z_]+)'/);
  const nameMatch = block.match(/name:\s*'([^']+)'/);
  if (!idMatch || !nameMatch) return;
  if (!/疗法|治疗|药浴|灸|针|敷/.test(nameMatch[1])) return;

  const hasInheritors = /inheritors:\s*\[\s*[^\]]/.test(block);
  const hasClinicalCases = /clinicalCases:\s*\[\s*[^\]]/.test(block);
  const hasRelatedHerbs = /relatedHerbs:\s*\[\s*[^\]]/.test(block);
  const hasRelatedHistory = /relatedHistoryPeriods:\s*\[\s*[^\]]/.test(block);

  const missing = [];
  if (!hasInheritors) missing.push('五、传承人物');
  if (!hasClinicalCases) missing.push('六、临床案例');
  if (!hasRelatedHerbs) missing.push('七、相关草药');
  if (!hasRelatedHistory) missing.push('八、历史渊源');

  if (missing.length > 0) {
    therapyJumps++;
    console.log(`[${nameMatch[1]}] 缺失: ${missing.join(', ')}`);
  }
});

console.log(`\n共 ${therapyJumps} 个疗法存在章节跳跃\n`);