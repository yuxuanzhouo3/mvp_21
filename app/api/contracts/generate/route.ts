import { NextRequest, NextResponse } from "next/server";

import { ContractAIError, generateContract } from "@/lib/ai";
import { type AIAnalysisResult } from "@/lib/ai/types";
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
        "AI 生成超时，请稍后重试或精简输入后再生成。",
        "AI generation timed out. Please retry, or shorten the input before generating.",
      );
    default:
      return t(
        "AI 服务暂时不可用，请稍后重试。",
        "AI service is temporarily unavailable. Please try again later.",
      );
  }
}

export const maxDuration = 300;

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

  return {
    userId: authResult.userId,
  };
}

export async function POST(request: NextRequest) {
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
      const template = await getDashboardTemplateById(auth.userId, templateId).catch(() => null);
      if (template?.content) {
        resolvedTemplateName = template.name;
        resolvedTemplateContent = template.content;
        resolvedTemplateVersion = template.version;
      }
    }

    const aiTimeBudgetMs = parsePositiveInt(
      process.env.AI_GENERATE_TIME_BUDGET_MS,
      50_000,
    );
    const contract = await generateContract({
      analysisResult,
      templateId,
      templateName: resolvedTemplateName,
      templateContent: resolvedTemplateContent,
      templateVersion: resolvedTemplateVersion,
      customFields,
      timeBudgetMs: aiTimeBudgetMs,
    });

    const response = NextResponse.json({
      success: true,
      data: contract,
    });
    response.headers.set("X-AI-Time-Budget-Ms", String(aiTimeBudgetMs));
    return response;
  } catch (error) {
    if (error instanceof ContractAIError) {
      console.error("Generate contract AI error:", {
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

    console.error("Generate contract failed:", error);

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
