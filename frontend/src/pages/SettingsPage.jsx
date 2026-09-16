import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useChangePassword, useDeleteAccount, useUpdateProfile, useUploadAvatar } from '../api/users.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import Button from '../components/Button.jsx';
import Cover from '../components/Cover.jsx';
import TextField from '../components/TextField.jsx';
import useDocumentTitle from '../lib/useDocumentTitle.js';

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const { user } = useAuth();

  return (
    <section>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-muted">
        Signed in as @{user.username} ·{' '}
        <Link to={`/u/${user.username}`} className="text-accent hover:underline">
          View profile
        </Link>
      </p>

      <SettingsSection title="Profile">
        <ProfileForm />
      </SettingsSection>
      <SettingsSection title="Profile picture">
        <AvatarForm />
      </SettingsSection>
      <SettingsSection title="Change password">
        <PasswordForm />
      </SettingsSection>
      <SettingsSection title="Delete account">
        <DeleteForm />
      </SettingsSection>
    </section>
  );
}

function SettingsSection({ title, children }) {
  return (
    <section className="mt-10 max-w-md border-t border-line pt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Errors the API ties to a field go under that input; anything else shows above the form.
function useFormErrors(mutation) {
  const fields = mutation.error?.details?.fields ?? {};
  const formError = mutation.error && !mutation.error.details?.fields ? mutation.error.message : null;
  return { fields, formError };
}

function FormError({ message }) {
  return message ? (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  ) : null;
}

function ProfileForm() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const update = useUpdateProfile();
  const { fields, formError } = useFormErrors(update);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate({ displayName, bio }, { onSuccess: (data) => setUser(data.user) });
      }}
    >
      <FormError message={formError} />
      <TextField label="Display name" name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} error={fields.displayName} maxLength={50} required />
      <div>
        <label htmlFor="field-bio" className="block text-sm">
          Bio
        </label>
        <textarea
          id="field-bio"
          rows={4}
          maxLength={1000}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={`mt-1 block w-full border bg-transparent px-3 py-2 outline-none focus:border-accent ${fields.bio ? 'border-danger' : 'border-line'}`}
        />
        {fields.bio && <p className="mt-1 text-xs text-danger">{fields.bio}</p>}
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
        {update.isSuccess && <span className="text-sm text-muted">Saved</span>}
      </div>
    </form>
  );
}

function AvatarForm() {
  const { user, setUser } = useAuth();
  const [file, setFile] = useState(null);
  const upload = useUploadAvatar();
  const { fields, formError } = useFormErrors(upload);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (file) upload.mutate(file, { onSuccess: (data) => { setUser(data.user); setFile(null); } });
      }}
    >
      <div className="flex items-center gap-4">
        <Cover src={user.avatarUrl} alt="Your profile picture" placeholder="No photo" className="w-20 shrink-0" />
        <div className="text-sm">
          <label htmlFor="field-avatar" className="block">
            Choose an image
          </label>
          <input
            id="field-avatar"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block text-sm text-muted file:mr-3 file:cursor-pointer file:border file:border-line file:bg-transparent file:px-3 file:py-1 file:text-fg"
          />
          <p className={`mt-1 text-xs ${fields.avatar ? 'text-danger' : 'text-muted'}`}>{fields.avatar ?? 'JPEG, PNG, or WebP, up to 2 MB. Cropped to a square.'}</p>
        </div>
      </div>
      <FormError message={formError} />
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!file || upload.isPending}>
          {upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
        {upload.isSuccess && !file && <span className="text-sm text-muted">Updated</span>}
      </div>
    </form>
  );
}

function PasswordForm() {
  const { setAccessToken } = useAuth();
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [mismatch, setMismatch] = useState(false);
  const change = useChangePassword();
  const { fields, formError } = useFormErrors(change);
  const update = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const bad = values.newPassword !== values.confirm;
        setMismatch(bad);
        if (bad) return;
        change.mutate(
          { currentPassword: values.currentPassword, newPassword: values.newPassword },
          {
            onSuccess: (data) => {
              setAccessToken(data.accessToken);
              setValues({ currentPassword: '', newPassword: '', confirm: '' });
            },
          },
        );
      }}
    >
      <FormError message={formError} />
      <TextField label="Current password" name="currentPassword" type="password" autoComplete="current-password" value={values.currentPassword} onChange={update} error={fields.currentPassword} required />
      <TextField label="New password" name="newPassword" type="password" autoComplete="new-password" hint="At least 8 characters" value={values.newPassword} onChange={update} error={fields.newPassword} required />
      <TextField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" value={values.confirm} onChange={update} error={mismatch ? 'Passwords do not match' : undefined} required />
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? 'Changing…' : 'Change password'}
        </Button>
        {change.isSuccess && <span className="text-sm text-muted">Changed. Other devices are signed out.</span>}
      </div>
    </form>
  );
}

function DeleteForm() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteAccount();
  const { fields, formError } = useFormErrors(remove);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!confirming) {
          setConfirming(true);
          return;
        }
        remove.mutate(password, {
          onSuccess: async () => {
            // The server already ended the session; clear it locally and go home.
            await logout();
            queryClient.clear();
            navigate('/', { replace: true });
          },
        });
      }}
    >
      <p className="text-sm text-muted">Deleting your account removes your ratings and reviews. This cannot be undone.</p>
      <FormError message={formError} />
      <TextField label="Your password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} required />
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={remove.isPending || !password}
          className="cursor-pointer bg-danger px-4 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {remove.isPending ? 'Deleting…' : confirming ? 'Yes, delete my account' : 'Delete account'}
        </button>
        {confirming && !remove.isPending && (
          <button type="button" onClick={() => setConfirming(false)} className="cursor-pointer text-sm text-muted hover:text-fg">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
