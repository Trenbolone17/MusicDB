import { useState } from 'react';
import { Link } from 'react-router';
import { useDeleteReview, useReviews } from '../api/reviews.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { formatDate } from '../lib/format.js';
import Pagination from './Pagination.jsx';
import QueryState from './QueryState.jsx';
import { RatingValue } from './Rating.jsx';

// Written reviews of one item, newest first. Ratings without text are counted in the average
// but aren't listed here, since there's nothing to read.
export default function ReviewsSection({ type, id }) {
  const [page, setPage] = useState(1);
  const reviews = useReviews(type, id, page);
  const { user } = useAuth();
  const remove = useDeleteReview(type, id);

  return (
    <QueryState
      query={reviews}
      loadingMessage="Loading reviews…"
      emptyMessage="No written reviews yet. Be the first."
    >
      {(data) => (
        <>
          <ol className="divide-y divide-line">
            {data.items.map((review) => {
              const isMine = user?.username === review.author.username;
              return (
                <li key={review.id} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm">
                      <Link to={`/u/${review.author.username}`} className="hover:text-accent">
                        {review.author.displayName}
                      </Link>
                      <span className="text-muted"> · {formatDate(review.createdAt)}</span>
                      {isMine && <span className="text-muted"> · your review</span>}
                    </p>
                    <RatingValue rating={review.rating} />
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-line">{review.body}</p>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(review.id)}
                      disabled={remove.isPending}
                      className="mt-2 cursor-pointer text-xs text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </QueryState>
  );
}
