import { NextRequest, NextResponse } from "next/server";

import { generateContract } from "@/lib/ai";
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

    const contract = await generateContract({
      analysisResult,
      templateId,
      templateName: resolvedTemplateName,
      templateContent: resolvedTemplateContent,
      templateVersion: resolvedTemplateVersion,
      customFields,
    });

    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error) {
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
