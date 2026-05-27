/**
 * Wrapper around fetch for Linbis API calls.
 * On 401, it calls refreshAccessToken() to get a fresh token and retries ONCE.
 */
export async function linbisFetch(
  url: string,
  options: RequestInit,
  accessToken: string,
  refreshAccessToken: () => Promise<string>,
): Promise<Response> {
  // First attempt with the current token
  const headers = {
    ...Object.fromEntries(new Headers(options.headers).entries()),
    Authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Token likely expired — refresh and retry once
    console.log("[linbisFetch] 401 received, refreshing token and retrying...");
    const newToken = await refreshAccessToken();

    const retryHeaders = {
      ...Object.fromEntries(new Headers(options.headers).entries()),
      Authorization: `Bearer ${newToken}`,
    };

    return fetch(url, { ...options, headers: retryHeaders });
  }

  return response;
}
