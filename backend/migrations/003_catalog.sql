CREATE TABLE artists (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mbid           uuid NOT NULL UNIQUE,        -- MusicBrainz artist id
  name           text NOT NULL,
  sort_name      text,
  disambiguation text,
  artist_type    text,                        -- Person, Group, ...
  country        text,
  bio            text,
  wikipedia_url  text,                        -- source of bio/image, shown as attribution
  image_url      text,
  rating_count   integer NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  rating_sum     integer NOT NULL DEFAULT 0,
  seeded_at      timestamptz,                 -- discography fully imported; lets the seed resume
  search_vector  tsvector GENERATED ALWAYS AS (to_tsvector('simple', f_unaccent(name))) STORED,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Every rating is 1..10, so the sum must stay within [count, 10*count]. Catches counter drift.
  CONSTRAINT artists_rating_sum_range CHECK (rating_sum BETWEEN rating_count AND rating_count * 10)
);
CREATE INDEX artists_search_idx    ON artists USING gin (search_vector);
CREATE INDEX artists_name_trgm_idx ON artists USING gin (f_unaccent(name) gin_trgm_ops);

CREATE TABLE genres (
  id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE artist_genres (
  artist_id  bigint  NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  genre_id   integer NOT NULL REFERENCES genres(id)  ON DELETE CASCADE,
  vote_count integer NOT NULL DEFAULT 0,      -- MusicBrainz votes; used to show the top few genres
  PRIMARY KEY (artist_id, genre_id)
);
CREATE INDEX artist_genres_genre_id_idx ON artist_genres (genre_id);

CREATE TABLE albums (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mbid          uuid NOT NULL UNIQUE,         -- MusicBrainz release-group id
  release_mbid  uuid,                         -- the specific release the tracklist came from
  artist_id     bigint NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  title         text NOT NULL,
  release_year  smallint,
  cover_url     text,
  rating_count  integer NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  rating_sum    integer NOT NULL DEFAULT 0,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', f_unaccent(title))) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT albums_rating_sum_range CHECK (rating_sum BETWEEN rating_count AND rating_count * 10)
);
CREATE INDEX albums_artist_id_idx  ON albums (artist_id, release_year);
CREATE INDEX albums_search_idx     ON albums USING gin (search_vector);
CREATE INDEX albums_title_trgm_idx ON albums USING gin (f_unaccent(title) gin_trgm_ops);

-- A track's artist is albums.artist_id (joined), so the schema has one source of truth.
CREATE TABLE tracks (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mbid          uuid NOT NULL UNIQUE,         -- MusicBrainz recording id
  album_id      bigint NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  title         text NOT NULL,
  disc_number   smallint NOT NULL DEFAULT 1,
  track_number  smallint NOT NULL,
  duration_ms   integer CHECK (duration_ms > 0),
  rating_count  integer NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  rating_sum    integer NOT NULL DEFAULT 0,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', f_unaccent(title))) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracks_position_key UNIQUE (album_id, disc_number, track_number),
  CONSTRAINT tracks_rating_sum_range CHECK (rating_sum BETWEEN rating_count AND rating_count * 10)
);
CREATE INDEX tracks_search_idx     ON tracks USING gin (search_vector);
CREATE INDEX tracks_title_trgm_idx ON tracks USING gin (f_unaccent(title) gin_trgm_ops);
