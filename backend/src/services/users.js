const { query, withTransaction } = require('../db');
const storage = require('../storage');

// Columns describing the signed-in user's own account. Public profiles leave out email.
const SELF_COLUMNS = `id, username, email, display_name AS "displayName", bio, avatar_key AS "avatarKey",
                      is_admin AS "isAdmin", created_at AS "createdAt"`;

// Turns a SELF_COLUMNS row into what the API sends: the stored key becomes a public URL.
function toSelf(row) {
  if (!row) return null;
  const { avatarKey, ...rest } = row;
  return { ...rest, avatarUrl: storage.urlFor(avatarKey) };
}

async function findSelfById(id) {
  const { rows } = await query(`SELECT ${SELF_COLUMNS} FROM users WHERE id = $1`, [id]);
  return toSelf(rows[0]);
}

// Every review the user wrote disappears with the account (ON DELETE CASCADE), so their
// ratings are first subtracted from each item's counters in the same transaction. Returns
// the avatar key, for the caller to remove from storage once the transaction has committed.
async function deleteAccount(userId) {
  return withTransaction(async (client) => {
    for (const [table, column] of [
      ['artists', 'artist_id'],
      ['albums', 'album_id'],
      ['tracks', 'track_id'],
    ]) {
      await client.query(
        `UPDATE ${table} AS target
         SET rating_count = target.rating_count - mine.count,
             rating_sum = target.rating_sum - mine.sum,
             updated_at = now()
         FROM (SELECT ${column} AS id, count(*) AS count, sum(rating) AS sum
                 FROM reviews
                WHERE user_id = $1 AND ${column} IS NOT NULL
                GROUP BY ${column}) AS mine
         WHERE target.id = mine.id`,
        [userId],
      );
    }
    const { rows } = await client.query('DELETE FROM users WHERE id = $1 RETURNING avatar_key AS "avatarKey"', [userId]);
    return rows[0]?.avatarKey ?? null;
  });
}

module.exports = { SELF_COLUMNS, toSelf, findSelfById, deleteAccount };
