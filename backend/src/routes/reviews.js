const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { parseIdParam } = require('../middleware/idParam');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const reviewService = require('../services/reviews');

const PAGE_SIZE = 10;
const MAX_PAGE = 1000;

const RatingSchema = z
  .number('Give a rating from 1 to 10')
  .int('Use a whole number')
  .min(1, 'Rate from 1 to 10')
  .max(10, 'Rate from 1 to 10');

// An empty text box means "rating only", which is stored as NULL.
const BodySchema = z
  .string()
  .trim()
  .max(5000, 'Use at most 5000 characters')
  .transform((text) => text || null)
  .nullable()
  .optional();

const SaveReviewSchema = z.object({ rating: RatingSchema, body: BodySchema });

const EditReviewSchema = z
  .object({ rating: RatingSchema.optional(), body: BodySchema })
  .refine((values) => values.rating !== undefined || values.body !== undefined, {
    message: 'Change the rating or the review text',
  });

const parsePage = (value) => {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
};

// Routes for one target type, e.g. /api/albums/:id/reviews. Each type gets its own router so
// an unknown id reports the right thing ("Album not found").
function createTargetRouter(targetType, { reviewLimiter }) {
  const { column, label } = reviewService.TARGETS[targetType];
  const router = express.Router();
  parseIdParam(router, label);

  // Written reviews, newest first. Ratings without text still count towards the average, but
  // there's nothing to read, so they're left out of the list.
  router.get('/:id/reviews', async (req, res) => {
    const page = parsePage(req.query.page);
    const { rows } = await query(
      `SELECT r.id, r.rating, r.body, r.created_at AS "createdAt", r.updated_at AS "updatedAt",
              json_build_object('username', u.username, 'displayName', u.display_name) AS author,
              count(*) OVER () AS "totalCount"
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.${column} = $1 AND r.body IS NOT NULL
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT $2 OFFSET $3`,
      [req.id, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    );

    res.json({
      items: rows.map(({ totalCount, ...review }) => review),
      page,
      pageSize: PAGE_SIZE,
      total: rows[0]?.totalCount ?? 0,
    });
  });

  router.get('/:id/my-review', requireAuth, async (req, res) => {
    const { rows } = await query(
      `SELECT id, rating, body, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM reviews
       WHERE user_id = $1 AND ${column} = $2`,
      [req.user.id, req.id],
    );
    res.json({ review: rows[0] ?? null });
  });

  // Rating again replaces the previous rating rather than adding a second one.
  router.put('/:id/my-review', requireAuth, reviewLimiter, validateBody(SaveReviewSchema), async (req, res) => {
    const { review, created } = await reviewService.saveReview({
      userId: req.user.id,
      targetType,
      targetId: req.id,
      rating: req.body.rating,
      body: req.body.body ?? null,
    });
    res.status(created ? 201 : 200).json({ review });
  });

  return router;
}

function createReviewsRouter({ reviewLimiter }) {
  const router = express.Router();

  router.use('/artists', createTargetRouter('artist', { reviewLimiter }));
  router.use('/albums', createTargetRouter('album', { reviewLimiter }));
  router.use('/tracks', createTargetRouter('track', { reviewLimiter }));

  const ownReviews = express.Router();
  parseIdParam(ownReviews, 'Review');

  ownReviews.patch('/:id', requireAuth, reviewLimiter, validateBody(EditReviewSchema), async (req, res) => {
    const review = await reviewService.updateReview({
      userId: req.user.id,
      reviewId: req.id,
      rating: req.body.rating,
      body: req.body.body,
    });
    res.json({ review });
  });

  ownReviews.delete('/:id', requireAuth, reviewLimiter, async (req, res) => {
    await reviewService.deleteReview({ userId: req.user.id, reviewId: req.id });
    res.status(204).end();
  });

  router.use('/reviews', ownReviews);
  return router;
}

module.exports = { createReviewsRouter };
