import { Herb } from '../../types';
import InteractiveImage from '../common/InteractiveImage';

interface HerbCardProps {
  herb: Herb;
  onClick: () => void;
}

/**
 * 草药卡片：展示草药图片、名称、归经、学名及功效摘要。
 *
 * 点击行为：
 * - 点击缩略图：仅放大图片（由 InteractiveImage 内部处理）
 * - 点击卡片其余区域：触发 onClick，打开草药详情弹窗
 *
 * 锚点：
 * - 渲染 `data-herb-anchor="${herb.id}"` 供 HerbCatalog 等其他组件做平滑滚动
 */
const HerbCard: React.FC<HerbCardProps> = ({ herb, onClick }) => {
  return (
    <div
      data-herb-anchor={herb.id}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="floating-card group flex items-center gap-4 p-4 cursor-pointer"
    >
      <InteractiveImage
        src={herb.image}
        alt={herb.name}
        thumbnailSize="md"
        hoverScale={1.4}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-serif font-semibold text-gray-800 group-hover:text-primary-700 transition-colors">
            {herb.name}
          </h4>
          <span className="text-xs text-gray-400 flex-shrink-0">{herb.meridian}</span>
        </div>

        <p className="text-xs text-gray-400 mt-1 italic">{herb.scientificName}</p>

        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{herb.efficacy}</p>
      </div>
    </div>
  );
};

export default HerbCard;