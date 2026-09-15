import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import QueryState from '../components/QueryState.jsx';

export default function HomePage() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api('/health') });

  return (
    <section>
      <h1 className="text-2xl font-semibold">Songboard</h1>
      <p className="mt-2 text-muted">Rate and review songs, albums, and artists.</p>

      <div className="mt-8 border-t border-line pt-4 text-sm">
        <QueryState query={health} loadingMessage="Checking the API…">
          {(data) => (
            <p>
              API status: <span className="text-accent">{data.status}</span>
            </p>
          )}
        </QueryState>
      </div>
    </section>
  );
}
