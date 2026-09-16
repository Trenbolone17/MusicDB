import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider.jsx';
import useAuthForm from '../auth/useAuthForm.js';
import Button from '../components/Button.jsx';
import TextField from '../components/TextField.jsx';
import useDocumentTitle from '../lib/useDocumentTitle.js';

export default function LoginPage() {
  useDocumentTitle('Log in');
  const { status, login } = useAuth();
  const location = useLocation();
  const form = useAuthForm({ login: '', password: '' }, login);

  // Pages that send people here pass { from } so they come back afterwards.
  if (status === 'authenticated') return <Navigate to={location.state?.from ?? '/'} replace />;

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">Log in</h1>

      <form onSubmit={form.handleSubmit} noValidate className="mt-6 space-y-4">
        {form.formError && (
          <p role="alert" className="text-sm text-danger">
            {form.formError}
          </p>
        )}
        <TextField
          label="Username or email"
          name="login"
          autoComplete="username"
          value={form.values.login}
          onChange={form.update}
          error={form.fieldErrors.login}
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.values.password}
          onChange={form.update}
          error={form.fieldErrors.password}
          required
        />
        <Button type="submit" disabled={form.submitting} className="w-full">
          {form.submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        New here?{' '}
        <Link to="/signup" state={location.state} className="text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </section>
  );
}
