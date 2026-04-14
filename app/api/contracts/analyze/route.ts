import { NextRequest, NextResponse } from "next/server";

import { ContractAIError, analyzeConversation } from "@/lib/ai";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import {
  DEFAULT_ANALYSIS_MAX_CHARS,
  prepareAnalysisInput,
  type PreparedAnalysisInput,
} from "@/lib/contracts/analysis-input";
import type {
  AIAnalysisResult,
  KeyTerm,
  RiskAlert,
  RiskLevel,
  SourceType,
} from "@/lib/ai/types";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve, reject) => {
        timer = setTimeout(() => {
          try {
            resolve(onTimeout());
          } catch (error) {
            reject(error);
          }
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function normalizeSourceType(value: unknown): SourceType {
  if (value === "screenshot" || value === "wechat" || value === "feishu") {
    return value;
  }
  return "text";
}

function normalizeLanguage(value: unknown): "zh" | "en" | undefined {
  if (value === "zh" || value === "en") {
    return value;
  }
  return undefined;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function requireCurrentUser(request: NextRequest) {
  const { token, error: tokenError } = extractTokenFromRequest(request);
  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: t("请先登录后再继续。", "Please sign in first."),
          },
        },
        { status: 401 },
      ),
    };
  }

  const authResult = await withTimeout(
    verifyAuthToken(token),
    parsePositiveInt(process.env.AUTH_VERIFY_TIMEOUT_MS, 5_000),
    () => ({ success: false, error: "AUTH_TIMEOUT" }),
  );
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: t("登录状态无效。", "Invalid token."),
          },
        },
        { status: 401 },
      ),
    };
  }

  return { userId: authResult.userId };
}

function inferFallbackContractType(content: string): string {
  const normalized = content.toLowerCase();
  if (!normalized.trim()) {
    return "custom";
  }
  if (/(保密|nda|non-disclosure|confidential)/i.test(normalized)) {
    return "nda";
  }
  if (/(劳动|雇佣|工资|月薪|试用期|employment|salary|probation)/i.test(normalized)) {
    return "labor";
  }
  if (/(软件|开发|系统|交付|验收|source code|milestone|delivery)/i.test(normalized)) {
    return "tech";
  }
  if (/(服务|顾问|support|service|consulting)/i.test(normalized)) {
    return "service";
  }
  if (/(合作|联营|分成|cooperation|partnership)/i.test(normalized)) {
    return "cooperation";
  }
  if (/(自由职业|外包|freelance|contractor)/i.test(normalized)) {
    return "freelance";
  }
  return "custom";
}

function inferRiskLevelFromLabel(label: string): RiskLevel {
  if (/(违约|penalty|liability|termination|纠纷|争议)/i.test(label)) {
    return "high";
  }
  if (/(付款|payment|金额|price|salary|invoice)/i.test(label)) {
    return "medium";
  }
  return "low";
}

function extractFallbackKeyTerms(content: string): KeyTerm[] {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 120);

  const keyTerms: KeyTerm[] = [];
  for (const line of lines) {
    if (!/(¥|￥|\$|%|天|月|年|金额|付款|payment|salary|term|deadline|交付|验收|违约|保密|liability|penalty)/i.test(line)) {
      continue;
    }

    const [rawLabel, ...rest] = line.split(/[:：]/);
    const label = (rawLabel || line).trim().slice(0, 64);
    const value = (rest.join(":") || line).trim().slice(0, 220);
    const riskLevel = inferRiskLevelFromLabel(label);

    keyTerms.push({
      type: /付款|payment|salary|金额|price|invoice/i.test(label)
        ? "payment"
        : /期限|term|deadline|start|end|交付|验收/i.test(label)
          ? "duration"
          : /保密|nda|confidential/i.test(label)
            ? "confidentiality"
            : "other",
      label: label || t("关键条款", "Key Term"),
      value,
      source: line.slice(0, 220),
      confidence: 0.55,
      riskLevel,
      suggestion:
        riskLevel === "high"
          ? t("建议补充明确违约责任和争议解决机制。", "Add explicit breach and dispute-resolution clauses.")
          : undefined,
    });

    if (keyTerms.length >= 10) {
      break;
    }
  }

  if (keyTerms.length > 0) {
    return keyTerms;
  }

  return [
    {
      type: "summary",
      label: t("沟通摘要", "Conversation Summary"),
      value: content.slice(0, 240),
      source: "input",
      confidence: 0.45,
      riskLevel: "medium",
      suggestion: t("建议补充金额、周期、交付标准和违约责任。", "Add amount, duration, delivery criteria, and breach terms."),
    },
  ];
}

function buildFallbackRiskAlerts(content: string): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  if (!/(违约|penalty|liability|争议|jurisdiction)/i.test(content)) {
    alerts.push({
      severity: "high",
      issue: t("未明确违约责任与争议解决条款。", "Missing breach liability and dispute-resolution clause."),
      suggestion: t("建议补充违约金、赔偿范围与管辖法院。", "Add penalty, damages scope, and jurisdiction."),
    });
  }
  if (!/(付款|payment|invoice|到账|转账|salary|金额)/i.test(content)) {
    alerts.push({
      severity: "medium",
      issue: t("付款安排不完整。", "Payment terms are incomplete."),
      suggestion: t("建议明确金额、节点、发票与逾期处理。", "Specify amount, milestones, invoicing, and late-payment handling."),
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      severity: "low",
      issue: t("已自动生成降级分析，请在生成前人工复核。", "Degraded analysis generated. Please review manually before drafting."),
      suggestion: t("建议在编辑页逐条确认关键条款。", "Review each key term on the analysis/edit page."),
    });
  }
  return alerts;
}

function buildFallbackAnalysis(
  content: string,
  sourceType: SourceType,
  language: "zh" | "en",
): AIAnalysisResult {
  const contractType = inferFallbackContractType(content);
  const keyTerms = extractFallbackKeyTerms(content);

  return {
    contractType,
    confidence: 0.45,
    partyA: {
      name: "",
      role: language === "zh" ? "甲方" : "Party A",
      company: "",
      position: "",
      contact: "",
      identified: false,
    },
    partyB: {
      name: "",
      role: language === "zh" ? "乙方" : "Party B",
      company: "",
      position: "",
      contact: "",
      identified: false,
    },
    keyTerms,
    summary:
      language === "zh"
        ? "AI 服务暂不可用，已基于输入内容生成可编辑的降级分析。"
        : "AI service is temporarily unavailable. A degraded but editable analysis has been produced.",
    scenario: {
      type: sourceType,
      description:
        language === "zh"
          ? "基于导入内容自动提取的合同事实（降级模式）。"
          : "Contract facts auto-extracted from imported content (degraded mode).",
    },
    riskAlerts: buildFallbackRiskAlerts(content),
    missingInfo: [
      {
        item:
          language === "zh"
            ? "合同金额与付款节点"
            : "Contract amount and payment milestones",
        importance: "high",
      },
      {
        item:
          language === "zh"
            ? "交付标准与验收规则"
            : "Delivery criteria and acceptance rules",
        importance: "medium",
      },
    ],
    professionalAdvice: [
      language === "zh"
        ? "建议在生成合同前，补充可量化的交付标准和逾期责任。"
        : "Before draft generation, add measurable delivery standards and late-performance liabilities.",
    ],
  };
}

function isRetryableAiFailure(error: unknown) {
  if (error instanceof ContractAIError) {
    return (
      error.code === "AI_TIMEOUT" ||
      error.code === "AI_RATE_LIMITED" ||
      error.code === "AI_PROVIDER_FAILED" ||
      error.code === "AI_KEY_UNAVAILABLE"
    );
  }

  if (error instanceof Error) {
    return /timeout|timed out|rate limit|temporarily unavailable/i.test(error.message);
  }

  return false;
}

function resolveAnalyzeInputMaxChars() {
  return clamp(
    parsePositiveInt(process.env.AI_ANALYZE_INPUT_MAX_CHARS, DEFAULT_ANALYSIS_MAX_CHARS),
    2_000,
    50_000,
  );
}

function resolveRouteBudgetMs() {
  return clamp(
    parsePositiveInt(process.env.AI_ANALYZE_ROUTE_BUDGET_MS, 24_000),
    3_000,
    120_000,
  );
}

function resolveSoftTimeoutMs() {
  return clamp(
    parsePositiveInt(process.env.AI_ANALYZE_SOFT_TIMEOUT_MS, 8_000),
    1_000,
    60_000,
  );
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireCurrentUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_JSON",
          message: t("请求体必须是有效 JSON。", "Request body must be valid JSON."),
        },
      },
      { status: 400 },
    );
  }

  if (!bodyRaw || typeof bodyRaw !== "object" || Array.isArray(bodyRaw)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_BODY",
          message: t("请求体必须是对象。", "Request body must be an object."),
        },
      },
      { status: 400 },
    );
  }

  const body = bodyRaw as Record<string, unknown>;
  const sourceType = normalizeSourceType(body.sourceType);
  const language = normalizeLanguage(body.language) || (isChinaRegion() ? "zh" : "en");
  const preparedInput = prepareAnalysisInput(normalizeText(body.content), {
    maxChars: resolveAnalyzeInputMaxChars(),
  });

  if (preparedInput.analyzedChars < 20) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CONTENT_TOO_SHORT",
          message: t("输入内容过短，请补充更多细节。", "Input content is too short. Please add more details."),
        },
      },
      { status: 400 },
    );
  }

  const softTimeoutMs = resolveSoftTimeoutMs();
  const routeBudgetMs = resolveRouteBudgetMs();
  const startedAt = Date.now();

  try {
    const timedResult = await withTimeout(
      withTimeout(
        analyzeConversation({
          content: preparedInput.content,
          sourceType,
          language,
        }),
        softTimeoutMs,
        () => {
          throw new ContractAIError(
            `AI analyze soft timeout after ${softTimeoutMs}ms`,
            "AI_TIMEOUT",
            504,
          );
        },
      ),
      routeBudgetMs,
      () => {
        throw new ContractAIError(
          `AI analyze route timeout after ${routeBudgetMs}ms`,
          "AI_TIMEOUT",
          504,
        );
      },
    );

    return NextResponse.json({
      success: true,
      data: timedResult,
      meta: {
        degraded: false,
        input: preparedInput,
        latencyMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    if (isRetryableAiFailure(error)) {
      const fallback = buildFallbackAnalysis(preparedInput.content, sourceType, language);
      return NextResponse.json({
        success: true,
        data: fallback,
        meta: {
          degraded: true,
          reason: error instanceof Error ? error.message : "AI unavailable",
          input: preparedInput,
          latencyMs: Date.now() - startedAt,
        },
      });
    }

    const status = error instanceof ContractAIError ? error.status : 500;
    const code = error instanceof ContractAIError ? error.code : "ANALYZE_FAILED";
    const message =
      error instanceof ContractAIError
        ? error.message
        : t("合同分析失败，请稍后重试。", "Failed to analyze contract. Please retry later.");

    return NextResponse.json(
      {
        success: false,
        error: { code, message },
        meta: {
          input: preparedInput satisfies PreparedAnalysisInput,
        },
      },
      { status },
    );
  }
}
