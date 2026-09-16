export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// The access token lives only in memory: a reload drops it, and refreshSession() gets a new one
// from the httpOnly refresh cookie. It never goes in localStorage, where any script could read it.
let accessToken = null;
let refreshInFlight = null;
const sessionEndedListeners = new Set();

export function setAccessToken(token) {
  accessToken = token;
}

// Notifies the listener when a request discovers the session is over (its refresh failed),
// so the UI can switch to logged out. Returns an unsubscribe function.
export function onSessionEnded(listener) {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

async function send(path, { method = 'GET', body, headers, signal } = {}) {
  try {
    return await fetch(`/api${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }
}

// Returns the JSON body of a successful response, or throws an ApiError whose message is safe
// to show the user.
async function readResponse(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (res.ok) return data;

  const error = data?.error;
  if (error) throw new ApiError(res.status, error.code, error.message, error.details);
  // No JSON body: usually the dev proxy reporting that the API isn't running.
  throw new ApiError(res.status, 'HTTP_ERROR', 'The server is unavailable. Try again shortly.');
}

// Calls the API and returns parsed JSON. When the access token has expired it refreshes the
// session once and retries, so callers never handle token expiry themselves.
export async function api(path, options) {
  let res = await send(path, options);

  if (res.status === 401 && accessToken) {
    const data = await res
      .clone()
      .json()
      .catch(() => null);
    if (data?.error?.code === 'INVALID_TOKEN') {
      const session = await refreshSession().catch(() => null);
      if (session?.accessToken) {
        res = await send(path, options);
      } else {
        sessionEndedListeners.forEach((listener) => listener());
      }
    }
  }

  return readResponse(res);
}

// Trades the refresh cookie for { user, accessToken }, both null when nobody is logged in.
// Overlapping callers share one request, so this tab never sends the same cookie twice.
export function refreshSession() {
  refreshInFlight ??= send('/auth/refresh', { method: 'POST' })
    .then(readResponse)
    .then(
      (session) => {
        accessToken = session.accessToken;
        return session;
      },
      (err) => {
        accessToken = null;
        if (err.status === 401) return { user: null, accessToken: null };
        throw err;
      },
    )
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}
