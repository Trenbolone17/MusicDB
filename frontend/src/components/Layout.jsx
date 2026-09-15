import { Outlet } from 'react-router';
import NavBar from './NavBar.jsx';

export default function Layout() {
  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </>
  );
}
