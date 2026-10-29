import React, { useState, useEffect } from 'react';
import { X, Loader2, ZoomIn } from 'lucide-react';

interface InteractiveImageProps {
  src: string;
  alt: string;
  className?: string;
  thumbnailSize?: 'sm' | 'md' | 'lg';
  hoverScale?: number;
  popupMaxWidth?: string;
  popupMaxHeight?: string;
}

const thumbnailSizes = {
  sm: { width: '64px', height: '64px' },
  md: { width: '80px', height: '80px' },
  lg: { width: '96px', height: '96px' }
};

const InteractiveImage: React.FC<InteractiveImageProps> = ({
  src,
  alt,
  className = '',
  thumbnailSize = 'md',
  hoverScale = 1.3,
  popupMaxWidth = '80vw',
  popupMaxHeight = '85vh'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  // ✅ 修复：在 effect 卸载时清理预加载 Image 对象的回调，避免组件卸载后触发 setState
  // （可能导致 "Can't perform a React state update on an unmounted component" 警告）
  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setIsLoading(false);
      setImageLoaded(true);
    };
    img.onerror = () => {
      setIsLoading(false);
    };
    // 卸载时清空回调，避免延迟事件触发已卸载组件的状态更新
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  useEffect(() => {
    if (isPopupOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isPopupOpen]);

  const handleThumbnailClick = () => {
    if (imageLoaded) {
      setIsPopupOpen(true);
    }
  };

  const handlePopupClose = () => {
    setIsPopupOpen(false);
  };

  const handlePopupBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handlePopupClose();
    }
  };

  const size = thumbnailSizes[thumbnailSize];

  return (
    <>
      <div
        className={`relative cursor-pointer overflow-hidden rounded-lg bg-gray-100 transition-all duration-300 ${className}`}
        style={{
          width: size.width,
          height: size.height
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleThumbnailClick}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        )}
        
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-300 ease-out"
          style={{
            transform: isHovered ? `scale(${hoverScale})` : 'scale(1)',
            opacity: isLoading ? 0 : 1
          }}
          loading="lazy"
        />
        
        <div 
          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <ZoomIn className="w-6 h-6 text-white" />
        </div>
        
        {imageLoaded && !isLoading && (
          <div 
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 transition-opacity duration-300 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="text-xs text-white font-medium truncate">{alt}</span>
          </div>
        )}
      </div>

      {isPopupOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/80 z-[20000] flex items-center justify-center p-4 transition-opacity duration-300"
            onClick={handlePopupBackdropClick}
          >
            <div
              className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-[80vw] max-h-[85vh] transition-transform duration-300"
              style={{
                maxWidth: popupMaxWidth,
                maxHeight: popupMaxHeight,
                animation: 'scaleIn 0.3s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handlePopupClose}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full shadow-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              <div className="relative min-w-[200px] min-h-[200px]">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
                  </div>
                )}
                
                <img
                  src={src}
                  alt={alt}
                  className="max-w-full max-h-[85vh] object-contain"
                  style={{
                    opacity: isLoading ? 0 : 1,
                    transition: 'opacity 0.3s ease'
                  }}
                />
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <h3 className="text-xl font-serif font-bold text-white">{alt}</h3>
                <p className="text-sm text-white/70 mt-1">点击图片或空白区域关闭</p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default InteractiveImage;