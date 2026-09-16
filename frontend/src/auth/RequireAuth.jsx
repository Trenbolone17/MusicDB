import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthProvider.jsx';

// Wraps a page only signed-in people may see. Visitors go to the log-in page and come back
// here afterwards. Nothing renders while the session check is still running.
export default function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return null;
  if (status === 'anonymous') return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}
