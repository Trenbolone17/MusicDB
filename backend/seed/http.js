// JSON-over-HTTP client for the seed scripts. MusicBrainz rate-limits hard and connections
// to these services sometimes time out or reset, so every request is spaced out,
// time-limited, and retried with growing delays.

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_ATTEMPTS = 6;
const MAX_BACKOFF_MS = 30_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// MusicBrainz and Wikimedia require a descriptive User-Agent with contact details.
function requireUserAgent(userAgent) {
  if (!userAgent || userAgent.includes('your-email@example.com')) {
    throw new Error(
      'Set SEED_USER_AGENT in .env to identify this app, e.g. SEED_USER_AGENT="Songboard/0.1 ( you@example.com )"',
    );
  }
  return userAgent;
}

// MusicBrainz explains its 503s ("server is currently busy" versus "exceeding the allowable
// rate limit"), which is worth keeping in the retry log.
async function errorDetail(response) {
  const text = await response.text().catch(() => '');
  let message = text;
  try {
    message = JSON.parse(text).error ?? text;
  } catch {
    // not JSON; use the raw text
  }
  return String(message).trim().slice(0, 80);
}

function retryAfterMs(response) {
  const seconds = Number(response.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

// Returns { getJson(url) }. Requests go out one at a time, each starting at least
// minIntervalMs after the previous one, and each is tried up to maxAttempts times.
// getJson resolves to parsed JSON, or null for a 404.
function createClient({ userAgent, minIntervalMs, maxAttempts = DEFAULT_MAX_ATTEMPTS, log = () => {} }) {
  let queue = Promise.resolve();
  let lastStart = 0;

  // Chains each task onto the previous one, so concurrent callers still take turns.
  // Retries happen inside the task, which pauses the whole queue while backing off.
  function schedule(task) {
    const run = queue.then(async () => {
      const wait = lastStart + minIntervalMs - Date.now();
      if (wait > 0) await delay(wait);
      lastStart = Date.now();
      return task();
    });
    queue = run.catch(() => {});
    return run;
  }

  async function attempt(url) {
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) return { done: true, value: null };
    if (response.ok) return { done: true, value: await response.json() };
    if (RETRYABLE_STATUS.has(response.status)) {
      const detail = await errorDetail(response);
      return { done: false, waitMs: retryAfterMs(response), reason: `HTTP ${response.status}${detail ? `: ${detail}` : ''}` };
    }
    throw new HttpError(`HTTP ${response.status} for ${url}`, response.status);
  }

  function getJson(url) {
    return schedule(async () => {
      for (let attemptNumber = 1; ; attemptNumber++) {
        let result;
        try {
          result = await attempt(url);
        } catch (err) {
          if (err instanceof HttpError) throw err;
          // Timeouts, connection resets, DNS failures, truncated bodies: all worth retrying.
          result = { done: false, waitMs: 0, reason: err.cause?.code || err.name };
        }
        if (result.done) return result.value;
        if (attemptNumber === maxAttempts) {
          throw new HttpError(`gave up after ${maxAttempts} attempts (${result.reason}): ${url}`);
        }
        // 2s, 4s, 8s, 16s, then 30s each time. MusicBrainz sends "Retry-After: 0" with its
        // 503s, so a server-suggested wait only ever lengthens the backoff.
        const backoffMs = Math.max(result.waitMs, Math.min(1000 * 2 ** attemptNumber, MAX_BACKOFF_MS));
        log(`retrying in ${backoffMs / 1000}s (${result.reason})`);
        await delay(backoffMs);
      }
    });
  }

  return { getJson };
}

module.exports = { createClient, requireUserAgent, HttpError };
