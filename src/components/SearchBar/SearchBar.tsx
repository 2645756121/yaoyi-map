import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  searchAll,
  getHerbById,
  getTherapyById,
  getHistoryPeriodById,
  getRegionById,
} from '../../data/mockData';
import { useMapStore } from '../../store/mapStore';
import { Search, X, Leaf, Stethoscope, Clock, MapPin, ChevronDown } from 'lucide-react';
import { SearchResult } from '../../types';

type SearchType = 'all' | 'herb' | 'therapy' | 'history';

const TYPE_THEME: Record<SearchType | 'default', { chip: string; iconBg: string; chipText: string; iconColor: string }> = {
  all: { chip: 'bg-primary-50 text-primary-700', iconBg: 'bg-primary-100', chipText: 'text-primary-700', iconColor: 'text-primary-600' },
  herb: { chip: 'bg-emerald-50 text-emerald-700', iconBg: 'bg-emerald-100', chipText: 'text-emerald-700', iconColor: 'text-emerald-600' },
  therapy: { chip: 'bg-amber-50 text-amber-700', iconBg: 'bg-amber-100', chipText: 'text-amber-700', iconColor: 'text-amber-600' },
  history: { chip: 'bg-ochre-50 text-ochre-700', iconBg: 'bg-ochre-100', chipText: 'text-ochre-700', iconColor: 'text-ochre-600' },
  default: { chip: 'bg-ink-50 text-ink-700', iconBg: 'bg-ink-100', chipText: 'text-ink-700', iconColor: 'text-ink-500' },
};

const TYPE_LABEL: Record<SearchType | 'default', string> = {
  all: '全部',
  herb: '草药',
  therapy: '疗法',
  history: '历史',
  default: '全部',
};

const SearchBar: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    setSelectedHerb,
    openHerbModal,
    setSelectedTherapy,
    openTherapyModal,
    setSelectedHistoryPeriod,
    openHistoryModal,
    setSelectedRegion,
    openPanel,
  } = useMapStore();

  useEffect(() => {
    if (keyword.trim()) {
      const searchResults = searchAll(keyword);
      const filtered =
        searchType === 'all' ? searchResults : searchResults.filter((r) => r.type === searchType);
      setResults(filtered);
      setIsDropdownOpen(filtered.length > 0);
    } else {
      setResults([]);
      setIsDropdownOpen(false);
    }
    setActiveIndex(-1);
  }, [keyword, searchType]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsTypeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      setKeyword(result.name);
      setIsDropdownOpen(false);

      if (result.type === 'herb') {
        const herb = getHerbById(result.id);
        if (herb) {
          setSelectedHerb(herb);
          openHerbModal();
        }
      } else if (result.type === 'therapy') {
        const therapy = getTherapyById(result.id);
        if (therapy) {
          setSelectedTherapy(therapy);
          openTherapyModal();
        }
      } else if (result.type === 'history') {
        const history = getHistoryPeriodById(result.id);
        if (history) {
          setSelectedHistoryPeriod(history);
          openHistoryModal();
        }
      }

      const region = getRegionById(result.regionId);
      if (region) {
        setSelectedRegion(region);
        openPanel();
      }
    },
    [
      setSelectedHerb,
      openHerbModal,
      setSelectedTherapy,
      openTherapyModal,
      setSelectedHistoryPeriod,
      openHistoryModal,
      setSelectedRegion,
      openPanel,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isDropdownOpen || results.length === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          if (activeIndex >= 0) {
            handleResultClick(results[activeIndex]);
          }
          break;
        case 'Escape':
          setIsDropdownOpen(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen, results, activeIndex, handleResultClick]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'herb':
        return <Leaf className="w-4 h-4 text-primary-600" />;
      case 'therapy':
        return <Stethoscope className="w-4 h-4 text-amber-600" />;
      case 'history':
        return <Clock className="w-4 h-4 text-ochre-600" />;
      default:
        return <Search className="w-4 h-4 text-ink-400" />;
    }
  };

  const typeOptions: SearchType[] = ['all', 'herb', 'therapy', 'history'];
  const activeTypeTheme = TYPE_THEME[searchType];

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <div className="flex items-stretch gap-2 rounded-2xl bg-amber-50/95 p-1.5 shadow-card border border-amber-200/70 backdrop-blur-sm">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500"
          />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onFocus={() => keyword.trim() && results.length > 0 && setIsDropdownOpen(true)}
            aria-label="搜索草药、疗法或历史"
            placeholder="搜索草药、疗法或历史..."
            className="input-yao pl-9 pr-9 bg-white/95 border-transparent"
          />
          {keyword && (
            <button
              type="button"
              aria-label="清除搜索"
              onClick={() => {
                setKeyword('');
                setResults([]);
                setIsDropdownOpen(false);
              }}
              className="btn-yao-icon absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative flex-shrink-0">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isTypeMenuOpen}
            onClick={() => {
              setIsTypeMenuOpen((open) => !open);
              setIsDropdownOpen(false);
            }}
            className={`h-full px-3 input-yao flex items-center gap-1.5 justify-between cursor-pointer ${activeTypeTheme.chipText}`}
            style={{ minWidth: '6.5rem' }}
          >
            <span className="text-sm font-semibold">{TYPE_LABEL[searchType]}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isTypeMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isTypeMenuOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-32 bg-white/95 backdrop-blur-sm border border-primary-100 rounded-xl shadow-floating py-1.5 z-60 overflow-hidden animate-[yao-rise_0.18s_ease-out]"
              role="listbox"
            >
              {typeOptions.map((type) => {
                const theme = TYPE_THEME[type];
                const active = searchType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setSearchType(type);
                      setIsTypeMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                      active
                        ? `${theme.chip} font-semibold`
                        : 'text-ink-700 hover:bg-amber-50/60'
                    }`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-primary-600' : 'bg-ink-200'}`} />
                    {TYPE_LABEL[type]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isDropdownOpen && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-white/97 backdrop-blur-md border border-primary-100 rounded-2xl shadow-floating z-50 overflow-hidden max-h-80 overflow-y-auto"
          role="listbox"
        >
          <ul className="p-2 space-y-1">
            {results.map((result, index) => {
              const region = getRegionById(result.regionId);
              const theme = TYPE_THEME[result.type] ?? TYPE_THEME.default;
              const active = index === activeIndex;
              return (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    type="button"
                    onClick={() => handleResultClick(result)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                      active
                        ? 'bg-primary-50 border-primary-300 shadow-soft'
                        : 'bg-white/60 border-transparent hover:bg-amber-50/60 hover:border-amber-200'
                    }`}
                    role="option"
                    aria-selected={active}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme.iconBg}`}
                    >
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`text-sm font-semibold truncate ${active ? 'text-primary-700' : 'text-ink-800'}`}
                        >
                          {result.name}
                        </h4>
                        <span
                          className={`chip-yao ${theme.chip}`}
                          style={{ background: theme.chip.replace('text-', '').split(' ')[0] }}
                        >
                          {TYPE_LABEL[result.type]}
                        </span>
                      </div>
                      <p className="text-xs text-ink-500 truncate mt-0.5">{result.description}</p>
                    </div>
                    {region && (
                      <div className="flex items-center gap-1 text-xs text-ink-500 shrink-0">
                        <MapPin className="w-3 h-3" />
                        {region.name.substring(0, 4)}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isDropdownOpen && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-primary-100 rounded-2xl shadow-floating z-50 p-5 text-center">
          <Search className="w-8 h-8 text-ink-300 mx-auto mb-2" />
          <p className="text-sm text-ink-600 font-medium">未找到相关结果</p>
          <p className="text-xs text-ink-500 mt-1">请尝试其他关键词</p>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
