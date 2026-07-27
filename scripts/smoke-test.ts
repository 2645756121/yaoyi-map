/**
 * 简单冒烟测试：验证修复后的核心数据完整性、Store 接口一致性、
 * 以及组件间引用关系是否正常。
 *
 * 运行方式： npx tsx scripts/smoke-test.ts
 * 或：       npm run test:smoke
 *
 * 这不是完整的单元测试套件，目的是在 CI 上快速发现回归问题。
 */
import {
  regions,
  herbs,
  therapies,
  historyPeriods,
  getHerbById,
  getTherapyById,
  getRegionById,
  getHerbsByRegion,
  getTherapiesByRegion,
  getHistoryPeriodsByRegion,
  searchAll,
} from '../src/data/mockData';

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: CheckResult[] = [];
const log = (name: string, passed: boolean, detail = '') => {
  results.push({ name, passed, detail });
};

function check(label: string, fn: () => void) {
  try {
    fn();
    log(label, true);
  } catch (e) {
    log(label, false, (e as Error).message);
  }
}

// 1. 基础实体完整性
check('regions 数组非空且每项有 id/name/color', () => {
  if (regions.length === 0) throw new Error('regions 为空');
  regions.forEach((r) => {
    if (!r.id || !r.name || !r.color) throw new Error(`region 缺少字段: ${JSON.stringify(r)}`);
  });
});

check('herbs 数组非空且 regionId 指向存在的 region', () => {
  if (herbs.length === 0) throw new Error('herbs 为空');
  const regionIds = new Set(regions.map((r) => r.id));
  herbs.forEach((h) => {
    if (!regionIds.has(h.regionId)) throw new Error(`herb ${h.id} regionId=${h.regionId} 无效`);
  });
});

check('therapies 数组非空且 regionId 指向存在的 region', () => {
  if (therapies.length === 0) throw new Error('therapies 为空');
  const regionIds = new Set(regions.map((r) => r.id));
  therapies.forEach((t) => {
    if (!regionIds.has(t.regionId)) throw new Error(`therapy ${t.id} regionId=${t.regionId} 无效`);
  });
});

// 2. historyPeriods.relatedTherapies 关联完整性
check('historyPeriods.relatedTherapies 所有 ID 必须存在', () => {
  const therapyIds = new Set(therapies.map((t) => t.id));
  historyPeriods.forEach((p) => {
    p.relatedTherapies.forEach((tid) => {
      if (!therapyIds.has(tid)) {
        throw new Error(`period ${p.id} 引用了不存在的疗法 ID: ${tid}`);
      }
    });
  });
});

// 3. therapies.relatedHerbs 关联完整性
check('therapies.relatedHerbs 所有 ID 必须存在', () => {
  const herbIds = new Set(herbs.map((h) => h.id));
  therapies.forEach((t) => {
    t.relatedHerbs.forEach((hid) => {
      if (!herbIds.has(hid)) {
        throw new Error(`therapy ${t.id} 引用了不存在的草药 ID: ${hid}`);
      }
    });
  });
});

// 4. therapies.relatedHistoryPeriods 关联完整性
check('therapies.relatedHistoryPeriods 所有 ID 必须存在', () => {
  const periodIds = new Set(historyPeriods.map((p) => p.id));
  therapies.forEach((t) => {
    t.relatedHistoryPeriods.forEach((pid) => {
      if (!periodIds.has(pid)) {
        throw new Error(`therapy ${t.id} 引用了不存在的时期 ID: ${pid}`);
      }
    });
  });
});

// 5. herbs.therapyIds 关联完整性
check('herbs.therapyIds 所有 ID 必须存在', () => {
  const therapyIds = new Set(therapies.map((t) => t.id));
  herbs.forEach((h) => {
    h.therapyIds.forEach((tid) => {
      if (!therapyIds.has(tid)) {
        throw new Error(`herb ${h.id} 引用了不存在的疗法 ID: ${tid}`);
      }
    });
  });
});

// 6. 查询函数正确性
check('getHerbsByRegion 返回的草药均属于指定 region', () => {
  const target = 'guangxi';
  const result = getHerbsByRegion(target);
  if (result.length === 0) throw new Error('广西应至少有一种草药');
  result.forEach((h) => {
    if (h.regionId !== target) throw new Error(`herb ${h.id} 不属于 ${target}`);
  });
});

check('getRegionById / getHerbById / getTherapyById 正确返回', () => {
  const region = getRegionById('guangxi');
  if (!region || region.name !== '广西壮族自治区') throw new Error('getRegionById 失败');
  const herb = getHerbById('yaoshanjujuan');
  if (!herb || herb.name !== '瑶山杜鹃') throw new Error('getHerbById 失败');
  const therapy = getTherapyById('yaoyutangfa');
  if (!therapy || !therapy.name.includes('药浴')) throw new Error('getTherapyById 失败');
});

// 7. 搜索功能
check('searchAll 关键词 "三七" 应能找到对应草药', () => {
  const r = searchAll('三七');
  if (r.length === 0) throw new Error('搜索三七无结果');
  if (!r.some((x) => x.id === 'sanqi')) throw new Error('搜索结果未包含 sanqi');
});

check('searchAll 关键词 "庞桶" 应能找到药浴疗法', () => {
  const r = searchAll('庞桶');
  if (r.length === 0) throw new Error('搜索庞桶无结果');
});

check('searchAll 区分大小写不敏感', () => {
  const lower = searchAll('sanqi');
  const upper = searchAll('SANQI');
  if (lower.length !== upper.length) throw new Error('大小写处理不一致');
});

// 8. 缓存一致性：连续两次 getHerbsByRegion 应返回相同引用
check('getHerbsByRegion 返回缓存（同一引用）', () => {
  const a = getHerbsByRegion('guangxi');
  const b = getHerbsByRegion('guangxi');
  if (a !== b) throw new Error('缓存未生效');
});

// 输出
const passed = results.filter((r) => r.passed).length;
const total = results.length;

console.log('\n=== Smoke Test Results ===');
results.forEach((r) => {
  const icon = r.passed ? '✓' : '✗';
  const line = `${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`;
  console.log(line);
});
console.log(`\n${passed}/${total} passed\n`);

if (passed !== total) {
  process.exit(1);
}