<<<<<<< HEAD
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
        meta: `${groups[r.id].length} 绉峘,
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
        <section className="herb-catalog-entry w-full px-4 pt-4 pb-2 animate-yao-fade-in-up" aria-label="鑽夎嵂鐩綍鍏ュ彛">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:via-amber-400 hover:to-amber-500 rounded-2xl shadow-yao-md hover:shadow-yao-lg text-ink-700 transition-all duration-300 ease-yao-soft focus:outline-none focus:ring-4 focus:ring-amber-300/60 relative overflow-hidden"
            aria-label="鎵撳紑鑽夎嵂鍒嗙被鐩綍"
          >
            {/* 椤堕儴瑁呴グ楂樺厜 */}
            <span
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
              }}
              aria-hidden
            />
            <div
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-primary-700 text-amber-200 backdrop-blur-md flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 ease-yao-bounce shadow-yao-sm"
              aria-hidden
            >
              <BookOpen className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-base sm:text-lg font-bold truncate flex items-center gap-2">
                <span className="text-ink-700">鑽夎嵂鍒嗙被鐩綍</span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 bg-ink-700 text-amber-100 text-xs rounded-full font-semibold gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-yao-pulse-glow" />
                  {herbs.length} 绉?
                </span>
              </div>
              <div className="text-xs sm:text-sm text-ink-600 truncate mt-0.5">
                鎸夊瓧姣?/ 鐪佷唤娴忚鍏ㄩ儴鐟惰嵂璧勬簮
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-primary-700 text-amber-100 rounded-lg text-xs font-medium flex-shrink-0 group-hover:bg-primary-800 transition-all duration-200 shadow-yao-xs">
              <span>鎵撳紑鐩綍</span>
              <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <svg className="sm:hidden w-5 h-5 flex-shrink-0 text-ink-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </section>
      )}

      {isOpen && (
        <div
          className="herb-catalog-panel relative w-full max-w-full box-border bg-ochre-50/95 backdrop-blur-md rounded-2xl shadow-yao-xl border border-ochre-300 my-4 overflow-hidden flex flex-col max-h-[85vh] animate-yao-pop-in"
          role="dialog"
          aria-modal="false"
          aria-label="鑽夎嵂鍒嗙被鐩綍"
        >
          {/* ===== 澶撮儴锛氭爣棰樺尯 ===== */}
          <div className="relative px-4 py-4 border-b border-ochre-300 flex items-center justify-between overflow-hidden bg-gradient-to-r from-ochre-100 via-ochre-50 to-ochre-100">
            <div className="absolute inset-0 opacity-30 pointer-events-none bg-yao-weave" aria-hidden />
            <div className="relative flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl yao-totem">
                <BookOpen className="w-5 h-5 text-ink-700 relative z-10" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-lg leading-tight text-ink-800">
                  鑽夎嵂鍒嗙被鐩綍
                </h2>
                <p className="text-xs text-ink-600 mt-0.5">
                  鍏?<span className="text-amber-700 font-bold">{herbs.length}</span> 绉嶇懚鑽?路 娴忚绱㈠紩
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="relative btn-yao-icon bg-ochre-100 hover:bg-amber-100 border-ochre-200 hover:border-amber-300 text-ink-700 hover:text-amber-900 transition-all duration-200"
              aria-label="鍏抽棴鐩綍"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ===== 宸ュ叿鏍忥細鎺掑簭 + 鎼滅储 + 瑙嗗浘 ===== */}
          <div className="p-3 border-b border-ochre-200 bg-ochre-100/40 backdrop-blur-sm space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setSortMode('alphabet'); setActiveKey(null); setSearchKeyword(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                  sortMode === 'alphabet'
                    ? 'bg-amber-500 text-ink-700 border-amber-600 shadow-yao-sm'
                    : 'bg-ochre-50 text-ink-700 border-ochre-300 hover:bg-amber-100 hover:border-amber-300'
                }`}
              >
                <span className="font-mono">A-Z</span>
                <span>瀛楁瘝椤哄簭</span>
              </button>
              <button
                type="button"
                onClick={() => { setSortMode('region'); setActiveKey(null); setSearchKeyword(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                  sortMode === 'region'
                    ? 'bg-amber-500 text-ink-700 border-amber-600 shadow-yao-sm'
                    : 'bg-ochre-50 text-ink-700 border-ochre-300 hover:bg-amber-100 hover:border-amber-300'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>鐪佷唤鍒嗗竷</span>
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="鎼滅储鑽夎嵂鍚嶇О銆佸鍚嶃€佺懚璇悕..."
                aria-label="鎼滅储鑽夎嵂"
                className="input-yao pl-9 pr-9 bg-white border-ochre-200 hover:border-amber-400 focus:border-amber-500"
              />
              {searchKeyword && (
                <button type="button" aria-label="娓呴櫎鎼滅储" onClick={() => setSearchKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 btn-yao-icon w-7 h-7 bg-ochre-100 hover:bg-amber-100 border-ochre-200 hover:border-amber-300 text-ink-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-500">瑙嗗浘</span>
              <div className="flex bg-ochre-100 rounded-lg p-0.5 border border-ochre-300">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200 ${viewMode === 'list' ? 'bg-amber-500 text-ink-700 shadow-yao-xs' : 'text-ink-700 hover:bg-amber-100'}`}
                  aria-label="鍒楄〃瑙嗗浘"
                  aria-pressed={viewMode === 'list'}
                >
                  <List className="w-3.5 h-3.5" />
                  鍒楄〃
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200 ${viewMode === 'grid' ? 'bg-amber-500 text-ink-700 shadow-yao-xs' : 'text-ink-700 hover:bg-amber-100'}`}
                  aria-label="缃戞牸瑙嗗浘"
                  aria-pressed={viewMode === 'grid'}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  缃戞牸
                </button>
              </div>
            </div>
          </div>

          {/* ===== A-Z 蹇嵎绱㈠紩 ===== */}
          {sortMode === 'alphabet' && !searchKeyword && (
            <div className="px-4 py-2 border-b border-ochre-300 bg-ochre-100/60 backdrop-blur-sm flex flex-wrap gap-1.5">
              {alphabetGroups.map((g) => (
                <button
                  type="button"
                  key={g.key}
                  onClick={() => setActiveKey(g.key)}
                  className={`yao-index-chip ${activeGroup?.key === g.key ? 'active' : ''}`}
                  aria-label={`璺宠浆鍒板瓧姣?${g.label}`}
                  aria-pressed={activeGroup?.key === g.key}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          {/* ===== 涓诲唴瀹癸細宸︿晶鍒嗙粍 + 鍙充晶鑽夎嵂 ===== */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            <div
              className={`${
                sortMode === 'alphabet' ? 'w-20 sm:w-24' : 'w-32 sm:w-40'
              } border-r border-ochre-300 overflow-y-auto modal-body-scroll bg-gradient-to-b from-ochre-100 to-ochre-50/70 backdrop-blur-sm`}
            >
              {filteredGroups.length === 0 ? (
                <div className="p-4 text-center text-xs text-ink-500">鏃犲尮閰嶅垎缁?/div>
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
                    <span className="text-[10px] text-ink-500">{group.herbs.length}绉?/span>
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
                  <p className="text-sm">璇烽€夋嫨宸︿晶鍒嗙粍</p>
                </div>
              ) : (
                <>
                  <div className="mb-3 px-1">
                    <h3 className="font-serif font-bold text-base text-ink-800 flex items-center gap-2">
                      <span className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
                      {activeGroup.label}
                      <span className="text-xs text-ink-500 font-normal">
                        {activeGroup.herbs.length} 绉?
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

          {/* ===== 搴曢儴鐘舵€佹爮 ===== */}
          <div className="px-4 py-2 border-t border-ochre-300 bg-ochre-100/70 backdrop-blur-sm text-center text-xs text-ink-600">
            {sortMode === 'alphabet' ? '鎸夎嫳鏂囧鍚嶉瀛楁瘝鎺掑簭' : '鎸夎崏鑽墍灞炵渷浠藉垎甯冩帓搴?}
            {totalCount > 0 && ` 路 鍏?${totalCount} 绉峘}
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
      className={`relative overflow-hidden bg-gradient-to-br from-ochre-200 to-ochre-100 flex-shrink-0 ring-1 ring-ochre-300 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {(!loaded || errored) && !fallbackUrl && (
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
          title={`${herb.name}锛?{herb.scientificName}锛塦}
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
                {regionMap[herb.regionId]?.name?.replace('澹棌鑷不鍖?, '').replace('鐪?, '') || ''}
              </span>
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-amber-600 flex-shrink-0 transition-colors" />
        </button>
      ))}
    </div>
  );
=======
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
        <section className="herb-catalog-entry w-full px-4 pt-4 pb-2 animate-yao-fade-in-up" aria-label="草药目录入口">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:via-amber-400 hover:to-amber-500 rounded-2xl shadow-yao-md hover:shadow-yao-lg text-ink-700 transition-all duration-300 ease-yao-soft focus:outline-none focus:ring-4 focus:ring-amber-300/60 relative overflow-hidden"
            aria-label="打开草药分类目录"
          >
            {/* 顶部装饰高光 */}
            <span
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
              }}
              aria-hidden
            />
            <div
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-primary-700 text-amber-200 backdrop-blur-md flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 ease-yao-bounce shadow-yao-sm"
              aria-hidden
            >
              <BookOpen className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-base sm:text-lg font-bold truncate flex items-center gap-2">
                <span className="text-ink-700">草药分类目录</span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 bg-ink-700 text-amber-100 text-xs rounded-full font-semibold gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-yao-pulse-glow" />
                  {herbs.length} 种
                </span>
              </div>
              <div className="text-xs sm:text-sm text-ink-600 truncate mt-0.5">
                按字母 / 省份浏览全部瑶药资源
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-primary-700 text-amber-100 rounded-lg text-xs font-medium flex-shrink-0 group-hover:bg-primary-800 transition-all duration-200 shadow-yao-xs">
              <span>打开目录</span>
              <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <svg className="sm:hidden w-5 h-5 flex-shrink-0 text-ink-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </section>
      )}

      {isOpen && (
        <div
          className="herb-catalog-panel relative w-full max-w-full box-border bg-ochre-50/95 backdrop-blur-md rounded-2xl shadow-yao-xl border border-ochre-300 my-4 overflow-hidden flex flex-col max-h-[85vh] animate-yao-pop-in"
          role="dialog"
          aria-modal="false"
          aria-label="草药分类目录"
        >
          {/* ===== 头部：标题区 ===== */}
          <div className="relative px-4 py-4 border-b border-ochre-300 flex items-center justify-between overflow-hidden bg-gradient-to-r from-ochre-100 via-ochre-50 to-ochre-100">
            <div className="absolute inset-0 opacity-30 pointer-events-none bg-yao-weave" aria-hidden />
            <div className="relative flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl yao-totem">
                <BookOpen className="w-5 h-5 text-ink-700 relative z-10" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-lg leading-tight text-ink-800">
                  草药分类目录
                </h2>
                <p className="text-xs text-ink-600 mt-0.5">
                  共 <span className="text-amber-700 font-bold">{herbs.length}</span> 种瑶药 · 浏览索引
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="relative btn-yao-icon bg-ochre-100 hover:bg-amber-100 border-ochre-200 hover:border-amber-300 text-ink-700 hover:text-amber-900 transition-all duration-200"
              aria-label="关闭目录"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ===== 工具栏：排序 + 搜索 + 视图 ===== */}
          <div className="p-3 border-b border-ochre-200 bg-ochre-100/40 backdrop-blur-sm space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setSortMode('alphabet'); setActiveKey(null); setSearchKeyword(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                  sortMode === 'alphabet'
                    ? 'bg-amber-500 text-ink-700 border-amber-600 shadow-yao-sm'
                    : 'bg-ochre-50 text-ink-700 border-ochre-300 hover:bg-amber-100 hover:border-amber-300'
                }`}
              >
                <span className="font-mono">A-Z</span>
                <span>字母顺序</span>
              </button>
              <button
                type="button"
                onClick={() => { setSortMode('region'); setActiveKey(null); setSearchKeyword(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                  sortMode === 'region'
                    ? 'bg-amber-500 text-ink-700 border-amber-600 shadow-yao-sm'
                    : 'bg-ochre-50 text-ink-700 border-ochre-300 hover:bg-amber-100 hover:border-amber-300'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>省份分布</span>
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索草药名称、学名、瑶语名..."
                aria-label="搜索草药"
                className="input-yao pl-9 pr-9 bg-white border-ochre-200 hover:border-amber-400 focus:border-amber-500"
              />
              {searchKeyword && (
                <button type="button" aria-label="清除搜索" onClick={() => setSearchKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 btn-yao-icon w-7 h-7 bg-ochre-100 hover:bg-amber-100 border-ochre-200 hover:border-amber-300 text-ink-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-500">视图</span>
              <div className="flex bg-ochre-100 rounded-lg p-0.5 border border-ochre-300">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200 ${viewMode === 'list' ? 'bg-amber-500 text-ink-700 shadow-yao-xs' : 'text-ink-700 hover:bg-amber-100'}`}
                  aria-label="列表视图"
                  aria-pressed={viewMode === 'list'}
                >
                  <List className="w-3.5 h-3.5" />
                  列表
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200 ${viewMode === 'grid' ? 'bg-amber-500 text-ink-700 shadow-yao-xs' : 'text-ink-700 hover:bg-amber-100'}`}
                  aria-label="网格视图"
                  aria-pressed={viewMode === 'grid'}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  网格
                </button>
              </div>
            </div>
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

          {/* ===== 底部状态栏 ===== */}
          <div className="px-4 py-2 border-t border-ochre-300 bg-ochre-100/70 backdrop-blur-sm text-center text-xs text-ink-600">
            {sortMode === 'alphabet' ? '按英文学名首字母排序' : '按草药所属省份分布排序'}
            {totalCount > 0 && ` · 共 ${totalCount} 种`}
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
      className={`relative overflow-hidden bg-gradient-to-br from-ochre-200 to-ochre-100 flex-shrink-0 ring-1 ring-ochre-300 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {(!loaded || errored) && !fallbackUrl && (
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
>>>>>>> 3f57f56 (feat: 省份瑶医瑶药深度资料 + 流式面板布局 + 统一 Logo 组件)
};