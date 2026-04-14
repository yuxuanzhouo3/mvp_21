import { isChinaRegion } from "@/lib/config/region";

export interface ContractChatScreenshotData {
  sourceType: "wechat" | "feishu" | "screenshot";
  conversationText: string;
  summary: string;
}

export interface ContractChatScreenshotAnalysisResult {
  provider: "dashscope";
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

const OCR_PROMPT_EN = `You are extracting chat content from a contract negotiation screenshot.

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

const OCR_PROMPT_ZH = `你正在从一张合同协商聊天截图中提取可读内容。

任务：
1. 将 sourceType 识别为 "wechat"、"feishu" 或 "screenshot"。
2. 按阅读顺序提取所有可识别的聊天文本。
3. 如果能看到说话人名称，请尽量保留。
4. 使用简洁纯文本输出，每条消息一行。
5. 用简体中文输出一段简短摘要，总结截图中可见的合同事实。

只返回 JSON，不要包裹 Markdown。
Schema:
{
  "sourceType": "wechat",
  "conversationText": "甲：...\\n乙：...",
  "summary": "简短摘要"
}`;

function getOcrPrompt() {
  return isChinaRegion() ? OCR_PROMPT_ZH : OCR_PROMPT_EN;
}

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

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(raw || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveOcrProviderTimeoutMs() {
  const fallback = parsePositiveInt(process.env.AI_PROVIDER_TIMEOUT_MS, 12_000);
  const configured = parsePositiveInt(process.env.OCR_PROVIDER_TIMEOUT_MS, fallback);
  return Math.max(2_000, Math.min(30_000, configured));
}

async function callDashScope(imageBase64: string): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey?.trim()) {
    throw new ContractChatOcrError(
      "DASHSCOPE_API_KEY is unavailable",
      "OCR_KEY_UNAVAILABLE",
      503,
    );
  }

  const timeoutMs = resolveOcrProviderTimeoutMs();
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    abortController.abort("OCR_TIMEOUT");
  }, timeoutMs);

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
                content: [
                  { image: imageBase64 },
                  { text: getOcrPrompt() },
                ],
              },
            ],
          },
        }),
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        /timeout|timed out|aborted|abort/i.test(error.message))
    ) {
      throw new ContractChatOcrError(
        `DashScope OCR timeout after ${timeoutMs}ms`,
        "OCR_TIMEOUT",
        504,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new ContractChatOcrError(
      `DashScope OCR request failed: ${message}`,
      "OCR_PROVIDER_FAILED",
      502,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 401 || response.status === 403) {
      throw new ContractChatOcrError(
        `DASHSCOPE_API_KEY is unavailable: ${errorText}`,
        "OCR_KEY_UNAVAILABLE",
        503,
      );
    }

    if (response.status === 408 || response.status === 504) {
      throw new ContractChatOcrError(
        `DashScope OCR timeout: ${errorText}`,
        "OCR_TIMEOUT",
        504,
      );
    }

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

export async function analyzeContractChatScreenshot(
  imageBase64: string,
  sourceHint?: "wechat" | "feishu" | "screenshot",
): Promise<ContractChatScreenshotAnalysisResult> {
  const rawText = await callDashScope(imageBase64);
  const data = parseRawResult(rawText);

  if (sourceHint && data.sourceType === "screenshot") {
    data.sourceType = sourceHint;
  }

  ensureResult(data);

  return {
    provider: "dashscope",
    rawText,
    data,
  };
}
