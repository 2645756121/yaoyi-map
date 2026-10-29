import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Leaf, ChevronRight, MapPin, BookOpen, LayoutGrid, List } from 'lucide-react';
import { herbs, regions } from '../../data/mockData';
import { applyHerbImageOverride, getHerbImageFallback } from '../../lib/herbImages';
import { useMapStore } from '../../store/mapStore';
import EntryCard from '../common/EntryCard';
import {
  PanelChip,
  PanelChipRow,
  PanelFooter,
  PanelHeader,
  PanelOverlay,
  PanelSearch,
  PanelSurface,
} from '../common/PanelKit';
import { Herb, Region } from '../../types';

type SortMode = 'alphabet' | 'region';
type ViewMode = 'list' | 'grid';

interface GroupedHerb { key: string; label: string; meta?: string; herbs: Herb[]; }

const HerbCatalog: React.FC<{ bare?: boolean }> = ({ bare = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('alphabet');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');

  const { setSelectedHerb, openHerbModal, closePanel } = useMapStore();

  const regionMap = useMemo<Record<string, Region>>(() => {
    const map: Record<string, Region> = {};
    regions.forEach((r) => { map[r.id] = r; });
    return map;
  }, []);

  const alphabetGroups = useMemo<GroupedHerb[]>(() => {
    const sorted = [...herbs].sort((a, b) => {
      const aFirst = (a.nameEn || a.name).charAt(0).toUpperCase();
      const bFirst = (b.nameEn || b.name).charAt(0).toUpperCase();
      if (aFirst === bFirst) return (a.nameEn || a.name).localeCompare(b.nameEn || b.name);
      return aFirst.localeCompare(bFirst);
    });
    const groups: Record<string, Herb[]> = {};
    sorted.forEach((h) => {
      const first = (h.nameEn || h.name).charAt(0).toUpperCase();
      const key = /[A-Z]/.test(first) ? first : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(h);
    });
    return Object.keys(groups).sort().map((key) => ({ key, label: key, herbs: groups[key] }));
  }, []);

  const regionGroups = useMemo<GroupedHerb[]>(() => {
    const groups: Record<string, Herb[]> = {};
    herbs.forEach((h) => {
      if (!groups[h.regionId]) groups[h.regionId] = [];
      groups[h.regionId].push(h);
    });
    return regions
      .filter((r) => groups[r.id] && groups[r.id].length > 0)
      .map((r) => ({
        key: r.id,
        label: r.name,
        meta: `${groups[r.id].length} 种`,
        herbs: groups[r.id].sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, []);

  const currentGroups = sortMode === 'alphabet' ? alphabetGroups : regionGroups;

  const filteredGroups = useMemo<GroupedHerb[]>(() => {
    if (!searchKeyword.trim()) return currentGroups;
    const kw = searchKeyword.trim().toLowerCase();
    return currentGroups
      .map((group) => ({
        ...group,
        herbs: group.herbs.filter(
          (h) =>
            h.name.toLowerCase().includes(kw) ||
            h.nameEn.toLowerCase().includes(kw) ||
            (h.nameYao && h.nameYao.toLowerCase().includes(kw)) ||
            h.scientificName.toLowerCase().includes(kw)
        ),
      }))
      .filter((group) => group.herbs.length > 0);
  }, [currentGroups, searchKeyword]);

  const activeGroup = filteredGroups.find((g) => g.key === activeKey) || filteredGroups[0];

  const handleHerbClick = (herb: Herb) => {
    setIsOpen(false);
    closePanel();
    setSelectedHerb(herb);
    openHerbModal();
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        const target = document.querySelector(`[data-herb-anchor="${herb.id}"]`);
        if (target instanceof HTMLElement) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.add('herb-card-flash');
          setTimeout(() => target.classList.remove('herb-card-flash'), 1200);
        }
      }, 350);
    }
  };

  const totalCount = useMemo(() => {
    const groups = sortMode === 'alphabet' ? alphabetGroups : regionGroups;
    return groups.reduce((sum, g) => sum + g.herbs.length, 0);
  }, [sortMode, alphabetGroups, regionGroups]);

  return (
    <>
      {!isOpen && (
        <section
          className={`herb-catalog-entry w-full${bare ? '' : ' px-4 pt-4 pb-2'} animate-yao-fade-in-up`}
          aria-label="草药目录入口"
        >
          <EntryCard
            tone="amber"
            icon={<BookOpen className="w-5 h-5" />}
            title="草药分类目录"
            subtitle="按字母 / 省份浏览全部瑶药资源"
            badge={`${herbs.length} 种`}
            ariaLabel="打开草药分类目录"
            onClick={() => setIsOpen(true)}
          />
        </section>
      )}

      {isOpen && createPortal(
        /* 独立浮层：此前面板直接内联在顶栏格子中，被压成 ~280px 宽的一条，字母栏与卡片全挤在一起 */
        <PanelOverlay onClose={() => setIsOpen(false)} label="草药分类目录">
          <PanelSurface className="herb-catalog-panel">
          <PanelHeader
            tone="amber"
            icon={<BookOpen className="w-5 h-5" />}
            title="草药分类目录"
            subtitle={`共 ${herbs.length} 种瑶药 · 浏览索引`}
            onClose={() => setIsOpen(false)}
            closeLabel="关闭目录"
          />

          {/* ===== 工具栏：搜索 + 排序 + 视图（统一 PanelKit 规格） ===== */}
          <div className="px-4 pt-3 pb-2 space-y-2 border-b border-black/[0.05]">
            <PanelSearch
              value={searchKeyword}
              onChange={setSearchKeyword}
              placeholder="搜索草药名称、学名、瑶语名…"
              tone="amber"
            />

            <PanelChipRow>
              <PanelChip
                active={sortMode === 'alphabet'}
                onClick={() => { setSortMode('alphabet'); setActiveKey(null); setSearchKeyword(''); }}
                tone="amber"
              >
                <span className="font-mono">A-Z</span> 字母顺序
              </PanelChip>
              <PanelChip
                active={sortMode === 'region'}
                onClick={() => { setSortMode('region'); setActiveKey(null); setSearchKeyword(''); }}
                tone="amber"
              >
                <MapPin className="inline w-3 h-3 -mt-0.5 mr-0.5" />省份分布
              </PanelChip>
              <span className="ml-auto text-[11px] text-gray-500">视图</span>
              <PanelChip active={viewMode === 'list'} onClick={() => setViewMode('list')} tone="amber" ariaLabel="列表视图" ariaPressed={viewMode === 'list'}>
                <List className="inline w-3 h-3 -mt-0.5 mr-0.5" />列表
              </PanelChip>
              <PanelChip active={viewMode === 'grid'} onClick={() => setViewMode('grid')} tone="amber" ariaLabel="网格视图" ariaPressed={viewMode === 'grid'}>
                <LayoutGrid className="inline w-3 h-3 -mt-0.5 mr-0.5" />网格
              </PanelChip>
            </PanelChipRow>
          </div>

          {/* ===== A-Z 快捷索引 ===== */}
          {sortMode === 'alphabet' && !searchKeyword && (
            <div className="px-4 py-2 border-b border-ochre-300 bg-ochre-100/60 backdrop-blur-sm flex flex-wrap gap-1.5">
              {alphabetGroups.map((g) => (
                <button
                  type="button"
                  key={g.key}
                  onClick={() => setActiveKey(g.key)}
                  className={`yao-index-chip ${activeGroup?.key === g.key ? 'active' : ''}`}
                  aria-label={`跳转到字母 ${g.label}`}
                  aria-pressed={activeGroup?.key === g.key}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          {/* ===== 主内容：左侧分组 + 右侧草药 ===== */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            <div
              className={`${
                sortMode === 'alphabet' ? 'w-20 sm:w-24' : 'w-32 sm:w-40'
              } border-r border-ochre-300 overflow-y-auto modal-body-scroll bg-gradient-to-b from-ochre-100 to-ochre-50/70 backdrop-blur-sm`}
            >
              {filteredGroups.length === 0 ? (
                <div className="p-4 text-center text-xs text-ink-500">无匹配分组</div>
              ) : (
                filteredGroups.map((group) => (
                  <button
                    type="button"
                    key={group.key}
                    onClick={() => setActiveKey(group.key)}
                    className={`w-full px-2 py-3 flex flex-col items-center gap-0.5 transition-all duration-200 border-l-4 ${
                      activeGroup?.key === group.key
                        ? 'bg-amber-100 border-amber-500 text-ink-800 font-bold shadow-yao-xs'
                        : 'border-transparent text-ink-600 hover:bg-ochre-50 hover:border-amber-300'
                    }`}
                  >
                    <span className="text-sm font-bold truncate w-full text-center">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-ink-500">{group.herbs.length}种</span>
                  </button>
                ))
              )}
            </div>

            <div className="flex-1 overflow-y-auto modal-body-scroll p-3 bg-ochre-50/40">
              {!activeGroup ? (
                <div className="flex flex-col items-center justify-center h-full text-ink-500">
                  <div className="w-16 h-16 rounded-full bg-ochre-100 flex items-center justify-center mb-3">
                    <Leaf className="w-8 h-8 text-amber-600" />
                  </div>
                  <p className="text-sm">请选择左侧分组</p>
                </div>
              ) : (
                <>
                  <div className="mb-3 px-1">
                    <h3 className="font-serif font-bold text-base text-ink-800 flex items-center gap-2">
                      <span className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
                      {activeGroup.label}
                      <span className="text-xs text-ink-500 font-normal">
                        {activeGroup.herbs.length} 种
                      </span>
                    </h3>
                  </div>
                  {viewMode === 'grid' ? (
                    <HerbThumbnailGrid herbs={activeGroup.herbs} onClick={handleHerbClick} />
                  ) : (
                    <HerbCompactList
                      herbs={activeGroup.herbs}
                      onClick={handleHerbClick}
                      regionMap={regionMap}
                      showRegion={sortMode === 'alphabet'}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          <PanelFooter>
            {sortMode === 'alphabet' ? '按英文名首字母排序' : '按草药所属省份分布排序'}
            {totalCount > 0 && ` · 共 ${totalCount} 种`}
          </PanelFooter>
          </PanelSurface>
        </PanelOverlay>,
        document.body
      )}
    </>
  );
};

export default HerbCatalog;

interface HerbThumbnailProps { herb: Herb; size?: number; className?: string; }

const HerbThumbnail: React.FC<HerbThumbnailProps> = ({ herb, size = 56, className = '' }) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const resolvedImageUrl = useMemo(
    () => applyHerbImageOverride(herb.id, herb.image).url,
    [herb.id, herb.image]
  );
  const fallbackUrl = useMemo(() => getHerbImageFallback(herb.id), [herb.id]);

  const handleError = () => {
    if (fallbackUrl && imgRef.current && imgRef.current.src !== fallbackUrl) {
      imgRef.current.src = fallbackUrl;
      setLoaded(true);
      return;
    }
    setErrored(true);
  };

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-ochre-200 to-ochre-100 flex-shrink-0 ring-1 ring-ochre-300 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* 占位：加载中 / 加载失败都显示，避免兜底也失败时出现纯色空白块 */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Leaf className="text-amber-600 opacity-50" style={{ width: size * 0.5, height: size * 0.5 }} />
        </div>
      )}
      {!errored && (
        <img
          ref={imgRef}
          src={resolvedImageUrl}
          alt={herb.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ aspectRatio: '1 / 1' }}
        />
      )}
    </div>
  );
};

interface HerbThumbnailGridProps { herbs: Herb[]; onClick: (herb: Herb) => void; }

const HerbThumbnailGrid: React.FC<HerbThumbnailGridProps> = ({ herbs, onClick }) => {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1024) setCols(6);
      else if (w >= 640) setCols(4);
      else setCols(3);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} data-testid="herb-thumbnail-grid">
      {herbs.map((herb) => (
        <button
          key={herb.id}
          onClick={() => onClick(herb)}
          title={`${herb.name}（${herb.scientificName}）`}
          aria-label={`${herb.name} ${herb.scientificName}`}
          className="group flex flex-col items-center gap-1 p-2 bg-ochre-50 hover:bg-amber-50 rounded-lg border border-ochre-300 hover:border-amber-400 hover:shadow-yao-sm transition-all duration-200"
        >
          <HerbThumbnail herb={herb} size={56} className="rounded-md group-hover:scale-110 transition-transform duration-300" />
          <div className="w-full text-center min-w-0">
            <div className="text-xs font-semibold text-ink-800 group-hover:text-amber-700 truncate transition-colors">{herb.name}</div>
            <div className="text-[10px] text-ink-500 italic truncate">{herb.scientificName}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

interface HerbCompactListProps {
  herbs: Herb[];
  onClick: (herb: Herb) => void;
  regionMap: Record<string, Region>;
  showRegion: boolean;
}

const HerbCompactList: React.FC<HerbCompactListProps> = ({ herbs, onClick, regionMap, showRegion }) => {
  return (
    <div className="space-y-1.5" data-testid="herb-compact-list">
      {herbs.map((herb) => (
        <button
          key={herb.id}
          onClick={() => onClick(herb)}
          className="w-full flex items-center gap-2.5 p-2 bg-ochre-50 hover:bg-amber-50 rounded-lg text-left transition-all duration-200 border border-ochre-300 hover:border-amber-400 hover:shadow-yao-xs group"
        >
          <HerbThumbnail herb={herb} size={32} className="rounded-md group-hover:scale-110 transition-transform duration-300" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-ink-800 group-hover:text-amber-700 truncate transition-colors">{herb.name}</h4>
            <p className="text-xs text-ink-500 truncate italic">{herb.scientificName}</p>
          </div>
          {showRegion && (
            <div className="flex items-center gap-1 text-xs text-ink-500 flex-shrink-0">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[60px]">
                {regionMap[herb.regionId]?.name?.replace('壮族自治区', '').replace('省', '') || ''}
              </span>
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-amber-600 flex-shrink-0 transition-colors" />
        </button>
      ))}
    </div>
  );
};