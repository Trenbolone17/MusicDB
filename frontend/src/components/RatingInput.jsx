import { useState } from 'react';
import StarIcon from './StarIcon.jsx';

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Ten stars, filled up to the chosen rating and previewed on hover. Each star is a real
// button, so it works with the keyboard and with a screen reader.
export default function RatingInput({ value, onChange, disabled }) {
  const [preview, setPreview] = useState(null);
  const shown = preview ?? value ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-0.5" onMouseLeave={() => setPreview(null)}>
        {RATINGS.map((rating) => (
          <button
            key={rating}
            type="button"
            disabled={disabled}
            aria-label={`Rate ${rating} out of 10`}
            aria-pressed={value === rating}
            onMouseEnter={() => setPreview(rating)}
            onFocus={() => setPreview(rating)}
            onBlur={() => setPreview(null)}
            onClick={() => onChange(rating)}
            className="cursor-pointer p-0.5 disabled:cursor-not-allowed"
          >
            <StarIcon className={`size-6 ${rating <= shown ? 'text-accent' : 'text-line'}`} />
          </button>
        ))}
      </div>
      <span className="text-sm tabular-nums text-muted">{value ? `${value} / 10` : 'Not rated'}</span>
    </div>
  );
}
