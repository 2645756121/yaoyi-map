import fs from 'node:fs';
const mock=fs.readFileSync('src/data/mockData.ts','utf8');
const ext=fs.readFileSync('src/data/yaoCountyExtendedData.ts','utf8');
function getBody(src, marker){const s=src.indexOf(marker);const eq=src.indexOf('=',s);const o=src.indexOf('[',eq);let d=0;for(let i=o;i<src.length;i++){if(src[i]=='[')d++; if(src[i]==']')d--; if(d==0)return src.slice(o+1,i)}return''}
function split(body){const out=[];let d=0,s=-1;for(let i=0;i<body.length;i++){if(body[i]=='{'){if(d==0)s=i;d++}else if(body[i]=='}'){d--;if(d==0&&s>=0)out.push(body.slice(s,i+1))}}return out}
function field(o,k){return o.match(new RegExp(`${k}:\\s*'([^']*)'`))?.[1]??''}
const herbs=split(getBody(mock,'export const herbs')).map(o=>field(o,'scientificName'));
const bySci=new Set(herbs);
const miss=new Map();
for(const m of ext.matchAll(/localHerbResources:\s*\[([\s\S]*?)\]\s*,\s*clinicalCases/g)){
 for(const o of split(m[1])){const sci=field(o,'scientificName'); if(!bySci.has(sci)) miss.set(sci,{name:field(o,'name'),sci,part:field(o,'medicinalPart'),eff:field(o,'efficacy')});}
}
console.log('missing',miss.size); for(const v of miss.values()) console.log(JSON.stringify(v));
