import fs from 'node:fs';

const mockPath = 'src/data/mockData.ts';
const extPath = 'src/data/yaoCountyExtendedData.ts';
const mock = fs.readFileSync(mockPath, 'utf8');
let ext = fs.readFileSync(extPath, 'utf8');

function getArrayBody(src, marker) {
  const start = src.indexOf(marker);
  const eq = src.indexOf('=', start);
  const open = src.indexOf('[', eq);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    if (src[i] === ']') depth--;
    if (depth === 0) return src.slice(open + 1, i);
  }
  return '';
}

function splitObjects(body) {
  const out = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (body[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) out.push(body.slice(start, i + 1));
    }
  }
  return out;
}

function field(obj, key) {
  return obj.match(new RegExp(`${key}:\\s*'([^']*)'`))?.[1] ?? '';
}

function setField(obj, key, value) {
  const safe = value.replaceAll("'", "\\'");
  return obj.replace(new RegExp(`${key}:\\s*'[^']*'`), `${key}: '${safe}'`);
}

const herbs = splitObjects(getArrayBody(mock, 'export const herbs')).map((obj) => ({
  name: field(obj, 'name'),
  scientificName: field(obj, 'scientificName'),
  medicinalPart: field(obj, 'medicinalPart'),
  efficacy: field(obj, 'efficacy'),
}));
const bySci = new Map(herbs.map((h) => [h.scientificName, h]));

let changed = 0;
const resourceArrayRe = /localHerbResources:\s*\[([\s\S]*?)\]\s*,\s*clinicalCases/g;
for (const match of [...ext.matchAll(resourceArrayRe)]) {
  const body = match[1];
  for (const obj of splitObjects(body)) {
    const sci = field(obj, 'scientificName');
    const canonical = bySci.get(sci);
    if (!canonical) continue;
    let next = obj;
    next = setField(next, 'name', canonical.name);
    next = setField(next, 'medicinalPart', canonical.medicinalPart);
    next = setField(next, 'efficacy', canonical.efficacy);
    if (next !== obj) {
      ext = ext.replace(obj, next);
      changed++;
    }
  }
}

fs.writeFileSync(extPath, ext, 'utf8');
console.log(`synced localHerbResources objects: ${changed}`);
