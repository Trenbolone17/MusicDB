import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.js';

// 'artist' | 'album' | 'track' -> the path segment the API uses.
const PATHS = { artist: 'artists', album: 'albums', track: 'tracks' };

export function useReviews(type, id, page) {
  return useQuery({
    queryKey: ['reviews', type, id, page],
    queryFn: () => api(`/${PATHS[type]}/${id}/reviews?page=${page}`),
    // Keep the current page visible while the next one loads, instead of flashing "Loading".
    placeholderData: (previous) => previous,
  });
}

export function useMyReview(type, id, enabled) {
  return useQuery({
    queryKey: ['my-review', type, id],
    queryFn: () => api(`/${PATHS[type]}/${id}/my-review`),
    enabled,
  });
}

// After any change, refetch this item (its average moved), its reviews, and your own review.
function useReviewMutation(type, id, mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of [[type], ['reviews', type, id], ['my-review', type, id]]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useSaveReview(type, id) {
  return useReviewMutation(type, id, (values) =>
    api(`/${PATHS[type]}/${id}/my-review`, { method: 'PUT', body: values }),
  );
}

export function useDeleteReview(type, id) {
  return useReviewMutation(type, id, (reviewId) => api(`/reviews/${reviewId}`, { method: 'DELETE' }));
}
