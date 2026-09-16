// Previous / next paging. Renders nothing when everything fits on one page.
export default function Pagination({ page, pageSize, total, onPageChange }) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return null;

  const buttonClass =
    'cursor-pointer text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline';

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center gap-4 text-sm">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className={buttonClass}>
        Previous
      </button>
      <span className="text-muted tabular-nums">
        Page {page} of {pageCount}
      </span>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} className={buttonClass}>
        Next
      </button>
    </nav>
  );
}
