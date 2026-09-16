import { useQuery } from '@tanstack/react-query';
import { api } from './client.js';

// type: 'tracks' | 'albums' | 'artists'; sort: 'top' | 'trending'
export function useChart(type, sort, page) {
  return useQuery({
    queryKey: ['chart', type, sort, page],
    queryFn: () => api(`/charts/${type}?sort=${sort}&page=${page}`),
    // Keep the current list visible while the next page or sort loads.
    placeholderData: (previous) => previous,
  });
}
