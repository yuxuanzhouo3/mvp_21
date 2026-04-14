import { NextRequest, NextResponse } from "next/server";

import { ContractAIError, generateContract } from "@/lib/ai";
import {
  type AIAnalysisResult,
  type ContractContent,
  type ContractType,
} from "@/lib/ai/types";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import { getDashboardTemplateById } from "@/lib/data/dashboard-store";
import { buildMembershipEntitlements } from "@/lib/membership/policy";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(raw || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function resolveGenerateSoftTimeoutMs() {
  return parsePositiveInt(process.env.AI_GENERATE_SOFT_TIMEOUT_MS, 12_000);
}

function resolveGenerateRouteBudgetMs() {
  return parsePositiveInt(process.env.AI_GENERATE_ROUTE_BUDGET_MS, 12_000);
}

function resolveStepTimeoutMs(deadlineAt: number, desiredMs: number, floorMs: number) {
  const remainingMs = deadlineAt - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= floorMs) {
    return floorMs;
  }
  return Math.max(floorMs, Math.min(desiredMs, remainingMs));
}

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function pickContractTypeLabel(contractType: unknown) {
  const type = normalizeText(contractType, "custom").toLowerCase() as ContractType | string;
  const labels: Record<string, { zh: string; en: string }> = {
    labor: { zh: "劳动合同", en: "Employment Contract" },
    service: { zh: "服务合同", en: "Service Agreement" },
    cooperation: { zh: "合作协议", en: "Cooperation Agreement" },
    nda: { zh: "保密协议", en: "NDA" },
    freelance: { zh: "自由职业合同", en: "Freelance Contract" },
    tech: { zh: "技术开发合同", en: "Technology Development Contract" },
    software: { zh: "软件开发合同", en: "Software Development Contract" },
    custom: { zh: "合同", en: "Contract" },
  };

  return labels[type] || labels.custom;
}

function buildFastFallbackContract(args: {
  analysisResult: AIAnalysisResult;
  templateName?: string;
  customFields?: Record<string, string>;
}): ContractContent {
  const { analysisResult, templateName, customFields } = args;
  const zh = isChinaRegion();
  const typeLabel = pickContractTypeLabel(analysisResult.contractType);
  const title = normalizeText(templateName)
    ? normalizeText(templateName)
    : zh
      ? `${typeLabel.zh}草稿`
      : `${typeLabel.en} Draft`;

  const partyAName = normalizeText(
    analysisResult.partyA?.name,
    zh ? "甲方（待补充）" : "Party A (To Be Added)",
  );
  const partyBName = normalizeText(
    analysisResult.partyB?.name,
    zh ? "乙方（待补充）" : "Party B (To Be Added)",
  );

  const summary = normalizeText(
    analysisResult.summary,
    zh
      ? "系统已进入快速生成模式，请在编辑页补充关键业务事实。"
      : "Fast generation mode is enabled. Please complete key business facts in the editor.",
  );

  const keyTermLines = (analysisResult.keyTerms || [])
    .slice(0, 8)
    .map((term) => `${normalizeText(term.label, zh ? "条款" : "Term")}: ${normalizeText(term.value)}`)
    .filter(Boolean);

  const keyTermBody = keyTermLines.length
    ? keyTermLines.join("\n")
    : zh
      ? "请补充：金额、付款节点、交付内容、期限、违约责任。"
      : "Please add: amount, payment milestones, deliverables, timeline, and liabilities.";

  const extraFieldLines = Object.entries(customFields || {})
    .filter(([key, value]) => key.trim() && normalizeText(value))
    .slice(0, 8)
    .map(([key, value]) => `${key}: ${normalizeText(value)}`);

  const extraFieldBody = extraFieldLines.length
    ? `${zh ? "补充字段" : "Additional Fields"}:\n${extraFieldLines.join("\n")}`
    : "";

  const sections = [
    {
      id: "section-1",
      title: zh ? "一、合同主体" : "1. Parties",
      content: zh
        ? `甲方：${partyAName}\n乙方：${partyBName}\n双方身份信息、联系方式及签约主体信息请在正式签署前补充完整。`
        : `Party A: ${partyAName}\nParty B: ${partyBName}\nPlease complete legal entity and contact details before execution.`,
      order: 1,
      editable: true,
    },
    {
      id: "section-2",
      title: zh ? "二、合作内容与交付" : "2. Scope and Deliverables",
      content: zh
        ? `基于当前事实摘要：\n${summary}\n\n关键点：\n${keyTermBody}${extraFieldBody ? `\n\n${extraFieldBody}` : ""}`
        : `Current fact summary:\n${summary}\n\nKey points:\n${keyTermBody}${extraFieldBody ? `\n\n${extraFieldBody}` : ""}`,
      order: 2,
      editable: true,
    },
    {
      id: "section-3",
      title: zh ? "三、价款与支付" : "3. Fees and Payment",
      content: zh
        ? "请补充合同总金额、币种、付款节点、发票类型及逾期付款责任。"
        : "Please specify total amount, currency, payment milestones, invoicing, and late-payment liabilities.",
      order: 3,
      editable: true,
    },
    {
      id: "section-4",
      title: zh ? "四、期限与违约责任" : "4. Term and Liability",
      content: zh
        ? "请补充生效日期、履约期限、交付验收标准、违约金及损失赔偿规则。"
        : "Please define effective date, term, acceptance criteria, liquidated damages, and indemnities.",
      order: 4,
      editable: true,
    },
  ];

  return {
    title,
    contractType: normalizeText(analysisResult.contractType, "custom"),
    generatedBy: {
      expertName: zh ? "系统快速模式" : "System Fast Mode",
      expertTitle: zh ? "降级初稿生成" : "Degraded Draft Generator",
      generatedAt: new Date().toISOString(),
    },
    sections,
    disclaimer: zh
      ? "当前为快速降级草稿，用于避免超时中断。请在编辑页补全关键条款后再签署。"
      : "This is a fast degraded draft to avoid timeout interruption. Please complete key clauses before signing.",
    signature: {
      partyA: {
        name: partyAName,
        title: zh ? "甲方（盖章）" : "Party A (Signature / Seal)",
      },
      partyB: {
        name: partyBName,
        title: zh ? "乙方（签字/盖章）" : "Party B (Signature / Seal)",
      },
    },
  };
}

function getAiErrorMessage(error: ContractAIError): string {
  switch (error.code) {
    case "AI_KEY_UNAVAILABLE":
    case "AI_NOT_CONFIGURED":
      return t(
        "AI API Key 不可用，请联系管理员检查配置。",
        "AI API key is unavailable. Please ask the administrator to check the configuration.",
      );
    case "AI_AUTH_FAILED":
      return t(
        "AI API Key 鉴权失败，请检查配置。",
        "AI API key authentication failed. Please check the API key configuration.",
      );
    case "AI_RATE_LIMITED":
      return t(
        "AI 服务当前请求较多，请稍后重试。",
        "AI service is currently rate-limited. Please try again shortly.",
      );
    case "AI_TIMEOUT":
      return t(
        "AI 生成超时，系统已切换为快速初稿。",
        "AI generation timed out. Switched to a fast fallback draft.",
      );
    default:
      return t(
        "AI 服务暂时不可用，请稍后重试。",
        "AI service is temporarily unavailable. Please try again later.",
      );
  }
}

export const maxDuration = 300;

async function requireCurrentUser(request: NextRequest, deadlineAt: number) {
  const { token, error: tokenError } = extractTokenFromRequest(request);

  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: t("请先登录后再试。", "Please sign in first."),
          },
        },
        { status: 401 },
      ),
    };
  }

  const authResult = await withTimeout(
    verifyAuthToken(token),
    resolveStepTimeoutMs(
      deadlineAt,
      parsePositiveInt(process.env.AUTH_VERIFY_TIMEOUT_MS, 5_000),
      1_000,
    ),
    {
      success: false,
      error: "AUTH_TIMEOUT",
    },
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

  try {
    const profileTimeoutMs = parsePositiveInt(
      process.env.MEMBERSHIP_PROFILE_TIMEOUT_MS,
      4_000,
    );
    const settingsTimeoutMs = parsePositiveInt(
      process.env.MEMBERSHIP_SETTINGS_TIMEOUT_MS,
      4_000,
    );

    const profilePromise = isChinaRegion()
      ? loadChinaAccountProfile(authResult.userId)
      : loadIntlAccountProfile(
          authResult.userId,
          authResult.user && "user_metadata" in authResult.user
            ? authResult.user
            : undefined,
        );

    const [profile, settings] = await Promise.all([
      withTimeout(
        profilePromise,
        resolveStepTimeoutMs(deadlineAt, profileTimeoutMs, 800),
        null,
      ),
      withTimeout(
        loadAdminSettings(),
        resolveStepTimeoutMs(deadlineAt, settingsTimeoutMs, 800),
        null,
      ),
    ]);
    if (settings) {
      const entitlements = buildMembershipEntitlements(
        {
          plan:
            profile?.subscription_plan ||
            authResult.user?.subscription_plan ||
            authResult.user?.user_metadata?.subscription_plan,
          status:
            profile?.subscription_status ||
            authResult.user?.subscription_status ||
            authResult.user?.user_metadata?.subscription_status,
          membershipExpiresAt:
            profile?.membership_expires_at ||
            profile?.subscription_expires_at ||
            authResult.user?.membership_expires_at ||
            authResult.user?.user_metadata?.membership_expires_at ||
            authResult.user?.subscription_expires_at ||
            authResult.user?.user_metadata?.subscription_expires_at,
        },
        settings,
      );

      if (!entitlements.features.canGenerateContract) {
        return {
          error: NextResponse.json(
            {
              success: false,
              error: {
                code: "CONTRACT_GENERATION_DISABLED",
                message: t(
                  "合同生成功能当前已被管理员关闭。",
                  "Contract generation is currently disabled by the administrator.",
                ),
              },
            },
            { status: 403 },
          ),
        };
      }
    } else {
      console.warn(
        "[/api/contracts/generate] Membership settings unavailable, using graceful bypass for availability.",
      );
    }
  } catch (error) {
    console.warn(
      "[/api/contracts/generate] Membership gating failed, bypassing to keep service available:",
      error,
    );
  }

  return {
    userId: authResult.userId,
  };
}

export async function POST(request: NextRequest) {
  try {
    const routeBudgetMs = resolveGenerateRouteBudgetMs();
    const deadlineAt = Date.now() + routeBudgetMs;

    const auth = await requireCurrentUser(request, deadlineAt);
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    const {
      analysisResult,
      templateId,
      templateName,
      templateContent,
      templateVersion,
      customFields,
    } = body as {
      analysisResult: AIAnalysisResult;
      templateId?: string;
      templateName?: string;
      templateContent?: string;
      templateVersion?: number;
      customFields?: Record<string, string>;
    };

    if (!analysisResult || !analysisResult.contractType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: t("请提供有效的分析结果。", "Please provide a valid analysis result."),
          },
        },
        { status: 400 },
      );
    }

    let resolvedTemplateName = templateName;
    let resolvedTemplateContent = templateContent;
    let resolvedTemplateVersion = templateVersion;

    if ((!resolvedTemplateContent || !resolvedTemplateContent.trim()) && templateId) {
      const template = await withTimeout(
        getDashboardTemplateById(auth.userId, templateId).catch(() => null),
        resolveStepTimeoutMs(deadlineAt, 1_500, 500),
        null,
      );
      if (template?.content) {
        resolvedTemplateName = template.name;
        resolvedTemplateContent = template.content;
        resolvedTemplateVersion = template.version;
      }
    }

    const aiTimeBudgetMs = resolveStepTimeoutMs(
      deadlineAt,
      parsePositiveInt(process.env.AI_GENERATE_TIME_BUDGET_MS, 12_000),
      1_200,
    );
    const softTimeoutMs = resolveStepTimeoutMs(
      deadlineAt,
      resolveGenerateSoftTimeoutMs(),
      1_200,
    );

    let contract: ContractContent;
    let degraded = false;
    let degradedReason = "";
    let degradedMessage = "";

    let softTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        softTimeoutHandle = setTimeout(() => {
          reject(
            new ContractAIError(
              `Generate soft timeout after ${softTimeoutMs}ms`,
              "AI_TIMEOUT",
              504,
            ),
          );
        }, softTimeoutMs);
      });

      contract = await Promise.race([
        generateContract({
          analysisResult,
          templateId,
          templateName: resolvedTemplateName,
          templateContent: resolvedTemplateContent,
          templateVersion: resolvedTemplateVersion,
          customFields,
          timeBudgetMs: aiTimeBudgetMs,
          maxTokens: parsePositiveInt(process.env.AI_GENERATE_MAX_TOKENS, 1_600),
        }),
        timeoutPromise,
      ]);
    } catch (error) {
      degraded = true;
      if (error instanceof ContractAIError) {
        degradedReason = error.code;
        degradedMessage = getAiErrorMessage(error);
      } else if (error instanceof Error) {
        degradedReason = "GENERATE_FAILED";
        degradedMessage = error.message;
      } else {
        degradedReason = "GENERATE_FAILED";
        degradedMessage = String(error);
      }

      console.warn("Generate contract degraded to fast fallback:", {
        reason: degradedReason,
        message: degradedMessage,
      });

      contract = buildFastFallbackContract({
        analysisResult,
        templateName: resolvedTemplateName,
        customFields,
      });
    } finally {
      if (softTimeoutHandle) {
        clearTimeout(softTimeoutHandle);
      }
    }

    const response = NextResponse.json({
      success: true,
      data: contract,
      meta: {
        degraded,
        degradedReason: degraded ? degradedReason : undefined,
        degradedMessage: degraded ? degradedMessage : undefined,
      },
    });
    response.headers.set("X-AI-Time-Budget-Ms", String(aiTimeBudgetMs));
    if (degraded) {
      response.headers.set("X-AI-Degraded", "1");
      response.headers.set("X-AI-Degraded-Reason", degradedReason || "GENERATE_FAILED");
    }
    return response;
  } catch (error) {
    console.error("Generate contract failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GENERATE_FAILED",
          message: t("生成失败，请稍后重试。", "Generation failed. Please try again."),
        },
      },
      { status: 500 },
    );
  }
}
