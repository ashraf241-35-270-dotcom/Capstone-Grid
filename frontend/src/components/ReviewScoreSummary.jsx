function MarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.75h8.5L20 8.25v11A1.75 1.75 0 0 1 18.25 21h-11A1.75 1.75 0 0 1 5.5 19.25v-13A2.5 2.5 0 0 1 8 3.75Z" />
      <path d="M15 4v5h5M8.5 13h8M8.5 16.5h5" />
    </svg>
  );
}

function StarIcon({ filled }) {
  return (
    <svg className={filled ? 'rating-star rating-star-filled' : 'rating-star'} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2.8 2.84 5.75 6.35.92-4.6 4.48 1.09 6.33L12 17.29l-5.68 2.99 1.09-6.33-4.6-4.48 6.35-.92L12 2.8Z" />
    </svg>
  );
}

export default function ReviewScoreSummary({ marks, rating, compact = false }) {
  return (
    <section
      className={`review-scores${compact ? ' review-scores-compact' : ''}`}
      aria-label={`Mark ${marks} out of 100; rating ${rating} out of 5`}
    >
      <div className="review-score-card">
        <span className="review-score-icon"><MarkIcon /></span>
        <span className="review-score-label">Mark</span>
        <strong className="review-mark-value">
          {marks}<span>/100</span>
        </strong>
      </div>
      <div className="review-score-card review-rating-card">
        <span className="review-score-icon"><StarIcon filled /></span>
        <span className="review-score-label">Rating</span>
        <div className="review-rating-value">
          <span className="review-rating-stars" role="img" aria-label={`${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <StarIcon key={star} filled={star <= rating} />
            ))}
          </span>
          <strong>{rating}<span>/5</span></strong>
        </div>
      </div>
    </section>
  );
}
