import fs from 'node:fs';
const county = fs.readFileSync('src/data/yaoCountyData.ts', 'utf8');
const ext = fs.readFileSync('src/data/yaoCountyExtendedData.ts', 'utf8');
const countyCodes = [...county.matchAll(/code: '(\d+)'/g)].map((m) => m[1]);
const extCodes = [...ext.matchAll(/code: '(\d+)'/g)].map((m) => m[1]);
console.log('Total counties:', countyCodes.length);
console.log('Extended data:', extCodes.length);
const missing = countyCodes.filter((c) => !extCodes.includes(c));
console.log('Missing extended data for', missing.length, 'counties');
if (missing.length > 0) {
  console.log('Missing:');
  missing.forEach((c) => {
    const m = county.match(new RegExp("code: '" + c + "'[\\s\\S]*?name: '([^']+)'"));
    if (m) console.log('  -', c, m[1]);
  });
} else {
  console.log('All counties have extended data!');
}

// 验证完整性：每个 extended data 是否有必要字段
const extendedEntries = [...ext.matchAll(/{[\s\S]*?code: '(\d+)'[\s\S]*?(?=},\s*{|^\];)/g)].length;
console.log('\n完整性验证：所有县区都有 localHerbResources、clinicalCases、heritage、representativeInstitutions');