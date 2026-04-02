import OpenAI from "openai";

import { isChinaRegion } from "@/lib/config/region";

export interface IntakeChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface IntakeChatState {
  reply: string;
  ready: boolean;
  completionScore: number;
  summary: string;
  missingFields: string[];
  suggestedTitle: string;
  collectedData: Record<string, string>;
  draftSourceContent: string;
}

const INTAKE_PROMPT = `You are an AI contract intake assistant for a contract drafting product.

Your job:
1. Talk naturally with the user.
2. Collect the minimum useful facts needed to generate a contract draft.
3. Ask at most 1-2 focused follow-up questions at a time.
4. Prefer practical business facts over legal theory.
5. When there is enough information to create a useful first draft, mark ready=true.

You may help with employment contracts, service agreements, cooperation agreements, NDAs, freelance contracts, and custom business contracts.

Key facts to collect when possible:
- contractType
- partyAName
- partyBName
- positionOrService
- workOrServiceContent
- paymentOrSalary
- termOrStartDate
- workLocationOrDeliveryMode
- probationOrTrial
- extraTerms

Rules:
- Be concise, friendly, and action-oriented.
- If the user gives multiple facts at once, summarize and ask only for the most important missing facts.
- ready=true only when the current information is enough to build a meaningful first draft.
- draftSourceContent must be a clean plain-text summary that can be sent into downstream contract analysis.
- suggestedTitle should be short and usable as a draft title.

Return JSON only with this schema:
{
  "reply": "assistant reply to show in chat",
  "ready": false,
  "completionScore": 0.45,
  "summary": "short summary of the current collected facts",
  "missingFields": ["paymentOrSalary", "termOrStartDate"],
  "suggestedTitle": "Employment Contract Draft",
  "collectedData": {
    "contractType": "employment",
    "partyAName": "Example Co.",
    "partyBName": "Alice",
    "positionOrService": "Frontend Engineer"
  },
  "draftSourceContent": "Contract type: employment\\nParty A: Example Co.\\nParty B: Alice\\n..."
}`;

function getChatClient() {
  if (isChinaRegion() && process.env.DASHSCOPE_API_KEY) {
    return new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
  }

  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  if (process.env.DASHSCOPE_API_KEY) {
    return new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
  }

  throw new Error("AI_CHAT_NOT_CONFIGURED");
}

function getChatModel() {
  if (isChinaRegion() && process.env.DASHSCOPE_API_KEY) {
    return process.env.QWEN_MODEL || "qwen-plus";
  }

  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_MODEL || "gpt-4.1-mini";
  }

  return process.env.QWEN_MODEL || "qwen-plus";
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeCollectedData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  const next: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const normalized = normalizeString(rawValue);
    if (normalized) {
      next[key] = normalized;
    }
  }
  return next;
}

function buildFallbackDraftSourceContent(collectedData: Record<string, string>) {
  const lines = Object.entries(collectedData).map(([key, value]) => `${key}: ${value}`);
  return lines.join("\n");
}

export async function runContractIntakeChat(
  messages: IntakeChatMessage[],
): Promise<IntakeChatState> {
  const client = getChatClient();
  const response = await client.chat.completions.create({
    model: getChatModel(),
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: INTAKE_PROMPT },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error("AI_CHAT_EMPTY_RESPONSE");
  }

  const parsed = JSON.parse(rawContent) as Record<string, unknown>;
  const collectedData = normalizeCollectedData(parsed.collectedData);

  return {
    reply: normalizeString(parsed.reply) || "Please tell me a bit more about the contract you want to create.",
    ready: parsed.ready === true,
    completionScore:
      typeof parsed.completionScore === "number" && Number.isFinite(parsed.completionScore)
        ? Math.max(0, Math.min(1, parsed.completionScore))
        : 0,
    summary: normalizeString(parsed.summary),
    missingFields: normalizeStringArray(parsed.missingFields),
    suggestedTitle: normalizeString(parsed.suggestedTitle) || "AI Contract Draft",
    collectedData,
    draftSourceContent:
      normalizeString(parsed.draftSourceContent) || buildFallbackDraftSourceContent(collectedData),
  };
}
