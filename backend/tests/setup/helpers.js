const { randomUUID } = require('node:crypto');
const { query } = require('../../src/db');

// Empties every application table. config.js refuses to run tests against any database
// whose name doesn't end in "_test", so this can never touch dev data.
async function resetDatabase() {
  await query(`
    TRUNCATE users, refresh_tokens, reviews, featured_items, artist_genres, genres,
             tracks, albums, artists
    RESTART IDENTITY CASCADE`);
}

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
    `INSERT INTO tracks (mbid, album_id, title, disc_number, track_number, duration_ms, rating_count, rating_sum)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      randomUUID(),
      albumId,
      fields.title ?? 'Test Track',
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

module.exports = { resetDatabase, createArtist, createAlbum, createTrack, addGenre };
