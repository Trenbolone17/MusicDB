// SQL for an item's average rating to one decimal place, or NULL when it has no ratings.
// `alias` is always a table alias written in our own queries, never user input.
const ratingAverage = (alias) => `round(${alias}.rating_sum::numeric / NULLIF(${alias}.rating_count, 0), 1)`;

module.exports = { ratingAverage };
