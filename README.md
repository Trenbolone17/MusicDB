# Songboard

IMDb for music: rate and review songs, albums, and artists.

- Catalog of real artists, albums, and tracks from MusicBrainz, with bios and photos from Wikipedia and cover art from the Cover Art Archive.
- Ratings from 1 to 10 with optional written reviews; one rating per person per item.
- Top charts by a Bayesian weighted average, plus a time-decayed Trending view.
- Search with typo tolerance, admin-curated featured picks, public profiles, and account settings.

See [SPEC.md](SPEC.md) for the feature spec and [DECISIONS.md](DECISIONS.md) for every design decision not covered there.

## Requirements

- Node 22 or newer (see `.nvmrc`) and npm
- Docker with Compose v2, for Postgres

## Setup

```sh
cp .env.example .env     # then set SEED_USER_AGENT to your app name and email
npm install
npm run dev
```

`npm run dev` starts Postgres in Docker, applies any pending migrations, and runs the API and the web app with reload.

- Web app: http://localhost:5173
- API: http://localhost:3000/api/health
- Postgres: localhost:5433 (5433 so it doesn't collide with a Postgres already on 5432)

The catalog starts empty. To fill it:

```sh
npm run seed:catalog -- --artists 10    # a quick subset, a few minutes
npm run seed:catalog                    # all 200 artists, roughly an hour
```

The seed respects MusicBrainz's one-request-per-second limit and retries when the service is busy, so it's slow by design. It's safe to stop with Ctrl+C and re-run: finished artists are skipped, and nothing is ever deleted.

To make yourself an admin (for the Featured picks), sign up in the app, then:

```sh
npm run make-admin -- <your username>
```

Log out and back in afterwards; an **Admin** link appears beside your username.

## Scripts

All run from the repo root.

| Command | What it does |
|---|---|
| `npm run dev` | Start Postgres, migrate, and run the API and web app with reload |
| `npm test` | Start Postgres and run the backend tests against the `songboard_test` database |
| `npm run migrate` | Apply pending SQL migrations from `backend/migrations` |
| `npm run seed:catalog` | Import artists, albums, and tracks from MusicBrainz (`-- --artists N` for a subset, `-- --refresh` to re-fetch) |
| `npm run seed:artist-list` | Regenerate `backend/seed/artists.json` from ListenBrainz (the committed list is normally all you need) |
| `npm run make-admin -- <username>` | Grant admin rights (`--revoke` removes them) |
| `npm run build` | Production build of the web app into `frontend/dist` |
| `npm run db:down` | Stop Postgres (data stays in the `pgdata` Docker volume) |

## Environment variables

Everything the project reads is listed in [.env.example](.env.example). The API refuses to start if a required value is missing, and in production if the JWT secret is still the placeholder.

| Variable | Purpose |
|---|---|
| `NODE_ENV`, `PORT` | Runtime mode and API port (the Vite proxy reads `PORT` too) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Docker Postgres credentials and host port |
| `DATABASE_URL`, `TEST_DATABASE_URL` | Connection strings; tests refuse any database not ending in `_test` |
| `JWT_ACCESS_SECRET`, `ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`, `COOKIE_SECURE` | Session tokens and the refresh cookie |
| `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_AUTH_WINDOW_MINUTES` | Sign-ups and failed log-ins allowed per IP per window (also password changes and deletions, per account) |
| `RATE_LIMIT_REVIEW_MAX`, `RATE_LIMIT_REVIEW_WINDOW_MINUTES` | Rating writes allowed per account per window |
| `STORAGE_DRIVER`, `UPLOADS_DIR`, `PUBLIC_UPLOADS_URL` | Where profile pictures go and the URL they're served at |
| `SEED_USER_AGENT`, `SEED_MAX_ALBUMS_PER_ARTIST` | Identifies the seed to MusicBrainz and Wikimedia; albums imported per artist |

## How ranking works

Both formulas live in [backend/src/ranking.js](backend/src/ranking.js), in JavaScript and in SQL, and the tests check that the two orderings agree.

**Top charts** use a Bayesian weighted average, the same idea as IMDb's Top 250:

```
score = (rating_sum + m × C) / (rating_count + m)
```

- `C` is the mean of every rating of that type (the site-wide average for songs, say).
- `m` is 5: each item starts with five virtual votes at the site-wide average.

So one perfect 10 scores below a 9.2 backed by twenty ratings, and as real ratings pile up the score approaches the plain average. Only rated items are listed; unrated ones would all tie at `C`.

**Trending** uses the same formula but weights each rating by its age:

```
w = 0.5 ^ (age_days / 14)
trending = (Σ w × rating + m × C) / (Σ w + m)
```

A rating's weight halves every 14 days, measured from when it was last changed, and ratings older than 90 days are dropped (their weight is under 2% by then).

Each item keeps `rating_count` and `rating_sum` on its own row, updated in the same transaction as the review, so charts never scan the reviews table for Top and only scan the last 90 days for Trending.

## Schema

Migrations are plain SQL in [backend/migrations](backend/migrations), applied in filename order by `npm run migrate`, each in its own transaction, recorded in `schema_migrations`.

| Table | What it holds |
|---|---|
| `users` | Accounts: username and email (unique, case-insensitive), argon2 password hash, display name, bio, avatar key, `is_admin` |
| `refresh_tokens` | SHA-256 hashes of refresh tokens, with expiry and rotation timestamps |
| `artists` | MusicBrainz artists with bio, Wikipedia link, image, and rating counters |
| `genres`, `artist_genres` | Genre names and each artist's genres with MusicBrainz vote counts |
| `albums` | Release groups with year, cover URL, rating counters; `artist_id` |
| `tracks` | Recordings with disc and track number, duration, rating counters; `album_id` (an album's artist is the track's artist) |
| `reviews` | One row per rating: `user_id`, exactly one of `artist_id` / `album_id` / `track_id`, `rating` 1–10, optional `body` |
| `featured_items` | Admin picks: exactly one of the three target ids, each featurable once |

Rules enforced by Postgres rather than only by the app:

- **One rating per person per item:** unique constraints on `(user_id, artist_id)`, `(user_id, album_id)`, and `(user_id, track_id)`. Rating again updates the existing row.
- **Exactly one target per review:** `CHECK (num_nonnulls(artist_id, album_id, track_id) = 1)`.
- **Ratings stay in range:** `CHECK (rating BETWEEN 1 AND 10)`, and each item's `rating_sum` must lie between `rating_count` and `10 × rating_count`, which catches any counter drift.
- **Search:** generated `tsvector` columns plus trigram indexes on names and titles, both accent-insensitive through an immutable `f_unaccent()` wrapper.

Review writes lock the target row first, then write the review and move the counters in the same transaction. Deleting an account subtracts that person's ratings from every counter before the cascade removes their reviews.

## API

Everything is under `/api` and returns JSON. Errors always look like `{ "error": { "code", "message", "details"? } }`; validation errors carry `details.fields` with one message per field.

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Catalog | `GET /artists/:id`, `GET /albums/:id`, `GET /tracks/:id` |
| Reviews | `GET /{artists,albums,tracks}/:id/reviews?page=`, `GET` and `PUT /{artists,albums,tracks}/:id/my-review`, `PATCH /reviews/:id`, `DELETE /reviews/:id` |
| Charts | `GET /charts/{tracks,albums,artists}?sort=top\|trending&page=` |
| Search | `GET /search?q=&type=all\|artists\|albums\|tracks&page=` |
| Featured | `GET /featured`, `POST /admin/featured`, `DELETE /admin/featured/:id` (admins) |
| Home | `GET /home` |
| Users | `GET /users/:username`, `GET /users/:username/top-tracks`, `GET /users/:username/reviews?page=` |
| Me | `GET /me`, `PATCH /me`, `PUT /me/avatar` (multipart), `PUT /me/password`, `DELETE /me` |

Authentication: a short-lived JWT access token in the `Authorization: Bearer` header, kept only in memory by the web app, and a refresh token in an httpOnly `SameSite=Strict` cookie scoped to `/api/auth`. Refresh tokens rotate on every use; reuse of an old one after a short grace window ends all of that account's sessions.

## Tests

```sh
npm test
```

Jest and Supertest drive the real Express app against the `songboard_test` database, which the test setup migrates and truncates between tests. Among other things the suite covers:

- duplicate rating enforcement, including a raw SQL insert that Postgres must reject;
- authorization on review edit and delete (401 without a token, 403 for someone else's review, 404 for a missing one);
- the ranking calculation, and that the SQL ordering matches the JavaScript formula for both Top and Trending;
- sign-up, log-in, refresh-token rotation and reuse detection, and rate limits;
- search matching, profile stats, avatar processing, password change, and account deletion.

## Layout

```
backend/
  migrations/   numbered .sql files
  scripts/      migrate, seed-catalog, seed-artist-list, make-admin
  seed/         MusicBrainz and Wikipedia clients, selection logic, artists.json
  src/          Express app: routes/, services/, middleware/, storage/, ranking.js
  tests/        Jest + Supertest
  uploads/      profile pictures (gitignored)
frontend/
  src/          React app: pages/, components/, api/ hooks, auth/ session handling
docker-compose.yml   Postgres 16
```
