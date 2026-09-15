# Songboard

IMDb for music: rate and review songs, albums, and artists.

> Work in progress. Full docs on setup, the ranking formula, and the schema arrive with the final feature.
> See [SPEC.md](SPEC.md) for the feature spec and [DECISIONS.md](DECISIONS.md) for design decisions.

## Requirements
- Node 22 or newer (see `.nvmrc`) and npm
- Docker with Compose v2

## Quick start
```sh
cp .env.example .env
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/health
- Postgres (Docker): localhost:5433

## Scripts (run from the repo root)
| Command | What it does |
|---|---|
| `npm run dev` | Start Postgres, apply migrations, run the API and web app with reload |
| `npm run migrate` | Apply pending SQL migrations from `backend/migrations` |
| `npm run seed:catalog` | Import artists, studio albums, and tracks from MusicBrainz, with bios from Wikipedia (about an hour; add `-- --artists 10` for a quick subset, `-- --refresh` to re-fetch) |
| `npm run seed:artist-list` | Regenerate `backend/seed/artists.json` from ListenBrainz (the committed list is normally all you need) |
| `npm test` | Start Postgres and run the backend tests against `songboard_test` |
| `npm run db:down` | Stop Postgres (data stays in the `pgdata` Docker volume) |

Before seeding, set `SEED_USER_AGENT` in `.env` to your app name and a contact email; MusicBrainz and Wikimedia require it.
The seed is safe to stop and re-run: finished artists are skipped.

## Layout
- `backend/`: Express API, SQL migrations, seed scripts, Jest tests
- `frontend/`: React + Vite + Tailwind app
- `docker-compose.yml`: Postgres 16
