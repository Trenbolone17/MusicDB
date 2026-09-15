import { useQuery } from '@tanstack/react-query';
import { api } from './client.js';

export function useArtist(id) {
  return useQuery({ queryKey: ['artist', id], queryFn: () => api(`/artists/${encodeURIComponent(id)}`) });
}

export function useAlbum(id) {
  return useQuery({ queryKey: ['album', id], queryFn: () => api(`/albums/${encodeURIComponent(id)}`) });
}

export function useTrack(id) {
  return useQuery({ queryKey: ['track', id], queryFn: () => api(`/tracks/${encodeURIComponent(id)}`) });
}
