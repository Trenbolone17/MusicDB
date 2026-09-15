import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">
        That page doesn&apos;t exist.{' '}
        <Link to="/" className="text-accent hover:underline">
          Go home
        </Link>
      </p>
    </section>
  );
}
