-- Admin-curated picks. Same exactly-one-target pattern as reviews; each item can be featured once.
CREATE TABLE featured_items (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artist_id   bigint UNIQUE REFERENCES artists(id) ON DELETE CASCADE,
  album_id    bigint UNIQUE REFERENCES albums(id)  ON DELETE CASCADE,
  track_id    bigint UNIQUE REFERENCES tracks(id)  ON DELETE CASCADE,
  target_type text GENERATED ALWAYS AS (
                CASE WHEN artist_id IS NOT NULL THEN 'artist'
                     WHEN album_id  IS NOT NULL THEN 'album'
                     ELSE 'track' END) STORED,
  created_by  bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT featured_items_one_target CHECK (num_nonnulls(artist_id, album_id, track_id) = 1)
);
