import { useEffect } from 'react';

// Sets the tab title to "<title> · Songboard" while the calling page is shown. A missing
// title (say, while data loads) leaves the current one alone.
export default function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    document.title = `${title} · Songboard`;
    return () => {
      document.title = 'Songboard';
    };
  }, [title]);
}
