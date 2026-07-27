import fs from 'node:fs';
const mock = fs.readFileSync('src/data/mockData.ts','utf8');
const ext = fs.readFileSync('src/data/yaoCountyExtendedData.ts','utf8');
const herbBlock = mock.slice(mock.indexOf('export const herbs'));
const cat = [...herbBlock.matchAll(/id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?scientificName:\s*'([^']+)'[\s\S]*?efficacy:\s*'([^']+)'[\s\S]*?medicinalPart:\s*'([^']+)'/g)].map(m=>({id:m[1],name:m[2],scientificName:m[3],efficacy:m[4],medicinalPart:m[5]}));
const bySci = new Map(cat.map(h=>[h.scientificName,h]));
const res = [...ext.matchAll(/name:\s*'([^']+)'[\s\S]*?scientificName:\s*'([^']+)'[\s\S]*?source:\s*'[^']+'[\s\S]*?medicinalPart:\s*'([^']+)'[\s\S]*?efficacy:\s*'([^']+)'/g)].map(m=>({name:m[1],scientificName:m[2],medicinalPart:m[3],efficacy:m[4]}));
const missing = new Map(); const mismatch=[];
for(const r of res){ const h=bySci.get(r.scientificName); if(!h){ missing.set(r.scientificName,r); continue;} const diff=[]; for(const k of ['name','medicinalPart','efficacy']) if(r[k]!==h[k]) diff.push(k); if(diff.length)mismatch.push({r,h,diff});}
console.log('catalog',cat.length,'resources',res.length,'missingSci',missing.size,'mismatchExact',mismatch.length);
for(const r of missing.values()) console.log('MISSING',r.name,'|',r.scientificName,'|',r.medicinalPart,'|',r.efficacy);
console.log('--- mismatches sample');
for(const m of mismatch.slice(0,80)) console.log('MISMATCH',m.r.name,'=>',m.h.name,'diff='+m.diff.join(','));
