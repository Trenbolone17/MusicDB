import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useDeleteReview, useMyReview, useSaveReview } from '../api/reviews.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import Button from './Button.jsx';
import RatingInput from './RatingInput.jsx';

// Your own rating of one item: pick 1–10, optionally write something, and save. Saving again
// replaces what you had before.
export default function ReviewForm({ type, id }) {
  const { status } = useAuth();
  const location = useLocation();
  const signedIn = status === 'authenticated';

  const myReview = useMyReview(type, id, signedIn);
  const save = useSaveReview(type, id);
  const remove = useDeleteReview(type, id);

  const [rating, setRating] = useState(null);
  const [body, setBody] = useState('');
  const existing = myReview.data?.review ?? null;

  // Fill the form once your existing review arrives, and clear it after a delete.
  useEffect(() => {
    setRating(existing?.rating ?? null);
    setBody(existing?.body ?? '');
  }, [existing]);

  if (!signedIn) {
    return (
      <p className="text-sm text-muted">
        <Link to="/login" state={{ from: location.pathname }} className="text-accent hover:underline">
          Log in
        </Link>{' '}
        to rate this.
      </p>
    );
  }

  if (myReview.isPending) return <p className="text-sm text-muted">Loading your rating…</p>;

  const error = save.error || remove.error || (myReview.isError ? myReview.error : null);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ rating, body: body.trim() || null });
      }}
    >
      <RatingInput value={rating} onChange={setRating} disabled={save.isPending} />

      <label htmlFor="review-body" className="mt-4 block text-sm">
        Review (optional)
      </label>
      <textarea
        id="review-body"
        rows={4}
        maxLength={5000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="What do you make of it?"
        className="mt-1 block w-full border border-line bg-transparent px-3 py-2 outline-none focus:border-accent"
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error.message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={!rating || save.isPending}>
          {save.isPending ? 'Saving…' : existing ? 'Update rating' : 'Save rating'}
        </Button>
        {existing && (
          <button
            type="button"
            onClick={() => remove.mutate(existing.id)}
            disabled={remove.isPending}
            className="cursor-pointer text-sm text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {remove.isPending ? 'Deleting…' : 'Delete my rating'}
          </button>
        )}
        {save.isSuccess && !save.isPending && <span className="text-sm text-muted">Saved</span>}
      </div>
    </form>
  );
}
