const path = require('node:path');
const { z } = require('zod');

// One .env at the repo root is shared by the backend, docker-compose, and Vite.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration (see .env.example):\n${problems.join('\n')}`);
}

const env = parsed.data;
const isTest = env.NODE_ENV === 'test';
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
};
