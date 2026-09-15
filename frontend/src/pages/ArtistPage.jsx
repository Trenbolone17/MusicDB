import { Link, useParams } from 'react-router';
import { useArtist } from '../api/catalog.js';
import Cover from '../components/Cover.jsx';
import EmptyMessage from '../components/EmptyMessage.jsx';
import QueryState from '../components/QueryState.jsx';
import { InlineRating, RatingSummary } from '../components/Rating.jsx';
import Section from '../components/Section.jsx';
import useDocumentTitle from '../lib/useDocumentTitle.js';
import NotFoundPage from './NotFoundPage.jsx';

export default function ArtistPage() {
  const { id } = useParams();
  const artist = useArtist(id);
  useDocumentTitle(artist.data?.name);

  return (
    <QueryState query={artist} loadingMessage="Loading artist…" notFound={<NotFoundPage title="Artist not found" />}>
      {(data) => <ArtistDetails artist={data} />}
    </QueryState>
  );
}

function ArtistDetails({ artist }) {
  const facts = [artist.type, artist.country].filter(Boolean).join(' · ');

  return (
    <article>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <Cover src={artist.imageUrl} alt={artist.name} className="w-40 shrink-0 sm:w-48" />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold break-words">{artist.name}</h1>
          {facts && <p className="mt-1 text-sm text-muted">{facts}</p>}
          {artist.genres.length > 0 && <p className="mt-3 text-sm">{artist.genres.join(' · ')}</p>}
          <div className="mt-4">
            <RatingSummary average={artist.ratingAverage} count={artist.ratingCount} />
          </div>
        </div>
      </header>

      {artist.bio && (
        <section className="mt-8 max-w-prose">
          <p className="leading-relaxed">{artist.bio}</p>
          {artist.wikipediaUrl && (
            <p className="mt-2 text-xs text-muted">
              From{' '}
              <a href={artist.wikipediaUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Wikipedia
              </a>
              , licensed CC BY-SA.
            </p>
          )}
        </section>
      )}

      <Section title="Discography">
        {artist.albums.length === 0 ? (
          <EmptyMessage>No albums in the catalog yet.</EmptyMessage>
        ) : (
          <AlbumGrid albums={artist.albums} />
        )}
      </Section>

      <Section title="Top tracks">
        {artist.topTracks.length === 0 ? (
          <EmptyMessage>No rated tracks yet.</EmptyMessage>
        ) : (
          <TopTracks tracks={artist.topTracks} />
        )}
      </Section>
    </article>
  );
}

function AlbumGrid({ albums }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {albums.map((album) => (
        <li key={album.id}>
          <Link to={`/albums/${album.id}`} className="group block">
            <Cover src={album.coverUrl} alt={`${album.title} cover`} className="w-full" />
            <p className="mt-2 text-sm font-medium break-words group-hover:text-accent">{album.title}</p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              {album.releaseYear && <span>{album.releaseYear}</span>}
              {album.ratingCount > 0 && <InlineRating average={album.ratingAverage} count={album.ratingCount} />}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TopTracks({ tracks }) {
  return (
    <ol className="divide-y divide-line">
      {tracks.map((track, index) => (
        <li key={track.id} className="flex items-center gap-3 py-2 text-sm">
          <span className="w-6 shrink-0 text-right tabular-nums text-muted">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <Link to={`/tracks/${track.id}`} className="block truncate hover:text-accent" title={track.title}>
              {track.title}
            </Link>
            <Link to={`/albums/${track.album.id}`} className="block truncate text-xs text-muted hover:text-accent">
              {track.album.title}
            </Link>
          </div>
          <InlineRating average={track.ratingAverage} count={track.ratingCount} />
        </li>
      ))}
    </ol>
  );
}
