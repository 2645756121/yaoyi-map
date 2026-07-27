import fs from 'node:fs';

const mock = fs.readFileSync('src/data/mockData.ts', 'utf8');
const ext = fs.readFileSync('src/data/yaoCountyExtendedData.ts', 'utf8');

function parseArrayObjects(src, arrayName) {
  const exportMatch = src.match(new RegExp(`export\\s+const\\s+${arrayName}\\b`));
  const start = exportMatch?.index ?? -1;
  if (start < 0) return [];
  const eqStart = src.indexOf('=', start);
  const arrStart = src.indexOf('[', eqStart);
  let depth = 0;
  let end = -1;
  for (let i = arrStart; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const body = src.slice(arrStart + 1, end);
  const objects = [];
  depth = 0;
  let objStart = -1;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (body[i] === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        objects.push(body.slice(objStart, i + 1));
        objStart = -1;
      }
    }
  }
  return objects;
}

function field(obj, name) {
  const re = new RegExp(`${name}:\\s*'([^']*)'`);
  return obj.match(re)?.[1] ?? '';
}

const herbs = parseArrayObjects(mock, 'herbs').map((obj) => ({
  id: field(obj, 'id'),
  name: field(obj, 'name'),
  scientificName: field(obj, 'scientificName'),
  medicinalPart: field(obj, 'medicinalPart'),
  efficacy: field(obj, 'efficacy'),
}));
const byName = new Map(herbs.map((h) => [h.name, h]));
const bySci = new Map(herbs.map((h) => [h.scientificName, h]));

const resourceObjs = [...ext.matchAll(/localHerbResources:\s*\[([\s\S]*?)\]\s*,\s*clinicalCases/g)].flatMap((m) => {
  const body = m[1];
  const list = [];
  let depth = 0; let start = -1;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (body[i] === '}') { depth--; if (depth === 0 && start >= 0) { list.push(body.slice(start, i + 1)); start = -1; } }
  }
  return list;
});

const mismatches = [];
for (const obj of resourceObjs) {
  const r = {
    name: field(obj, 'name'),
    scientificName: field(obj, 'scientificName'),
    medicinalPart: field(obj, 'medicinalPart'),
    efficacy: field(obj, 'efficacy'),
  };
  let h = byName.get(r.name) || bySci.get(r.scientificName);
  if (!h) {
    h = herbs.find((x) => r.name.includes(x.name) || x.name.includes(r.name.replace(/^[\u4e00-\u9fa5]{1,4}/, '')));
  }
  if (!h) continue;
  const diff = [];
  for (const key of ['name', 'scientificName', 'medicinalPart', 'efficacy']) {
    if (r[key] !== h[key]) diff.push(key);
  }
  if (diff.length) mismatches.push({ resource: r, canonical: h, diff });
}

console.log(`目录草药: ${herbs.length}`);
console.log(`县市草药资源: ${resourceObjs.length}`);
console.log(`可匹配但不一致: ${mismatches.length}`);
for (const m of mismatches.slice(0, 80)) {
  console.log(`- ${m.resource.name} / ${m.resource.scientificName} -> ${m.canonical.name} / ${m.canonical.scientificName} diff=${m.diff.join(',')}`);
}
