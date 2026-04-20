
import OpenAI from "openai";

import { isChinaRegion } from "@/lib/config/region";
import {
  getUnifiedAIApiKey,
  getUnifiedAIBaseUrl,
  getUnifiedAIModel,
} from "@/lib/config/runtime-env";
import type {
  AIAnalysisResult,
  AnalyzeConversationRequest,
  ContractContent,
  ContractType,
  GenerateContractRequest,
  KeyTerm,
  MissingInfo,
  PartyInfo,
  RiskAlert,
  RiskLevel,
} from "./types";
import {
  generateAnalyzePrompt,
  generateAnalyzeSystemPrompt,
  generatePreAnalyzePrompt,
  generatePreAnalyzeSystemPrompt,
  type PromptLanguage as AnalyzePromptLanguage,
} from "./prompts/analyze";
import {
  generateContractPrompt,
  generateContractSystemPrompt,
  getContractTypeDisplayName,
  type PromptLanguage as GeneratePromptLanguage,
} from "./prompts/generate";
import {
  ALL_EXPERTS,
  BUSINESS_CONTRACT_EXPERT,
  FREELANCE_EXPERT,
  getExpertByContractType,
  LABOR_LAW_EXPERT,
  TECH_CONTRACT_EXPERT,
} from "./prompts/experts";

type AILanguage = AnalyzePromptLanguage & GeneratePromptLanguage;
type AIProvider = "dashscope";

export class ContractAIError extends Error {
  code: string;
  status: number;
  provider?: AIProvider;

  constructor(message: string, code: string, status = 500, provider?: AIProvider) {
    super(message);
    this.name = "ContractAIError";
    this.code = code;
    this.status = status;
    this.provider = provider;
  }
}

function getDefaultLanguage(): AILanguage {
  return isChinaRegion() ? "zh" : "en";
}

function resolveLanguage(input?: "zh" | "en"): AILanguage {
  return input === "zh" || input === "en" ? input : getDefaultLanguage();
}

function hasDashScope() {
  return Boolean(getUnifiedAIApiKey());
}

function hasProvider(provider: AIProvider) {
  return hasDashScope();
}

function getProviderKeyName(provider: AIProvider) {
  return "DASHSCOPE_API_KEY";
}

function getAIClientByProvider(provider: AIProvider): OpenAI {
  return new OpenAI({
    apiKey: getUnifiedAIApiKey(),
    baseURL: getUnifiedAIBaseUrl(),
  });
}

function getModelByProvider(provider: AIProvider): string {
  return getUnifiedAIModel();
}

function mapProviderError(error: unknown, provider: AIProvider): ContractAIError {
  if (error instanceof ContractAIError) {
    return error;
  }

  const status =
    typeof (error as { status?: unknown })?.status === "number"
      ? (error as { status: number }).status
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  if (status === 429) {
    return new ContractAIError(
      `AI provider rate limited: ${message}`,
      "AI_RATE_LIMITED",
      503,
      provider,
    );
  }

  if (status === 401 || status === 403) {
    return new ContractAIError(
      `${getProviderKeyName(provider)} is unavailable: ${message}`,
      "AI_KEY_UNAVAILABLE",
      503,
      provider,
    );
  }

  if (
    normalizedMessage.includes("api key") ||
    normalizedMessage.includes("apikey") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("authentication")
  ) {
    return new ContractAIError(
      `${getProviderKeyName(provider)} is unavailable: ${message}`,
      "AI_KEY_UNAVAILABLE",
      503,
      provider,
    );
  }

  return new ContractAIError(
    `AI provider request failed: ${message}`,
    "AI_PROVIDER_FAILED",
    502,
    provider,
  );
}

async function runWithProviderFallback<T>(
  task: (context: { provider: AIProvider; client: OpenAI; model: string }) => Promise<T>,
): Promise<T> {
  const preferredProvider: AIProvider = "dashscope";
  const providers: AIProvider[] = [preferredProvider];
  let lastError: ContractAIError | null = null;

  for (const provider of providers) {
    if (!hasProvider(provider)) {
      lastError = new ContractAIError(
        `${getProviderKeyName(provider)} is unavailable`,
        "AI_KEY_UNAVAILABLE",
        503,
        provider,
      );
      continue;
    }

    try {
      return await task({
        provider,
        client: getAIClientByProvider(provider),
        model: getModelByProvider(provider),
      });
    } catch (error) {
      lastError = mapProviderError(error, provider);
    }
  }

  throw (
    lastError ||
    new ContractAIError(
      "No AI provider is configured",
      "AI_NOT_CONFIGURED",
      503,
      preferredProvider,
    )
  );
}

function normalizeContractType(contractType: unknown): ContractType | "custom" {
  const raw = typeof contractType === "string" ? contractType.trim().toLowerCase() : "";

  switch (raw) {
    case "labor":
    case "service":
    case "cooperation":
    case "nda":
    case "freelance":
    case "tech":
    case "software":
    case "custom":
      return raw;
    case "development":
    case "outsourcing":
      return "tech";
    default:
      return "custom";
  }
}

function normalizeRiskLevel(value: unknown): RiskLevel {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeParty(value: unknown): PartyInfo {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { name: "", role: "", company: "", position: "", contact: "", identified: false };
  }

  const record = value as Record<string, unknown>;
  return {
    name: normalizeString(record.name),
    role: normalizeString(record.role),
    company: normalizeString(record.company),
    position: normalizeString(record.position),
    contact: normalizeString(record.contact),
    idNumber: normalizeString(record.idNumber),
    identified: normalizeBoolean(record.identified) || Boolean(record.name || record.company),
  };
}

function normalizeKeyTerms(value: unknown): KeyTerm[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const label = normalizeString(record.label) || normalizeString(record.type) || "Key Term";
      const normalized: KeyTerm = {
        type: normalizeString(record.type) || "other",
        label,
        value: normalizeString(record.value),
        source: normalizeString(record.source),
        confidence: Math.max(0, Math.min(1, normalizeNumber(record.confidence, 0.75))),
      };

      const riskLevel = normalizeString(record.riskLevel);
      if (riskLevel) {
        normalized.riskLevel = normalizeRiskLevel(riskLevel);
      }

      const riskNote = normalizeString(record.riskNote);
      if (riskNote) {
        normalized.riskNote = riskNote;
      }

      const suggestion = normalizeString(record.suggestion);
      if (suggestion) {
        normalized.suggestion = suggestion;
      }

      return normalized;
    })
    .filter((item): item is KeyTerm => Boolean(item && (item.label || item.value)));
}

function normalizeRiskAlerts(value: unknown): RiskAlert[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const alerts = value.map((item): RiskAlert | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const issue = normalizeString(record.issue);
      const suggestion = normalizeString(record.suggestion);
      if (!issue && !suggestion) {
        return null;
      }

      return {
        severity: normalizeRiskLevel(record.severity),
        issue,
        impact: normalizeString(record.impact) || undefined,
        suggestion,
      } satisfies RiskAlert;
    });

  return alerts.filter((item): item is RiskAlert => item !== null);
}

function normalizeMissingInfo(value: unknown): MissingInfo[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const missingInfo = value.map((item): MissingInfo | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const name = normalizeString(record.item);
      if (!name) {
        return null;
      }

      return {
        item: name,
        importance: normalizeRiskLevel(record.importance),
        defaultSuggestion: normalizeString(record.defaultSuggestion) || undefined,
      } satisfies MissingInfo;
    });

  return missingInfo.filter((item): item is MissingInfo => item !== null);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeJsonResponse(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  const match = fenced.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : fenced) as Record<string, any>;
}

async function requestJsonCompletion(
  client: OpenAI,
  provider: AIProvider,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
) {
  let response: Awaited<ReturnType<typeof client.chat.completions.create>>;

  try {
    response = await client.chat.completions.create({
      model,
      temperature,
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
  } catch (error) {
    throw mapProviderError(error, provider);
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new ContractAIError(
      "AI provider returned an empty response",
      "AI_EMPTY_RESPONSE",
      502,
      provider,
    );
  }

  try {
    return normalizeJsonResponse(content);
  } catch (error) {
    throw new ContractAIError(
      `AI provider returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "AI_INVALID_JSON_RESPONSE",
      502,
      provider,
    );
  }
}

async function preAnalyze(
  content: string,
  language: AILanguage,
  provider: AIProvider,
  client: OpenAI,
  model: string,
) {
  const result = await requestJsonCompletion(
    client,
    provider,
    model,
    generatePreAnalyzeSystemPrompt(language),
    generatePreAnalyzePrompt(content, language),
    0.1,
    800,
  );

  return {
    contractType: normalizeContractType(result.contractType),
    scenario: normalizeString(result.scenario),
  };
}

function buildFallbackSummary(language: AILanguage, contractType: string, keyTerms: KeyTerm[]) {
  const contractLabel = getContractTypeDisplayName(contractType, language);
  const snippets = keyTerms
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.value}`)
    .filter(Boolean)
    .join(language === "zh" ? "；" : "; ");

  if (!snippets) {
    return language === "zh"
      ? `已识别合同类型：${contractLabel}。`
      : `Detected contract type: ${contractLabel}.`;
  }

  return language === "zh"
    ? `已识别合同类型：${contractLabel}；${snippets}`
    : `Detected contract type: ${contractLabel}; ${snippets}`;
}

function getFallbackDisclaimer(language: AILanguage) {
  return language === "zh"
    ? "本合同由 MornContract 基于 AI 辅助生成，签署前请结合实际业务与法律要求进一步审核。"
    : "This contract was generated with AI assistance by MornContract. Please review it against your actual transaction and legal requirements before signing.";
}

export async function analyzeConversation(
  request: AnalyzeConversationRequest,
): Promise<AIAnalysisResult> {
  const language = resolveLanguage(request.language);
  const { parsed, contractType, expert } = await runWithProviderFallback(
    async ({ provider, client, model }) => {
      const { contractType } = await preAnalyze(
        request.content,
        language,
        provider,
        client,
        model,
      );
      const expert = getExpertByContractType(contractType);
      const parsed = await requestJsonCompletion(
        client,
        provider,
        model,
        generateAnalyzeSystemPrompt(expert, language),
        generateAnalyzePrompt(expert, request.content, language),
        0.2,
        3200,
      );

      return { parsed, contractType, expert };
    },
  );

  const normalizedType = normalizeContractType(parsed.contractType || contractType);
  const keyTerms = normalizeKeyTerms(parsed.keyTerms);

  return {
    contractType: normalizedType,
    confidence: Math.max(0, Math.min(1, normalizeNumber(parsed.confidence, 0.8))),
    partyA: normalizeParty(parsed.partyA),
    partyB: normalizeParty(parsed.partyB),
    keyTerms,
    suggestedTemplate: normalizeString(parsed.suggestedTemplate) || undefined,
    summary:
      normalizeString(parsed.summary) || buildFallbackSummary(language, normalizedType, keyTerms),
    expertAnalysis:
      parsed.expertAnalysis && typeof parsed.expertAnalysis === "object"
        ? {
            expertName: normalizeString(parsed.expertAnalysis.expertName) || expert.name,
            expertTitle: normalizeString(parsed.expertAnalysis.expertTitle) || expert.title,
            analysisDate:
              normalizeString(parsed.expertAnalysis.analysisDate) || new Date().toISOString(),
            overallAssessment:
              normalizeString(parsed.expertAnalysis.overallAssessment) ||
              (language === "zh" ? "已完成合同事实与风险分析。" : "Contract facts and risks analyzed."),
          }
        : {
            expertName: expert.name,
            expertTitle: expert.title,
            analysisDate: new Date().toISOString(),
            overallAssessment:
              language === "zh" ? "已完成合同事实与风险分析。" : "Contract facts and risks analyzed.",
          },
    scenario:
      parsed.scenario && typeof parsed.scenario === "object"
        ? {
            type: normalizeString(parsed.scenario.type),
            description: normalizeString(parsed.scenario.description),
            negotiationStatus: normalizeString(parsed.scenario.negotiationStatus) || undefined,
            powerBalance: normalizeString(parsed.scenario.powerBalance) || undefined,
          }
        : undefined,
    riskAlerts: normalizeRiskAlerts(parsed.riskAlerts),
    missingInfo: normalizeMissingInfo(parsed.missingInfo),
    professionalAdvice: normalizeStringArray(parsed.professionalAdvice),
  };
}

function buildDefaultSections(language: AILanguage, contractType: string) {
  const title = getContractTypeDisplayName(contractType, language);

  if (language === "zh") {
    return [
      {
        id: "section-1",
        title: `第一条 ${title}双方信息`,
        content: "甲乙双方的名称、地址、联系人等基础信息见合同首页或待补充信息。",
        order: 1,
        editable: true,
      },
      {
        id: "section-2",
        title: "第二条 合作内容",
        content: "双方应按已确认的业务安排履行各自义务，具体服务范围与交付要求以本合同约定为准。",
        order: 2,
        editable: true,
      },
      {
        id: "section-3",
        title: "第三条 价款与支付",
        content: "合同价款、支付节点、开票与付款条件以双方确认的商务条款为准。",
        order: 3,
        editable: true,
      },
    ];
  }

  return [
    {
      id: "section-1",
      title: "1. Parties",
      content: "The parties' legal names, addresses, and contact details should be completed in the final agreement.",
      order: 1,
      editable: true,
    },
    {
      id: "section-2",
      title: "2. Scope",
      content: "Each party shall perform its obligations in accordance with the agreed business arrangement and the scope stated in this agreement.",
      order: 2,
      editable: true,
    },
    {
      id: "section-3",
      title: "3. Fees and Payment",
      content: "Fees, payment milestones, invoicing requirements, and payment conditions shall follow the commercial terms agreed by the parties.",
      order: 3,
      editable: true,
    },
  ];
}

export async function generateContract(
  request: GenerateContractRequest,
): Promise<ContractContent> {
  const language = resolveLanguage(request.language);
  const contractType = normalizeContractType(request.analysisResult.contractType);
  const expert = getExpertByContractType(contractType);
  const prompt = generateContractPrompt(
    expert,
    JSON.stringify(request.analysisResult, null, 2),
    contractType,
    language,
  );

  const templatePrompt = request.templateContent?.trim()
    ? language === "zh"
      ? `\n\n补充要求：请优先参考以下模板的结构与表述，但不得违背分析结果中的真实交易事实。\n模板名称：${request.templateName || getContractTypeDisplayName(contractType, language)}\n模板版本：${request.templateVersion || 1}\n模板正文：\n${request.templateContent}`
      : `\n\nAdditional instruction: Prefer the structure and drafting style of the template below, but do not contradict the actual transaction facts in the analysis result.\nTemplate name: ${request.templateName || getContractTypeDisplayName(contractType, language)}\nTemplate version: ${request.templateVersion || 1}\nTemplate body:\n${request.templateContent}`
    : "";

  const parsed = await runWithProviderFallback(
    async ({ provider, client, model }) =>
      requestJsonCompletion(
        client,
        provider,
        model,
        generateContractSystemPrompt(expert, language),
        `${prompt}${templatePrompt}`,
        0.35,
        6500,
      ),
  );

  const title =
    normalizeString(parsed.title) || getContractTypeDisplayName(contractType, language);

  const sections = Array.isArray(parsed.sections)
    ? parsed.sections
        .map((section: any, index: number) => ({
          id: normalizeString(section?.id) || `section-${index + 1}`,
          title:
            normalizeString(section?.title) ||
            (language === "zh" ? `第${index + 1}条 条款` : `${index + 1}. Clause`),
          content: normalizeString(section?.content),
          order:
            typeof section?.order === "number" && Number.isFinite(section.order)
              ? section.order
              : index + 1,
          editable: section?.editable !== false,
          tips: normalizeString(section?.tips) || undefined,
        }))
        .filter((section) => section.content || section.title)
    : [];

  return {
    title,
    contractType,
    legalBasis: normalizeString(parsed.legalBasis) || undefined,
    generatedBy: {
      expertName: normalizeString(parsed.generatedBy?.expertName) || expert.name,
      expertTitle: normalizeString(parsed.generatedBy?.expertTitle) || expert.title,
      generatedAt:
        normalizeString(parsed.generatedBy?.generatedAt) || new Date().toISOString(),
    },
    contractNumber: normalizeString(parsed.contractNumber) || undefined,
    sections: sections.length > 0 ? sections : buildDefaultSections(language, contractType),
    disclaimer: normalizeString(parsed.disclaimer) || getFallbackDisclaimer(language),
    signature: {
      partyA: {
        name:
          normalizeString(parsed.signature?.partyA?.name) ||
          (language === "zh" ? "【待补充：甲方名称】" : "[To be completed: Party A name]"),
        title:
          normalizeString(parsed.signature?.partyA?.title) ||
          (language === "zh" ? "甲方（盖章）" : "Party A (Signature / Seal)"),
        representative: normalizeString(parsed.signature?.partyA?.representative) || undefined,
        idNumber: normalizeString(parsed.signature?.partyA?.idNumber) || undefined,
        date: normalizeString(parsed.signature?.partyA?.date) || undefined,
      },
      partyB: {
        name:
          normalizeString(parsed.signature?.partyB?.name) ||
          (language === "zh" ? "【待补充：乙方名称】" : "[To be completed: Party B name]"),
        title:
          normalizeString(parsed.signature?.partyB?.title) ||
          (language === "zh" ? "乙方（签字/盖章）" : "Party B (Signature / Seal)"),
        representative: normalizeString(parsed.signature?.partyB?.representative) || undefined,
        idNumber: normalizeString(parsed.signature?.partyB?.idNumber) || undefined,
        date: normalizeString(parsed.signature?.partyB?.date) || undefined,
      },
    },
    appendices: Array.isArray(parsed.appendices)
      ? parsed.appendices
          .map((item: any) => ({
            name: normalizeString(item?.name),
            description: normalizeString(item?.description) || undefined,
          }))
          .filter((item) => item.name)
      : undefined,
  };
}

export async function analyzeAndGenerateContract(
  conversationContent: string,
  sourceType: "text" | "screenshot" | "wechat" | "feishu" = "text",
) {
  const language = getDefaultLanguage();
  const analysis = await analyzeConversation({
    content: conversationContent,
    sourceType,
    language,
  });

  const expert = getExpertByContractType(analysis.contractType);
  const contract = await generateContract({
    analysisResult: analysis,
    language,
  });

  return {
    analysis,
    contract,
    expert: {
      name: expert.name,
      title: expert.title,
    },
  };
}

export function getSupportedContractTypes() {
  const language = getDefaultLanguage();

  return [
    {
      value: "labor" as ContractType,
      label: getContractTypeDisplayName("labor", language),
      description:
        language === "zh"
          ? "适用于正式劳动用工关系。"
          : "Suitable for formal employment relationships.",
      expert: LABOR_LAW_EXPERT.name,
    },
    {
      value: "freelance" as ContractType,
      label: getContractTypeDisplayName("freelance", language),
      description:
        language === "zh"
          ? "适用于自由职业、顾问或独立承包合作。"
          : "Suitable for freelance, consulting, or independent contractor engagements.",
      expert: FREELANCE_EXPERT.name,
    },
    {
      value: "tech" as ContractType,
      label: getContractTypeDisplayName("tech", language),
      description:
        language === "zh"
          ? "适用于软件开发、技术实施和外包项目。"
          : "Suitable for software development, implementation, and outsourcing projects.",
      expert: TECH_CONTRACT_EXPERT.name,
    },
    {
      value: "cooperation" as ContractType,
      label: getContractTypeDisplayName("cooperation", language),
      description:
        language === "zh"
          ? "适用于项目合作或商业协作安排。"
          : "Suitable for project cooperation and business collaboration.",
      expert: BUSINESS_CONTRACT_EXPERT.name,
    },
    {
      value: "nda" as ContractType,
      label: getContractTypeDisplayName("nda", language),
      description:
        language === "zh"
          ? "适用于保密义务和信息保护场景。"
          : "Suitable for confidentiality and information protection scenarios.",
      expert: BUSINESS_CONTRACT_EXPERT.name,
    },
    {
      value: "service" as ContractType,
      label: getContractTypeDisplayName("service", language),
      description:
        language === "zh"
          ? "适用于一般服务提供和项目交付。"
          : "Suitable for general service delivery and project-based work.",
      expert: BUSINESS_CONTRACT_EXPERT.name,
    },
    {
      value: "custom" as ContractType,
      label: getContractTypeDisplayName("custom", language),
      description:
        language === "zh"
          ? "适用于其他自定义合同场景。"
          : "Suitable for other custom contract scenarios.",
      expert: BUSINESS_CONTRACT_EXPERT.name,
    },
  ];
}

export function getAllExperts() {
  return ALL_EXPERTS.map((expert) => ({
    id: expert.id,
    name: expert.name,
    title: expert.title,
    expertise: expert.expertise,
  }));
}

export function getExpertInfo(contractType: string) {
  const expert = getExpertByContractType(contractType);
  return {
    name: expert.name,
    title: expert.title,
    expertise: expert.expertise,
  };
}
