import fs from 'fs';
import path from 'path';

const mockDataPath = path.join('src', 'data', 'yaoCountyData.ts');
const mockDataContent = fs.readFileSync(mockDataPath, 'utf8');

const codeMatches = mockDataContent.match(/code:\s*['"](\d{6})['"]/g);
const codes = codeMatches ? [...new Set(codeMatches.map(m => (m.match(/\d{6}/) || [])[0]))] : [];

console.log(`找到 ${codes.length} 个瑶区县 code`);

const countyDir = path.join('public', 'map', 'county');
const features = [];
const failed = [];

for (const code of codes) {
  const filePath = path.join(countyDir, `${code}.json`);
  if (!fs.existsSync(filePath)) {
    failed.push(code);
    continue;
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.features && data.features.length > 0) {
      features.push(data.features[0]);
    }
  } catch (e) {
    failed.push(`${code}: ${e.message}`);
  }
}

console.log(`成功加载 ${features.length} 个区县 polygon`);
if (failed.length > 0) {
  console.log(`失败: ${failed.join(', ')}`);
}

const categoryMap = {};
const institutionMap = {};
const nameMap = {};

const objMatches = mockDataContent.match(/\{[^}]*code:\s*['"]\d{6}['"][^}]*\}/g);
if (objMatches) {
  for (const objStr of objMatches) {
    const codeMatch = objStr.match(/code:\s*['"](\d{6})['"]/);
    const catMatch = objStr.match(/category:\s*['"](\w+)['"]/);
    const instMatch = objStr.match(/institutionCount:\s*(\d+)/);
    const nameMatch = objStr.match(/name:\s*['"]([^'"]+)['"]/);
    if (codeMatch && catMatch) {
      categoryMap[codeMatch[1]] = catMatch[1];
    }
    if (codeMatch && instMatch) {
      institutionMap[codeMatch[1]] = parseInt(instMatch[1]);
    }
    if (codeMatch && nameMatch) {
      nameMap[codeMatch[1]] = nameMatch[1];
    }
  }
}

const heightMap = {
  core: 120000,
  production: 60000,
  development: 30000,
};

for (const feat of features) {
  const code = String(feat.properties.adcode);
  const category = categoryMap[code] || 'development';
  feat.properties.category = category;
  feat.properties.height = heightMap[category] || 20000;
  feat.properties.institutionCount = institutionMap[code] || 0;
  feat.properties.yaoName = nameMap[code] || feat.properties.name;
}

const featureCollection = {
  type: 'FeatureCollection',
  features,
};

const outPath = path.join('public', 'map', 'yao-counties-polygon.geojson');
fs.writeFileSync(outPath, JSON.stringify(featureCollection));
console.log(`已写入 ${outPath}，大小: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
