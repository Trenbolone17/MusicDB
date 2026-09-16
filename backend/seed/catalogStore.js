// Writes one artist's catalog using the caller's transaction client. It only inserts and
// updates: deleting catalog rows would cascade to users' reviews.
async function saveArtistCatalog(client, { artist, genres, albums }) {
  const artistResult = await client.query(
    `INSERT INTO artists (mbid, name, sort_name, disambiguation, artist_type, country,
                          bio, wikipedia_url, image_url, seeded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (mbid) DO UPDATE SET
       name = EXCLUDED.name, sort_name = EXCLUDED.sort_name, disambiguation = EXCLUDED.disambiguation,
       artist_type = EXCLUDED.artist_type, country = EXCLUDED.country, bio = EXCLUDED.bio,
       wikipedia_url = EXCLUDED.wikipedia_url, image_url = EXCLUDED.image_url,
       seeded_at = now(), updated_at = now()
     RETURNING id`,
    [
      artist.mbid, artist.name, artist.sortName, artist.disambiguation, artist.type, artist.country,
      artist.bio, artist.wikipediaUrl, artist.imageUrl,
    ],
  );
  const artistId = artistResult.rows[0].id;

  // Nothing user-owned references genre links, so replacing the set is safe.
  await client.query('DELETE FROM artist_genres WHERE artist_id = $1', [artistId]);
  for (const genre of genres) {
    // DO UPDATE (a no-op) rather than DO NOTHING, so RETURNING also yields existing genres' ids.
    const genreResult = await client.query(
      'INSERT INTO genres (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [genre.name],
    );
    await client.query('INSERT INTO artist_genres (artist_id, genre_id, vote_count) VALUES ($1, $2, $3)', [
      artistId,
      genreResult.rows[0].id,
      genre.votes,
    ]);
  }

  let albumsAdded = 0;
  let tracksAdded = 0;
  for (const album of albums) {
    const inserted = await client.query(
      `INSERT INTO albums (mbid, release_mbid, artist_id, title, release_year, cover_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (mbid) DO NOTHING
       RETURNING id`,
      [album.mbid, album.releaseMbid, artistId, album.title, album.releaseYear, album.coverUrl],
    );

    if (inserted.rowCount === 0) {
      // Imported before: refresh its details and its tracks' credits, but keep its tracklist,
      // which reviews may point at.
      await client.query(
        'UPDATE albums SET title = $2, release_year = $3, cover_url = $4, updated_at = now() WHERE mbid = $1',
        [album.mbid, album.title, album.releaseYear, album.coverUrl],
      );
      for (const track of album.tracks) {
        await client.query('UPDATE tracks SET credit = $2 WHERE mbid = $1 AND credit IS DISTINCT FROM $2', [
          track.mbid,
          track.credit,
        ]);
      }
      continue;
    }

    albumsAdded++;
    const albumId = inserted.rows[0].id;
    for (const track of album.tracks) {
      // No conflict target, so this skips both a recording already stored under another
      // album (unique mbid) and a duplicate disc/track position.
      const result = await client.query(
        `INSERT INTO tracks (mbid, album_id, title, credit, disc_number, track_number, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [track.mbid, albumId, track.title, track.credit, track.discNumber, track.trackNumber, track.durationMs],
      );
      tracksAdded += result.rowCount;
    }
  }

  return { artistId, albumsAdded, tracksAdded };
}

module.exports = { saveArtistCatalog };
