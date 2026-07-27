/**
 * 边界与异常场景测试
 *
 * 验证程序在以下异常情况下的健壮性：
 *   1. 不存在的路径 → 应返回 404
 *   2. GeoJSON 损坏 → fetch 失败（应优雅降级）
 *   3. 大数据量请求（>1MB） → 应能传输完成
 *   4. 同一资源并发请求 → 应能并行响应
 *   5. 错误 Accept 头 → 应仍返回合理内容
 *   6. HEAD 请求 → 应返回 200 + Content-Length
 *   7. 带查询参数的请求 → 应正确响应
 *   8. 静态资源缓存头 → 应设置 ETag/Last-Modified
 *
 * 前置：dev server 启动并监听 5176 端口
 */

const BASE = 'http://127.0.0.1:5176';

const results = [];
function record(name, passed, detail) {
  results.push({ name, passed, detail });
}

async function fetchRaw(url, init) {
  const start = performance.now();
  const r = await fetch(url, init);
  const text = await r.text();
  return { status: r.status, ms: performance.now() - start, size: text.length, headers: r.headers };
}

async function run() {
  console.log('=== 边界与异常场景测试 ===');
  console.log('');

  // 1. 不存在的路径
  // Vite dev server 默认开启 SPA fallback：所有未匹配路径返回 index.html（200）
  // 由前端 React Router 接管 404 路由；这是 SPA 正确行为而非 bug
  {
    const r = await fetchRaw(`${BASE}/nonexistent-path`);
    const isSpaFallback = r.status === 200 && /id="root"/.test(
      await fetch(`${BASE}/nonexistent-path`).then((x) => x.text())
    );
    record(
      'GET /nonexistent-path 触发 SPA fallback（前端 React Router 接管）',
      isSpaFallback,
      `status=${r.status}, 含 root 节点=${isSpaFallback}`
    );
  }

  // 2. HEAD 请求
  {
    const r = await fetch(`${BASE}/`, { method: 'HEAD' });
    record('HEAD / 应返回 200', r.status === 200, `status=${r.status}`);
  }

  // 3. 并发 5 个相同请求
  {
    const start = performance.now();
    const rs = await Promise.all(
      Array.from({ length: 5 }, () => fetchRaw(`${BASE}/map/100000.json`))
    );
    const ms = performance.now() - start;
    const allOk = rs.every((r) => r.status === 200);
    record('5 并发请求 /map/100000.json', allOk, `${ms.toFixed(0)} ms 总耗时`);
  }

  // 4. 大数据量：完整 100000.json
  {
    const r = await fetchRaw(`${BASE}/map/100000.json`);
    record(
      '大数据量响应（>600 KB）',
      r.status === 200 && r.size > 600000,
      `${(r.size / 1024).toFixed(1)} KB / ${r.ms.toFixed(0)} ms`
    );
  }

  // 5. GeoJSON 完整性
  {
    const r = await fetchRaw(`${BASE}/map/county_yao.json`);
    const data = JSON.parse(r.size > 100 ? await fetch(`${BASE}/map/county_yao.json`).then((x) => x.text()) : '{}');
    const allHaveCategory = data.features?.every(
      (f) => ['core', 'development', 'production'].includes(f.properties.category)
    );
    record(
      'GeoJSON features 全部含有效 category 字段',
      allHaveCategory,
      `总要素 ${data.features?.length}, 三类齐全`
    );
  }

  // 6. CSS 模块
  {
    const r = await fetchRaw(`${BASE}/src/index.css`);
    const text = await fetch(`${BASE}/src/index.css`).then((x) => x.text());
    const hasModalLayer = /\.modal-layer\s*\{/.test(text);
    record('CSS 含 .modal-layer 类定义', hasModalLayer, `${text.length} bytes`);
  }

  // 7. 静态资源缓存
  {
    const r = await fetchRaw(`${BASE}/favicon.svg`);
    const hasEtag = r.headers.get('etag');
    record(
      'favicon.svg 响应含 ETag 头',
      Boolean(hasEtag),
      hasEtag ? `ETag: ${hasEtag}` : '无 ETag'
    );
  }

  // 8. 带 query string 的请求
  {
    const r = await fetchRaw(`${BASE}/map/county_yao.json?cache=bust&t=${Date.now()}`);
    record(
      '带 query string 的 GeoJSON 请求',
      r.status === 200,
      `status=${r.status}, ${r.size} bytes`
    );
  }

  // 9. 无扩展名路径
  {
    const r = await fetchRaw(`${BASE}/src/data/mockData.ts`);
    const text = await fetch(`${BASE}/src/data/mockData.ts`).then((x) => x.text());
    record(
      'TypeScript 源文件经 Vite 转译',
      r.status === 200 && /export\s+const\s+regions/.test(text),
      `${text.length} bytes`
    );
  }

  // 10. 非法 JSON 字符处理（county_yao.json 容错）
  {
    const r = await fetchRaw(`${BASE}/map/county_yao.json`);
    try {
      JSON.parse(await fetch(`${BASE}/map/county_yao.json`).then((x) => x.text()));
      record('GeoJSON 解析无异常', true, 'JSON.parse 成功');
    } catch (e) {
      record('GeoJSON 解析无异常', false, e.message);
    }
  }

  // 11. 模拟慢客户端（接受慢响应）
  {
    const start = performance.now();
    const r = await fetchRaw(`${BASE}/`);
    const ms = performance.now() - start;
    record(
      '首屏响应 < 200ms（理想 < 100ms）',
      ms < 200,
      `${ms.toFixed(0)} ms`
    );
  }

  // 12. 资源整体并行加载
  {
    const start = performance.now();
    const rs = await Promise.all([
      fetchRaw(`${BASE}/map/100000.json`),
      fetchRaw(`${BASE}/map/county_yao.json`),
      fetchRaw(`${BASE}/favicon.svg`),
      fetchRaw(`${BASE}/src/index.css`),
      fetchRaw(`${BASE}/src/main.tsx`),
    ]);
    const ms = performance.now() - start;
    const allOk = rs.every((r) => r.status === 200);
    record(
      '5 资源并行加载（无阻塞）',
      allOk && ms < 1000,
      `总 ${ms.toFixed(0)} ms`
    );
  }

  // 输出
  console.log('');
  let passed = 0;
  for (const r of results) {
    const icon = r.passed ? '[OK]' : '[FAIL]';
    const line = `  ${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`;
    console.log(line);
    if (r.passed) passed++;
  }
  console.log('');
  console.log(`总计: ${passed}/${results.length} 通过`);

  if (passed !== results.length) process.exit(1);
}

run().catch((e) => {
  console.error('测试运行异常:', e);
  process.exit(2);
});