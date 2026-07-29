import React, { useState, useEffect } from 'react';
import { useMapStore } from '../../store/mapStore';
import { getHerbsByRegion, getTherapiesByRegion, getHistoryPeriodsByRegion } from '../../data/mockData';
import HerbCard from './HerbCard';
import CollapsibleSection from './CollapsibleSection';
import StarRating from './StarRating';
import { X, MapPin, Leaf, Clock, Stethoscope, TrendingUp, Sparkles, Calendar, ChevronLeft, Compass } from 'lucide-react';

// 鍏抽敭璇嶉珮浜鐞?const renderHighlightedText = (text: string, keywords: string[] = []): React.ReactNode => {
  if (keywords.length === 0) return text;
  const escapedKeywords = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'g');
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (keywords.includes(part)) {
      return (
        <span key={index} className="keyword">
          {part}
        </span>
      );
    }
    return part;
  });
};

// 甯歌鐟惰嵂鍏抽敭璇?const commonHerbKeywords = ['涓変竷', '澶╅夯', '鐏佃姖', '鏉滀徊', '榛勭簿', '鑼嫇', '閲戦摱鑺?, '鏉胯摑鏍?, '鍗婂', '褰撳綊'];

const RegionPanel: React.FC = () => {
  const { selectedRegion, isPanelOpen, closePanel, setSelectedHerb, openHerbModal, setSelectedTherapy, openTherapyModal, setSelectedHistoryPeriod, openHistoryModal } = useMapStore();

  const herbs = selectedRegion ? getHerbsByRegion(selectedRegion.id) : [];
  const therapies = selectedRegion ? getTherapiesByRegion(selectedRegion.id) : [];
  const historyPeriods = selectedRegion ? getHistoryPeriodsByRegion(selectedRegion.id) : [];

  // 鍗＄墖 staggered 鍔ㄧ敾寤惰繜
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (selectedRegion) {
      setAnimationKey(prev => prev + 1);
    }
  }, [selectedRegion]);

  const handleHerbClick = (herbId: string) => {
    const herb = herbs.find(h => h.id === herbId);
    if (herb) {
      closePanel();
      setSelectedHerb(herb);
      openHerbModal();
    }
  };

  const handleTherapyClick = (therapyId: string) => {
    const therapy = therapies.find(t => t.id === therapyId);
    if (therapy) {
      closePanel();
      setSelectedTherapy(therapy);
      openTherapyModal();
    }
  };

  const handleHistoryClick = (historyId: string) => {
    const history = historyPeriods.find(h => h.id === historyId);
    if (history) {
      closePanel();
      setSelectedHistoryPeriod(history);
      openHistoryModal();
    }
  };

  // 绌虹姸鎬佺粍浠?  const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-yao-fade-in-up">
      <div className="relative w-28 h-28 mb-6">
        <div className="absolute inset-0 rounded-full bg-amber-200/60 animate-yao-pulse-glow" aria-hidden />
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-ochre-200 to-amber-100 flex items-center justify-center shadow-yao-md">
          <Compass className="w-12 h-12 text-amber-700 animate-yao-sway" />
        </div>
      </div>
      <h3 className="font-serif font-bold text-xl text-ink-800 mb-2">鎺㈢储鐟跺尰鍒嗗竷</h3>
      <p className="text-sm text-ink-600 mb-5 max-w-xs leading-relaxed">
        鐐瑰嚮鍦板浘涓婄殑缁胯壊鍖哄煙锛屼簡瑙ｅ悇鍦板尯鐨勭懚鍖荤壒鑹层€佽崏鑽祫婧愬拰鍘嗗彶娓婃簮
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {['骞胯タ', '骞夸笢', '婀栧崡', '浜戝崡', '璐靛窞', '姹熻タ', '娴峰崡', '閲嶅簡', '鍥涘窛'].map((region) => (
          <span
            key={region}
            className="px-3 py-1 rounded-full bg-ochre-100 text-ink-700 text-xs border border-ochre-300 hover:bg-amber-100 hover:border-amber-300 transition-all duration-200"
          >
            {region}
          </span>
        ))}
      </div>
    </div>
  );

  // 澶撮儴鍖哄煙
  const PanelHeader = ({ onClose }: { onClose?: () => void }) => (
    <div
      className="relative px-5 py-5 border-b border-ochre-300 overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, rgba(247, 234, 223, 0.95) 0%, rgba(212, 172, 106, 0.18) 50%, rgba(247, 234, 223, 0.95) 100%)',
      }}
    >
      {/* 椤堕儴鐞ョ弨鑹查珮鍏?*/}
      <span
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(212, 172, 106, 0.8), transparent)',
        }}
        aria-hidden
      />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          {/* 鐟舵棌鍥捐吘鍦嗗舰鍥炬爣 */}
          <div
            className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-yao-md transition-transform duration-300 hover:scale-105"
            style={{
              background:
                'linear-gradient(135deg, #D4AC6A 0%, #C09454 50%, #A87D40 100%)',
              boxShadow: '0 6px 18px -4px rgba(212, 172, 106, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
            }}
          >
            <svg
              className="w-8 h-8 text-ink-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="6" r="2" />
              <path d="M8 10 Q12 8 16 10" />
              <path d="M6 14 Q12 11 18 14" />
              <path d="M4 18 Q12 14 20 18" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif font-bold text-2xl text-ink-800 leading-tight">
              {selectedRegion!.name}
            </h2>
            <p className="text-sm text-ink-600 mt-0.5 font-light">
              {selectedRegion!.nameEn}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-ochre-100 hover:bg-amber-100 border border-ochre-200 hover:border-amber-300 text-ink-700 hover:text-amber-900 transition-all duration-200 hover:rotate-90"
            aria-label="鍏抽棴闈㈡澘"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-5 mb-1 flex-wrap">
        <div className="flex items-center gap-2 text-amber-700 text-sm">
          <MapPin className="w-4 h-4" />
          <span>{selectedRegion!.location}</span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full shadow-yao-xs"
            style={{ backgroundColor: selectedRegion!.color }}
          />
          <span className="text-sm text-ink-600">鍒嗗竷瀵嗗害锛?/span>
          <StarRating rating={selectedRegion!.density} />
        </div>
      </div>
    </div>
  );

  // 绠€浠嬫枃鏈尯鍩?  const DescriptionSection = () => (
    <div className="px-6 py-4 bg-ochre-50/60 backdrop-blur-sm border-b border-ochre-200">
      <p
        className="text-ink-700 text-base text-indent"
        style={{ lineHeight: '1.8' }}
      >
        {renderHighlightedText(selectedRegion!.description, commonHerbKeywords)}
      </p>
    </div>
  );

  // 鍐呭鍖哄煙
  const PanelContent = () => (
    <div
      key={animationKey}
      className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 region-panel-scroll"
    >
      {/* 鍘嗗彶娓婃簮 */}
      <div
        className="animate-yao-card-up"
        style={{ animationDelay: '0.08s' }}
      >
        <CollapsibleSection
          title="鍘嗗彶娓婃簮"
          icon={<Clock className="w-5 h-5 text-amber-700" />}
          count={historyPeriods.length}
          defaultExpanded={false}
        >
          <p className="text-ink-700 text-base text-indent" style={{ lineHeight: '1.8', marginBottom: '16px' }}>
            {selectedRegion!.history}
          </p>
          <div className="flex flex-wrap gap-2">
            {historyPeriods.map((period) => (
              <button
                key={period.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleHistoryClick(period.id);
                }}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 hover:shadow-yao-xs"
              >
                <Calendar className="w-4 h-4" />
                {period.periodName}
              </button>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* 鐗硅壊鐤楁硶 */}
      <div
        className="animate-yao-card-up"
        style={{ animationDelay: '0.18s' }}
      >
        <CollapsibleSection
          title="鐗硅壊鐤楁硶"
          icon={<Stethoscope className="w-5 h-5 text-primary-700" />}
          count={therapies.length}
          defaultExpanded={false}
        >
          <div className="space-y-2">
            {therapies.map((therapy) => (
              <button
                key={therapy.id}
                onClick={() => handleTherapyClick(therapy.id)}
                className="w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200 text-left group border border-ochre-200 hover:border-amber-400 hover:shadow-yao-sm bg-ochre-50 hover:bg-amber-50"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-200 text-amber-700 group-hover:scale-110 transition-all duration-200">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-ink-800 group-hover:text-amber-700 text-base">{therapy.name}</h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 border border-primary-200">
                      {therapy.system}
                    </span>
                    <span className="text-xs text-ink-500">
                      {therapy.applicableConditions.length} 涓€傜敤鐥呯棁
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* 甯哥敤鑽潗 */}
      <div
        className="animate-yao-card-up"
        style={{ animationDelay: '0.28s' }}
      >
        <CollapsibleSection
          title="甯哥敤鑽潗"
          icon={<Leaf className="w-5 h-5 text-primary-700" />}
          count={herbs.length}
          defaultExpanded={false}
        >
          <div className="space-y-2">
            {herbs.map((herb) => (
              <div
                key={herb.id}
                className="cursor-pointer"
                onClick={() => handleHerbClick(herb.id)}
              >
                <HerbCard
                  herb={herb}
                  onClick={() => handleHerbClick(herb.id)}
                />
              </div>
            ))}
          </div>

          {herbs.length === 0 && (
            <div className="text-center py-8">
              <Leaf className="w-12 h-12 text-ink-300 mx-auto mb-3" />
              <p className="text-ink-400 text-sm">鏆傛棤鑽夎嵂鏁版嵁</p>
            </div>
          )}
        </CollapsibleSection>
      </div>

      {/* 鐜颁唬鍙戝睍 */}
      <div
        className="animate-yao-card-up"
        style={{ animationDelay: '0.38s' }}
      >
        <CollapsibleSection
          title="鐜颁唬鍙戝睍"
          icon={<TrendingUp className="w-5 h-5 text-amber-700" />}
        >
          <p className="text-ink-700 text-base text-indent" style={{ lineHeight: '1.8' }}>
            {selectedRegion!.modernDevelopment}
          </p>
        </CollapsibleSection>
      </div>
    </div>
  );

  // 搴曢儴鎸夐挳
  const PanelFooter = () => (
    <div className="p-4 border-t border-ochre-300 bg-ochre-100/70 backdrop-blur-sm">
      <button
        onClick={closePanel}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-ink-700 rounded-xl shadow-yao-md hover:shadow-yao-lg transition-all duration-200 hover:from-amber-400 hover:to-amber-500 font-semibold active:translate-y-0.5"
      >
        <ChevronLeft className="w-5 h-5" />
        杩斿洖鍦板浘鎺㈢储
      </button>
    </div>
  );

  return (
    <>
      <div
        className={`modal-layer transition-all duration-300 ease-yao-soft ${
          isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closePanel}
      >
        <div
          className={`info-panel-wrapper frosted-panel transform transition-all duration-450 ease-yao-soft ${
            isPanelOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {!selectedRegion ? (
            <>
              <EmptyState />
              <div className="px-4 py-3 border-t border-ochre-300 bg-ochre-100/60 backdrop-blur-sm text-center">
                <span className="text-xs text-ink-500">鐐瑰嚮鍦板浘鎺㈢储</span>
              </div>
            </>
          ) : (
            <>
              <PanelHeader onClose={closePanel} />
              <DescriptionSection />
              <PanelContent />
              <PanelFooter />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default RegionPanel;