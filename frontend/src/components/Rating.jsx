import { formatRating, pluralize } from '../lib/format.js';
import StarIcon from './StarIcon.jsx';

// Rating line for detail pages: "★ 8.4 / 10 · 1,203 ratings".
export function RatingSummary({ average, count }) {
  if (!count) return <p className="text-sm text-muted">No ratings yet</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <StarIcon className="size-5" />
      <span className="text-xl font-semibold tabular-nums">{formatRating(average)}</span>
      <span className="text-sm text-muted">/ 10 · {pluralize(count, 'rating')}</span>
    </p>
  );
}

// Compact average for list rows: "★ 8.4", or a muted dash when there are no ratings.
export function InlineRating({ average, count }) {
  if (!count) {
    return (
      <span className="text-muted" aria-label="No ratings">
        –
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" aria-label={`Rated ${formatRating(average)} out of 10`}>
      <StarIcon className="size-3.5" />
      {formatRating(average)}
    </span>
  );
}

// One person's whole-number rating, as shown on their review.
export function RatingValue({ rating }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm tabular-nums" aria-label={`Rated ${rating} out of 10`}>
      <StarIcon className="size-3.5" />
      {rating}
    </span>
  );
}
