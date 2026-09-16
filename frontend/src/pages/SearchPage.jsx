import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useSearch } from '../api/search.js';
import Pagination from '../components/Pagination.jsx';
import QueryState from '../components/QueryState.jsx';
import RankedList from '../components/RankedList.jsx';
import SearchIcon from '../components/SearchIcon.jsx';
import Section from '../components/Section.jsx';
import { pluralize } from '../lib/format.js';
import { toRows } from '../lib/rows.js';
import useDocumentTitle from '../lib/useDocumentTitle.js';

const TYPING_PAUSE_MS = 300;

const GROUPS = [
  { type: 'artists', title: 'Artists', noun: 'artist' },
  { type: 'albums', title: 'Albums', noun: 'album' },
  { type: 'tracks', title: 'Songs', noun: 'song' },
];

export default function SearchPage() {
  useDocumentTitle('Search');
  // The URL is the source of truth (?q=&type=&page=), so results can be shared and the back
  // button works. The input keeps its own text and updates the URL after a short pause.
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const type = GROUPS.some((group) => group.type === params.get('type')) ? params.get('type') : 'all';
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  const [text, setText] = useState(q);

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === q) return undefined;
    const timer = setTimeout(() => {
      setParams(trimmed ? { q: trimmed } : {}, { replace: true });
    }, TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text, q, setParams]);

  const results = useSearch(q, type, page);
  const group = GROUPS.find((each) => each.type === type);

  return (
    <section>
      <h1 className="text-2xl font-semibold">Search</h1>

      <form onSubmit={(event) => event.preventDefault()} className="mt-4">
        <label htmlFor="search-input" className="sr-only">
          Search artists, albums, and songs
        </label>
        <div className="flex items-center gap-2 border-b border-line focus-within:border-accent">
          <SearchIcon className="size-4 shrink-0 text-muted" />
          <input
            id="search-input"
            type="search"
            autoFocus
            autoComplete="off"
            placeholder="Artists, albums, songs"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full bg-transparent py-2 outline-none placeholder:text-muted"
          />
        </div>
      </form>

      {!q ? (
        <p className="mt-6 text-sm text-muted">Type a name or a title. Spelling doesn&apos;t have to be exact.</p>
      ) : group ? (
        <TypeResults q={q} group={group} results={results} onPageChange={(next) => setParams({ q, type, page: String(next) })} />
      ) : (
        <GroupedResults q={q} results={results} />
      )}
    </section>
  );
}

function GroupedResults({ q, results }) {
  return (
    <QueryState
      query={results}
      loadingMessage="Searching…"
      isEmpty={(data) => GROUPS.every((group) => data[group.type].items.length === 0)}
      emptyMessage={`Nothing matches “${q}”.`}
    >
      {(data) =>
        GROUPS.filter((group) => data[group.type].items.length > 0).map((group) => {
          const { items, total } = data[group.type];
          return (
            <Section key={group.type} title={group.title}>
              <RankedList rows={toRows(group.type, items)} />
              {total > items.length && (
                <Link to={`/search?q=${encodeURIComponent(q)}&type=${group.type}`} className="mt-3 inline-block text-sm text-accent hover:underline">
                  See all {pluralize(total, group.noun)}
                </Link>
              )}
            </Section>
          );
        })
      }
    </QueryState>
  );
}

function TypeResults({ q, group, results, onPageChange }) {
  return (
    <div className="mt-6">
      <p className="text-sm text-muted">
        {group.title} matching “{q}” ·{' '}
        <Link to={`/search?q=${encodeURIComponent(q)}`} className="text-accent hover:underline">
          All results
        </Link>
      </p>
      <div className="mt-4">
        <QueryState query={results} loadingMessage="Searching…" emptyMessage={`No ${group.title.toLowerCase()} match “${q}”.`}>
          {(data) => (
            <>
              <RankedList rows={toRows(group.type, data.items)} />
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={onPageChange} />
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}
