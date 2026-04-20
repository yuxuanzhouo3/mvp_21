import { NextRequest, NextResponse } from "next/server";

import { ContractAIError, generateContract } from "@/lib/ai";
import { type AIAnalysisResult } from "@/lib/ai/types";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isAdminRole } from "@/lib/auth/user-role";
import { isChinaRegion } from "@/lib/config/region";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import { getDashboardTemplateById } from "@/lib/data/dashboard-store";
import { buildMembershipEntitlements } from "@/lib/membership/policy";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function parseIntlAdminEmailAllowlist(): string[] {
  const raw =
    process.env.INTL_ADMIN_EMAIL_ALLOWLIST ||
    process.env.ADMIN_ROLE_EMAIL_ALLOWLIST ||
    "";

  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isIntlAdminAllowlistedEmail(email?: string | null): boolean {
  if (isChinaRegion()) {
    return false;
  }

  if (!email || typeof email !== "string") {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const allowlist = parseIntlAdminEmailAllowlist();
  return allowlist.includes(normalized);
}

function parseBudget(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function getGenerateRouteTimeoutMs() {
  const routeBudget = parseBudget("AI_GENERATE_ROUTE_BUDGET_MS", 45_000, 100, 180_000);
  const totalBudget = parseBudget("AI_GENERATE_TOTAL_ROUTE_BUDGET_MS", 55_000, 200, 180_000);
  const safetyBuffer = parseBudget("AI_GENERATE_ROUTE_SAFETY_BUFFER_MS", 3_000, 0, 30_000);
  const effective = Math.max(100, Math.min(routeBudget, totalBudget - safetyBuffer));
  return effective;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, reason: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(reason));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function isTimeoutLikeError(error: unknown) {
  if (error instanceof ContractAIError) {
    const message = (error.message || "").toLowerCase();
    return (
      error.code === "AI_TIMEOUT" ||
      error.code === "AI_PROVIDER_TIMEOUT" ||
      message.includes("timeout") ||
      message.includes("timed out")
    );
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("timeout") || message.includes("timed out");
  }

  return false;
}

function isAccountStandingIssue(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("overdue-payment") ||
    message.includes("account is in good standing") ||
    message.includes("access denied")
  );
}

function mapContractTypeLabel(contractType: string | undefined) {
  const type = (contractType || "custom").toLowerCase();
  if (isChinaRegion()) {
    switch (type) {
      case "labor":
        return "劳动合同";
      case "service":
        return "服务合同";
      case "cooperation":
        return "合作协议";
      case "nda":
        return "保密协议";
      case "freelance":
        return "自由职业合同";
      case "tech":
      case "software":
        return "技术开发合同";
      default:
        return "商事合同";
    }
  }

  switch (type) {
    case "labor":
      return "Employment Contract";
    case "service":
      return "Service Agreement";
    case "cooperation":
      return "Cooperation Agreement";
    case "nda":
      return "NDA";
    case "freelance":
      return "Freelance Agreement";
    case "tech":
    case "software":
      return "Technology Development Agreement";
    default:
      return "Business Contract";
  }
}

function buildFallbackContractFromAnalysis(analysisResult: AIAnalysisResult) {
  const contractType = analysisResult.contractType || "custom";
  const contractLabel = mapContractTypeLabel(contractType);
  const keyTerms = Array.isArray(analysisResult.keyTerms)
    ? analysisResult.keyTerms
        .map((item) => {
          const label = typeof item?.label === "string" ? item.label.trim() : "";
          const value = typeof item?.value === "string" ? item.value.trim() : "";
          return label && value ? `${label}: ${value}` : "";
        })
        .filter(Boolean)
    : [];

  const partyAName =
    analysisResult.partyA?.name || (isChinaRegion() ? "待补充甲方信息" : "Party A (to be completed)");
  const partyBName =
    analysisResult.partyB?.name || (isChinaRegion() ? "待补充乙方信息" : "Party B (to be completed)");

  return {
    title: isChinaRegion() ? `${contractLabel}（草稿）` : `${contractLabel} (Draft)`,
    contractType,
    sections: [
      {
        id: "section-1",
        title: isChinaRegion() ? "1. 合同主体" : "1. Parties",
        content: isChinaRegion()
          ? `甲方：${partyAName}\n乙方：${partyBName}`
          : `Party A: ${partyAName}\nParty B: ${partyBName}`,
        order: 1,
        editable: true,
      },
      {
        id: "section-2",
        title: isChinaRegion() ? "2. 合作内容与关键条款" : "2. Scope and Key Terms",
        content:
          keyTerms.length > 0
            ? keyTerms.map((item) => `- ${item}`).join("\n")
            : isChinaRegion()
              ? "请补充合作范围、交付内容、验收标准等关键信息。"
              : "Please complete key scope details, deliverables, and acceptance criteria.",
        order: 2,
        editable: true,
      },
      {
        id: "section-3",
        title: isChinaRegion() ? "3. 付款与时间安排" : "3. Payment and Timeline",
        content:
          (typeof analysisResult.summary === "string" && analysisResult.summary.trim()) ||
          (isChinaRegion()
            ? "请补充金额、付款节点、起止日期与违约责任。"
            : "Please complete amount, milestones, timeline, and breach terms."),
        order: 3,
        editable: true,
      },
    ],
    disclaimer: isChinaRegion()
      ? "当前为 AI 超时降级草稿，请在发送签署前完成法律与业务复核。"
      : "This is a degraded draft due to AI timeout. Please complete legal and business review before signing.",
    signature: {
      partyA: {
        name: isChinaRegion() ? "【待补充：甲方名称】" : "[To be completed: Party A]",
        title: isChinaRegion() ? "甲方（盖章）" : "Party A (Signature / Seal)",
      },
      partyB: {
        name: isChinaRegion() ? "【待补充：乙方名称】" : "[To be completed: Party B]",
        title: isChinaRegion() ? "乙方（签字/盖章）" : "Party B (Signature / Seal)",
      },
    },
  };
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
            message: t("请先登录后再试。", "Please sign in first."),
          },
        },
        { status: 401 },
      ),
    };
  }

  const authResult = await verifyAuthToken(token);
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
    ? await loadChinaAccountProfile(authResult.userId)
    : await loadIntlAccountProfile(
        authResult.userId,
        authResult.user && "user_metadata" in authResult.user
          ? authResult.user
          : undefined,
      );

  let role =
    profile?.role ||
    authResult.user?.role ||
    authResult.user?.user_metadata?.role ||
    authResult.user?.app_metadata?.role ||
    "user";
  const email =
    profile?.email ||
    authResult.user?.email ||
    authResult.user?.user_metadata?.email ||
    null;

  if (isIntlAdminAllowlistedEmail(email)) {
    role = "admin";
  }

  if (!isAdminRole(role)) {
  const settings = await loadAdminSettings();
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
  }

  return {
    userId: authResult.userId,
  };
}

export async function POST(request: NextRequest) {
  let analysisResultForFallback: AIAnalysisResult | null = null;
  try {
    const auth = await requireCurrentUser(request);
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
    analysisResultForFallback = analysisResult ?? null;

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

    if (!analysisResult.keyTerms || analysisResult.keyTerms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_KEY_TERMS",
            message: t(
              "尚未提取到关键条款，请先补充合同事实后再生成。",
              "No key terms were extracted. Please add more contract facts before generating.",
            ),
          },
        },
        { status: 400 },
      );
    }

    let resolvedTemplateName = templateName;
    let resolvedTemplateContent = templateContent;
    let resolvedTemplateVersion = templateVersion;

    if ((!resolvedTemplateContent || !resolvedTemplateContent.trim()) && templateId) {
      const template = await getDashboardTemplateById(auth.userId, templateId).catch(
        () => null,
      );
      if (template?.content) {
        resolvedTemplateName = template.name;
        resolvedTemplateContent = template.content;
        resolvedTemplateVersion = template.version;
      }
    }

    const timeoutMs = getGenerateRouteTimeoutMs();
    const contract = await withTimeout(
      generateContract({
        analysisResult,
        templateId,
        templateName: resolvedTemplateName,
        templateContent: resolvedTemplateContent,
        templateVersion: resolvedTemplateVersion,
        customFields,
      }),
      timeoutMs,
      `AI generation route timeout after ${timeoutMs}ms`,
    );

    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error("Generate contract failed:", error);

    const shouldUseDegradedFallback =
      isTimeoutLikeError(error) ||
      isAccountStandingIssue(error) ||
      (error instanceof ContractAIError &&
        (error.code === "AI_PROVIDER_FAILED" ||
          error.code === "AI_KEY_UNAVAILABLE" ||
          error.code === "AI_NOT_CONFIGURED" ||
          error.code === "AI_RATE_LIMITED"));

    if (shouldUseDegradedFallback) {
      if (analysisResultForFallback && analysisResultForFallback.contractType) {
        return NextResponse.json({
          success: true,
          data: buildFallbackContractFromAnalysis(analysisResultForFallback),
          meta: {
            degraded: true,
            reason:
              error instanceof Error
                ? error.message
                : "AI generation degraded fallback",
          },
        });
      }
    }

    if (error instanceof Error && error.message.includes("API")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AI_SERVICE_ERROR",
            message: t(
              "AI 服务暂时不可用，请稍后重试。",
              "AI service is temporarily unavailable. Please try again later.",
            ),
          },
        },
        { status: 503 },
      );
    }

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
