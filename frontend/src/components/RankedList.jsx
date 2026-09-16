import { Link } from 'react-router';
import { pluralize } from '../lib/format.js';
import Cover from './Cover.jsx';
import { InlineRating } from './Rating.jsx';

// Numbered rows for a chart. Each row: { rank, href, image, imageAlt, title, subtitle,
// ratingAverage, ratingCount }.
export default function RankedList({ rows }) {
  return (
    <ol className="divide-y divide-line">
      {rows.map((row) => (
        <li key={row.href} className="flex items-center gap-3 py-2 text-sm">
          <span className="w-7 shrink-0 text-right tabular-nums text-muted">{row.rank}</span>
          <Cover src={row.image} alt={row.imageAlt ?? ''} placeholder="" className="w-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <Link to={row.href} className="block truncate font-medium hover:text-accent" title={row.title}>
              {row.title}
            </Link>
            {row.subtitle && <p className="truncate text-xs text-muted">{row.subtitle}</p>}
          </div>
          <div className="shrink-0 text-right">
            <InlineRating average={row.ratingAverage} count={row.ratingCount} />
            <p className="text-xs text-muted">{pluralize(row.ratingCount, 'rating')}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
