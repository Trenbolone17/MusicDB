import { Route, Routes } from 'react-router';
import Layout from './components/Layout.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AlbumPage from './pages/AlbumPage.jsx';
import ArtistPage from './pages/ArtistPage.jsx';
import ChartPage from './pages/ChartPage.jsx';
import FeaturedPage from './pages/FeaturedPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import TrackPage from './pages/TrackPage.jsx';

// Pages that aren't built yet. Each later feature swaps in the real page.
const placeholders = [['u/:username', 'Profile']];

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="top/songs" element={<ChartPage type="tracks" />} />
        <Route path="top/albums" element={<ChartPage type="albums" />} />
        <Route path="top/artists" element={<ChartPage type="artists" />} />
        <Route path="artists/:id" element={<ArtistPage />} />
        <Route path="albums/:id" element={<AlbumPage />} />
        <Route path="tracks/:id" element={<TrackPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="featured" element={<FeaturedPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        {placeholders.map(([path, title]) => (
          <Route key={path} path={path} element={<PlaceholderPage title={title} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
