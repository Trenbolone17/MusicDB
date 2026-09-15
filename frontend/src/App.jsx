import { Route, Routes } from 'react-router';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';

// Pages that aren't built yet. Each later feature swaps in the real page.
const placeholders = [
  ['top/songs', 'Top Songs'],
  ['top/albums', 'Top Albums'],
  ['top/artists', 'Top Artists'],
  ['featured', 'Featured'],
  ['search', 'Search'],
  ['login', 'Log in'],
  ['signup', 'Sign up'],
];

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        {placeholders.map(([path, title]) => (
          <Route key={path} path={path} element={<PlaceholderPage title={title} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
