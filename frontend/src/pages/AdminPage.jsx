import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useFeature, useFeatured, useUnfeature } from '../api/featured.js';
import { useSearch } from '../api/search.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import QueryState from '../components/QueryState.jsx';
import SearchIcon from '../components/SearchIcon.jsx';
import Section from '../components/Section.jsx';
import { ROW_BUILDERS } from '../lib/rows.js';
import useDocumentTitle from '../lib/useDocumentTitle.js';

const TYPING_PAUSE_MS = 300;

// Catalog type key -> what the admin API calls it.
const GROUPS = [
  ['tracks', 'Songs', 'track'],
  ['albums', 'Albums', 'album'],
  ['artists', 'Artists', 'artist'],
];

// The minimal admin tool: search for something, then feature or unfeature it.
export default function AdminPage() {
  useDocumentTitle('Admin');
  const { status, user } = useAuth();

  if (status === 'loading') return null;
  if (!user?.isAdmin) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-muted">This page is for admins only.</p>
      </section>
    );
  }
  return <AdminTools />;
}

function AdminTools() {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const featured = useFeatured();
  const results = useSearch(q, 'all', 1);
  const feature = useFeature();
  const unfeature = useUnfeature();
  const error = feature.error || unfeature.error;

  // "tracks:12" -> the featured item's id, for the Unfeature button on search results.
  const featuredIds = new Map();
  for (const [key] of GROUPS) {
    for (const item of featured.data?.[key] ?? []) featuredIds.set(`${key}:${item.id}`, item.featuredId);
  }

  function ItemRow({ typeKey, apiType, item }) {
    const row = ROW_BUILDERS[typeKey](item);
    const featuredId = featuredIds.get(`${typeKey}:${item.id}`);
    const busy = feature.isPending || unfeature.isPending;
    return (
      <li className="flex items-center gap-3 py-2 text-sm">
        <div className="min-w-0 flex-1">
          <Link to={row.href} className="block truncate hover:text-accent">
            {row.title}
          </Link>
          {row.subtitle && <p className="truncate text-xs text-muted">{row.subtitle}</p>}
        </div>
        {featuredId ? (
          <button type="button" disabled={busy} onClick={() => unfeature.mutate(featuredId)} className="cursor-pointer text-danger hover:underline disabled:opacity-50">
            Unfeature
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => feature.mutate({ type: apiType, id: item.id })} className="cursor-pointer text-accent hover:underline disabled:opacity-50">
            Feature
          </button>
        )}
      </li>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-2 text-sm text-muted">Search for something to feature it on the home page.</p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.message}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 border-b border-line focus-within:border-accent">
        <SearchIcon className="size-4 shrink-0 text-muted" />
        <input
          type="search"
          autoFocus
          autoComplete="off"
          placeholder="Artists, albums, songs"
          aria-label="Search the catalog"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="w-full bg-transparent py-2 outline-none placeholder:text-muted"
        />
      </div>

      {q && (
        <QueryState
          query={results}
          loadingMessage="Searching…"
          isEmpty={(data) => GROUPS.every(([key]) => data[key].items.length === 0)}
          emptyMessage={`Nothing matches “${q}”.`}
        >
          {(data) =>
            GROUPS.filter(([key]) => data[key].items.length > 0).map(([key, title, apiType], index) => (
              <Section key={key} title={title} divider={index > 0}>
                <ul className="divide-y divide-line">
                  {data[key].items.map((item) => (
                    <ItemRow key={item.id} typeKey={key} apiType={apiType} item={item} />
                  ))}
                </ul>
              </Section>
            ))
          }
        </QueryState>
      )}

      <Section title="Currently featured">
        <QueryState
          query={featured}
          loadingMessage="Loading…"
          isEmpty={(data) => GROUPS.every(([key]) => data[key].length === 0)}
          emptyMessage="Nothing is featured yet."
        >
          {(data) =>
            GROUPS.filter(([key]) => data[key].length > 0).map(([key, title, apiType]) => (
              <div key={key} className="mb-4 last:mb-0">
                <h3 className="text-xs tracking-wide text-muted uppercase">{title}</h3>
                <ul className="divide-y divide-line">
                  {data[key].map((item) => (
                    <ItemRow key={item.id} typeKey={key} apiType={apiType} item={item} />
                  ))}
                </ul>
              </div>
            ))
          }
        </QueryState>
      </Section>
    </section>
  );
}
