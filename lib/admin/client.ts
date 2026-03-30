import { tokenManager } from "@/lib/auth/frontend-token-manager";

function mergeHeaders(headers?: HeadersInit, authHeaders?: HeadersInit) {
  const merged = new Headers(headers);

  if (authHeaders) {
    new Headers(authHeaders).forEach((value, key) => {
      merged.set(key, value);
    });
  }

  return merged;
}

async function parseJsonSafely(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function getAdminAuthHeaders() {
  const headers = await tokenManager.getAuthHeaderAsync();
  if (!headers) {
    throw new Error("Authentication expired, please sign in again.");
  }

  return headers;
}

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const authHeaders = await getAdminAuthHeaders();

  return fetch(input, {
    ...init,
    headers: mergeHeaders(init.headers, authHeaders),
  });
}

export async function adminFetchJson<T = any>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<T> {
  const response = await adminFetch(input, init);
  const payload = await parseJsonSafely(response);

  if (!response.ok || payload?.success === false) {
    const message =
      payload?.error?.message ||
      payload?.error ||
      `Admin request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}
