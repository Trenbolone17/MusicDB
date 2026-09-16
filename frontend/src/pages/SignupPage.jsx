import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider.jsx';
import useAuthForm from '../auth/useAuthForm.js';
import Button from '../components/Button.jsx';
import TextField from '../components/TextField.jsx';
import useDocumentTitle from '../lib/useDocumentTitle.js';

export default function SignupPage() {
  useDocumentTitle('Sign up');
  const { status, signup } = useAuth();
  const location = useLocation();
  const form = useAuthForm({ username: '', email: '', displayName: '', password: '' }, (values) =>
    // A blank display name falls back to the username on the server.
    signup({ ...values, displayName: values.displayName.trim() || undefined }),
  );

  if (status === 'authenticated') return <Navigate to={location.state?.from ?? '/'} replace />;

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">Create an account</h1>

      <form onSubmit={form.handleSubmit} noValidate className="mt-6 space-y-4">
        {form.formError && (
          <p role="alert" className="text-sm text-danger">
            {form.formError}
          </p>
        )}
        <TextField
          label="Username"
          name="username"
          autoComplete="username"
          hint="3–30 letters, numbers, or underscores"
          value={form.values.username}
          onChange={form.update}
          error={form.fieldErrors.username}
          required
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.values.email}
          onChange={form.update}
          error={form.fieldErrors.email}
          required
        />
        <TextField
          label="Display name (optional)"
          name="displayName"
          autoComplete="nickname"
          hint="Shown on your profile. Defaults to your username."
          value={form.values.displayName}
          onChange={form.update}
          error={form.fieldErrors.displayName}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          value={form.values.password}
          onChange={form.update}
          error={form.fieldErrors.password}
          required
        />
        <Button type="submit" disabled={form.submitting} className="w-full">
          {form.submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" state={location.state} className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </section>
  );
}
