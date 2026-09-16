import { Link, useParams } from 'react-router';
import { useAlbum } from '../api/catalog.js';
import Cover from '../components/Cover.jsx';
import EmptyMessage from '../components/EmptyMessage.jsx';
import QueryState from '../components/QueryState.jsx';
import { InlineRating, RatingSummary } from '../components/Rating.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import ReviewsSection from '../components/ReviewsSection.jsx';
import Section from '../components/Section.jsx';
import { formatDuration, formatTotalMinutes, pluralize } from '../lib/format.js';
import useDocumentTitle from '../lib/useDocumentTitle.js';
import NotFoundPage from './NotFoundPage.jsx';

export default function AlbumPage() {
  const { id } = useParams();
  const album = useAlbum(id);
  useDocumentTitle(album.data && `${album.data.title} by ${album.data.artist.name}`);

  return (
    <QueryState query={album} loadingMessage="Loading album…" notFound={<NotFoundPage title="Album not found" />}>
      {(data) => <AlbumDetails album={data} />}
    </QueryState>
  );
}

function AlbumDetails({ album }) {
  const totalMs = album.tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0);
  const facts = [
    album.releaseYear,
    pluralize(album.tracks.length, 'track'),
    totalMs > 0 && formatTotalMinutes(totalMs),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <Cover src={album.coverUrl} alt={`${album.title} cover`} className="w-48 shrink-0 sm:w-56" />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold break-words">{album.title}</h1>
          <p className="mt-1">
            by{' '}
            <Link to={`/artists/${album.artist.id}`} className="text-accent hover:underline">
              {album.artist.name}
            </Link>
          </p>
          <p className="mt-1 text-sm text-muted">{facts}</p>
          <div className="mt-4">
            <RatingSummary average={album.ratingAverage} count={album.ratingCount} />
          </div>
        </div>
      </header>

      <Section title="Tracklist">
        {album.tracks.length === 0 ? <EmptyMessage>No tracks listed.</EmptyMessage> : <Tracklist tracks={album.tracks} />}
      </Section>

      <Section title="Your rating">
        <ReviewForm type="album" id={album.id} />
      </Section>

      <Section title="Reviews">
        <ReviewsSection type="album" id={album.id} />
      </Section>
    </article>
  );
}

function Tracklist({ tracks }) {
  const discs = [...Map.groupBy(tracks, (track) => track.discNumber)];

  return discs.map(([discNumber, discTracks]) => (
    <div key={discNumber} className="mb-6 last:mb-0">
      {discs.length > 1 && <h3 className="mb-1 text-xs tracking-wide text-muted uppercase">Disc {discNumber}</h3>}
      <ol className="divide-y divide-line">
        {discTracks.map((track) => (
          <li key={track.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="w-6 shrink-0 text-right tabular-nums text-muted">{track.trackNumber}</span>
            <div className="min-w-0 flex-1">
              <Link to={`/tracks/${track.id}`} className="block truncate hover:text-accent" title={track.title}>
                {track.title}
              </Link>
              {track.credit && <p className="truncate text-xs text-muted">{track.credit}</p>}
            </div>
            <span className="w-12 shrink-0 text-right">
              <InlineRating average={track.ratingAverage} count={track.ratingCount} />
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums text-muted">{formatDuration(track.durationMs)}</span>
          </li>
        ))}
      </ol>
    </div>
  ));
}
