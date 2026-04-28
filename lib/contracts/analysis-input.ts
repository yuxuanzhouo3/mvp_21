export interface AnalysisInputOptions {
  maxChars?: number;
}

export interface PreparedAnalysisInput {
  content: string;
  truncated: boolean;
  analyzedChars: number;
}

const OMITTED_MARKER = "[...middle content omitted for faster AI analysis...]";

function normalizeInput(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function clampMaxChars(maxChars?: number): number {
  const parsed = Number(maxChars);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 2_600;
  }
  return Math.max(200, Math.floor(parsed));
}

function compactByHeadTail(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }

  const marker = `\n${OMITTED_MARKER}\n`;
  const budget = maxChars - marker.length;
  if (budget <= 40) {
    return content.slice(0, maxChars);
  }

  const headBudget = Math.ceil(budget * 0.55);
  const tailBudget = Math.max(0, budget - headBudget);
  const head = content.slice(0, headBudget).trimEnd();
  const tail = content.slice(-tailBudget).trimStart();
  const compacted = `${head}${marker}${tail}`;

  return compacted.length <= maxChars ? compacted : compacted.slice(0, maxChars);
}

export function prepareAnalysisInput(
  sourceText: string,
  options: AnalysisInputOptions = {},
): PreparedAnalysisInput {
  const maxChars = clampMaxChars(options.maxChars);
  const normalized = normalizeInput(sourceText || "");

  if (normalized.length <= maxChars) {
    return {
      content: normalized,
      truncated: false,
      analyzedChars: normalized.length,
    };
  }

  const compacted = compactByHeadTail(normalized, maxChars);
  return {
    content: compacted,
    truncated: true,
    analyzedChars: compacted.length,
  };
}
