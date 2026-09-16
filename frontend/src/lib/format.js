// 284400 -> "4:44"
export function formatDuration(ms) {
  if (!ms) return '';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// 3212000 -> "54 min"
export function formatTotalMinutes(ms) {
  return `${Math.round(ms / 60_000)} min`;
}

// 8.4 -> "8.4", 8 -> "8.0"
export function formatRating(average) {
  return average == null ? '–' : average.toFixed(1);
}

// "2026-09-16T12:00:00Z" -> "16 Sep 2026"
export function formatDate(iso) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

// (1, 'track') -> "1 track", (1203, 'rating') -> "1,203 ratings"
export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count.toLocaleString('en')} ${count === 1 ? singular : plural}`;
}
