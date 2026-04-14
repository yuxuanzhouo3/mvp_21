import { NextRequest, NextResponse } from "next/server";

import { ContractAIError, analyzeConversation } from "@/lib/ai";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import {
  MAX_ANALYSIS_MAX_CHARS,
  MIN_ANALYSIS_MAX_CHARS,
  prepareAnalysisInput,
} from "@/lib/contracts/analysis-input";
import {
  SourceType,
  type AIAnalysisResult,
  type ContractType,
} from "@/lib/ai/types";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  const parsed = Number.parseInt(String(raw || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function resolveAnalyzeMaxChars() {
  const configured = parsePositiveInt(process.env.AI_ANALYZE_INPUT_MAX_CHARS) || 4_000;
  return Math.max(
    MIN_ANALYSIS_MAX_CHARS,
    Math.min(MAX_ANALYSIS_MAX_CHARS, configured),
  );
}

function resolveAnalyzeSoftTimeoutMs() {
  const configured = parsePositiveInt(process.env.AI_ANALYZE_SOFT_TIMEOUT_MS) || 10_000;
  return Math.max(3_000, Math.min(30_000, configured));
}

function resolveAnalyzeRouteBudgetMs() {
  const configured = parsePositiveInt(process.env.AI_ANALYZE_ROUTE_BUDGET_MS) || 10_000;
  return Math.max(5_000, Math.min(30_000, configured));
}

function resolveAuthTimeoutMs() {
  const configured = parsePositiveInt(process.env.AUTH_VERIFY_TIMEOUT_MS) || 5_000;
  return Math.max(1_000, Math.min(8_000, configured));
}

function resolveStepTimeoutMs(deadlineAt: number, desiredMs: number, floorMs: number) {
  const remainingMs = deadlineAt - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= floorMs) {
    return floorMs;
  }
  return Math.max(floorMs, Math.min(desiredMs, remainingMs));
}

const FAST_CONTRACT_TYPE_RULES: Array<{ type: ContractType; pattern: RegExp }> = [
  {
    type: "nda",
    pattern: /(nda|non[- ]?disclosure|confidential|保密|保密协议|竞业)/i,
  },
  {
    type: "labor",
    pattern: /(employment|employee|salary|payroll|probation|labor|劳动|雇佣|工资|试用|社保)/i,
  },
  {
    type: "tech",
    pattern: /(software|development|source code|api|deploy|milestone|验收|源码|开发|部署|交付)/i,
  },
  {
    type: "service",
    pattern: /(service|consulting|support|顾问|服务|服务费|委托)/i,
  },
  {
    type: "cooperation",
    pattern: /(cooperation|partnership|reseller|revenue share|合作|联营|渠道|分成)/i,
  },
];

const FAST_KEY_LINE_PATTERN =
  /(\d|%|¥|￥|\$|amount|price|payment|invoice|tax|deadline|term|delivery|acceptance|penalty|liability|confidential|金额|付款|税|期限|交付|验收|违约|赔偿|保密)/i;

function normalizeText(content: string) {
  return content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function inferFastContractType(content: string): ContractType {
  for (const rule of FAST_CONTRACT_TYPE_RULES) {
    if (rule.pattern.test(content)) {
      return rule.type;
    }
  }
  return "custom";
}

function extractTaggedValue(content: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}\\s*[:：]\\s*([^\\n,，;；。]{2,60})`, "i");
    const match = content.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function buildFastFallbackAnalysis(content: string): AIAnalysisResult {
  const normalized = normalizeText(content);
  const contractType = inferFastContractType(normalized);
  const lines = normalized.split("\n");
  const keyLines = lines
    .filter((line) => line.length >= 8 && FAST_KEY_LINE_PATTERN.test(line))
    .slice(0, 8);

  const keyTerms = keyLines.map((line, index) => ({
    type: index === 0 ? "core" : "term",
    label: t(`核心条款 ${index + 1}`, `Key Term ${index + 1}`),
    value: line.slice(0, 240),
    source: line.slice(0, 240),
    confidence: 0.42,
    riskLevel: "medium" as const,
    suggestion: t("建议在草稿中补充更明确的金额、时间和交付标准。", "Specify amount, timeline, and delivery standards more clearly in the draft."),
  }));

  if (keyTerms.length === 0) {
    keyTerms.push({
      type: "summary",
      label: t("核心约定", "Core Terms"),
      value: normalized.slice(0, 220) || t("待补充合同事实。", "Contract facts need more detail."),
      source: "input",
      confidence: 0.35,
      riskLevel: "medium",
      suggestion: t("建议补充交易金额、履约期限和违约责任。", "Add payment amount, timeline, and breach liabilities."),
    });
  }

  const partyAName = extractTaggedValue(normalized, [
    "甲方",
    "Party A",
    "Client",
    "委托方",
    "发包方",
  ]);
  const partyBName = extractTaggedValue(normalized, [
    "乙方",
    "Party B",
    "Vendor",
    "承包方",
    "服务方",
  ]);

  const hasMoney = /(¥|￥|\$|\d+\s*(元|万元|usd|cny|rmb)|amount|price|payment|金额|费用|价款)/i.test(
    normalized,
  );
  const hasTimeline = /(day|days|month|months|year|years|date|deadline|期限|日期|天|月|年|截止)/i.test(
    normalized,
  );
  const hasScope = /(scope|service|deliver|acceptance|内容|范围|交付|验收|服务)/i.test(normalized);

  const missingInfo: NonNullable<AIAnalysisResult["missingInfo"]> = [];
  if (!partyAName) {
    missingInfo.push({
      item: t("甲方信息", "Party A details"),
      importance: "high",
      defaultSuggestion: t("请补充甲方名称或主体信息。", "Please add Party A legal entity details."),
    });
  }
  if (!partyBName) {
    missingInfo.push({
      item: t("乙方信息", "Party B details"),
      importance: "high",
      defaultSuggestion: t("请补充乙方名称或主体信息。", "Please add Party B legal entity details."),
    });
  }
  if (!hasMoney) {
    missingInfo.push({
      item: t("支付条款", "Payment terms"),
      importance: "high",
      defaultSuggestion: t("请补充金额、币种、付款节点。", "Please specify amount, currency, and milestones."),
    });
  }
  if (!hasTimeline) {
    missingInfo.push({
      item: t("履约期限", "Timeline"),
      importance: "medium",
      defaultSuggestion: t("请补充起止时间与关键里程碑。", "Please add start/end dates and milestones."),
    });
  }
  if (!hasScope) {
    missingInfo.push({
      item: t("服务/交付范围", "Scope and deliverables"),
      importance: "medium",
      defaultSuggestion: t("请补充工作内容、交付物、验收标准。", "Please add scope, deliverables, and acceptance criteria."),
    });
  }

  return {
    contractType,
    confidence: 0.42,
    partyA: {
      name: partyAName,
      role: "partyA",
      identified: Boolean(partyAName),
    },
    partyB: {
      name: partyBName,
      role: "partyB",
      identified: Boolean(partyBName),
    },
    keyTerms,
    summary:
      normalized.slice(0, 300) ||
      t("已进入快速分析模式，请补充更多合同事实。", "Fast analysis mode enabled. Please provide more contract details."),
    expertAnalysis: {
      expertName: t("系统快速模式", "System Fast Mode"),
      expertTitle: t("规则提取分析", "Rule-based Extraction"),
      analysisDate: new Date().toISOString(),
      overallAssessment: t(
        "AI 分析未在时限内完成，系统已返回快速可编辑结果以保证流程继续。",
        "AI analysis did not finish in time. A fast editable result was returned so your flow can continue.",
      ),
    },
    riskAlerts: [
      {
        severity: "medium",
        issue: t("关键信息可能不完整", "Some key facts may be incomplete"),
        impact: t("可能影响后续条款准确性", "This may affect draft clause accuracy"),
        suggestion: t("建议在下一步补充金额、期限、违约责任。", "Add amount, timeline, and liability details in the next step."),
      },
    ],
    missingInfo,
    professionalAdvice: [
      t("优先确认交易金额、付款节点和违约责任。", "Prioritize payment amount, milestones, and breach liability."),
      t("在编辑页补齐主体信息与交付验收标准。", "Complete party details and acceptance standards in the editor."),
    ],
  };
}

function getAiErrorMessage(error: ContractAIError): string {
  switch (error.code) {
    case "AI_KEY_UNAVAILABLE":
    case "AI_NOT_CONFIGURED":
      return t(
        "DASHSCOPE_API_KEY 密钥不可用，请联系管理员检查配置。",
        "AI API key is unavailable. Please ask the administrator to check the configuration.",
      );
    case "AI_AUTH_FAILED":
      return t(
        "DASHSCOPE_API_KEY 密钥不可用，请检查 API Key 配置。",
        "AI API key is unavailable. Please check the API key configuration.",
      );
    case "AI_RATE_LIMITED":
      return t(
        "AI 服务当前请求较多，请稍后重试。",
        "AI service is currently rate-limited. Please try again shortly.",
      );
    case "AI_TIMEOUT":
      return t(
        "AI 分析超时，请稍后重试或精简输入后再分析。",
        "AI analysis timed out. Please retry, or shorten the input before analyzing.",
      );
    default:
      return t(
        "AI 服务暂时不可用，请稍后重试。",
        "AI service is temporarily unavailable. Please try again later.",
      );
  }
}

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const routeBudgetMs = resolveAnalyzeRouteBudgetMs();
    const deadlineAt = Date.now() + routeBudgetMs;

    const { token, error: tokenError } = extractTokenFromRequest(request);
    if (tokenError || !token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: t("请先登录后再使用分析功能。", "Please sign in before analysis."),
          },
        },
        { status: 401 },
      );
    }

    const authResult = await withTimeout(
      verifyAuthToken(token),
      resolveStepTimeoutMs(deadlineAt, resolveAuthTimeoutMs(), 1_000),
      {
        success: false,
        error: "AUTH_TIMEOUT",
      },
    );
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: t("登录状态无效。", "Invalid token."),
          },
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { content, sourceType = "text" } = body as {
      content: string;
      sourceType?: SourceType;
    };

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: t("请提供对话内容。", "Please provide conversation content."),
          },
        },
        { status: 400 },
      );
    }

    const rawContent = content.trim();

    if (rawContent.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONTENT_TOO_SHORT",
            message: t(
              "对话内容太短，请提供更详细的对话。",
              "Conversation is too short. Please provide more detail.",
            ),
          },
        },
        { status: 400 },
      );
    }

    if (rawContent.length > 120_000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONTENT_TOO_LONG",
            message: t(
              "对话内容过长，请精简后重试。",
              "Conversation is too long. Please shorten it and try again.",
            ),
          },
        },
        { status: 400 },
      );
    }

    const preparedInput = prepareAnalysisInput(rawContent, {
      maxChars: resolveAnalyzeMaxChars(),
    });

    if (preparedInput.content.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONTENT_TOO_SHORT",
            message: t(
              "对话内容太短，请提供更详细的对话。",
              "Conversation is too short. Please provide more detail.",
            ),
          },
        },
        { status: 400 },
      );
    }

    if (preparedInput.truncated) {
      console.info("[/api/contracts/analyze] Input truncated for latency control:", {
        originalChars: preparedInput.originalChars,
        normalizedChars: preparedInput.normalizedChars,
        analyzedChars: preparedInput.analyzedChars,
      });
    }

    let result: AIAnalysisResult;
    let degraded = false;
    let degradedReason = "";
    let degradedMessage = "";

    let softTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const softTimeoutMs = resolveStepTimeoutMs(
        deadlineAt,
        resolveAnalyzeSoftTimeoutMs(),
        1_500,
      );
      const timeoutPromise = new Promise<never>((_, reject) => {
        softTimeoutHandle = setTimeout(() => {
          reject(
            new ContractAIError(
              `Analyze soft timeout after ${softTimeoutMs}ms`,
              "AI_TIMEOUT",
              504,
            ),
          );
        }, softTimeoutMs);
      });

      result = await Promise.race([
        analyzeConversation({
          content: preparedInput.content,
          sourceType,
        }),
        timeoutPromise,
      ]);
    } catch (error) {
      degraded = true;
      if (error instanceof ContractAIError) {
        degradedReason = error.code;
        degradedMessage = getAiErrorMessage(error);
      } else if (error instanceof Error) {
        degradedReason = "ANALYZE_FAILED";
        degradedMessage = error.message;
      } else {
        degradedReason = "ANALYZE_FAILED";
        degradedMessage = String(error);
      }

      console.warn("[/api/contracts/analyze] Degraded to fast fallback:", {
        reason: degradedReason,
        message: degradedMessage,
      });

      result = buildFastFallbackAnalysis(preparedInput.content);
    } finally {
      if (softTimeoutHandle) {
        clearTimeout(softTimeoutHandle);
      }
    }

    const response = NextResponse.json({
      success: true,
      data: result,
      meta: {
        input: {
          originalChars: preparedInput.originalChars,
          analyzedChars: preparedInput.analyzedChars,
          truncated: preparedInput.truncated,
        },
        degraded,
        degradedReason: degraded ? degradedReason : undefined,
        degradedMessage: degraded ? degradedMessage : undefined,
      },
    });
    if (degraded) {
      response.headers.set("X-AI-Degraded", "1");
      response.headers.set("X-AI-Degraded-Reason", degradedReason || "ANALYZE_FAILED");
    }
    return response;
  } catch (error) {
    if (error instanceof ContractAIError) {
      console.error("Analyze conversation AI error:", {
        code: error.code,
        status: error.status,
        provider: error.provider,
        message: error.message,
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: getAiErrorMessage(error),
            provider: error.provider,
          },
        },
        { status: error.status },
      );
    }

    console.error("Analyze conversation failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ANALYZE_FAILED",
          message: t("分析失败，请重试。", "Analysis failed. Please try again."),
        },
      },
      { status: 500 },
    );
  }
}
