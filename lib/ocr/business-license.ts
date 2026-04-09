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

  constructor(message: string, code: string, status = 500) {
    super(message);
    this.name = "BusinessLicenseOcrError";
    this.code = code;
    this.status = status;
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

const FIELD_ALIASES: Record<keyof BusinessLicenseInfo, string[]> = {
  companyName: [
    "companyName",
    "company_name",
    "企业名称",
    "公司名称",
    "名称",
  ],
  creditCode: [
    "creditCode",
    "credit_code",
    "socialCreditCode",
    "registrationCode",
    "统一社会信用代码",
    "信用代码",
    "注册号",
  ],
  legalPerson: [
    "legalPerson",
    "legalRepresentative",
    "legal_person",
    "法人",
    "法定代表人",
    "经营者",
  ],
  address: [
    "address",
    "registeredAddress",
    "registered_address",
    "注册地址",
    "住所",
    "营业场所",
  ],
};

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .replace(/[；，。]\s*$/, "")
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

function pickRegexValue(rawText: string, labels: string[]): string {
  for (const label of labels) {
    const regex = new RegExp(
      `${label}\\s*[：:]\\s*["“”]?([^"“”\\n]+)["“”]?`,
      "i",
    );
    const match = rawText.match(regex);
    if (match?.[1]) {
      return normalizeText(match[1]);
    }
  }

  return "";
}

function parseRegexResult(rawText: string): BusinessLicenseInfo {
  return {
    companyName: pickRegexValue(rawText, ["企业名称", "公司名称", "companyName"]),
    creditCode: pickRegexValue(rawText, [
      "统一社会信用代码",
      "信用代码",
      "creditCode",
      "registrationCode",
    ]),
    legalPerson: pickRegexValue(rawText, [
      "法定代表人",
      "法人",
      "经营者",
      "legalPerson",
    ]),
    address: pickRegexValue(rawText, [
      "注册地址",
      "住所",
      "营业场所",
      "address",
    ]),
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
    );
  }

  const response = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DASHSCOPE_OCR_MODEL || "qwen-vl-plus",
        input: {
          messages: [
            {
              role: "user",
              content: [
                { image: imageBase64 },
                { text: OCR_PROMPT },
              ],
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 401 || response.status === 403) {
      throw new BusinessLicenseOcrError(
        `DASHSCOPE_API_KEY is unavailable: ${errorText}`,
        "OCR_KEY_UNAVAILABLE",
        503,
      );
    }

    throw new BusinessLicenseOcrError(
      `DashScope OCR failed: ${errorText}`,
      "OCR_PROVIDER_FAILED",
      502,
    );
  }

  const result = await response.json();
  const content = result?.output?.choices?.[0]?.message?.content;

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part?.text === "string" ? part.text : "",
      )
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
  );
}

export async function analyzeBusinessLicense(
  imageBase64: string,
): Promise<BusinessLicenseAnalysisResult> {
  const rawText = await callDashScope(imageBase64);
  const data = normalizeAnalysis(rawText);

  ensureAtLeastOneField(data);

  return {
    provider: "dashscope",
    rawText,
    data,
  };
}
