// Treats an empty array, or a paginated { items: [] } response, as empty.
function defaultIsEmpty(data) {
  if (Array.isArray(data)) return data.length === 0;
  if (Array.isArray(data?.items)) return data.items.length === 0;
  return false;
}

// Renders the loading, error, or empty state for a TanStack Query result, and otherwise
// calls children(data). Wrap every list in this, so no view is ever a blank screen.
export default function QueryState({
  query,
  children,
  isEmpty = defaultIsEmpty,
  emptyMessage = 'Nothing here yet.',
  loadingMessage = 'Loading…',
}) {
  if (query.isPending) {
    return (
      <p className="py-6 text-sm text-muted" aria-live="polite">
        {loadingMessage}
      </p>
    );
  }

  if (query.isError) {
    return (
      <div className="py-6 text-sm" role="alert">
        <p className="text-muted">{query.error?.message || 'Something went wrong.'}</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-2 cursor-pointer text-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isEmpty(query.data)) {
    return <p className="py-6 text-sm text-muted">{emptyMessage}</p>;
  }

  return children(query.data);
}
