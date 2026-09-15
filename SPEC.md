# Songboard — Spec

Feature spec and UI direction for Songboard. Copied from the project kickoff brief; CLAUDE.md points here.
Anything decided that isn't covered below goes in DECISIONS.md.

## UI direction
- Dark mode by default, near-black background (#0e0e0e-ish), light grey text, one green accent (#22c55e or similar) used sparingly for links, active states, and the primary button. No other colours except a muted red for destructive actions.
- Flat design: no shadows, no gradients, no rounded cards with borders everywhere. Use spacing and typography for hierarchy, thin 1px dividers where needed.
- Minimal clutter. Prefer text labels over icons. The only icons allowed are a star for ratings and a search magnifier.
- Top navigation bar with the site name on the left and text links: Top Songs, Top Albums, Top Artists, Featured, Search. On the right: Log in / Sign up, or the username linking to the profile when logged in.
- Responsive: works on a phone width without horizontal scroll.
- Every list view must have loading, empty, and error states — never a blank screen.

## Pages
- Home: featured songs and artists, then compact Top Songs / Top Albums / Top Artists sections with "View all" links.
- Top Songs / Top Albums / Top Artists: ranked lists using Bayesian-weighted average (define the formula in code with a comment), with pagination. A "Trending" toggle that uses a time-decayed score.
- Featured: admin-curated picks. Add an is_admin flag on users and a minimal admin route to set/unset featured items.
- Artist page: name, image, bio, genres, average rating, rating count, discography (albums), top tracks by rating, recent reviews.
- Album page: cover art, artist link, year, tracklist with each track's rating, album rating, reviews.
- Track page: title, artist, album, duration, rating, reviews.
- Search: single input searching artists, albums, and tracks with Postgres full-text search plus pg_trgm for typo tolerance. Results grouped by type.
- Auth: sign up, log in, log out. JWT access token in memory, refresh token in httpOnly cookie. Validate inputs server-side (zod).
- Profile page (public): display name, profile picture, bio, join date, number of ratings, their average given rating, their top rated songs (highest ratings they've given), recent reviews.
- Profile settings (private): edit display name, bio, upload/replace profile picture (store locally in /uploads for now, abstract behind a storage function so S3 can be swapped in later), change password, delete account.

## Rating and review rules
- Users can rate 1–10 (allow a rating without written text; a review is rating + optional text).
- One rating per user per target (artist, album, or track), enforced by a unique constraint in Postgres. Submitting again updates the existing one.
- Users can edit and delete their own reviews only. Author is checked server-side.
- Keep rating_count and rating_sum denormalised on artists/albums/tracks, updated in the same transaction as the review write.
- Rate-limit auth endpoints and review submission.

## Data
- Seed script that pulls real data from the MusicBrainz API (respect 1 request/second, set a descriptive User-Agent) for ~200 popular artists with their albums and tracks. Fetch cover art from the Cover Art Archive. Make the script idempotent so it can be re-run.
- Also seed a few fake users and reviews so the charts aren't empty on first load.

## Engineering
- Backend: Express, pg with raw SQL and a small query helper, plain .sql migration files with a runner script. Frontend: React + Vite + Tailwind + TanStack Query + React Router.
- Consistent JSON error format from the API. Central error-handling middleware.
- .env.example listing every variable. docker-compose.yml with Postgres so the project starts with one command.
- README that explains setup, the ranking formula, and the schema.
- Tests with Jest + Supertest for: duplicate rating enforcement, auth guards on review edit/delete, and the ranking calculation.

## How to work
Implement one numbered feature at a time. After each one, stop, tell me how to run and verify it, and wait for me to confirm before continuing. Commit after each feature with a clear message. If you make a design decision that isn't in CLAUDE.md or this prompt, add a one-line note about it to a DECISIONS.md file.
