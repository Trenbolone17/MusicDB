import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.js';

export function useProfile(username) {
  return useQuery({ queryKey: ['profile', username], queryFn: () => api(`/users/${encodeURIComponent(username)}`) });
}

export function useProfileTopTracks(username) {
  return useQuery({
    queryKey: ['profile', username, 'top-tracks'],
    queryFn: () => api(`/users/${encodeURIComponent(username)}/top-tracks`),
  });
}

export function useProfileReviews(username, page) {
  return useQuery({
    queryKey: ['profile', username, 'reviews', page],
    queryFn: () => api(`/users/${encodeURIComponent(username)}/reviews?page=${page}`),
    placeholderData: (previous) => previous,
  });
}

// Profile edits refetch the public profile, which shows the same fields.
function useProfileMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }) });
}

export function useUpdateProfile() {
  return useProfileMutation((fields) => api('/me', { method: 'PATCH', body: fields }));
}

export function useUploadAvatar() {
  return useProfileMutation((file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api('/me/avatar', { method: 'PUT', formData });
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (fields) => api('/me/password', { method: 'PUT', body: fields }) });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: (password) => api('/me', { method: 'DELETE', body: { password } }) });
}
