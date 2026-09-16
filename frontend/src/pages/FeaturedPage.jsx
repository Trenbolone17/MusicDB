import { useFeatured } from '../api/featured.js';
import QueryState from '../components/QueryState.jsx';
import RankedList from '../components/RankedList.jsx';
import Section from '../components/Section.jsx';
import { toRows } from '../lib/rows.js';
import useDocumentTitle from '../lib/useDocumentTitle.js';

const GROUPS = [
  ['tracks', 'Songs'],
  ['albums', 'Albums'],
  ['artists', 'Artists'],
];

export default function FeaturedPage() {
  useDocumentTitle('Featured');
  const featured = useFeatured();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Featured</h1>
      <p className="mt-2 text-sm text-muted">Hand-picked by the people who run Songboard.</p>

      <QueryState
        query={featured}
        loadingMessage="Loading featured picks…"
        isEmpty={(data) => GROUPS.every(([key]) => data[key].length === 0)}
        emptyMessage="Nothing has been featured yet."
      >
        {(data) =>
          GROUPS.filter(([key]) => data[key].length > 0).map(([key, title]) => (
            <Section key={key} title={title}>
              <RankedList rows={toRows(key, data[key])} />
            </Section>
          ))
        }
      </QueryState>
    </section>
  );
}
