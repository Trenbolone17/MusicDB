# Decisions

Design decisions not covered by CLAUDE.md or SPEC.md. One line each.

## Tooling and setup
- Plain JavaScript everywhere; the backend is CommonJS so Jest runs without experimental ESM flags.
- SPEC.md was created from the kickoff brief, because CLAUDE.md refers to it.
- Docker Postgres is published on host port 5433, since a local Postgres commonly occupies 5432.
- The site is named "Songboard", per CLAUDE.md.
- `.nvmrc` pins Node 22 (CLAUDE.md), and `engines` allows `>=22`, so newer Node also works.
- Tests run against a separate `songboard_test` database; config refuses to start in test mode against any database not ending in `_test`.
- `npm run dev` starts Postgres, applies migrations, then runs the API and Vite together, so the project starts with one command.
- In dev, Vite proxies `/api` and `/uploads` to Express, so the browser sees one origin (no CORS, and the refresh cookie can be SameSite=Strict).
- Postgres `bigint` values (ids, counts) are parsed as JS numbers and `numeric` as floats; ids will never approach 2^53.
- Tailwind's default colour palette is removed in `@theme`, so only the approved tokens (bg, fg, muted, line, accent, danger) exist as utilities.
- Unknown routes return the standard JSON error (`NOT_FOUND`), not Express's HTML page.

## Catalog data
- An album is a MusicBrainz release group of primary type Album with no secondary types (no live, compilation, EP, or single); its tracklist comes from the earliest official release.
- A recording (song) belongs to the first album it was imported with.
- Albums and tracks have one primary artist; featured artists are not modelled.
- The ~200 popular artists come from ListenBrainz sitewide stats, committed as JSON so seeds are reproducible.
- Artist bio and image come from the English Wikipedia summary, found via the artist's Wikidata link, with a "From Wikipedia" attribution.
- Cover art is hotlinked from the Cover Art Archive, not downloaded.
- Search matches names and titles only, using the `simple` text config plus `unaccent`, since names are multilingual proper nouns.

## Reviews and charts
- Reviews point at their target through three nullable foreign keys plus a CHECK that exactly one is set, rather than a generic target_id.
- rating_count and rating_sum are maintained in app code inside the review transaction; the target row is locked first, and a CHECK constraint catches drift.
- Ratings without text count in charts but are not shown in "recent reviews" lists.
- Charts list only items with at least one rating, 25 per page.
- Ranking prior weight m = 5; trending uses a 14-day half-life over a 90-day window.

## Auth, API, and uploads
- Email is required at signup; login accepts username or email.
- Passwords are hashed with argon2.
- Refresh tokens are stored as SHA-256 hashes, rotated on every refresh, and revoked on logout or password change.
- The API error shape adds an optional `details` field, used only for validation errors.
- Rate limits use express-rate-limit's in-memory store, which is fine for a single process.
- Avatars are re-encoded to 256px WebP with sharp.
