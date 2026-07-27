import fs from 'node:fs';

const mock = fs.readFileSync('src/data/mockData.ts', 'utf8');
const ext = fs.readFileSync('src/data/yaoCountyExtendedData.ts', 'utf8');
const territories = fs.readFileSync('src/components/MapBoard/ChinaTerritoriesLoader.ts', 'utf8');

function body(src, marker) { const s=src.indexOf(marker); const eq=src.indexOf('=',s); const o=src.indexOf('[',eq); let d=0; for(let i=o;i<src.length;i++){ if(src[i]=='[')d++; if(src[i]==']')d--; if(d==0)return src.slice(o+1,i);} return ''; }
function splitObjects(text) { const out=[]; let d=0,s=-1; for(let i=0;i<text.length;i++){ if(text[i]=='{'){ if(d==0)s=i; d++; } else if(text[i]=='}'){ d--; if(d==0&&s>=0) out.push(text.slice(s,i+1)); } } return out; }
function field(obj,key){ return obj.match(new RegExp(`${key}:\\s*'([^']*)'`))?.[1] ?? ''; }

const herbs = splitObjects(body(mock, 'export const herbs')).map(o => ({ name: field(o,'name'), scientificName: field(o,'scientificName'), medicinalPart: field(o,'medicinalPart'), efficacy: field(o,'efficacy') }));
const bySci = new Map(herbs.map(h => [h.scientificName, h]));
const resourceArrays = [...ext.matchAll(/localHerbResources:\s*\[([\s\S]*?)\]\s*,\s*clinicalCases/g)].map(m => m[1]);
const resources = resourceArrays.flatMap(splitObjects).map(o => ({ name: field(o,'name'), scientificName: field(o,'scientificName'), medicinalPart: field(o,'medicinalPart'), efficacy: field(o,'efficacy') }));
const issues = [];
for (const r of resources) {
  const h = bySci.get(r.scientificName);
  if (!h) { issues.push(`目录缺失: ${r.name} / ${r.scientificName}`); continue; }
  for (const key of ['name','medicinalPart','efficacy']) {
    if (r[key] !== h[key]) issues.push(`${r.scientificName} 字段不一致: ${key} county='${r[key]}' catalog='${h[key]}'`);
  }
}

const taiwanChecks = [
  /TAIWAN_UNRELATED_TERRITORIES = new Set\(\['台湾岛', '澎湖列岛', '金门', '马祖列岛'\]\)/,
  /isTaiwanUnrelated\(name\) \? '#94a3b8' : '#dc2626'/,
  /isTaiwanUnrelated\(name\) \? '#475569' : '#dc2626'/,
  /fillColor: isTaiwanUnrelated\(name\) \? '#cbd5e1' : '#dc2626'/,
];
const taiwanOk = taiwanChecks.every((re) => re.test(territories));

console.log(`目录草药: ${herbs.length}`);
console.log(`县市资源: ${resources.length}`);
console.log(`一致性问题: ${issues.length}`);
if (issues.length) issues.slice(0, 50).forEach(i => console.log(' - ' + i));
console.log(`台湾无关地区普通样式: ${taiwanOk ? 'PASS' : 'FAIL'}`);
process.exit(issues.length === 0 && taiwanOk ? 0 : 1);
