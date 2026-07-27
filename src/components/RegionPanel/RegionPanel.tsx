import React, { useState, useEffect } from 'react';
import { useMapStore } from '../../store/mapStore';
import { getHerbsByRegion, getTherapiesByRegion, getHistoryPeriodsByRegion } from '../../data/mockData';
import HerbCard from './HerbCard';
import CollapsibleSection from './CollapsibleSection';
import StarRating from './StarRating';
import { X, MapPin, Leaf, Clock, Stethoscope, TrendingUp, Sparkles, Calendar, ChevronLeft } from 'lucide-react';

// 关键词高亮处理
const renderHighlightedText = (text: string, keywords: string[] = []): React.ReactNode => {
  if (keywords.length === 0) return text;
  
  // 构建正则表达式
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

// 常见瑶药关键词
const commonHerbKeywords = ['三七', '天麻', '灵芝', '杜仲', '黄精', '茯苓', '金银花', '板蓝根', '半夏', '当归'];

const RegionPanel: React.FC = () => {
  const { selectedRegion, isPanelOpen, closePanel, setSelectedHerb, openHerbModal, setSelectedTherapy, openTherapyModal, setSelectedHistoryPeriod, openHistoryModal } = useMapStore();
  
  const herbs = selectedRegion ? getHerbsByRegion(selectedRegion.id) : [];
  const therapies = selectedRegion ? getTherapiesByRegion(selectedRegion.id) : [];
  const historyPeriods = selectedRegion ? getHistoryPeriodsByRegion(selectedRegion.id) : [];
  
  // 卡片staggered动画延迟
  const [animationKey, setAnimationKey] = useState(0);
  
  useEffect(() => {
    if (selectedRegion) {
      setAnimationKey(prev => prev + 1);
    }
  }, [selectedRegion]);
  
  const handleHerbClick = (herbId: string) => {
    const herb = herbs.find(h => h.id === herbId);
    if (herb) {
      // 先关闭地区面板，再打开草药弹窗，避免两个面板叠加造成视觉重叠
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
  
  // 空状态组件
  const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center mb-8 shadow-md">
        <Leaf className="w-12 h-12 text-primary-600" />
      </div>
      <h3 className="text-2xl font-serif font-bold text-gray-800 mb-4">探索瑶医分布</h3>
      <p className="text-gray-500 text-base mb-6 max-w-sm">点击地图上的绿色区域，了解各地区的瑶医特色、草药资源和历史渊源</p>
      <div className="flex flex-wrap justify-center gap-2">
        {['广西', '广东', '湖南', '云南', '贵州', '江西', '海南', '重庆', '四川'].map((region) => (
          <span key={region} className="px-4 py-1.5 rounded-full bg-primary-50 text-primary-700 text-base">
            {region}
          </span>
        ))}
      </div>
    </div>
  );
  
  // 头部区域
  const PanelHeader = ({ onClose }: { onClose?: () => void }) => (
    <div 
      className="p-5 border-b border-white/40"
      style={{ backgroundColor: `${selectedRegion!.color}15` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          {/* 瑶族图腾图标 */}
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md"
            style={{ backgroundColor: selectedRegion!.color }}
          >
            <svg 
              className="w-8 h-8 text-white" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.8"
            >
              {/* 瑶族图腾 - 简化的盘王图腾 */}
              <circle cx="12" cy="6" r="2" />
              <path d="M8 10 Q12 8 16 10" />
              <path d="M6 14 Q12 11 18 14" />
              <path d="M4 18 Q12 14 20 18" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-serif font-bold text-gray-800">
              {selectedRegion!.name}
            </h2>
            <p className="text-base text-gray-500" style={{ fontSize: '0.9em' }}>
              {selectedRegion!.nameEn}
            </p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/60 transition-all duration-200"
          >
            <X className="w-7 h-7 text-gray-600" />
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-5 mb-1 flex-wrap">
        <div className="flex items-center gap-2 text-primary-600 text-base">
          <MapPin className="w-5 h-5" />
          <span>{selectedRegion!.location}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: selectedRegion!.color }}
          />
          <span className="text-base text-gray-500">分布密度：</span>
          <StarRating rating={selectedRegion!.density} />
        </div>
      </div>
    </div>
  );
  
  // 简介文本区域
  const DescriptionSection = () => (
    <div className="px-6 py-4 bg-white/40 backdrop-blur-sm border-b border-white/30">
      <p 
        className="text-gray-700 text-base text-indent"
        style={{ lineHeight: '1.8' }}
      >
        {renderHighlightedText(selectedRegion!.description, commonHerbKeywords)}
      </p>
    </div>
  );
  
  // 内容区域
  const PanelContent = () => (
    <div 
      key={animationKey}
      className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 region-panel-scroll"
    >
      {/* 历史渊源折叠面板 */}
      <div 
        className="animate-card-slide-up"
        style={{ animationDelay: '0.1s' }}
      >
        <CollapsibleSection
          title="历史渊源"
          icon={<Clock className="w-6 h-6 text-amber-600" />}
          count={historyPeriods.length}
          defaultExpanded={false}
        >
          <p className="text-gray-600 text-base text-indent" style={{ lineHeight: '1.8', marginBottom: '16px' }}>
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
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-md bg-amber-50 text-amber-700 hover:bg-amber-100"
              >
                <Calendar className="w-4 h-4" />
                {period.periodName}
              </button>
            ))}
          </div>
        </CollapsibleSection>
      </div>
      
      {/* 特色疗法折叠面板 */}
      <div 
        className="animate-card-slide-up"
        style={{ animationDelay: '0.3s' }}
      >
        <CollapsibleSection
          title="特色疗法"
          icon={<Stethoscope className="w-6 h-6 text-emerald-600" />}
          count={therapies.length}
          defaultExpanded={false}
        >
          <div className="space-y-3">
            {therapies.map((therapy) => (
              <button
                key={therapy.id}
                onClick={() => handleTherapyClick(therapy.id)}
                className="w-full flex items-center gap-4 p-4 rounded-lg transition-all duration-200 hover:shadow-md text-left group border border-transparent hover:border-gray-200"
                style={{ backgroundColor: `${selectedRegion!.color}05` }}
              >
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${selectedRegion!.color}20` }}
                >
                  <Sparkles className="w-6 h-6" style={{ color: selectedRegion!.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-800 group-hover:text-gray-900 text-lg">{therapy.name}</h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-500">
                      {therapy.system}
                    </span>
                    <span className="text-sm text-gray-400">
                      {therapy.applicableConditions.length}个适用病症
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      </div>
      
      {/* 常用药材折叠面板 */}
      <div 
        className="animate-card-slide-up"
        style={{ animationDelay: '0.5s' }}
      >
        <CollapsibleSection
          title="常用药材"
          icon={<Leaf className="w-5 h-5 text-green-600" />}
          count={herbs.length}
          defaultExpanded={false}
        >
          <div className="space-y-3">
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
              <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">暂无草药数据</p>
            </div>
          )}
        </CollapsibleSection>
      </div>
      
      {/* 现代发展折叠面板 */}
      <div 
        className="animate-card-slide-up"
        style={{ animationDelay: '0.7s' }}
      >
        <CollapsibleSection
          title="现代发展"
          icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
        >
          <p className="text-gray-600 text-base text-indent" style={{ lineHeight: '1.8' }}>
            {selectedRegion!.modernDevelopment}
          </p>
        </CollapsibleSection>
      </div>
    </div>
  );
  
  // 底部按钮
  const PanelFooter = () => (
    <div className="p-4 border-t border-white/40 bg-white/40 backdrop-blur-sm">
      <button
        onClick={closePanel}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 hover:shadow-lg text-base font-medium"
      >
        <ChevronLeft className="w-5 h-5" />
        返回地图探索
      </button>
    </div>
  );
  
  return (
    <>
      <div 
        className={`modal-layer transition-all duration-300 ease-out ${
          isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closePanel}
      >
        <div 
          className={`info-panel-wrapper frosted-panel transform transition-all duration-300 ease-out ${
            isPanelOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {!selectedRegion ? (
            <>
              <EmptyState />
              <div className="p-4 border-t border-gray-200 bg-white/40 backdrop-blur-sm">
                <div className="text-center text-xs text-gray-500">点击地图探索</div>
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