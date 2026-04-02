import { isChinaRegion } from "@/lib/config/region";

export interface ContractChatScreenshotData {
  sourceType: "wechat" | "feishu" | "screenshot";
  conversationText: string;
  summary: string;
}

export interface ContractChatScreenshotAnalysisResult {
  provider: "dashscope" | "openai";
  rawText: string;
  data: ContractChatScreenshotData;
}

export class ContractChatOcrError extends Error {
  status: number;
  code: string;

  constructor(message: string, code: string, status = 500) {
    super(message);
    this.name = "ContractChatOcrError";
    this.code = code;
    this.status = status;
  }
}

const OCR_PROMPT = `You are extracting chat content from a contract negotiation screenshot.

Tasks:
1. Identify the sourceType as one of "wechat", "feishu", or "screenshot".
2. Extract all readable conversation text in reading order.
3. Preserve speaker names when visible.
4. Output concise plain text, one message per line.
5. Write a short summary of the contract-related facts you can see.

Return JSON only. Do not wrap it in markdown.

Schema:
{
  "sourceType": "wechat",
  "conversationText": "Alice: ...\\nBob: ...",
  "summary": "Short summary"
}`;

function stripMarkdownFence(value: string) {
  return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function extractJsonCandidate(value: string) {
  const cleaned = stripMarkdownFence(value);
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\r/g, "").trim();
}

function normalizeSourceType(value: unknown): ContractChatScreenshotData["sourceType"] {
  if (value === "wechat" || value === "feishu") {
    return value;
  }

  return "screenshot";
}

function extractOpenAIText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function parseRawResult(rawText: string): ContractChatScreenshotData {
  const candidate = extractJsonCandidate(rawText);
  if (!candidate) {
    return {
      sourceType: "screenshot",
      conversationText: stripMarkdownFence(rawText),
      summary: "",
    };
  }

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    return {
      sourceType: normalizeSourceType(parsed.sourceType),
      conversationText: normalizeText(parsed.conversationText),
      summary: normalizeText(parsed.summary),
    };
  } catch {
    return {
      sourceType: "screenshot",
      conversationText: stripMarkdownFence(rawText),
      summary: "",
    };
  }
}

function ensureResult(data: ContractChatScreenshotData) {
  if (!data.conversationText.trim()) {
    throw new ContractChatOcrError(
      "No readable conversation text was extracted from the screenshot",
      "OCR_EMPTY_RESULT",
      502,
    );
  }
}

async function callDashScope(imageBase64: string): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new ContractChatOcrError(
      "DASHSCOPE_API_KEY is not configured",
      "OCR_NOT_CONFIGURED",
      500,
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
    throw new ContractChatOcrError(
      `DashScope OCR failed: ${errorText}`,
      "OCR_PROVIDER_FAILED",
      502,
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

  throw new ContractChatOcrError(
    "DashScope OCR returned an empty response",
    "OCR_EMPTY_RESPONSE",
    502,
  );
}

async function callOpenAI(imageBase64: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ContractChatOcrError(
      "OPENAI_API_KEY is not configured",
      "OCR_NOT_CONFIGURED",
      500,
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: imageBase64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ContractChatOcrError(
      `OpenAI OCR failed: ${errorText}`,
      "OCR_PROVIDER_FAILED",
      502,
    );
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  const rawText = extractOpenAIText(content);

  if (!rawText) {
    throw new ContractChatOcrError(
      "OpenAI OCR returned an empty response",
      "OCR_EMPTY_RESPONSE",
      502,
    );
  }

  return rawText;
}

export async function analyzeContractChatScreenshot(
  imageBase64: string,
  sourceHint?: "wechat" | "feishu" | "screenshot",
): Promise<ContractChatScreenshotAnalysisResult> {
  const provider = isChinaRegion() ? "dashscope" : "openai";
  const rawText =
    provider === "dashscope"
      ? await callDashScope(imageBase64)
      : await callOpenAI(imageBase64);
  const data = parseRawResult(rawText);

  if (sourceHint && data.sourceType === "screenshot") {
    data.sourceType = sourceHint;
  }

  ensureResult(data);

  return {
    provider,
    rawText,
    data,
  };
}
