import { Route, Routes } from 'react-router';
import Layout from './components/Layout.jsx';
import AlbumPage from './pages/AlbumPage.jsx';
import ArtistPage from './pages/ArtistPage.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import TrackPage from './pages/TrackPage.jsx';

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
        <Route path="artists/:id" element={<ArtistPage />} />
        <Route path="albums/:id" element={<AlbumPage />} />
        <Route path="tracks/:id" element={<TrackPage />} />
        {placeholders.map(([path, title]) => (
          <Route key={path} path={path} element={<PlaceholderPage title={title} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
