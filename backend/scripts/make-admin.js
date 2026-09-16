// Grants (or, with --revoke, removes) admin rights for one account. There's deliberately no
// UI for this: an admin is made from the server, by whoever runs it.
//
//   npm run make-admin -- <username>
//   npm run make-admin -- <username> --revoke
const { pool, query } = require('../src/db');

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const username = args.find((arg) => !arg.startsWith('--'));
  if (!username) throw new Error('Usage: npm run make-admin -- <username> [--revoke]');

  const { rows } = await query(
    'UPDATE users SET is_admin = $2, updated_at = now() WHERE lower(username) = lower($1) RETURNING username',
    [username, !revoke],
  );
  if (rows.length === 0) throw new Error(`No account named "${username}"`);
  console.log(`${rows[0].username} is ${revoke ? 'no longer' : 'now'} an admin.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
