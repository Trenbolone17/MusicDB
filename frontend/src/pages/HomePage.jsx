import { Link } from 'react-router';
import { useHome } from '../api/featured.js';
import EmptyMessage from '../components/EmptyMessage.jsx';
import QueryState from '../components/QueryState.jsx';
import RankedList from '../components/RankedList.jsx';
import { toRows } from '../lib/rows.js';
import useDocumentTitle from '../lib/useDocumentTitle.js';

const TOP_LISTS = [
  ['tracks', 'Top Songs', '/top/songs'],
  ['albums', 'Top Albums', '/top/albums'],
  ['artists', 'Top Artists', '/top/artists'],
];

export default function HomePage() {
  // No page title: the tab just reads "Songboard" on the home page.
  useDocumentTitle(null);
  const home = useHome();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Songboard</h1>
      <p className="mt-2 text-muted">Rate and review songs, albums, and artists.</p>

      <QueryState query={home} loadingMessage="Loading…">
        {(data) => (
          <>
            <HomeSection title="Featured songs" href="/featured">
              {data.featured.tracks.length === 0 ? (
                <EmptyMessage>Nothing featured yet.</EmptyMessage>
              ) : (
                <RankedList rows={toRows('tracks', data.featured.tracks)} />
              )}
            </HomeSection>
            <HomeSection title="Featured artists" href="/featured">
              {data.featured.artists.length === 0 ? (
                <EmptyMessage>Nothing featured yet.</EmptyMessage>
              ) : (
                <RankedList rows={toRows('artists', data.featured.artists)} />
              )}
            </HomeSection>

            {TOP_LISTS.map(([key, title, href]) => (
              <HomeSection key={key} title={title} href={href}>
                {data.top[key].length === 0 ? (
                  <EmptyMessage>Nothing has been rated yet.</EmptyMessage>
                ) : (
                  <RankedList rows={toRows(key, data.top[key])} />
                )}
              </HomeSection>
            ))}
          </>
        )}
      </QueryState>
    </section>
  );
}

function HomeSection({ title, href, children }) {
  return (
    <section className="mt-10 border-t border-line pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link to={href} className="text-sm text-accent hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
