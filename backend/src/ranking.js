// Ranking formulas for the charts. Everything that turns ratings into an order lives here, in
// both a JavaScript and a SQL form, and the tests check that the two agree.
//
// "Top" charts use a Bayesian weighted average, the same idea as IMDb's Top 250:
//
//   score = (rating_sum + m * C) / (rating_count + m)
//
// C is the mean of every rating of that type (the "global mean") and m is PRIOR_WEIGHT. It's
// as if each item started with m virtual votes at the global mean, so one perfect 10 can't
// outrank a 9.2 backed by hundreds of ratings. As real ratings pile up, the score approaches
// the plain average.
//
// "Trending" charts use the same formula, but each rating is weighted by how recent it is:
//
//   w = 0.5 ^ (age_days / TRENDING_HALF_LIFE_DAYS)
//   trending = (sum(w * rating) + m * C) / (sum(w) + m)
//
// Age is measured from the rating's updated_at, so a changed rating counts as fresh. Ratings
// older than TRENDING_WINDOW_DAYS are dropped; their weight is below 2% by then anyway.

const PRIOR_WEIGHT = 5;
const TRENDING_HALF_LIFE_DAYS = 14;
const TRENDING_WINDOW_DAYS = 90;

function bayesianScore({ ratingSum, ratingCount, globalMean, priorWeight = PRIOR_WEIGHT }) {
  return (ratingSum + priorWeight * globalMean) / (ratingCount + priorWeight);
}

function decayWeight(ageDays, halfLifeDays = TRENDING_HALF_LIFE_DAYS) {
  return 0.5 ** (ageDays / halfLifeDays);
}

// `ratings` is a list of { rating, ageDays } for one item.
function trendingScore({ ratings, globalMean, priorWeight = PRIOR_WEIGHT, halfLifeDays = TRENDING_HALF_LIFE_DAYS }) {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const { rating, ageDays } of ratings) {
    const weight = decayWeight(ageDays, halfLifeDays);
    weightedSum += weight * rating;
    weightTotal += weight;
  }
  return (weightedSum + priorWeight * globalMean) / (weightTotal + priorWeight);
}

// --- SQL forms of the same formulas ---
// Table names and aliases come from our own maps, never from user input, and the constants are
// numbers from this file, so interpolating them is safe.

// A CTE named "global" holding C for one table. coalesce() makes an unrated catalog score 0
// rather than NULL, which keeps the arithmetic below well-defined.
function globalMeanCte(table) {
  return `global AS (
    SELECT coalesce(sum(rating_sum)::numeric / nullif(sum(rating_count), 0), 0) AS mean
    FROM ${table}
  )`;
}

// The "top" score for a row of the aliased table. Needs the global CTE in scope.
function topScoreSql(alias) {
  return `(${alias}.rating_sum + ${PRIOR_WEIGHT} * global.mean) / (${alias}.rating_count + ${PRIOR_WEIGHT})`;
}

// A CTE named "recent" with each item's decayed rating sum and weight total over the window.
// reviews.target_type is filtered first, so the (target_type, updated_at) index applies.
function recentRatingsCte(reviewColumn, targetType) {
  return `recent AS (
    SELECT r.${reviewColumn} AS id,
           sum(r.rating * w.weight) AS weighted_sum,
           sum(w.weight) AS weighted_count
    FROM reviews r
    CROSS JOIN LATERAL (
      SELECT power(0.5, extract(epoch FROM now() - r.updated_at) / 86400.0 / ${TRENDING_HALF_LIFE_DAYS}) AS weight
    ) w
    WHERE r.target_type = '${targetType}'
      AND r.updated_at > now() - make_interval(days => ${TRENDING_WINDOW_DAYS})
    GROUP BY r.${reviewColumn}
  )`;
}

// The "trending" score for a row joined to the recent CTE. Needs the global CTE in scope.
const trendingScoreSql = `(recent.weighted_sum + ${PRIOR_WEIGHT} * global.mean) / (recent.weighted_count + ${PRIOR_WEIGHT})`;

module.exports = {
  PRIOR_WEIGHT,
  TRENDING_HALF_LIFE_DAYS,
  TRENDING_WINDOW_DAYS,
  bayesianScore,
  decayWeight,
  trendingScore,
  globalMeanCte,
  topScoreSql,
  recentRatingsCte,
  trendingScoreSql,
};
