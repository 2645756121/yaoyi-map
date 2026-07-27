import React, { useState, useEffect } from 'react';

const BackToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <div
      className={`back-to-top drum-button ${isVisible ? 'visible' : ''}`}
      onClick={scrollToTop}
      title="回到顶部"
    >
      {/* 瑶族铜鼓图标 */}
      <svg
        className="drum-icon w-7 h-7 text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 铜鼓顶部圆环 */}
        <circle cx="12" cy="5" r="3" />
        {/* 铜鼓鼓身 */}
        <path d="M5 8 Q5 6 7 6 L17 6 Q19 6 19 8 L19 18 Q19 20 17 20 L7 20 Q5 20 5 18 Z" />
        {/* 铜鼓纹饰 - 中心圆点 */}
        <circle cx="12" cy="13" r="1.5" fill="currentColor" />
        {/* 铜鼓纹饰 - 环线 */}
        <path d="M8 13 Q8 10 12 10 Q16 10 16 13" />
        <path d="M8 13 Q8 16 12 16 Q16 16 16 13" />
        {/* 顶部箭头表示回到顶部 */}
        <path d="M12 3 L12 1 M10 2 L12 0 L14 2" strokeWidth="2" />
      </svg>
    </div>
  );
};

export default BackToTop;