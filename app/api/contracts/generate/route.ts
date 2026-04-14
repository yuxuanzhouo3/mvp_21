import { NextRequest, NextResponse } from "next/server";

import { ContractAIError, generateContract } from "@/lib/ai";
import type { AIAnalysisResult, ContractContent, GenerateContractRequest } from "@/lib/ai/types";
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
  fallbackFactory: () => T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve, reject) => {
        timer = setTimeout(() => {
          try {
            resolve(fallbackFactory());
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

function normalizeLanguage(value: unknown): "zh" | "en" | undefined {
  if (value === "zh" || value === "en") {
    return value;
  }
  return undefined;
}

function sanitizeCustomFields(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const normalized = Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (accumulator, [key, raw]) => {
      if (typeof raw !== "string") {
        return accumulator;
      }
      const nextKey = key.trim();
      if (!nextKey) {
        return accumulator;
      }
      accumulator[nextKey] = raw;
      return accumulator;
    },
    {},
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function isValidAnalysisResult(value: unknown): value is AIAnalysisResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.contractType === "string" &&
    Array.isArray(record.keyTerms) &&
    record.keyTerms.length > 0
  );
}

function createFallbackSections(language: "zh" | "en", analysisResult: AIAnalysisResult) {
  const keyTermsText = analysisResult.keyTerms
    .slice(0, 8)
    .map((term) => `- ${term.label}: ${term.value}`)
    .join("\n");

  if (language === "zh") {
    return [
      {
        id: "section-1",
        title: "第一条 合同主体与定义",
        content:
          "甲乙双方应在本合同首页或附件中填写完整主体信息，包括公司名称、统一社会信用代码、地址、联系人及联系方式。",
        order: 1,
        editable: true,
      },
      {
        id: "section-2",
        title: "第二条 服务/合作内容与交付",
        content:
          "双方按照已确认的业务目标执行合作，具体范围、交付物、验收标准和时间节点应在本条及附件中进一步明确。",
        order: 2,
        editable: true,
      },
      {
        id: "section-3",
        title: "第三条 费用与付款安排",
        content:
          "双方应明确总价、付款节点、开票条件、逾期责任及税费承担。建议按里程碑或验收结果支付对应款项。",
        order: 3,
        editable: true,
      },
      {
        id: "section-4",
        title: "第四条 关键条款（待确认）",
        content: keyTermsText || "请补充金额、期限、付款节点、违约责任、争议解决等关键条款。",
        order: 4,
        editable: true,
      },
    ];
  }

  return [
    {
      id: "section-1",
      title: "1. Parties and Definitions",
      content:
        "The parties shall provide complete legal identity details in the contract cover page or annex, including name, registration number, address, and contacts.",
      order: 1,
      editable: true,
    },
    {
      id: "section-2",
      title: "2. Scope and Deliverables",
      content:
        "The parties shall perform the agreed business scope. Deliverables, acceptance criteria, and schedule should be specified in this section and annexes.",
      order: 2,
      editable: true,
    },
    {
      id: "section-3",
      title: "3. Fees and Payment",
      content:
        "The parties should define total consideration, milestones, invoice requirements, tax allocation, and late-payment liabilities.",
      order: 3,
      editable: true,
    },
    {
      id: "section-4",
      title: "4. Key Terms to Confirm",
      content:
        keyTermsText ||
        "Please add amount, duration, milestones, breach liability, and dispute resolution clauses.",
      order: 4,
      editable: true,
    },
  ];
}

function buildFallbackContract(
  analysisResult: AIAnalysisResult,
  language: "zh" | "en",
): ContractContent {
  const contractType = analysisResult.contractType || "custom";
  const title =
    language === "zh"
      ? `AI 降级草稿（${String(contractType)}）`
      : `AI Degraded Draft (${String(contractType)})`;
  const now = new Date().toISOString();

  return {
    title,
    contractType,
    legalBasis:
      language === "zh"
        ? "本草稿为 AI 服务降级输出，请务必人工复核。"
        : "This draft was produced in degraded mode. Manual legal review is required.",
    generatedBy: {
      expertName: language === "zh" ? "系统降级助手" : "System Fallback Assistant",
      expertTitle: language === "zh" ? "合同初稿整理" : "Contract Draft Assistant",
      generatedAt: now,
    },
    sections: createFallbackSections(language, analysisResult),
    disclaimer:
      language === "zh"
        ? "当前为降级草稿，请在签署前完成人工审核并补充缺失条款。"
        : "This is a degraded draft. Complete manual review and missing terms before signing.",
    signature: {
      partyA: {
        name: analysisResult.partyA?.name || (language === "zh" ? "【待补充：甲方名称】" : "[Party A name pending]"),
        title: language === "zh" ? "甲方（盖章）" : "Party A (Signature/Seal)",
      },
      partyB: {
        name: analysisResult.partyB?.name || (language === "zh" ? "【待补充：乙方名称】" : "[Party B name pending]"),
        title: language === "zh" ? "乙方（签字/盖章）" : "Party B (Signature/Seal)",
      },
    },
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

async function requireCurrentUserWithGeneratePermission(request: NextRequest) {
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

  const profile = isChinaRegion()
    ? await withTimeout(
        loadChinaAccountProfile(authResult.userId),
        parsePositiveInt(process.env.MEMBERSHIP_PROFILE_TIMEOUT_MS, 4_000),
        () => null,
      )
    : await withTimeout(
        loadIntlAccountProfile(
          authResult.userId,
          authResult.user && "user_metadata" in authResult.user
            ? authResult.user
            : undefined,
        ),
        parsePositiveInt(process.env.MEMBERSHIP_PROFILE_TIMEOUT_MS, 4_000),
        () => null,
      );

  const settings = await withTimeout(
    loadAdminSettings(),
    parsePositiveInt(process.env.MEMBERSHIP_SETTINGS_TIMEOUT_MS, 4_000),
    () => null,
  );

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
                "合同生成功能当前不可用，请联系管理员。",
                "Contract generation is currently unavailable.",
              ),
            },
          },
          { status: 403 },
        ),
      };
    }
  }

  return { userId: authResult.userId };
}

function resolveRouteBudgetMs() {
  return clamp(
    parsePositiveInt(process.env.AI_GENERATE_ROUTE_BUDGET_MS, 60_000),
    8_000,
    300_000,
  );
}

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const auth = await requireCurrentUserWithGeneratePermission(request);
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
  const analysisResult = body.analysisResult;
  if (!isValidAnalysisResult(analysisResult)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_ANALYSIS_RESULT",
          message: t(
            "分析结果无效或缺少关键条款。",
            "Analysis result is invalid or missing key terms.",
          ),
        },
      },
      { status: 400 },
    );
  }

  const language = normalizeLanguage(body.language) || (isChinaRegion() ? "zh" : "en");
  const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
  let templateName = typeof body.templateName === "string" ? body.templateName.trim() : "";
  let templateContent =
    typeof body.templateContent === "string" ? body.templateContent : "";
  let templateVersion =
    typeof body.templateVersion === "number" && Number.isFinite(body.templateVersion)
      ? body.templateVersion
      : undefined;

  if ((!templateContent || !templateContent.trim()) && templateId) {
    const template = await withTimeout(
      getDashboardTemplateById(auth.userId, templateId),
      parsePositiveInt(process.env.CONTRACTS_QUERY_TIMEOUT_MS, 5_000),
      () => null,
    );
    if (template?.content) {
      templateName = template.name || templateName;
      templateContent = template.content || templateContent;
      templateVersion = template.version ?? templateVersion;
    }
  }

  const requestPayload: GenerateContractRequest = {
    analysisResult,
    templateId: templateId || undefined,
    templateName: templateName || undefined,
    templateContent: templateContent || undefined,
    templateVersion,
    customFields: sanitizeCustomFields(body.customFields),
    language,
  };

  const startedAt = Date.now();
  try {
    const generated = await withTimeout(
      generateContract(requestPayload),
      resolveRouteBudgetMs(),
      () => {
        throw new ContractAIError("AI generation route timeout", "AI_TIMEOUT", 504);
      },
    );

    return NextResponse.json({
      success: true,
      data: generated,
      meta: {
        degraded: false,
        latencyMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    if (isRetryableAiFailure(error)) {
      const fallback = buildFallbackContract(analysisResult, language);
      return NextResponse.json({
        success: true,
        data: fallback,
        meta: {
          degraded: true,
          reason: error instanceof Error ? error.message : "AI unavailable",
          latencyMs: Date.now() - startedAt,
        },
      });
    }

    const status = error instanceof ContractAIError ? error.status : 500;
    const code = error instanceof ContractAIError ? error.code : "GENERATE_FAILED";
    const message =
      error instanceof ContractAIError
        ? error.message
        : t("合同生成失败，请稍后重试。", "Failed to generate contract. Please retry later.");

    return NextResponse.json(
      {
        success: false,
        error: { code, message },
      },
      { status },
    );
  }
}
