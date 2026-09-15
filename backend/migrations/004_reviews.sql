-- A review is a 1-10 rating plus optional text, on exactly one artist, album, or track.
CREATE TABLE reviews (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Three nullable FKs instead of a generic (target_type, target_id) pair, so Postgres
  -- enforces referential integrity and the unique constraints below stay plain.
  artist_id   bigint REFERENCES artists(id) ON DELETE CASCADE,
  album_id    bigint REFERENCES albums(id)  ON DELETE CASCADE,
  track_id    bigint REFERENCES tracks(id)  ON DELETE CASCADE,
  target_type text GENERATED ALWAYS AS (
                CASE WHEN artist_id IS NOT NULL THEN 'artist'
                     WHEN album_id  IS NOT NULL THEN 'album'
                     ELSE 'track' END) STORED,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 10),
  body        text CHECK (length(body) BETWEEN 1 AND 5000),  -- NULL = rating without written text
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_one_target CHECK (num_nonnulls(artist_id, album_id, track_id) = 1),
  -- One rating per user per target. NULLs never conflict in a UNIQUE constraint, so each
  -- constraint only applies to rows of its own target type.
  CONSTRAINT reviews_user_artist_key UNIQUE (user_id, artist_id),
  CONSTRAINT reviews_user_album_key  UNIQUE (user_id, album_id),
  CONSTRAINT reviews_user_track_key  UNIQUE (user_id, track_id)
);
CREATE INDEX reviews_artist_recent_idx ON reviews (artist_id, created_at DESC) WHERE artist_id IS NOT NULL;
CREATE INDEX reviews_album_recent_idx  ON reviews (album_id,  created_at DESC) WHERE album_id  IS NOT NULL;
CREATE INDEX reviews_track_recent_idx  ON reviews (track_id,  created_at DESC) WHERE track_id  IS NOT NULL;
CREATE INDEX reviews_user_recent_idx   ON reviews (user_id, created_at DESC);
CREATE INDEX reviews_trending_idx      ON reviews (target_type, updated_at);  -- trending window scan
