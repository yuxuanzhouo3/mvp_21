function normalizeErrorText(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }

  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

export function readOAuthCallbackError(hash: string): string | undefined {
  if (!hash) {
    return undefined;
  }

  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!fragment) {
    return undefined;
  }

  const params = new URLSearchParams(fragment);
  return (
    normalizeErrorText(params.get("error_description")) ||
    normalizeErrorText(params.get("error")) ||
    normalizeErrorText(params.get("error_code"))
  );
}
