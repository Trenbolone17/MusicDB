const path = require('node:path');
const { z } = require('zod');

// One .env at the repo root is shared by the backend, docker-compose, and Vite.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters (see .env.example)'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_REVIEW_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_REVIEW_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),
  // Where uploaded profile pictures go. 'disk' writes under UPLOADS_DIR (relative to backend/)
  // and serves them at PUBLIC_UPLOADS_URL; an S3 driver would slot in here later.
  STORAGE_DRIVER: z.enum(['disk']).default('disk'),
  UPLOADS_DIR: z.string().min(1).default('uploads'),
  PUBLIC_UPLOADS_URL: z.string().min(1).default('/uploads'),
  // Only the seed scripts use these, so the API starts without them.
  SEED_USER_AGENT: z.string().min(1).optional(),
  SEED_MAX_ALBUMS_PER_ARTIST: z.coerce.number().int().positive().default(15),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration (see .env.example):\n${problems.join('\n')}`);
}

const env = parsed.data;
const isTest = env.NODE_ENV === 'test';

// .env.example ships a placeholder secret so local setup works out of the box; never deploy it.
if (env.NODE_ENV === 'production' && env.JWT_ACCESS_SECRET.includes('change-me')) {
  throw new Error('Set a real JWT_ACCESS_SECRET before running in production');
}
const databaseUrl = isTest ? env.TEST_DATABASE_URL : env.DATABASE_URL;

// Tests truncate tables, so refuse to run them against anything but a *_test database.
if (isTest) {
  const dbName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
  if (!dbName.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must be set and name a database ending in "_test"');
  }
}

module.exports = {
  nodeEnv: env.NODE_ENV,
  isTest,
  port: env.PORT,
  databaseUrl,
  auth: {
    accessTokenSecret: env.JWT_ACCESS_SECRET,
    accessTokenTtlMinutes: env.ACCESS_TOKEN_TTL_MINUTES,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    cookieSecure: env.COOKIE_SECURE,
  },
  rateLimits: {
    auth: { max: env.RATE_LIMIT_AUTH_MAX, windowMs: env.RATE_LIMIT_AUTH_WINDOW_MINUTES * 60_000 },
    review: { max: env.RATE_LIMIT_REVIEW_MAX, windowMs: env.RATE_LIMIT_REVIEW_WINDOW_MINUTES * 60_000 },
  },
  storage: {
    driver: env.STORAGE_DRIVER,
    uploadsDir: path.resolve(__dirname, '..', env.UPLOADS_DIR),
    publicUrl: env.PUBLIC_UPLOADS_URL.replace(/\/$/, ''),
  },
  seed: {
    userAgent: env.SEED_USER_AGENT,
    maxAlbumsPerArtist: env.SEED_MAX_ALBUMS_PER_ARTIST,
  },
};
