interface StarRatingProps {
  rating: number;
  maxRating?: number;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, maxRating = 5 }) => {
  const getRatingText = (score: number): string => {
    if (score >= 5) return '5分：强烈推荐';
    if (score >= 4.5) return '4.5分：非常推荐';
    if (score >= 4) return '4分：推荐';
    if (score >= 3) return '3分：一般';
    if (score >= 2) return '2分：较少';
    return '1分：稀少';
  };

  return (
    <div className="star-rating">
      {[...Array(maxRating)].map((_, i) => (
        <span
          key={i}
          className={`star ${i < rating ? '' : 'empty'}`}
        >
          {i < rating ? '★' : '☆'}
        </span>
      ))}
      <div className="star-tooltip">
        {rating}分：{getRatingText(rating).split('：')[1]}
      </div>
    </div>
  );
};

export default StarRating;