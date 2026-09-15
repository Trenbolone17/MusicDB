# Songboard — IMDb for music

## Stack
- Node 22, Express, PostgreSQL 16 accessed with `pg` and raw SQL (no ORM)
- React + Vite + Tailwind + TanStack Query + React Router
- Redis for caching charts (later phase)

## Data model
artists, albums, tracks, users, reviews, genres, album_genres, artist_genres.
A review targets exactly one of artist/album/track. One review per user per target — enforce with a unique constraint in Postgres, not just in app code.

## Features, in priority order
1. Schema + migrations (plain .sql files)
2. Seed script pulling real data from MusicBrainz API (1 req/sec, set User-Agent)
3. Read API: artist, album, track pages; search via tsvector + GIN index
4. Auth: JWT, bcrypt, refresh token in httpOnly cookie
5. Reviews CRUD with denormalised rating_count / rating_sum updated in a transaction
6. Charts: Bayesian-weighted top albums/songs/artists, trending with time decay, via materialised views
7. Frontend pages: home, search, artist, album, track, login, review form
8. Docker Compose, tests (Jest + Supertest), GitHub Actions

## Rules
- Build one feature at a time; stop and let me run it before moving on
- Keep secrets in .env (gitignored); provide .env.example
- Explain any non-obvious pattern you introduce in a short comment