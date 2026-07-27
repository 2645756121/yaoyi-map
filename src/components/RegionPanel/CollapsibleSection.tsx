import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * 列表项最小契约：必须有 id，且支持通过 nameProp/descProp 指定的字符串属性
 */
interface CollapsibleItem {
  id: string;
  [key: string]: unknown;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  defaultExpanded?: boolean;
  children?: React.ReactNode;
  items?: CollapsibleItem[];
  onItemClick?: (id: string) => void;
  itemNameProp?: string;
  itemDescProp?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  count,
  defaultExpanded = true,
  children,
  items = [],
  onItemClick,
  itemNameProp = 'name',
  itemDescProp = 'description',
}) => {
  // 内部展开状态由 defaultExpanded 初始化，用户点击后完全由用户控制
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggle = () => {
    setIsExpanded((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  const renderItems = () => {
    if (!items || items.length === 0) return null;

    return (
      <div className="space-y-3">
        {items.map((item, index) => {
          const name = item[itemNameProp];
          const desc = item[itemDescProp];
          return (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 bg-white/80 rounded-xl cursor-pointer hover:bg-white hover:shadow-md transition-all duration-300 border border-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                if (onItemClick) {
                  onItemClick(item.id);
                }
              }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-700 font-semibold text-sm">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">{String(name ?? '')}</h4>
                {desc != null && (
                  <p className="text-sm text-gray-500 truncate mt-0.5">{String(desc)}</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="overflow-hidden mb-3">
      <div
        className="section-header-uniform"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center">
            {icon}
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-serif font-semibold text-gray-800">{title}</h3>
            {(count !== undefined || items.length > 0) && (
              <span className="text-xs text-gray-500 bg-white/70 px-2.5 py-0.5 rounded-full">
                {count !== undefined ? count : items.length}项
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-gray-600 transition-transform duration-300 ease-out ${isExpanded ? 'rotate-90' : ''} flex-shrink-0`}
          aria-hidden="true"
        />
      </div>

      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: isExpanded ? '2000px' : '0',
          opacity: isExpanded ? 1 : 0,
        }}
        aria-hidden={!isExpanded}
      >
        <div className="p-3 pt-0 text-left space-y-3">
          {children || renderItems()}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;