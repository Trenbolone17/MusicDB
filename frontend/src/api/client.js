export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Calls the API and returns parsed JSON. Throws ApiError, whose message is safe to show
// the user, for network failures and for any non-2xx response.
export async function api(path, { method = 'GET', body, headers, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }

  const data = await res.json().catch(() => null);
  if (res.ok) return data;

  const error = data?.error;
  if (error) throw new ApiError(res.status, error.code, error.message, error.details);
  // No JSON body: usually the dev proxy reporting that the API isn't running.
  throw new ApiError(res.status, 'HTTP_ERROR', 'The server is unavailable. Try again shortly.');
}
