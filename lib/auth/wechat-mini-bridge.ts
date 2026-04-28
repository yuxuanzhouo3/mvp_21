export interface NormalizedMiniProgramLoginPayload {
  type: string;
  requestId: string;
  token: string;
  accessToken: string;
  openid: string;
  unionid: string;
  mpCode: string;
  code: string;
  mpNickName: string;
  nickName: string;
  mpAvatarUrl: string;
  avatarUrl: string;
  error: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(
  record: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function hasInterestingMiniLoginField(record: Record<string, unknown>) {
  return Boolean(
    readString(
      record,
      "type",
      "requestId",
      "token",
      "accessToken",
      "openid",
      "unionid",
      "mpCode",
      "code",
      "mpNickName",
      "nickName",
      "mpAvatarUrl",
      "avatarUrl",
      "error",
      "errmsg",
      "message",
    ),
  );
}

function unwrapMiniProgramPayload(
  input: unknown,
): Record<string, unknown> | null {
  if (!isRecord(input)) {
    return null;
  }

  const queue: Record<string, unknown>[] = [input];
  const visited = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (hasInterestingMiniLoginField(current)) {
      return current;
    }

    for (const key of ["data", "detail", "payload"]) {
      const nested = current[key];
      if (isRecord(nested)) {
        queue.push(nested);
      }
    }
  }

  return input;
}

export function normalizeMiniProgramLoginPayload(
  input: unknown,
): NormalizedMiniProgramLoginPayload | null {
  const record = unwrapMiniProgramPayload(input);
  if (!record) {
    return null;
  }

  const normalized: NormalizedMiniProgramLoginPayload = {
    type: readString(record, "type", "event"),
    requestId: readString(record, "requestId"),
    token: readString(record, "token"),
    accessToken: readString(record, "accessToken"),
    openid: readString(record, "openid", "openId"),
    unionid: readString(record, "unionid", "unionId"),
    mpCode: readString(record, "mpCode"),
    code: readString(record, "code"),
    mpNickName: readString(record, "mpNickName"),
    nickName: readString(record, "nickName", "nickname"),
    mpAvatarUrl: readString(record, "mpAvatarUrl"),
    avatarUrl: readString(record, "avatarUrl"),
    error: readString(record, "error", "errmsg", "message"),
  };

  if (
    !normalized.type &&
    !normalized.requestId &&
    !normalized.token &&
    !normalized.accessToken &&
    !normalized.openid &&
    !normalized.unionid &&
    !normalized.mpCode &&
    !normalized.code &&
    !normalized.mpNickName &&
    !normalized.nickName &&
    !normalized.mpAvatarUrl &&
    !normalized.avatarUrl &&
    !normalized.error
  ) {
    return null;
  }

  return normalized;
}

export function hasMiniProgramLoginCredential(
  payload: NormalizedMiniProgramLoginPayload | null | undefined,
) {
  return Boolean(payload?.token || payload?.accessToken || payload?.mpCode || payload?.code);
}

export function buildMiniProgramLoginCallbackKey(
  payload: NormalizedMiniProgramLoginPayload,
) {
  return [
    payload.requestId,
    payload.token || payload.accessToken,
    payload.mpCode || payload.code,
    payload.openid,
  ].join("|");
}

export function readMiniProgramLoginPayloadFromSearch(search: string) {
  const params = new URLSearchParams(search);
  return normalizeMiniProgramLoginPayload(Object.fromEntries(params.entries()));
}
