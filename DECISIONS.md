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
- The Vite dev server binds to 127.0.0.1, because with the default `localhost` Node picked IPv6 `::1` only and 127.0.0.1:5173 refused connections.

## Catalog data
- An album is a MusicBrainz release group of primary type Album whose secondary types, if any, are only Soundtrack or Mixtape/Street (so no live albums, compilations, remixes, EPs, or singles); its tracklist comes from the earliest official release.
- A recording (song) belongs to the first album it was imported with.
- Regional editions are dropped: when at least half the shorter album's tracks are the same recordings as an album already kept for the artist, only the earlier-released one is kept.
- Albums and tracks have one primary artist; featured artists are not modelled.
- The ~200 popular artists come from ListenBrainz sitewide stats, committed as JSON so seeds are reproducible.
- Artist bio and image come from the English Wikipedia summary, found via the artist's Wikidata link, with a "From Wikipedia" attribution.
- Cover art is hotlinked from the Cover Art Archive, not downloaded.
- Cover URLs are built from MusicBrainz's per-release cover-art flag, so the seed makes no Cover Art Archive requests; browsers load images on demand.
- The seed's User-Agent comes from `SEED_USER_AGENT` (not `MUSICBRAINZ_USER_AGENT`), because Wikimedia requires one as well as MusicBrainz.
- Albums are ranked by MusicBrainz rating votes before the per-artist cap (default 15), so the best-known albums survive it; up to 6 extra candidates are checked to replace editions dropped as duplicates.
- The seed never deletes catalog rows, because reviews cascade from them; an album imported earlier keeps its tracklist on re-runs.
- The canonical release is the earliest official one with an audio tracklist; a year-only date counts as the end of that year, and DVD/Blu-ray/VHS media are skipped.
- If Wikipedia lookups fail after retries, the artist is still saved, without a bio, and listed at the end of the run.
- Release-group paging stops at 1,000 entries per artist, so artists with huge bootleg catalogues can't stall the run.
- Seed HTTP requests time out after 20s and retry with backoff from 2s up to 30s: up to 10 attempts for MusicBrainz, whose 503s are frequent and where one failed request discards the artist's other work, and 6 for other services.
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

## Catalog API and pages
- Each detail endpoint returns everything its page needs in one response (artist with top genres, albums, and top tracks; album with its tracklist); reviews will come from a separate, paginated endpoint.
- A non-numeric, zero, or unknown id returns 404 `NOT_FOUND`, and the page shows a "not found" message instead of a retry button.
- Until the ranking module lands (Feature 8), an artist's top tracks are its rated tracks ordered by plain average, then rating count.
- Artist pages show the top 6 genres by MusicBrainz votes.
- Missing or broken images show a flat "No image" placeholder.
- The rating star is light grey; green stays reserved for links, active states, and the primary button.
- The query client retries network and server errors once and never retries 4xx responses.
- Tab titles read "<name> · Songboard".
