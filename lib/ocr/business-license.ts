import { isChinaRegion } from "@/lib/config/region";
import { getQwenModel } from "@/lib/config/runtime-env";

export interface BusinessLicenseInfo {
  companyName: string;
  creditCode: string;
  legalPerson: string;
  address: string;
}

export interface BusinessLicenseAnalysisResult {
  provider: "dashscope";
  rawText: string;
  data: BusinessLicenseInfo;
}

export class BusinessLicenseOcrError extends Error {
  status: number;
  code: string;
  provider?: "dashscope";

  constructor(
    message: string,
    code: string,
    status = 500,
    provider?: "dashscope",
  ) {
    super(message);
    this.name = "BusinessLicenseOcrError";
    this.code = code;
    this.status = status;
    this.provider = provider;
  }
}

const OCR_PROMPT = `Read this business registration or business license image and extract these fields:
1. companyName
2. creditCode
3. legalPerson
4. address

Return JSON only. Do not wrap it in markdown.
If a field is missing, use an empty string.

Example:
{
  "companyName": "Example Co., Ltd.",
  "creditCode": "91310000XXXXXXXXXX",
  "legalPerson": "Jane Doe",
  "address": "Registered address"
}`;

const CHINESE_LABELS = {
  companyName: ["\u4f01\u4e1a\u540d\u79f0", "\u516c\u53f8\u540d\u79f0", "\u540d\u79f0"],
  creditCode: [
    "\u7edf\u4e00\u793e\u4f1a\u4fe1\u7528\u4ee3\u7801",
    "\u4fe1\u7528\u4ee3\u7801",
    "\u6ce8\u518c\u53f7",
  ],
  legalPerson: [
    "\u6cd5\u4eba",
    "\u6cd5\u5b9a\u4ee3\u8868\u4eba",
    "\u7ecf\u8425\u8005",
  ],
  address: ["\u6ce8\u518c\u5730\u5740", "\u4f4f\u6240", "\u8425\u4e1a\u573a\u6240"],
} as const;

const FIELD_ALIASES: Record<keyof BusinessLicenseInfo, string[]> = {
  companyName: ["companyName", "company_name", ...CHINESE_LABELS.companyName],
  creditCode: [
    "creditCode",
    "credit_code",
    "socialCreditCode",
    "registrationCode",
    ...CHINESE_LABELS.creditCode,
  ],
  legalPerson: [
    "legalPerson",
    "legalRepresentative",
    "legal_person",
    ...CHINESE_LABELS.legalPerson,
  ],
  address: ["address", "registeredAddress", "registered_address", ...CHINESE_LABELS.address],
};

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(raw || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveOcrProviderTimeoutMs() {
  const fallback = parsePositiveInt(process.env.AI_PROVIDER_TIMEOUT_MS, 15_000);
  const configured = parsePositiveInt(process.env.OCR_PROVIDER_TIMEOUT_MS, fallback);
  return Math.max(2_000, Math.min(60_000, configured));
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .replace(/[;，。,]\s*$/, "")
    .trim();
}

function stripMarkdownFence(value: string): string {
  return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function extractJsonCandidate(value: string): string | null {
  const cleaned = stripMarkdownFence(value);
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function normalizeFromObject(record: Record<string, unknown>): BusinessLicenseInfo {
  const result: BusinessLicenseInfo = {
    companyName: "",
    creditCode: "",
    legalPerson: "",
    address: "",
  };

  (Object.keys(FIELD_ALIASES) as Array<keyof BusinessLicenseInfo>).forEach((key) => {
    for (const alias of FIELD_ALIASES[key]) {
      const candidate = normalizeText(record[alias]);
      if (candidate) {
        result[key] = candidate;
        break;
      }
    }
  });

  return result;
}

function parseJsonResult(rawText: string): BusinessLicenseInfo | null {
  const candidate = extractJsonCandidate(rawText);
  if (!candidate) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return normalizeFromObject(parsed);
  } catch {
    return null;
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickRegexValue(rawText: string, labels: string[]): string {
  for (const label of labels) {
    const pattern = new RegExp(
      `${escapeRegex(label)}\\s*[:：]\\s*["“”']?([^"“”'\\n]+)["“”']?`,
      "i",
    );
    const match = rawText.match(pattern);
    if (match?.[1]) {
      return normalizeText(match[1]);
    }
  }

  return "";
}

function parseRegexResult(rawText: string): BusinessLicenseInfo {
  return {
    companyName: pickRegexValue(rawText, ["companyName", ...CHINESE_LABELS.companyName]),
    creditCode: pickRegexValue(rawText, [
      "creditCode",
      "socialCreditCode",
      "registrationCode",
      ...CHINESE_LABELS.creditCode,
    ]),
    legalPerson: pickRegexValue(rawText, ["legalPerson", ...CHINESE_LABELS.legalPerson]),
    address: pickRegexValue(rawText, ["address", "registeredAddress", ...CHINESE_LABELS.address]),
  };
}

function normalizeAnalysis(rawText: string): BusinessLicenseInfo {
  const fromJson = parseJsonResult(rawText);
  const fromRegex = parseRegexResult(rawText);

  return {
    companyName: fromJson?.companyName || fromRegex.companyName,
    creditCode: fromJson?.creditCode || fromRegex.creditCode,
    legalPerson: fromJson?.legalPerson || fromRegex.legalPerson,
    address: fromJson?.address || fromRegex.address,
  };
}

function ensureAtLeastOneField(data: BusinessLicenseInfo) {
  if (!data.companyName && !data.creditCode && !data.legalPerson && !data.address) {
    throw new BusinessLicenseOcrError(
      "No recognizable business license fields were returned",
      "OCR_EMPTY_RESULT",
      502,
    );
  }
}

async function callDashScope(imageBase64: string): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey?.trim()) {
    throw new BusinessLicenseOcrError(
      "DASHSCOPE_API_KEY is unavailable",
      "OCR_KEY_UNAVAILABLE",
      503,
      "dashscope",
    );
  }

  const timeoutMs = resolveOcrProviderTimeoutMs();
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort("OCR_TIMEOUT"), timeoutMs);

  let response: Response;
  try {
    response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: abortController.signal,
        body: JSON.stringify({
          model: process.env.DASHSCOPE_OCR_MODEL || "qwen-vl-plus",
          input: {
            messages: [
              {
                role: "user",
                content: [{ image: imageBase64 }, { text: OCR_PROMPT }],
              },
            ],
          },
        }),
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || /timeout|timed out|aborted|abort/i.test(error.message))
    ) {
      throw new BusinessLicenseOcrError(
        `DashScope OCR timeout after ${timeoutMs}ms`,
        "OCR_TIMEOUT",
        504,
        "dashscope",
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new BusinessLicenseOcrError(
      `DashScope OCR request failed: ${message}`,
      "OCR_PROVIDER_FAILED",
      502,
      "dashscope",
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new BusinessLicenseOcrError(
        `DASHSCOPE_API_KEY is unavailable: ${errorText}`,
        "OCR_KEY_UNAVAILABLE",
        503,
        "dashscope",
      );
    }
    if (response.status === 408 || response.status === 504) {
      throw new BusinessLicenseOcrError(
        `DashScope OCR timeout: ${errorText}`,
        "OCR_TIMEOUT",
        504,
        "dashscope",
      );
    }
    throw new BusinessLicenseOcrError(
      `DashScope OCR failed: ${errorText}`,
      "OCR_PROVIDER_FAILED",
      502,
      "dashscope",
    );
  }

  const result = await response.json();
  const content = result?.output?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
  }
  if (typeof content === "string") {
    return content;
  }

  throw new BusinessLicenseOcrError(
    "DashScope OCR returned an empty response",
    "OCR_EMPTY_RESPONSE",
    502,
    "dashscope",
  );
}

async function callOcrProvider(imageBase64: string) {
  const rawText = await callDashScope(imageBase64);
  return { provider: "dashscope" as const, rawText };
}

export async function analyzeBusinessLicense(
  imageBase64: string,
): Promise<BusinessLicenseAnalysisResult> {
  const { provider, rawText } = await callOcrProvider(imageBase64);
  const data = normalizeAnalysis(rawText);

  ensureAtLeastOneField(data);

  return {
    provider,
    rawText,
    data,
  };
}

export function getBusinessLicenseOcrProvider(): "dashscope" {
  return "dashscope";
}

export function getBusinessLicenseOcrModel() {
  return process.env.DASHSCOPE_OCR_MODEL || getQwenModel();
}
