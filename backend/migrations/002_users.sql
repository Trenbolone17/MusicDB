CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text NOT NULL CHECK (username ~ '^[A-Za-z0-9_]{3,30}$'),
  email         text NOT NULL CHECK (length(email) <= 254),
  password_hash text NOT NULL,
  display_name  text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 50),
  bio           text NOT NULL DEFAULT '' CHECK (length(bio) <= 1000),
  avatar_key    text,                         -- storage key; storage.urlFor() turns it into a URL
  is_admin      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness: "Alice" and "alice" are the same account.
CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));
CREATE UNIQUE INDEX users_email_lower_key    ON users (lower(email));

CREATE TABLE refresh_tokens (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,           -- sha256 of the raw token; the raw token lives only in the cookie
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
