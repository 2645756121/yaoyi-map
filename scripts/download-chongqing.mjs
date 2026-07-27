import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PUBLIC_MAP = resolve(process.cwd(), 'public/map');

(async () => {
  const data = JSON.parse(
    await readFile(`${PUBLIC_MAP}/province/500000_full.json`, 'utf8')
  );
  const countyAggregate = JSON.parse(
    await readFile(`${PUBLIC_MAP}/yao_counties_real.json`, 'utf8')
  );

  let ok = 0, fail = 0;
  for (const f of data.features) {
    if (f.properties.level !== 'district') continue;
    const adcode = f.properties.adcode;
    try {
      const r = await fetch(
        `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}.json`,
        { signal: AbortSignal.timeout(15_000) }
      );
      const countyData = await r.json();
      countyData.features.forEach((feat) => {
        feat.properties = {
          ...feat.properties,
          provinceAdcode: 500000,
          provinceName: '重庆市',
          cityAdcode: 500000,
          cityName: '重庆市',
        };
      });
      await writeFile(
        `${PUBLIC_MAP}/county/${adcode}.json`,
        JSON.stringify(countyData),
        'utf8'
      );
      countyAggregate.features.push(...countyData.features);
      ok++;
    } catch (e) {
      fail++;
      console.log('  ✗', adcode, f.properties.name, e.message);
    }
  }
  await writeFile(
    `${PUBLIC_MAP}/yao_counties_real.json`,
    JSON.stringify(countyAggregate),
    'utf8'
  );
  console.log(`重庆县级: ${ok} 成功, ${fail} 失败`);
  console.log(`聚合 features: ${countyAggregate.features.length}`);
})();