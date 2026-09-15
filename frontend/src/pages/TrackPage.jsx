import { Link, useParams } from 'react-router';
import { useTrack } from '../api/catalog.js';
import Cover from '../components/Cover.jsx';
import QueryState from '../components/QueryState.jsx';
import { RatingSummary } from '../components/Rating.jsx';
import { formatDuration } from '../lib/format.js';
import useDocumentTitle from '../lib/useDocumentTitle.js';
import NotFoundPage from './NotFoundPage.jsx';

export default function TrackPage() {
  const { id } = useParams();
  const track = useTrack(id);
  useDocumentTitle(track.data && `${track.data.title} by ${track.data.artist.name}`);

  return (
    <QueryState query={track} loadingMessage="Loading track…" notFound={<NotFoundPage title="Track not found" />}>
      {(data) => <TrackDetails track={data} />}
    </QueryState>
  );
}

function TrackDetails({ track }) {
  const position = track.discNumber > 1 ? `Disc ${track.discNumber}, track ${track.trackNumber}` : `Track ${track.trackNumber}`;
  const facts = [position, formatDuration(track.durationMs)].filter(Boolean).join(' · ');

  return (
    <article className="flex flex-col gap-6 sm:flex-row sm:items-end">
      <Link to={`/albums/${track.album.id}`} className="w-40 shrink-0 sm:w-48">
        <Cover src={track.album.coverUrl} alt={`${track.album.title} cover`} className="w-full" />
      </Link>
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold break-words">{track.title}</h1>
        <p className="mt-1">
          by{' '}
          <Link to={`/artists/${track.artist.id}`} className="text-accent hover:underline">
            {track.artist.name}
          </Link>
        </p>
        <p className="mt-1 text-sm text-muted">
          from{' '}
          <Link to={`/albums/${track.album.id}`} className="text-accent hover:underline">
            {track.album.title}
          </Link>
          {track.album.releaseYear && ` (${track.album.releaseYear})`}
        </p>
        <p className="mt-1 text-sm text-muted">{facts}</p>
        <div className="mt-4">
          <RatingSummary average={track.ratingAverage} count={track.ratingCount} />
        </div>
      </div>
    </article>
  );
}
