import { useSearchParams } from 'react-router';
import { useChart } from '../api/charts.js';
import Pagination from '../components/Pagination.jsx';
import QueryState from '../components/QueryState.jsx';
import RankedList from '../components/RankedList.jsx';
import useDocumentTitle from '../lib/useDocumentTitle.js';

// How each chart turns an API item into a list row.
const CHARTS = {
  tracks: {
    title: 'Top Songs',
    row: (item) => ({
      href: `/tracks/${item.id}`,
      image: item.album.coverUrl,
      imageAlt: `${item.album.title} cover`,
      title: item.title,
      subtitle: `${item.artist.name} · ${item.album.title}`,
    }),
  },
  albums: {
    title: 'Top Albums',
    row: (item) => ({
      href: `/albums/${item.id}`,
      image: item.coverUrl,
      imageAlt: `${item.title} cover`,
      title: item.title,
      subtitle: [item.artist.name, item.releaseYear].filter(Boolean).join(' · '),
    }),
  },
  artists: {
    title: 'Top Artists',
    row: (item) => ({ href: `/artists/${item.id}`, image: item.imageUrl, imageAlt: item.name, title: item.name }),
  },
};

const SORTS = [
  {
    value: 'top',
    label: 'Top',
    description: 'Ranked by a weighted average that favours items with more ratings.',
    empty: 'Nothing has been rated yet.',
  },
  {
    value: 'trending',
    label: 'Trending',
    description: 'Ratings from the last 90 days, with recent ones counting most.',
    empty: 'Nothing has been rated in the last 90 days.',
  },
];

export default function ChartPage({ type }) {
  const chart = CHARTS[type];
  useDocumentTitle(chart.title);

  // Sort and page live in the URL, so a chart position can be shared or bookmarked.
  const [params, setParams] = useSearchParams();
  const sort = params.get('sort') === 'trending' ? 'trending' : 'top';
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  const current = SORTS.find((option) => option.value === sort);
  const result = useChart(type, sort, page);

  // Only non-default values go in the URL; changing the sort starts back at page 1.
  const navigate = (nextSort, nextPage) =>
    setParams({ ...(nextSort !== 'top' && { sort: nextSort }), ...(nextPage > 1 && { page: String(nextPage) }) });

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold">{chart.title}</h1>
        <div role="group" aria-label="Sort" className="flex gap-4 text-sm">
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === sort}
              onClick={() => navigate(option.value, 1)}
              className={option.value === sort ? 'text-accent' : 'cursor-pointer text-muted hover:text-fg'}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">{current.description}</p>

      <div className="mt-6">
        <QueryState query={result} loadingMessage="Loading chart…" emptyMessage={current.empty}>
          {(data) => (
            <>
              <RankedList
                rows={data.items.map((item) => ({
                  rank: item.rank,
                  ratingAverage: item.ratingAverage,
                  ratingCount: item.ratingCount,
                  ...chart.row(item),
                }))}
              />
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(nextPage) => navigate(sort, nextPage)}
              />
            </>
          )}
        </QueryState>
      </div>
    </section>
  );
}
