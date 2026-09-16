const { withTransaction } = require('../db');
const { forbidden, notFound } = require('../errors');

// A review points at exactly one target through one of three columns. Everything here works
// off this map; the table names come from it, never from user input.
const TARGETS = {
  artist: { column: 'artist_id', table: 'artists', label: 'Artist' },
  album: { column: 'album_id', table: 'albums', label: 'Album' },
  track: { column: 'track_id', table: 'tracks', label: 'Track' },
};

const REVIEW_COLUMNS = `id, rating, body, created_at AS "createdAt", updated_at AS "updatedAt"`;

// Locks the target row, so everyone rating the same item queues up instead of racing on its
// counters, and confirms the item exists. Every write below takes this lock first, which also
// keeps the lock order the same everywhere and rules out deadlocks.
async function lockTarget(client, target, targetId) {
  const { rows } = await client.query(`SELECT id FROM ${target.table} WHERE id = $1 FOR UPDATE`, [targetId]);
  if (rows.length === 0) throw notFound(`${target.label} not found`);
}

// Moves the denormalised counters, in the same transaction as the review write so they can't drift.
function applyRatingDelta(client, target, targetId, countDelta, sumDelta) {
  return client.query(
    `UPDATE ${target.table}
     SET rating_count = rating_count + $2, rating_sum = rating_sum + $3, updated_at = now()
     WHERE id = $1`,
    [targetId, countDelta, sumDelta],
  );
}

// Loads a review for editing or deleting: the target is locked first (same order as saving),
// then the review row itself, so a concurrent delete can't slip in between.
async function loadOwnReviewForWrite(client, reviewId, userId) {
  const located = await client.query(
    `SELECT target_type AS "targetType", coalesce(artist_id, album_id, track_id) AS "targetId"
     FROM reviews WHERE id = $1`,
    [reviewId],
  );
  if (located.rows.length === 0) throw notFound('Review not found');

  const target = TARGETS[located.rows[0].targetType];
  const targetId = located.rows[0].targetId;
  await lockTarget(client, target, targetId);

  const { rows } = await client.query(
    `SELECT id, user_id AS "userId", rating, body FROM reviews WHERE id = $1 FOR UPDATE`,
    [reviewId],
  );
  const review = rows[0];
  if (!review) throw notFound('Review not found');
  // Ownership is decided here, from the database, never from what the client claims.
  if (review.userId !== userId) throw forbidden('You can only change your own reviews');

  return { review, target, targetId };
}

// Creates or replaces this user's rating of one item. Submitting again updates the existing
// row; the unique (user, target) constraints make a second row impossible anyway.
async function saveReview({ userId, targetType, targetId, rating, body }) {
  const target = TARGETS[targetType];

  return withTransaction(async (client) => {
    await lockTarget(client, target, targetId);

    const existing = await client.query(
      `SELECT id, rating FROM reviews WHERE user_id = $1 AND ${target.column} = $2 FOR UPDATE`,
      [userId, targetId],
    );

    if (existing.rows.length > 0) {
      const previous = existing.rows[0];
      const { rows } = await client.query(
        `UPDATE reviews SET rating = $2, body = $3, updated_at = now()
         WHERE id = $1
         RETURNING ${REVIEW_COLUMNS}`,
        [previous.id, rating, body],
      );
      await applyRatingDelta(client, target, targetId, 0, rating - previous.rating);
      return { review: rows[0], created: false };
    }

    const { rows } = await client.query(
      `INSERT INTO reviews (user_id, ${target.column}, rating, body)
       VALUES ($1, $2, $3, $4)
       RETURNING ${REVIEW_COLUMNS}`,
      [userId, targetId, rating, body],
    );
    await applyRatingDelta(client, target, targetId, 1, rating);
    return { review: rows[0], created: true };
  });
}

// Edits the author's own review. Fields left out keep their current value.
async function updateReview({ userId, reviewId, rating, body }) {
  return withTransaction(async (client) => {
    const { review, target, targetId } = await loadOwnReviewForWrite(client, reviewId, userId);

    const nextRating = rating ?? review.rating;
    const nextBody = body === undefined ? review.body : body;
    const { rows } = await client.query(
      `UPDATE reviews SET rating = $2, body = $3, updated_at = now()
       WHERE id = $1
       RETURNING ${REVIEW_COLUMNS}`,
      [reviewId, nextRating, nextBody],
    );
    await applyRatingDelta(client, target, targetId, 0, nextRating - review.rating);
    return rows[0];
  });
}

async function deleteReview({ userId, reviewId }) {
  await withTransaction(async (client) => {
    const { review, target, targetId } = await loadOwnReviewForWrite(client, reviewId, userId);
    await client.query('DELETE FROM reviews WHERE id = $1', [reviewId]);
    await applyRatingDelta(client, target, targetId, -1, -review.rating);
  });
}

module.exports = { TARGETS, saveReview, updateReview, deleteReview };
