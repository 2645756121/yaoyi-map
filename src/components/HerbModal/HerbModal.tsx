import React, { useState, useEffect } from 'react';
import { useMapStore } from '../../store/mapStore';
import { getTherapyById, getRegionById } from '../../data/mockData';
import { X, Pill, Heart, AlertCircle, ChevronRight, MapPin, ChevronDown, ZoomIn, Loader2 } from 'lucide-react';

const HerbModal: React.FC = () => {
  const { selectedHerb, isHerbModalOpen, closeHerbModal, setSelectedTherapy, openTherapyModal } = useMapStore();

  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    efficacy: true,
    usage: false,
    botanical: false,
    yaoHistory: false,
    ingredients: false,
    basicInfo: false,
    distribution: false,
    pharmacology: false,
    relatedTherapies: false,
  });

  const [isImagePopupOpen, setIsImagePopupOpen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    if (isImagePopupOpen && selectedHerb) {
      document.body.style.overflow = 'hidden';
      setIsImageLoading(true);
      const img = new Image();
      img.src = selectedHerb.image;
      img.onload = () => setIsImageLoading(false);
      img.onerror = () => setIsImageLoading(false);
      // ✅ 修复：卸载时清理 Image 回调，避免组件卸载后触发 setState 警告
      return () => {
        document.body.style.overflow = '';
        img.onload = null;
        img.onerror = null;
      };
    } else {
      document.body.style.overflow = '';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isImagePopupOpen, selectedHerb]);

  const handleImagePopupClose = () => {
    setIsImagePopupOpen(false);
  };

  const handleImagePopupBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleImagePopupClose();
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!selectedHerb) return null;

  const relatedTherapies = selectedHerb.therapyIds.map((id) => getTherapyById(id)).filter(Boolean);
  const region = getRegionById(selectedHerb.regionId);

  const handleTherapyClick = (therapyId: string) => {
    const therapy = getTherapyById(therapyId);
    if (therapy) {
      setSelectedTherapy(therapy);
      openTherapyModal();
    }
  };

  const SectionHeader = (props: {
    icon: React.ReactNode;
    title: string;
    section: string;
    count?: number;
  }) => (
    <div
      className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
      onClick={() => toggleSection(props.section)}
    >
      <div className="flex items-center gap-3">
        {props.icon}
        <h3 className="font-serif font-semibold text-gray-900 text-lg">{props.title}</h3>
        {props.count !== undefined && (
          <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full">
            {props.count}项
          </span>
        )}
      </div>
      <ChevronDown
        className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${
          expandedSections[props.section] ? 'rotate-180' : ''
        }`}
      />
    </div>
  );

  // 弹窗内容（图片 + 可滚动面板）
  const modalContent = (
    <div
      className={`modal-layer transition-all duration-300 ${
        isHerbModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={closeHerbModal}
    >
      <div
        className={`info-panel-wrapper frosted-panel transform transition-all duration-300 ${
          isHerbModalOpen ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="关闭"
          onClick={closeHerbModal}
          className="btn-yao-icon absolute top-4 right-4 z-10 w-9 h-9 shadow-card hover:bg-primary-50 text-ink-700 hover:text-primary-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/*
          ✅ 单列流式布局（v2）：
             - 图片作为 .herb-modal-body-scroll 滚动容器的第一个子元素
             - 用户滚动时图片自然随滚动条移动（不再独立固定置顶）
             - 保留 max-h-[300px] 高度限制
        */}
        <div className="herb-modal-body modal-body-scroll overflow-y-auto">
          <div
            className="herb-modal-image relative overflow-hidden rounded-t-2xl cursor-zoom-in hover:brightness-95 transition-all duration-300"
            onClick={() => setIsImagePopupOpen(true)}
            style={{ aspectRatio: '16 / 9', maxHeight: '300px' }}
          >
            <img
              src={selectedHerb.image}
              alt={selectedHerb.name}
              className="w-full h-full object-cover herb-image-large"
              loading="lazy"
              style={{ aspectRatio: '16 / 9' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-4 text-white">
              <h2 className="text-2xl font-serif font-bold">{selectedHerb.name}</h2>
              <p className="text-sm opacity-80 italic">{selectedHerb.nameEn}</p>
              {selectedHerb.nameYao && (
                <p className="text-xs opacity-70 mt-1">
                  <span className="bg-white/20 px-2 py-0.5 rounded">瑶语：{selectedHerb.nameYao}</span>
                </p>
              )}
            </div>
            <div className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full p-2 transition-colors">
              <ZoomIn className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="bg-green-50 rounded-xl p-5">
              <div className="flex flex-wrap items-center gap-2 mb-4 justify-center">
                <span className="text-sm px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                  {selectedHerb.taste}
                </span>
                <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                  {selectedHerb.medicinalPart}
                </span>
                <span className="text-sm px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-medium flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {region?.name || selectedHerb.regionId}
                </span>
              </div>
              <div className="text-center">
                <span className="text-sm text-gray-600 italic">{selectedHerb.scientificName}</span>
              </div>
            </div>

            <div className="space-y-3">
              <SectionHeader
                icon={<Heart className="w-5 h-5 text-rose-600" />}
                title="一、功效主治"
                section="efficacy"
              />
              {expandedSections.efficacy && (
                <div className="bg-rose-50 rounded-xl p-5 ml-4 animate-fadeIn">
                  <p className="text-gray-700 text-base leading-relaxed text-indent">
                    {selectedHerb.efficacy}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionHeader
                icon={<Pill className="w-5 h-5 text-blue-600" />}
                title="二、用法用量"
                section="usage"
              />
              {expandedSections.usage && (
                <div className="bg-blue-50 rounded-xl p-5 ml-4 animate-fadeIn">
                  <p className="text-gray-700 text-base leading-relaxed text-indent">
                    {selectedHerb.usage}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionHeader
                icon={<AlertCircle className="w-5 h-5 text-emerald-600" />}
                title="三、植物学特征"
                section="botanical"
              />
              {expandedSections.botanical && (
                <div className="bg-emerald-50 rounded-xl p-5 ml-4 animate-fadeIn">
                  <p className="text-gray-700 text-base leading-relaxed text-indent">
                    {selectedHerb.botanicalFeatures || '该草药为多年生草本植物，具有独特的药理活性成分。'}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionHeader
                icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
                title="四、瑶医应用历史"
                section="yaoHistory"
              />
              {expandedSections.yaoHistory && (
                <div className="bg-amber-50 rounded-xl p-5 ml-4 animate-fadeIn">
                  <p className="text-gray-700 text-base leading-relaxed text-indent">
                    {selectedHerb.yaoMedicineHistory || '瑶族世代相传，临床应用历史悠久。'}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionHeader
                icon={<AlertCircle className="w-5 h-5 text-indigo-600" />}
                title="五、主要药用成分"
                section="ingredients"
              />
              {expandedSections.ingredients && (
                <div className="bg-indigo-50 rounded-xl p-5 ml-4 animate-fadeIn">
                  <p className="text-gray-700 text-base leading-relaxed text-indent">
                    {selectedHerb.activeIngredients || '含有多种生物活性成分，具有显著药理作用。'}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionHeader
                icon={<MapPin className="w-5 h-5 text-purple-600" />}
                title="六、采集与分布"
                section="distribution"
              />
              {expandedSections.distribution && (
                <div className="bg-purple-50 rounded-xl p-5 ml-4 animate-fadeIn">
                  <p className="text-gray-700 text-base leading-relaxed text-indent">
                    {selectedHerb.distributionArea}
                  </p>
                  <p className="text-gray-700 text-base leading-relaxed text-indent mt-2">
                    采集季节：{selectedHerb.collectionSeason}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionHeader
                icon={<AlertCircle className="w-5 h-5 text-teal-600" />}
                title="七、现代药理学研究"
                section="pharmacology"
              />
              {expandedSections.pharmacology && (
                <div className="bg-teal-50 rounded-xl p-5 ml-4 animate-fadeIn">
                  <p className="text-gray-700 text-base leading-relaxed text-indent">
                    {selectedHerb.modernPharmacology}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <SectionHeader
                icon={<Heart className="w-5 h-5 text-emerald-600" />}
                title="八、关联瑶医技法"
                section="relatedTherapies"
                count={relatedTherapies.length}
              />
              {expandedSections.relatedTherapies && (
                <div className="bg-emerald-50 rounded-xl p-3 ml-4 animate-fadeIn space-y-2">
                  {relatedTherapies.map((therapy) => (
                    <div
                      key={therapy!.id}
                      onClick={() => handleTherapyClick(therapy!.id)}
                      className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-emerald-100 cursor-pointer transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-emerald-200 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {therapy!.name}
                        </h4>
                        <p className="text-sm text-gray-600">{therapy!.system}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-amber-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2 justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h3 className="font-serif font-semibold text-gray-800">温馨提示</h3>
              </div>
              <p className="text-sm text-gray-600 text-indent">
                以上信息仅供参考，不能替代专业医生的诊断和治疗。使用中草药前，请咨询专业中医师或瑶医的建议。
              </p>
            </div>

            <button
              onClick={closeHerbModal}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 图片放大预览弹窗
  const imagePopup = isImagePopupOpen ? (
    <div
      className="fixed inset-0 bg-black/90 z-[30000] flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={handleImagePopupBackdropClick}
    >
      <div
        className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-[90vw] max-h-[90vh]"
        style={{ animation: 'scaleIn 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleImagePopupClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full shadow-lg transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="relative min-w-[200px] min-h-[200px]">
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
            </div>
          )}

          <img
            src={selectedHerb.image}
            alt={selectedHerb.name}
            className="max-w-full max-h-[90vh] object-contain"
            style={{
              opacity: isImageLoading ? 0 : 1,
              transition: 'opacity 0.3s ease',
            }}
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <h3 className="text-xl font-serif font-bold text-white">{selectedHerb.name}</h3>
          <p className="text-sm text-white/70 mt-1">点击图片或空白区域关闭</p>
        </div>
      </div>
    </div>
  ) : null;

  // ✅ 使用 div 包裹而非 Fragment（避免某些场景的 TS 解析问题）
  return (
    <div>
      {modalContent}
      {imagePopup}
    </div>
  );
};

export default HerbModal;