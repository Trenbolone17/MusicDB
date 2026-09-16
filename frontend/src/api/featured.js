import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.js';

export function useFeatured() {
  return useQuery({ queryKey: ['featured'], queryFn: () => api('/featured') });
}

export function useHome() {
  return useQuery({ queryKey: ['home'], queryFn: () => api('/home') });
}

// Admin actions. Both refetch the featured list and the home page afterwards.
function useFeaturedMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featured'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

export function useFeature() {
  // type: 'artist' | 'album' | 'track'
  return useFeaturedMutation(({ type, id }) => api('/admin/featured', { method: 'POST', body: { type, id } }));
}

export function useUnfeature() {
  return useFeaturedMutation((featuredId) => api(`/admin/featured/${featuredId}`, { method: 'DELETE' }));
}
