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

// 4 色体系主题：每种类型对应天然色系
const TYPE_THEME: Record<SearchType | 'default', {
  chip: string;
  iconBg: string;
  chipText: string;
  iconColor: string;
  ringColor: string;
}> = {
  all: {
    chip: 'bg-primary-100 text-primary-800 border-primary-300',
    iconBg: 'bg-primary-200',
    chipText: 'text-primary-800',
    iconColor: 'text-primary-700',
    ringColor: 'ring-primary-300',
  },
  herb: {
    chip: 'bg-primary-50 text-primary-700 border-primary-300',
    iconBg: 'bg-primary-100',
    chipText: 'text-primary-700',
    iconColor: 'text-primary-700',
    ringColor: 'ring-primary-300',
  },
  therapy: {
    chip: 'bg-amber-100 text-amber-900 border-amber-400',
    iconBg: 'bg-amber-200',
    chipText: 'text-amber-900',
    iconColor: 'text-amber-700',
    ringColor: 'ring-amber-300',
  },
  history: {
    chip: 'bg-ochre-100 text-ink-700 border-ochre-300',
    iconBg: 'bg-ochre-200',
    chipText: 'text-ink-700',
    iconColor: 'text-primary-700',
    ringColor: 'ring-ochre-300',
  },
  default: {
    chip: 'bg-ink-50 text-ink-700 border-ink-200',
    iconBg: 'bg-ink-100',
    chipText: 'text-ink-700',
    iconColor: 'text-ink-500',
    ringColor: 'ring-ink-200',
  },
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
  const inputRef = useRef<HTMLInputElement>(null);

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
        return <Leaf className="w-4 h-4 text-primary-700" />;
      case 'therapy':
        return <Stethoscope className="w-4 h-4 text-amber-700" />;
      case 'history':
        return <Clock className="w-4 h-4 text-ink-700" />;
      default:
        return <Search className="w-4 h-4 text-ink-500" />;
    }
  };

  const typeOptions: SearchType[] = ['all', 'herb', 'therapy', 'history'];
  const activeTypeTheme = TYPE_THEME[searchType];

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      {/* ===== 搜索栏外框：米色 + 蜜炙黄阴影 ===== */}
      <div className="flex items-stretch gap-1.5 rounded-2xl bg-ochre-100/95 p-1.5 shadow-yao-md border border-ochre-300/70 backdrop-blur-sm transition-all duration-200 focus-within:shadow-yao-lg focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-300/40">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600 transition-colors"
          />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onFocus={() => keyword.trim() && results.length > 0 && setIsDropdownOpen(true)}
            aria-label="搜索草药、疗法或历史"
            placeholder="搜索草药、疗法或历史..."
            className="input-yao pl-9 pr-9 bg-white/95 border-ochre-200 hover:border-amber-400 focus:border-amber-500 focus:bg-white focus:shadow-yao-sm"
          />
          {keyword && (
            <button
              type="button"
              aria-label="清除搜索"
              onClick={() => {
                setKeyword('');
                setResults([]);
                setIsDropdownOpen(false);
                inputRef.current?.focus();
              }}
              className="btn-yao-icon absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-ochre-100 hover:bg-amber-100 border-ochre-200 hover:border-amber-300 text-ink-700 hover:text-amber-900"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ===== 类型下拉选择 ===== */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isTypeMenuOpen}
            onClick={() => {
              setIsTypeMenuOpen((open) => !open);
              setIsDropdownOpen(false);
            }}
            className={`h-full px-3 input-yao flex items-center gap-1.5 justify-between cursor-pointer font-semibold ${activeTypeTheme.chipText} bg-white/95 border-ochre-200 hover:border-amber-400`}
            style={{ minWidth: '6.5rem' }}
          >
            <span className="text-sm">{TYPE_LABEL[searchType]}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${isTypeMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isTypeMenuOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-36 bg-ochre-50/98 backdrop-blur-md border border-ochre-300 rounded-xl shadow-yao-lg py-1.5 z-[100] overflow-visible animate-yao-rise"
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
                    className={`w-full px-3 py-2 text-left text-sm transition-all flex items-center gap-2 ${
                      active
                        ? `font-semibold ${theme.chip}`
                        : 'text-ink-700 hover:bg-ochre-100/70'
                    }`}
                  >
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full border-2 transition-all ${
                        active ? 'bg-amber-500 border-amber-700 scale-125' : 'border-ochre-300 bg-ochre-100'
                      }`}
                    />
                    {TYPE_LABEL[type]}
                    <span className="ml-auto text-[0.625rem] text-ink-500 font-normal">
                      {type === 'all' ? '4类' : '可筛选'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== 搜索结果下拉 ===== */}
      {isDropdownOpen && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-ochre-50/98 backdrop-blur-md border border-ochre-300 rounded-2xl shadow-yao-xl z-[100] overflow-hidden max-h-96 overflow-y-auto animate-yao-slide-up"
          role="listbox"
        >
          <div className="px-4 py-2 border-b border-ochre-200 bg-ochre-100/60 flex items-center justify-between text-xs text-ink-600">
            <span>共 <span className="font-semibold text-primary-700">{results.length}</span> 条结果</span>
            <span className="text-ink-500">↑↓ 选择 · Enter 确认 · Esc 关闭</span>
          </div>
          <ul className="p-2 space-y-1">
            {results.map((result, index) => {
              const region = getRegionById(result.regionId);
              const theme = TYPE_THEME[result.type] ?? TYPE_THEME.default;
              const active = index === activeIndex;
              return (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    onClick={() => handleResultClick(result)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                      active
                        ? 'bg-amber-50 border-amber-400 shadow-yao-sm'
                        : 'bg-white/70 border-transparent hover:bg-ochre-100/70 hover:border-amber-200'
                    }`}
                    role="option"
                    aria-selected={active}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                        active ? 'bg-amber-200 shadow-yao-xs' : theme.iconBg
                      }`}
                    >
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`text-sm font-semibold truncate ${
                            active ? 'text-amber-900' : 'text-ink-800'
                          }`}
                        >
                          {result.name}
                        </h4>
                        <span className={`chip-yao-outline`}>
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

      {/* ===== 空状态 ===== */}
      {isDropdownOpen && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-ochre-50 border border-ochre-300 rounded-2xl shadow-yao-xl z-[100] p-6 text-center animate-yao-rise">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
            <Search className="w-7 h-7 text-amber-600" />
          </div>
          <p className="text-sm font-medium text-ink-700">未找到相关结果</p>
          <p className="text-xs text-ink-500 mt-1">请尝试其他关键词</p>
        </div>
      )}
    </div>
  );
};

export default SearchBar;