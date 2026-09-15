# Songboard — IMDb for music

Full-stack site where users rate and review songs, albums, and artists.
The complete feature spec and UI direction are in SPEC.md — read it before implementing anything. Record any decision not covered there in DECISIONS.md.

## Stack
- Backend: Node 22, Express, PostgreSQL 16 via `pg` with raw SQL. No ORM.
- Migrations: numbered `.sql` files in backend/migrations, applied by `npm run migrate`.
- Frontend: React + Vite + Tailwind + TanStack Query + React Router.
- Redis for caching chart endpoints (later phase, not in v1).
- Tests: Jest + Supertest.

## Layout
- backend/  — Express app, migrations, seed scripts, tests
- frontend/ — Vite app
- docker-compose.yml at root runs Postgres

## Conventions
- All API routes under /api. Consistent JSON error shape: { error: { code, message } }.
- Validate request bodies with zod at the route boundary.
- Business rules that matter for correctness (one rating per user per target, ownership checks) are enforced in Postgres or in the transaction, not only in the UI.
- Denormalised rating_count / rating_sum on artists, albums, tracks; update them in the same transaction as the review write.
- Secrets only in .env; keep .env.example current.
- Prefer small, readable functions over clever ones. Add a short comment on any non-obvious pattern.

## UI rules
- Dark, flat, minimal. One green accent, muted red for destructive actions, nothing else.
- Text over icons. Only a star (ratings) and a magnifier (search) are allowed.
- Every list has loading, empty, and error states.

## Working agreement
- Implement one feature at a time. After each, stop, explain how to run and verify it, and wait for confirmation.
- Commit after each feature with a clear message.
- Never run destructive git commands or drop the database without asking.