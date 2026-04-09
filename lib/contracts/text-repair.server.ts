import iconv from "iconv-lite";

const KNOWN_MOJIBAKE_SEGMENTS = [
  "鍚堝悓",
  "绛剧讲",
  "璇佹嵁",
  "鏃堕棿绾",
  "涓嬭浇",
  "鍒嗕韩",
  "鏂囨。",
  "澶辫触",
  "鎴愬姛",
  "鍙戣捣",
  "寰呯‘璁",
  "鏈夋晥",
  "璁板綍",
];

function looksLikeUtf8GbkMojibake(value: string) {
  const text = value.trim();
  if (!text || text.length < 2) {
    return false;
  }

  return KNOWN_MOJIBAKE_SEGMENTS.some((segment) => text.includes(segment));
}

export function repairPossibleMojibake(value: string): string {
  if (!looksLikeUtf8GbkMojibake(value)) {
    return value;
  }

  try {
    const repaired = iconv.decode(iconv.encode(value, "gbk"), "utf8");
    if (!repaired || repaired === value) {
      return value;
    }

    if (KNOWN_MOJIBAKE_SEGMENTS.some((segment) => repaired.includes(segment))) {
      return value;
    }

    return repaired;
  } catch {
    return value;
  }
}

export function deepRepairPossibleMojibake<T>(value: T): T {
  if (typeof value === "string") {
    return repairPossibleMojibake(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepRepairPossibleMojibake(item)) as T;
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      result[key] = deepRepairPossibleMojibake(item);
    });
    return result as T;
  }

  return value;
}
