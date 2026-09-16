const { randomUUID } = require('node:crypto');
const { createApp } = require('../../src/app');
const { query } = require('../../src/db');
const { createAccessToken, hashPassword } = require('../../src/services/auth');

// Empties every application table. config.js refuses to run tests against any database
// whose name doesn't end in "_test", so this can never touch dev data.
async function resetDatabase() {
  await query(`
    TRUNCATE users, refresh_tokens, reviews, featured_items, artist_genres, genres,
             tracks, albums, artists
    RESTART IDENTITY CASCADE`);
}

// An app whose rate limits are high enough that ordinary tests never trip them.
function createTestApp(options = {}) {
  return createApp({ authRateLimit: { max: 1000, windowMs: 60_000 }, ...options });
}

let userCount = 0;

// Inserts a user directly, without going through sign-up. Returns { id, username, email, isAdmin }.
async function createUser(fields = {}) {
  userCount += 1;
  const username = fields.username ?? `user${userCount}`;
  const { rows } = await query(
    `INSERT INTO users (username, email, password_hash, display_name, is_admin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, email, is_admin AS "isAdmin"`,
    [
      username,
      fields.email ?? `${username}@example.com`,
      await hashPassword(fields.password ?? 'password123'),
      fields.displayName ?? username,
      fields.isAdmin ?? false,
    ],
  );
  return rows[0];
}

// The Authorization header value for a user, without going through log-in.
const authHeader = (user) => `Bearer ${createAccessToken(user.id)}`;

async function createArtist(fields = {}) {
  const { rows } = await query(
    `INSERT INTO artists (mbid, name, artist_type, country, bio, wikipedia_url, image_url, rating_count, rating_sum)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      randomUUID(),
      fields.name ?? 'Test Artist',
      fields.type ?? 'Group',
      fields.country ?? 'GB',
      fields.bio ?? null,
      fields.wikipediaUrl ?? null,
      fields.imageUrl ?? null,
      fields.ratingCount ?? 0,
      fields.ratingSum ?? 0,
    ],
  );
  return rows[0];
}

async function createAlbum(artistId, fields = {}) {
  const { rows } = await query(
    `INSERT INTO albums (mbid, artist_id, title, release_year, cover_url, rating_count, rating_sum)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      randomUUID(),
      artistId,
      fields.title ?? 'Test Album',
      fields.releaseYear ?? null,
      fields.coverUrl ?? null,
      fields.ratingCount ?? 0,
      fields.ratingSum ?? 0,
    ],
  );
  return rows[0];
}

async function createTrack(albumId, fields = {}) {
  const { rows } = await query(
    `INSERT INTO tracks (mbid, album_id, title, credit, disc_number, track_number, duration_ms, rating_count, rating_sum)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      randomUUID(),
      albumId,
      fields.title ?? 'Test Track',
      fields.credit ?? null,
      fields.discNumber ?? 1,
      fields.trackNumber ?? 1,
      fields.durationMs ?? null,
      fields.ratingCount ?? 0,
      fields.ratingSum ?? 0,
    ],
  );
  return rows[0];
}

async function addGenre(artistId, name, votes) {
  const { rows } = await query(
    'INSERT INTO genres (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
    [name],
  );
  await query('INSERT INTO artist_genres (artist_id, genre_id, vote_count) VALUES ($1, $2, $3)', [
    artistId,
    rows[0].id,
    votes,
  ]);
}

module.exports = {
  resetDatabase,
  createTestApp,
  createUser,
  authHeader,
  createArtist,
  createAlbum,
  createTrack,
  addGenre,
};
