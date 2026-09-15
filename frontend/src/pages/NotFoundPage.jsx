import { Link } from 'react-router';
import useDocumentTitle from '../lib/useDocumentTitle.js';

export default function NotFoundPage({ title = 'Page not found' }) {
  useDocumentTitle(title);

  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted">
        The link may be wrong, or it no longer exists.{' '}
        <Link to="/" className="text-accent hover:underline">
          Go home
        </Link>
      </p>
    </section>
  );
}
