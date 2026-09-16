-- Who performs a track, as MusicBrainz credits it ("K. J. Yesudas & K. S. Chithra"), stored
-- only when that differs from the album's artist. Film soundtracks are catalogued under the
-- composer, so this is how singers become visible and searchable.
ALTER TABLE tracks ADD COLUMN credit text;

-- The search vector now covers the credit too, at a lower weight than the title. A generated
-- column can't be changed in place, so it's rebuilt along with its index.
DROP INDEX tracks_search_idx;
ALTER TABLE tracks DROP COLUMN search_vector;
ALTER TABLE tracks ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', f_unaccent(title)), 'A') ||
  setweight(to_tsvector('simple', f_unaccent(coalesce(credit, ''))), 'B')
) STORED;
CREATE INDEX tracks_search_idx ON tracks USING gin (search_vector);
CREATE INDEX tracks_credit_trgm_idx ON tracks USING gin (f_unaccent(credit) gin_trgm_ops);
