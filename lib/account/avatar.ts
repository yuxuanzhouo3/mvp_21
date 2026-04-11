function stripWrappingQuotes(value: string): string {
  const source = value.trim();
  if (!source) {
    return source;
  }

  const first = source[0];
  const last = source[source.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return source.slice(1, -1).trim();
  }

  return source;
}

function hasUnsafeProtocol(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:text/html")
  );
}

function normalizeCandidate(value: string): string | undefined {
  const unescaped = stripWrappingQuotes(value).replace(/\\\//g, "/").trim();
  if (!unescaped || hasUnsafeProtocol(unescaped)) {
    return undefined;
  }

  const lower = unescaped.toLowerCase();

  if (
    lower.startsWith("data:image/") ||
    lower.startsWith("blob:") ||
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    unescaped.startsWith("/")
  ) {
    return unescaped;
  }

  if (unescaped.startsWith("//")) {
    return `https:${unescaped}`;
  }

  if (unescaped.startsWith("www.")) {
    return `https://${unescaped}`;
  }

  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#]|$)/i.test(unescaped)) {
    return `https://${unescaped}`;
  }

  return undefined;
}

export function normalizeAvatarSrc(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return normalizeCandidate(value);
}

export function pickAvatarSrcFromRecord(
  value: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidates: unknown[] = [
    value.avatar,
    value.avatar_url,
    value.picture,
    value.photo,
    value.photo_url,
    value.photoURL,
    value.headimgurl,
    value.headImgUrl,
    value.image,
    value.image_url,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAvatarSrc(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}
