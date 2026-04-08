import OpenAI from "openai";

import { isChinaRegion } from "@/lib/config/region";
import {
  getDashScopeBaseUrl,
  getOpenAIModel,
  getQwenModel,
} from "@/lib/config/runtime-env";

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

const INTAKE_PROMPT_EN = `You are an AI contract intake assistant for a contract drafting product.

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
- Always reply in the same language as the user's latest message.
- If the user gives multiple facts at once, summarize and ask only for the most important missing facts.
- ready=true only when the current information is enough to build a meaningful first draft.
- draftSourceContent must be a clean plain-text summary that can be sent into downstream contract analysis.
- suggestedTitle should be short and usable as a draft title.
- Distinguish carefully between employment and project/service/cooperation scenarios:
  - If the user describes outsourcing, software development, implementation, delivery, acceptance, project milestones, source code, deployment, or operation manuals, prefer service agreement / development agreement / cooperation agreement instead of employment contract.
  - Do not convert total contract price or milestone payments into salary, monthly wage, bonus, or signing bonus unless the user explicitly says salary, wage, payroll, employee, or probation.
  - Do not convert acceptance period, delivery deadline, or payment deadline into probation period.
  - For software or outsourcing projects, payment terms are usually project fees or milestone payments, not labor salary.
- Avoid inventing facts. If a field is unclear, mark it as missing instead of guessing.

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

const INTAKE_PROMPT_ZH = `你是合同起草产品中的 AI 合同信息采集助手。

你的任务：
1. 与用户自然对话。
2. 收集生成第一版合同草稿所需的最少但最关键的信息。
3. 每次最多只追问 1 到 2 个重点问题。
4. 优先收集实际业务事实，不要展开法律理论。
5. 当现有信息已经足够生成一版有意义的合同草稿时，设置 ready=true。

你可以帮助处理劳动合同、服务合同、合作协议、保密协议、自由职业合同，以及其他常见商事合同。

尽量收集的关键字段：
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

规则：
- 回复要简洁、友好、可执行。
- 始终使用用户最近一条消息对应的语言；如果用户用中文，就必须用简体中文回复。
- 如果用户一次提供了很多信息，请先总结，再只追问最关键的缺失项。
- 只有当信息已经足以生成一版有意义的初稿时，ready 才能为 true。
- draftSourceContent 必须是干净的纯文本摘要，可直接传给下游合同分析。
- suggestedTitle 应简短、可直接作为草稿标题。
- 必须严格区分“劳动用工”和“项目服务/软件开发/合作”场景：
  - 如果用户提到外包、软件开发、系统建设、项目交付、验收、源码、部署文档、操作手册、里程碑付款等，应优先判断为服务合同、开发合同或合作协议，而不是劳动合同。
  - 除非用户明确提到员工、入职、工资、月薪、试用期、社保等劳动用语，否则不要把合同总价或分期付款误写成工资、奖金或签约金。
  - 不要把验收周期、交付期限或付款期限误判成试用期。
  - 对于软件开发或外包项目，付款通常是项目费用或阶段款，不是工资。
- 不要臆造事实；不清楚就标记为缺失，而不是猜测。

只返回 JSON，格式如下：
{
  "reply": "展示给用户的回复",
  "ready": false,
  "completionScore": 0.45,
  "summary": "当前已收集信息的简短总结",
  "missingFields": ["paymentOrSalary", "termOrStartDate"],
  "suggestedTitle": "软件开发服务合同草稿",
  "collectedData": {
    "contractType": "service",
    "partyAName": "示例科技有限公司",
    "partyBName": "张三工作室",
    "workOrServiceContent": "开发 Web 管理系统"
  },
  "draftSourceContent": "合同类型：服务合同\\n甲方：示例科技有限公司\\n乙方：张三工作室\\n服务内容：开发 Web 管理系统\\n..."
}`;

function getReplyLanguageHint(messages: IntakeChatMessage[]) {
  if (isChinaRegion()) {
    return "Current deployment region is CN. You must reply entirely in Simplified Chinese. Even if the user's text appears garbled or mixed-encoding, infer the intended business meaning when possible and still produce natural Simplified Chinese output. All JSON string values intended for user display must also be in Simplified Chinese.";
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim());

  const sample = lastUserMessage?.content || "";
  const hasChinese = /[\u3400-\u9fff]/.test(sample);

  return hasChinese
    ? "The latest user message is in Chinese. You must reply entirely in Simplified Chinese, and all JSON string values intended for user display must also be in Simplified Chinese."
    : "The latest user message is not in Chinese. Reply in English unless the user clearly uses another language.";
}

function getIntakePrompt(messages: IntakeChatMessage[]) {
  const sample = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim())
    ?.content || "";

  return /[\u3400-\u9fff]/.test(sample) ? INTAKE_PROMPT_ZH : INTAKE_PROMPT_EN;
}

function getChatClient() {
  if (isChinaRegion() && process.env.DASHSCOPE_API_KEY) {
    return new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: getDashScopeBaseUrl(),
    });
  }

  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  if (process.env.DASHSCOPE_API_KEY) {
    return new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: getDashScopeBaseUrl(),
    });
  }

  throw new Error("AI_CHAT_NOT_CONFIGURED");
}

function getChatModel() {
  if (isChinaRegion() && process.env.DASHSCOPE_API_KEY) {
    return getQwenModel();
  }

  if (process.env.OPENAI_API_KEY) {
    return getOpenAIModel();
  }

  return getQwenModel();
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

function containsChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function containsMojibake(value: string) {
  return /[脗芒聙閸涚紒鐎甸崥娓氱拠瀹搁柅閹村]/.test(value);
}

function shouldForceChineseLocalization(
  messages: IntakeChatMessage[],
  draft: {
    reply: string;
    summary: string;
    suggestedTitle: string;
    draftSourceContent: string;
  },
) {
  if (!isChinaRegion()) {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user" && message.content.trim());

    const sample = lastUserMessage?.content || "";
    if (!containsChinese(sample)) {
      return false;
    }
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim());

  const sample = lastUserMessage?.content || "";
  if (!isChinaRegion() && !containsChinese(sample)) {
    return false;
  }

  const userFacingFields = [
    draft.reply,
    draft.summary,
    draft.suggestedTitle,
    draft.draftSourceContent,
  ].filter(Boolean);

  return userFacingFields.some(
    (value) => !containsChinese(value) || containsMojibake(value),
  );
}

async function localizeIntakeStateToChinese(
  client: OpenAI,
  model: string,
  draft: IntakeChatState,
) {
  async function translateField(value: string, label: string) {
    if (!value || (containsChinese(value) && !containsMojibake(value))) {
      return value;
    }

    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "你是一名专业翻译助手。请把用户提供的内容准确翻译成简体中文，只输出翻译结果，不要加解释，不要补充事实，保留金额、日期、专有名词和结构。",
        },
        {
          role: "user",
          content: `${label}：\n${value}`,
        },
      ],
    });

    return normalizeString(response.choices[0]?.message?.content) || value;
  }

  const [reply, summary, suggestedTitle, draftSourceContent] = await Promise.all([
    translateField(draft.reply, "回复内容"),
    translateField(draft.summary, "摘要"),
    translateField(draft.suggestedTitle, "草稿标题"),
    translateField(draft.draftSourceContent, "草稿摘要"),
  ]);

  return {
    reply,
    ready: draft.ready,
    completionScore: draft.completionScore,
    summary,
    missingFields: draft.missingFields,
    suggestedTitle,
    collectedData: draft.collectedData,
    draftSourceContent,
  } satisfies IntakeChatState;
}

export async function runContractIntakeChat(
  messages: IntakeChatMessage[],
): Promise<IntakeChatState> {
  const client = getChatClient();
  const model = getChatModel();
  const languageHint = getReplyLanguageHint(messages);
  const intakePrompt = getIntakePrompt(messages);
  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `${intakePrompt}\n\n${languageHint}` },
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

  const draft = {
    reply:
      normalizeString(parsed.reply) ||
      (isChinaRegion()
        ? "请再补充一些合同背景，我来继续帮你整理成草稿。"
        : "Please tell me a bit more about the contract you want to create."),
    ready: parsed.ready === true,
    completionScore:
      typeof parsed.completionScore === "number" && Number.isFinite(parsed.completionScore)
        ? Math.max(0, Math.min(1, parsed.completionScore))
        : 0,
    summary: normalizeString(parsed.summary),
    missingFields: normalizeStringArray(parsed.missingFields),
    suggestedTitle:
      normalizeString(parsed.suggestedTitle) || (isChinaRegion() ? "AI 合同草稿" : "AI Contract Draft"),
    collectedData,
    draftSourceContent:
      normalizeString(parsed.draftSourceContent) || buildFallbackDraftSourceContent(collectedData),
  } satisfies IntakeChatState;

  if (shouldForceChineseLocalization(messages, draft)) {
    try {
      return await localizeIntakeStateToChinese(client, model, draft);
    } catch (error) {
      console.warn("[contract-intake-chat] Failed to localize CN response:", error);
    }
  }

  return draft;
}
