import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useProfile, useProfileReviews, useProfileTopTracks } from '../api/users.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import Cover from '../components/Cover.jsx';
import Pagination from '../components/Pagination.jsx';
import QueryState from '../components/QueryState.jsx';
import RankedList from '../components/RankedList.jsx';
import { RatingValue } from '../components/Rating.jsx';
import Section from '../components/Section.jsx';
import { formatDate, formatRating, pluralize } from '../lib/format.js';
import useDocumentTitle from '../lib/useDocumentTitle.js';
import NotFoundPage from './NotFoundPage.jsx';

const TARGET_PATHS = { artist: 'artists', album: 'albums', track: 'tracks' };

export default function ProfilePage() {
  const { username } = useParams();
  const profile = useProfile(username);
  const { user } = useAuth();
  useDocumentTitle(profile.data?.displayName);

  return (
    <QueryState query={profile} loadingMessage="Loading profile…" notFound={<NotFoundPage title="User not found" />}>
      {(data) => <ProfileDetails profile={data} isOwn={user?.username === data.username} />}
    </QueryState>
  );
}

function ProfileDetails({ profile, isOwn }) {
  const facts = [
    `Joined ${formatDate(profile.createdAt)}`,
    pluralize(profile.ratingCount, 'rating'),
    profile.ratingCount > 0 && `average ${formatRating(profile.averageGiven)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <Cover src={profile.avatarUrl} alt={profile.displayName} placeholder="No photo" className="w-32 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold break-words">{profile.displayName}</h1>
          <p className="mt-1 text-sm text-muted">@{profile.username}</p>
          <p className="mt-2 text-sm text-muted">{facts}</p>
          {isOwn && (
            <p className="mt-3 text-sm">
              <Link to="/settings" className="text-accent hover:underline">
                Edit profile
              </Link>
            </p>
          )}
        </div>
      </header>

      {profile.bio && <p className="mt-8 max-w-prose leading-relaxed whitespace-pre-line">{profile.bio}</p>}

      <Section title="Top rated songs">
        <TopTracks username={profile.username} />
      </Section>

      <Section title="Recent reviews">
        <Reviews username={profile.username} />
      </Section>
    </article>
  );
}

function TopTracks({ username }) {
  const topTracks = useProfileTopTracks(username);
  return (
    <QueryState query={topTracks} loadingMessage="Loading…" emptyMessage="No songs rated yet.">
      {(data) => (
        <RankedList
          rows={data.items.map((item) => ({
            href: `/tracks/${item.id}`,
            image: item.album.coverUrl,
            imageAlt: `${item.album.title} cover`,
            title: item.title,
            subtitle: `${item.artist.name} · ${item.album.title} · rated ${item.givenRating}`,
            ratingAverage: item.ratingAverage,
            ratingCount: item.ratingCount,
          }))}
        />
      )}
    </QueryState>
  );
}

function Reviews({ username }) {
  const [page, setPage] = useState(1);
  const reviews = useProfileReviews(username, page);
  return (
    <QueryState query={reviews} loadingMessage="Loading…" emptyMessage="No written reviews yet.">
      {(data) => (
        <>
          <ol className="divide-y divide-line">
            {data.items.map((review) => (
              <li key={review.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                  <p className="min-w-0">
                    <Link to={`/${TARGET_PATHS[review.target.type]}/${review.target.id}`} className="font-medium hover:text-accent">
                      {review.target.title}
                    </Link>
                    {review.target.subtitle && <span className="text-muted"> · {review.target.subtitle}</span>}
                    <span className="text-muted"> · {formatDate(review.createdAt)}</span>
                  </p>
                  <RatingValue rating={review.rating} />
                </div>
                <p className="mt-2 text-sm whitespace-pre-line">{review.body}</p>
              </li>
            ))}
          </ol>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </QueryState>
  );
}
