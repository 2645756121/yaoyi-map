/**
 * TerrainRelief3D.test.tsx —— React 容器行为测试（viewer 完全 mock）
 *
 * 目的：验证容器的编排逻辑（默认隐藏点位、点击省份聚焦、切换省份无残留、
 * 取消选中清理、卸载释放、连续聚焦/取消成对调用），
 * 不触碰 Three.js / WebGL，因此对 mocked viewer 的调用进行断言。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import React from 'react';

/* ---------------- mock viewer（api + options 捕获） ---------------- */
const h = vi.hoisted(() => {
  // 用内联 import type 而非顶层 import：vi.hoisted 会被提升到所有 import 之前，
  // 顶层类型名在提升后的函数体内不可见。
  const state: { options: import('./terrainViewer').TerrainViewerOptions | null } = {
    options: null,
  };
  const mockApi = {
    setReliefRatio: vi.fn(),
    setSegments: vi.fn(),
    setWireframe: vi.fn(),
    // 专题晕染（药田晕染）：容器在 ready 后会调用一次，mock 必须提供，否则整组用例抛 TypeError
    setTintLayer: vi.fn(),
    // 省名统计数字（与晕染联动）
    setProvinceStatLabels: vi.fn(),
    setAutoRotate: vi.fn(),
    applyPreset: vi.fn(),
    resetView: vi.fn(),
    zoomBy: vi.fn(),
    setProvinceFeatures: vi.fn(),
    setCityFeatures: vi.fn(),
    setProvinceLabelsVisible: vi.fn(),
    setReservedRects: vi.fn(),
    setYaoProvinceAdcodes: vi.fn(),
    setProvinceStats: vi.fn(),
    setHerbPois: vi.fn(),
    setCountyPois: vi.fn(),
    getCameraBearing: vi.fn(() => 180),
    // 旅游路线层 API（开启路线时副作用会调用这些方法）
    setTourVisible: vi.fn(),
    isTourVisible: vi.fn(() => false),
    setTourActiveNode: vi.fn(),
    focusTourNode: vi.fn(),
    exitTourNode: vi.fn(),
    showTourOverview: vi.fn(),
    focusProvince: vi.fn(() => true),
    getFocusLodState: vi.fn(() => ({
      focused: false,
      globalSegments: 512,
      patchSegX: null,
      patchSegY: null,
    })),
    dispose: vi.fn(),
  };
  const createTerrainViewer = vi.fn(
    (options: import('./terrainViewer').TerrainViewerOptions) => {
      state.options = options;
      return mockApi;
    },
  );
  return { mockApi, createTerrainViewer, state };
});

vi.mock('./terrainViewer', () => ({
  createTerrainViewer: h.createTerrainViewer,
}));

/* ---------------- mock heightmap（返回极小合成高程图） ---------------- */
vi.mock('./heightmap', () => ({
  loadHeightmap: vi.fn(async () => ({
    width: 2,
    height: 2,
    data: new Float32Array([0, 500, 500, 1000]),
    meta: {
      name: 'test',
      encoding: 'terrarium',
      projection: 'mercator',
      bounds: [73, 17.5, 135.5, 54],
      width: 2,
      height: 2,
      aspect: 1,
      minElevation: 0,
      maxElevation: 1000,
      meanElevation: 500,
      seaPixelRatio: 0,
      source: 'test',
      generatedBy: 'test',
    },
  })),
  sampleElevation: vi.fn(() => 0),
}));

/* ---------------- mock assetPath ---------------- */
vi.mock('../../lib/assetPath', () => ({
  assetPath: (p: string) => '/' + p,
}));

import TerrainRelief3D from './TerrainRelief3D';
import { useMapStore } from '../../store/mapStore';

/* ---------------- fetch 桩 ---------------- */
function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as unknown as Response;
}

const provinceFC = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { adcode: 450000, name: '广西壮族自治区', center: [108.3, 23.8] },
      geometry: {
        type: 'Polygon',
        coordinates: [[[100, 20], [112, 20], [112, 26], [100, 26], [100, 20]]],
      },
    },
    {
      type: 'Feature',
      properties: { adcode: 440000, name: '广东省', center: [113.3, 23.1] },
      geometry: {
        type: 'Polygon',
        coordinates: [[[110, 20], [118, 20], [118, 25], [110, 25], [110, 20]]],
      },
    },
  ],
};

function cityFC(tag: string) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { adcode: `${tag}01`, name: `${tag}市一`, center: [110, 23] },
        geometry: { type: 'Polygon', coordinates: [[[109, 22], [111, 22], [111, 24], [109, 24], [109, 22]]] },
      },
      {
        type: 'Feature',
        properties: { adcode: `${tag}02`, name: `${tag}市二`, center: [111, 24] },
        geometry: { type: 'Polygon', coordinates: [[[110, 23], [112, 23], [112, 25], [110, 25], [110, 23]]] },
      },
    ],
  };
}

function installFetch() {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes('100000_full.json')) return jsonResponse(provinceFC);
    if (url.includes('450000_full.json')) return jsonResponse(cityFC('45'));
    if (url.includes('440000_full.json')) return jsonResponse(cityFC('44'));
    return jsonResponse({ type: 'FeatureCollection', features: [] });
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

/* ---------------- 辅助断言 ---------------- */
const herbArgs = () => h.mockApi.setHerbPois.mock.calls.map((c) => c[0]);
const countyArgs = () => h.mockApi.setCountyPois.mock.calls.map((c) => c[0]);
const lastHerb = () => herbArgs()[herbArgs().length - 1] ?? [];
const lastCounty = () => countyArgs()[countyArgs().length - 1] ?? [];
const anyNonEmpty = (calls: unknown[][]) =>
  calls.some((c) => Array.isArray(c[0]) && (c[0] as unknown[]).length > 0);

/** 挂载并等待 viewer 创建 + 省级边界加载完成 */
async function mount() {
  const utils = render(<TerrainRelief3D />);
  await waitFor(() => expect(h.createTerrainViewer).toHaveBeenCalled());
  await waitFor(() => expect(h.state.options).toBeTruthy());
  await waitFor(() => expect(h.mockApi.setProvinceFeatures).toHaveBeenCalled());
  return utils;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.options = null;
  installFetch();
  // 重置全局 store，避免用例间相互影响
  useMapStore.setState({ viewLevel: 'national' });
});

afterEach(() => {
  cleanup();
});

describe('TerrainRelief3D 容器行为', () => {
  it('(a) 初始状态：草药/县点位默认隐藏（无任何非空数组入参）', async () => {
    await mount();
    expect(anyNonEmpty(h.mockApi.setHerbPois.mock.calls)).toBe(false);
    expect(anyNonEmpty(h.mockApi.setCountyPois.mock.calls)).toBe(false);
  });

  it('(b)(c)(d)(e) 聚焦 → 切换 → 取消 → 卸载 的完整生命周期', async () => {
    const utils = await mount();

    /* (b) 点击广西 → 聚焦 + 该省草药/县点位 + store 层级为 region */
    await act(async () => {
      h.state.options.onProvinceClick({ adcode: 450000, name: '广西壮族自治区' });
    });
    await waitFor(() => expect(h.mockApi.focusProvince).toHaveBeenCalledWith(450000));
    await waitFor(() => {
      expect(lastHerb()).toHaveLength(5);
      expect(lastCounty()).toHaveLength(11);
    });
    const herb45 = lastHerb();
    const county45 = lastCounty();
    expect(useMapStore.getState().viewLevel).toBe('region');

    /* (c) 切换到广东 → 入参应与广西不同（无残留） */
    await act(async () => {
      h.state.options.onProvinceClick({ adcode: 440000, name: '广东省' });
    });
    await waitFor(() => expect(h.mockApi.focusProvince).toHaveBeenCalledWith(440000));
    await waitFor(() => {
      expect(lastHerb()).toHaveLength(5);
      expect(lastCounty()).toHaveLength(5);
    });
    expect(lastHerb()).not.toEqual(herb45);
    expect(lastCounty()).not.toEqual(county45);
    expect(useMapStore.getState().viewLevel).toBe('region');

    /* (d) 取消选中 → 清空点位 + resetView + store 层级为 national */
    await act(async () => {
      h.state.options.onProvinceClick(null);
    });
    await waitFor(() => expect(lastHerb()).toEqual([]));
    expect(lastCounty()).toEqual([]);
    expect(h.mockApi.resetView).toHaveBeenCalled();
    expect(useMapStore.getState().viewLevel).toBe('national');

    /* (e) 卸载 → dispose 恰好一次；最后一批草药点位为空（已被清理） */
    utils.unmount();
    await waitFor(() => expect(h.mockApi.dispose).toHaveBeenCalledTimes(1));
    expect(lastHerb()).toEqual([]);
  });

  it('(f) 连续 3 次「聚焦 → 取消」后，草药与县点位调用次数成对相等', async () => {
    await mount();

    const cycle = async (adcode: number) => {
      await act(async () => {
        h.state.options.onProvinceClick({ adcode, name: `省${adcode}` });
      });
      await waitFor(() => expect(h.mockApi.focusProvince).toHaveBeenCalledWith(adcode));
      await waitFor(() => expect(lastHerb().length).toBeGreaterThan(0));
      await act(async () => {
        h.state.options.onProvinceClick(null);
      });
      await waitFor(() => expect(lastHerb()).toEqual([]));
    };

    for (const code of [450000, 440000, 450000]) {
      await cycle(code);
    }

    expect(h.mockApi.setHerbPois.mock.calls.length).toBe(
      h.mockApi.setCountyPois.mock.calls.length,
    );
    // 3 次聚焦 + 3 次取消，各产生 6 次调用
    expect(h.mockApi.setHerbPois.mock.calls.length).toBe(6);
  });

  it('(g) 省级边界加载失败时地形仍可用：不整屏报错、不卡在加载态', async () => {
    // 地形本身已就绪，只有叠加的省界请求失败 → 必须降级为"无省界"而不是 error 遮罩
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes('100000_full.json')) throw new Error('boundary unavailable');
      return jsonResponse({ type: 'FeatureCollection', features: [] });
    });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const utils = render(<TerrainRelief3D />);
    await waitFor(() => expect(h.createTerrainViewer).toHaveBeenCalled());

    // 状态必须是 ready：既没有错误遮罩，也没有加载遮罩
    await waitFor(() => {
      expect(utils.queryByText('地形浮雕初始化失败')).toBeNull();
      expect(utils.queryByText(/正在加载中国地形高程数据/)).toBeNull();
    });
    // 省界确实没加载成功，且没有污染到 viewer
    expect(h.mockApi.setProvinceFeatures).not.toHaveBeenCalled();
    // 缩放控件仅在 status === 'ready' 时渲染 → 用它确认状态为 ready
    // （不依赖面板内的具体文案，避免 UI 文案调整让测试变脆弱）
    expect(utils.queryByLabelText('放大')).toBeTruthy();

    warn.mockRestore();
    utils.unmount();
  });

  it('(h) 控制面板：密度可切换，路线图例默认收纳', async () => {
    const utils = await mount();

    // 密度切换：默认「紧凑」，点击后变「宽松」
    expect(utils.getByLabelText('切换面板疏密').textContent).toBe('紧凑');
    await act(async () => {
      utils.getByLabelText('切换面板疏密').click();
    });
    expect(utils.getByLabelText('切换面板疏密').textContent).toBe('宽松');

    // 旅游路线默认关闭 → 不出现图例入口
    expect(utils.queryByText(/类别图例/)).toBeNull();

    // 开启路线 → 控制台自动收起（避免面板压住右侧站点徽标）
    await act(async () => {
      utils.getByLabelText('旅游路线').click();
    });
    await waitFor(() => expect(utils.queryByText(/类别图例/)).toBeNull());
    expect(utils.queryByRole('button', { name: /展开/ })).toBeTruthy();

    // 重新展开控制台后，图例入口才可见（且默认仍收起）
    await act(async () => {
      utils.getByRole('button', { name: /展开/ }).click();
    });
    await waitFor(() => expect(utils.queryByText(/类别图例/)).toBeTruthy());

    utils.unmount();
  });

  it('(i) 开启路线后点击省份：路线退出、保留相机并把视角交给省级聚焦', async () => {
    const utils = await mount();

    // 先开启路线
    await act(async () => {
      utils.getByLabelText('旅游路线').click();
    });
    // 开关已从控制台移到缩放控件下方 → 控制台收起时它依然常驻可见
    await waitFor(() => expect(utils.queryByLabelText('旅游路线')).not.toBeNull());
    expect(utils.getByLabelText('旅游路线').getAttribute('aria-checked')).toBe('true');

    // 点击省份 → 路线模式必须退出（两种浏览模式互斥）
    await act(async () => {
      h.state.options.onProvinceClick({ adcode: 450000, name: '广西壮族自治区' });
    });

    await waitFor(() =>
      expect(utils.getByLabelText('旅游路线').getAttribute('aria-checked')).toBe('false'),
    );
    // 关键：关闭时传 keepView=true，否则 viewer 会 applyPreset('overview') 把省份聚焦镜头冲掉
    expect(h.mockApi.setTourVisible).toHaveBeenCalledWith(false, true);
    // 省级聚焦仍然正常生效
    expect(h.mockApi.focusProvince).toHaveBeenCalledWith(450000);

    utils.unmount();
  });

  it('(j) 点击控制台以外的区域：控制台自动收起', async () => {
    const utils = await mount();

    // 默认展开（能点到密度切换按钮）
    expect(utils.getByLabelText('切换面板疏密')).toBeTruthy();

    // 在文档其它位置按下指针 → 应收起
    await act(async () => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }) as unknown as PointerEvent);
    });

    await waitFor(() => expect(utils.queryByLabelText('切换面板疏密')).toBeNull());
    expect(utils.queryByRole('button', { name: /展开/ })).toBeTruthy();

    utils.unmount();
  });
});
