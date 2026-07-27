import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Leaf, Search, X, ChevronRight, MapPin, BookOpen, LayoutGrid, List } from 'lucide-react';
import { herbs, regions } from '../../data/mockData';
import { applyHerbImageOverride, getHerbImageFallback } from '../../lib/herbImages';
import { useMapStore } from '../../store/mapStore';
import { Herb, Region } from '../../types';

type SortMode = 'alphabet' | 'region';
type ViewMode = 'list' | 'grid';

interface GroupedHerb { key: string; label: string; meta?: string; herbs: Herb[]; }

const HerbCatalog: React.FC = () => {
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
        <section className="herb-catalog-entry w-full px-4 pt-4 pb-2" aria-label="草药目录入口">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 hover:from-primary-700 hover:via-primary-800 hover:to-primary-900 rounded-2xl shadow-lg hover:shadow-xl text-white transition-all focus:outline-none focus:ring-4 focus:ring-primary-300"
            aria-label="打开草药分类目录"
          >
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform">
              <BookOpen className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-base sm:text-lg font-bold truncate flex items-center gap-2">
                <span>草药分类目录</span>
                <span className="hidden sm:inline px-2 py-0.5 bg-amber-400 text-amber-900 text-xs rounded-full font-semibold">
                  {herbs.length} 种
                </span>
              </div>
              <div className="text-xs sm:text-sm text-primary-100 truncate mt-0.5">
                按字母 / 省份浏览全部瑶药资源
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-lg text-xs font-medium flex-shrink-0 group-hover:bg-white/30 transition-colors">
              <span>打开目录</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <svg className="sm:hidden w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </section>
      )}

      {isOpen && (
        <div
          className="herb-catalog-panel relative w-full max-w-full box-border bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/60 my-4 overflow-hidden flex flex-col max-h-[85vh]"
          role="dialog"
          aria-modal="false"
          aria-label="草药分类目录"
        >
          <div
            className="relative px-4 py-4 border-b border-amber-200/50 flex items-center justify-between overflow-hidden"
            style={{
              background:
                'linear-gradient(120deg, rgba(238,245,238,0.95) 0%, rgba(251,243,227,0.95) 100%)',
            }}
          >
            <div className="absolute inset-0 opacity-25 pointer-events-none bg-yao-weave" aria-hidden />
            <div className="relative flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex items-center justify-center shadow-card">
                <BookOpen className="w-5 h-5 text-amber-100" />
              </div>
              <div>
                <h2 className="title-yao text-lg leading-tight">草药分类目录</h2>
                <p className="text-xs text-ink-500 mt-0.5">
                  共 <span className="text-primary-700 font-semibold">{herbs.length}</span> 种瑶药 · 浏览索引
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="relative btn-yao-icon" aria-label="关闭目录">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b border-white/30 bg-white/30 backdrop-blur-sm space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setSortMode('alphabet'); setActiveKey(null); setSearchKeyword(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                  sortMode === 'alphabet'
                    ? 'bg-primary-600 text-white border-primary-700 shadow-card'
                    : 'bg-white/80 text-ink-700 border-primary-100 hover:bg-primary-50'
                }`}
              >
                <span className="font-mono">A-Z</span>
                <span>字母顺序</span>
              </button>
              <button
                type="button"
                onClick={() => { setSortMode('region'); setActiveKey(null); setSearchKeyword(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                  sortMode === 'region'
                    ? 'bg-primary-600 text-white border-primary-700 shadow-card'
                    : 'bg-white/80 text-ink-700 border-primary-100 hover:bg-primary-50'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>省份分布</span>
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索草药名称、学名、瑶语名..."
                aria-label="搜索草药"
                className="input-yao pl-9 pr-9 bg-white/80"
              />
              {searchKeyword && (
                <button type="button" aria-label="清除搜索" onClick={() => setSearchKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 btn-yao-icon w-7 h-7">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">视图</span>
              <div className="flex bg-white/60 rounded-lg p-0.5 border border-gray-200">
                <button onClick={() => setViewMode('list')} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-primary-600 text-white shadow-card' : 'text-ink-700 hover:bg-primary-50'}`} aria-label="列表视图" aria-pressed={viewMode === 'list'}>
                  <List className="w-3.5 h-3.5" />
                  列表
                </button>
                <button type="button" onClick={() => setViewMode('grid')} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-primary-600 text-white shadow-card' : 'text-ink-700 hover:bg-primary-50'}`} aria-label="网格视图" aria-pressed={viewMode === 'grid'}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                  网格
                </button>
              </div>
            </div>
          </div>

          {sortMode === 'alphabet' && !searchKeyword && (
            <div className="px-4 py-2 border-b border-primary-100/70 bg-amber-50/40 backdrop-blur-sm flex flex-wrap gap-1.5">
              {alphabetGroups.map((g) => (
                <button
                  type="button"
                  key={g.key}
                  onClick={() => setActiveKey(g.key)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all border ${
                    activeGroup?.key === g.key
                      ? 'bg-primary-600 text-white border-primary-700 shadow-card scale-110'
                      : 'bg-white/80 text-ink-700 border-primary-100 hover:bg-primary-50'
                  }`}
                  aria-label={`跳转到字母 ${g.label}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 flex overflow-hidden min-h-0">
            <div
              className={`${
                sortMode === 'alphabet' ? 'w-20 sm:w-24' : 'w-32 sm:w-40'
              } border-r border-primary-100/60 overflow-y-auto modal-body-scroll bg-amber-50/40 backdrop-blur-sm`}
            >
              {filteredGroups.length === 0 ? (
                <div className="p-4 text-center text-xs text-ink-500">无匹配分组</div>
              ) : (
                filteredGroups.map((group) => (
                  <button
                    type="button"
                    key={group.key}
                    onClick={() => setActiveKey(group.key)}
                    className={`w-full px-2 py-3 flex flex-col items-center gap-0.5 transition-all border-l-4 ${
                      activeGroup?.key === group.key
                        ? 'bg-primary-100/70 border-primary-600 text-primary-800 font-semibold'
                        : 'border-transparent text-ink-600 hover:bg-white/70'
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

            <div className="flex-1 overflow-y-auto modal-body-scroll p-3 bg-white/30">
              {!activeGroup ? (
                <div className="flex flex-col items-center justify-center h-full text-ink-500">
                  <Leaf className="w-10 h-10 text-ink-300 mb-2" />
                  <p className="text-sm">请选择左侧分组</p>
                </div>
              ) : (
                <>
                  <div className="mb-2.5 px-1">
                    <h3 className="text-sm font-serif font-semibold text-primary-800 flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-amber-500" />
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

          <div className="p-3 border-t border-primary-100/60 bg-primary-50/70 backdrop-blur-sm text-center">
            <p className="text-xs text-ink-600">
              {sortMode === 'alphabet' ? '按英文学名首字母排序' : '按草药所属省份分布排序'}
              {totalCount > 0 && ` · 共 ${totalCount} 种`}
            </p>
          </div>
        </div>
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
      className={`relative overflow-hidden bg-gradient-to-br from-green-100 to-emerald-100 flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {(!loaded || errored) && !fallbackUrl && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Leaf className="text-green-600 opacity-50" style={{ width: size * 0.5, height: size * 0.5 }} />
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
          className="group flex flex-col items-center gap-1 p-2 bg-white/70 hover:bg-white rounded-lg border border-white/40 hover:border-primary-300 hover:shadow-md transition-all"
        >
          <HerbThumbnail herb={herb} size={56} className="rounded-md group-hover:scale-105 transition-transform" />
          <div className="w-full text-center min-w-0">
            <div className="text-xs font-medium text-gray-800 group-hover:text-primary-700 truncate">{herb.name}</div>
            <div className="text-[10px] text-gray-500 italic truncate">{herb.scientificName}</div>
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
          className="w-full flex items-center gap-2.5 p-2 bg-white/70 hover:bg-white rounded-lg text-left transition-all border border-white/40 hover:border-primary-200 hover:shadow-sm group"
        >
          <HerbThumbnail herb={herb} size={32} className="rounded-md group-hover:scale-105 transition-transform" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-800 group-hover:text-primary-700 truncate">{herb.name}</h4>
            <p className="text-xs text-gray-500 truncate italic">{herb.scientificName}</p>
          </div>
          {showRegion && (
            <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[60px]">
                {regionMap[herb.regionId]?.name?.replace('壮族自治区', '').replace('省', '') || ''}
              </span>
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 flex-shrink-0" />
        </button>
      ))}
    </div>
  );
};