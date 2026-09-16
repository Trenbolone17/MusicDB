import { Link, NavLink } from 'react-router';
import { useAuth } from '../auth/AuthProvider.jsx';
import SearchIcon from './SearchIcon.jsx';

const links = [
  { to: '/top/songs', label: 'Top Songs' },
  { to: '/top/albums', label: 'Top Albums' },
  { to: '/top/artists', label: 'Top Artists' },
  { to: '/featured', label: 'Featured' },
  { to: '/search', label: 'Search', icon: true },
];

const linkClass = ({ isActive }) => (isActive ? 'text-accent' : 'text-muted hover:text-fg');

function AccountLinks() {
  const { status, user, logout } = useAuth();

  // Show nothing until the session check answers, so signed-in users don't see "Log in" flash.
  if (status === 'loading') return null;

  if (status === 'authenticated') {
    return (
      <>
        <NavLink to={`/u/${user.username}`} className={linkClass}>
          {user.username}
        </NavLink>
        {user.isAdmin && (
          <NavLink to="/admin" className={linkClass}>
            Admin
          </NavLink>
        )}
        <button type="button" onClick={logout} className="cursor-pointer text-muted hover:text-fg">
          Log out
        </button>
      </>
    );
  }

  return (
    <>
      <NavLink to="/login" className={linkClass}>
        Log in
      </NavLink>
      <NavLink to="/signup" className={linkClass}>
        Sign up
      </NavLink>
    </>
  );
}

export default function NavBar() {
  return (
    <header className="border-b border-line">
      {/* On phones the links drop to their own full-width row below the site name. */}
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="font-semibold text-fg">
          Songboard
        </Link>

        <ul className="order-last flex w-full flex-wrap gap-x-4 gap-y-1 text-sm sm:order-none sm:w-auto">
          {links.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink to={to} className={linkClass}>
                <span className="inline-flex items-center gap-1.5">
                  {icon && <SearchIcon className="size-3.5" />}
                  {label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex gap-4 text-sm">
          <AccountLinks />
        </div>
      </nav>
    </header>
  );
}
