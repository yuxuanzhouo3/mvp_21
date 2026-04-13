const DEFAULT_ANALYSIS_MAX_CHARS = 12_000;
const MIN_ANALYSIS_MAX_CHARS = 2_000;
const MAX_ANALYSIS_MAX_CHARS = 50_000;
const OMITTED_SECTION_MARKER = "\n\n[...middle content omitted for faster AI analysis...]\n\n";
const KEY_LINE_PATTERN =
  /(\d|%|deadline|start|end|payment|deliver|milestone|invoice|acceptance|price|salary|term|penalty|liability|confidential|amount|tax|service fee)/i;

function clampMaxChars(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_ANALYSIS_MAX_CHARS;
  }

  return Math.max(
    MIN_ANALYSIS_MAX_CHARS,
    Math.min(MAX_ANALYSIS_MAX_CHARS, Math.floor(value)),
  );
}

function normalizeConversationText(content: string): string {
  const normalizedLines = content
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/[^\S\n]{2,}/g, " "));

  return normalizedLines.join("\n");
}

function takeByCharBudget(lines: string[], maxChars: number): string {
  if (maxChars <= 0) {
    return "";
  }

  const output: string[] = [];
  let usedChars = 0;
  for (const line of lines) {
    const nextChars = output.length === 0 ? line.length : line.length + 1;
    if (usedChars + nextChars > maxChars) {
      break;
    }
    output.push(line);
    usedChars += nextChars;
  }

  return output.join("\n");
}

function collectKeyLines(content: string): string[] {
  const unique = new Set<string>();
  const lines = content.split("\n");
  for (const line of lines) {
    if (!line || line.length < 8) {
      continue;
    }
    if (!KEY_LINE_PATTERN.test(line)) {
      continue;
    }
    unique.add(line);
    if (unique.size >= 80) {
      break;
    }
  }
  return Array.from(unique);
}

export interface PreparedAnalysisInput {
  content: string;
  originalChars: number;
  normalizedChars: number;
  analyzedChars: number;
  truncated: boolean;
}

export function prepareAnalysisInput(
  rawContent: string,
  options?: { maxChars?: number },
): PreparedAnalysisInput {
  const originalChars = rawContent.length;
  const normalized = normalizeConversationText(rawContent);
  const normalizedChars = normalized.length;
  const maxChars = clampMaxChars(options?.maxChars);

  if (normalizedChars <= maxChars) {
    return {
      content: normalized,
      originalChars,
      normalizedChars,
      analyzedChars: normalizedChars,
      truncated: false,
    };
  }

  const headChars = Math.max(400, Math.floor(maxChars * 0.44));
  const tailChars = Math.max(300, Math.floor(maxChars * 0.26));
  const head = normalized.slice(0, headChars).trim();
  const tail = normalized.slice(-tailChars).trim();

  const markersChars = OMITTED_SECTION_MARKER.length * 2;
  const remainingChars = Math.max(
    0,
    maxChars - head.length - tail.length - markersChars,
  );
  const keyBody = takeByCharBudget(collectKeyLines(normalized), remainingChars);

  let compacted = keyBody
    ? `${head}${OMITTED_SECTION_MARKER}${keyBody}${OMITTED_SECTION_MARKER}${tail}`
    : `${head}${OMITTED_SECTION_MARKER}${tail}`;

  if (compacted.length > maxChars) {
    compacted = `${compacted.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
  }

  return {
    content: compacted,
    originalChars,
    normalizedChars,
    analyzedChars: compacted.length,
    truncated: true,
  };
}

export {
  DEFAULT_ANALYSIS_MAX_CHARS,
  MAX_ANALYSIS_MAX_CHARS,
  MIN_ANALYSIS_MAX_CHARS,
};
