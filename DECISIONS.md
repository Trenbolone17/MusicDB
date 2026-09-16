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

## Malayalam catalog and singer credits
- The English list is widened to ListenBrainz's top 500 artists (it serves up to 1,000 in one request); the committed list is what the seed reads.
- Malayalam film music is catalogued on MusicBrainz under the composer, usually as a soundtrack or score and often as an EP, so it gets its own seed profile: albums and EPs, soundtracks allowed, up to 40 per artist, ties broken newest first because ratings are too sparse to rank by.
- The Malayalam artist list is a curated set of composers and bands (`seed/malayalam-names.json`) resolved to MusicBrainz ids by name, preferring hits located in India, plus Kerala-area artists with at least two albums or EPs. Area alone was too noisy (actors, lyricists) and too narrow (composers filed elsewhere).
- The Malayalam profile skips background-score albums (titles containing "score"; dozens of instrumental cues each, while the film's songs are on its soundtrack release) and releases MusicBrainz marks as a language other than Malayalam, since these composers also score Tamil and Telugu films; releases with no language set are kept.
- Singers are not seeded as artists: their MusicBrainz releases are mostly compilations. Instead each track stores its performer credit when it differs from the album artist, shown on pages and included in search at a lower weight than the title, so "Yesudas" finds his songs.
- Credits are matched by pg_trgm word similarity (`<%`), since a credit lists several performers and whole-string similarity would fall under the threshold; the word-similarity threshold is set to 0.45 on every connection, because the 0.6 default rejects a one-letter typo in a short name. The track search vector is rebuilt, since generated columns can't be altered in place.
- Re-seeding an already imported album now backfills its tracks' credits without touching the tracklist.
- `seed:catalog -- --only "Name,Name"` seeds particular artists from a list, for spot checks and re-seeding one artist; `malayalam-names.json` has an `exclude` list for Kerala-area artists that qualify on release count but aren't music acts (a spiritual leader, a film director).

## Reviews and charts
- Reviews point at their target through three nullable foreign keys plus a CHECK that exactly one is set, rather than a generic target_id.
- rating_count and rating_sum are maintained in app code inside the review transaction; the target row is locked first, and a CHECK constraint catches drift.
- Ratings without text count in charts but are not shown in "recent reviews" lists.
- Charts list only items with at least one rating, 25 per page.
- Ranking prior weight m = 5; trending uses a 14-day half-life over a 90-day window.
- No demo users or reviews are seeded, at the owner's request (the plan's Feature 7 was dropped); charts start empty and fill as real people rate.
- Trending lists only items with at least one rating inside the 90-day window; anything else has no recent signal to rank on.
- Chart sort and page live in the URL query string (`?sort=trending&page=2`), with defaults left out, so a chart position can be shared.
- An artist's "top tracks" use the same weighted score as the Top Songs chart, so the two never disagree.
- Charts get their total from a window count in the same query; a page past the end therefore reports total 0, which the client shows as empty.

## Auth, API, and uploads
- Email is required at signup; login accepts username or email.
- Passwords are hashed with argon2.
- Access tokens are HS256 JWTs lasting 15 minutes that carry only the user id; every authenticated request still confirms the user exists.
- Refresh tokens are stored as SHA-256 hashes and rotated on every refresh. A rotated token presented again within 30 seconds is treated as two tabs refreshing at once and gets a new token; later reuse deletes all of the user's refresh tokens, since it suggests theft.
- Logging out deletes the refresh token row instead of marking it revoked, so the rotation grace window can't revive it.
- Refreshing with no cookie returns 200 with `user: null`, because being logged out is a normal state, not an error.
- A failed log-in still verifies against a dummy hash when the account doesn't exist, so response times don't reveal which accounts exist.
- Duplicate usernames and emails are caught by the unique indexes rather than a pre-check, so two simultaneous sign-ups can't both succeed.
- The API error shape adds an optional `details` field; `details.fields` ties validation errors and duplicate usernames or emails to the form field they belong to.
- Rate limits use express-rate-limit's in-memory store, which is fine for a single process.
- Sign-up requests and failed log-ins each have a per-IP limit (10 per 15 minutes by default). Successful log-ins don't count, so typing the right password never locks anyone out. Refresh and log-out allow 100 per window, since refresh runs on every page load.
- Express trusts X-Forwarded-For only from loopback proxies, and the Vite proxy sets it, so dev rate limits apply per browser instead of to the proxy.
- `.env.example` ships a placeholder JWT secret so local setup works; the API refuses to start in production while the secret contains "change-me".
- Form errors use the muted red, the palette's only warning colour.
- Avatars are re-encoded to 256px WebP with sharp.

## Ratings and reviews
- Every review write locks the target row first, so ratings of the same item queue up and the counters can't race; edits and deletions take that same lock before the review row, which rules out deadlocks.
- Ownership is read from the database inside the write transaction: someone else's review gives 403, a missing one 404.
- Rating something again replaces the previous rating (PUT to your own review), so there's never a second row to reconcile.
- An empty review box is stored as NULL, which counts towards the average but isn't listed among written reviews.
- Review lists are 10 per page, newest first, with the total from a window function rather than a second count query.
- Review writes are limited per signed-in account (30 per 10 minutes by default) rather than per IP address.

## Search
- Search matches two ways at once: word-prefix full-text search (so "para" finds "Paranoid Android" while typing) or trigram similarity at Postgres's default 0.3 threshold (so "radiohed" finds "Radiohead"); both go through `f_unaccent`.
- Results order: exact name match first, then the higher of the full-text rank and the trigram similarity, then rating count.
- Query punctuation is stripped before building the tsquery, since it has meaning in tsquery syntax; a punctuation-only query falls back to trigram matching alone.
- The grouped view returns 5 per type with each type's total; choosing a type gives a 25-per-page list. Queries are capped at 100 characters.
- The search box updates the URL (`?q=`) after a 300 ms typing pause, so results can be shared and the back button works; the row shapes are shared with the charts through `catalogTypes.js`.

## Featured, admin, and home
- Admins are made from the server with `npm run make-admin -- <username>` (`--revoke` to remove); there is deliberately no UI for granting admin.
- `requireAdmin` reads `is_admin` from the users row on every request, so revoking it applies immediately rather than when the access token expires.
- Featuring an already-featured item answers 409; the unique constraints on `featured_items` are what actually prevent duplicates.
- The home page loads from one endpoint (`GET /api/home`): 6 featured songs and artists plus the top 5 of each chart, reusing the chart SQL.
- Admins see an extra "Admin" link beside their username in the nav; nobody else sees it, and the page itself refuses non-admins.
- Every list of catalog items (charts, search, featured, home) is built from one row-shape module (`frontend/src/lib/rows.js`), so an item looks the same everywhere.

## Profiles and settings
- File storage sits behind `storage.put/remove/urlFor` with one disk driver; the driver is chosen by `STORAGE_DRIVER`, so S3 later means one new driver file.
- Profile pictures are decoded and re-encoded by sharp to a 256px square WebP, which also strips metadata and rejects anything that isn't a readable image; uploads are capped at 2 MB. A replaced picture's old file is deleted after the database swap.
- Public profiles never include the email address or the user's numeric id.
- A profile's "top rated songs" are ordered by the rating that person gave, newest first among equals, and show the song's overall rating alongside.
- Changing the password deletes every refresh token for the account and issues a fresh one to the current session, so other devices are signed out but this one stays in.
- Deleting an account subtracts the person's ratings from each item's counters in the same transaction that deletes the row; the avatar file is removed after the commit.
- Password-checking endpoints (change password, delete account) share the auth rate limit, keyed by account.
- Tests upload into a temp directory, set before the config loads, so they never touch `backend/uploads`.

## Catalog API and pages
- Each detail endpoint returns everything its page needs in one response (artist with top genres, albums, and top tracks; album with its tracklist); reviews will come from a separate, paginated endpoint.
- A non-numeric, zero, or unknown id returns 404 `NOT_FOUND`, and the page shows a "not found" message instead of a retry button.
- Until the ranking module lands (Feature 8), an artist's top tracks are its rated tracks ordered by plain average, then rating count.
- Artist pages show the top 6 genres by MusicBrainz votes.
- Missing or broken images show a flat "No image" placeholder.
- The rating star is light grey; green stays reserved for links, active states, and the primary button.
- The query client retries network and server errors once and never retries 4xx responses.
- Tab titles read "<name> · Songboard".
