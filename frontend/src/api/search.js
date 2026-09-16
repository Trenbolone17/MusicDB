import { useQuery } from '@tanstack/react-query';
import { api } from './client.js';

// type: 'all' (top 5 per group) or 'artists' | 'albums' | 'tracks' (paged)
export function useSearch(q, type, page) {
  const params = new URLSearchParams({ q, ...(type !== 'all' && { type }), ...(page > 1 && { page: String(page) }) });
  return useQuery({
    queryKey: ['search', q, type, page],
    queryFn: () => api(`/search?${params}`),
    enabled: q.length > 0,
    // Keep the last results on screen while the next keystroke's results load.
    placeholderData: (previous) => previous,
  });
}
