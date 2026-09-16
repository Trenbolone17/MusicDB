const { query } = require('../db');

// Columns describing the signed-in user's own account. Public profiles leave out email.
const SELF_COLUMNS = `id, username, email, display_name AS "displayName", bio,
                      is_admin AS "isAdmin", created_at AS "createdAt"`;

async function findSelfById(id) {
  const { rows } = await query(`SELECT ${SELF_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

module.exports = { SELF_COLUMNS, findSelfById };
