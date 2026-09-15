-- Extensions used by search: trigram similarity for typo tolerance, and accent stripping.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() is only STABLE, so Postgres rejects it in generated columns and index
-- expressions. Pinning the dictionary and declaring the wrapper IMMUTABLE is the
-- documented workaround.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN public.unaccent('public.unaccent'::regdictionary, $1);
