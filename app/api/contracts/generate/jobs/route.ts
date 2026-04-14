import { NextRequest, NextResponse } from "next/server";

import type { AIAnalysisResult } from "@/lib/ai/types";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import { getContractById } from "@/lib/data/contracts-store";
import { buildMembershipEntitlements } from "@/lib/membership/policy";
import {
  enqueueContractGenerationJob,
  toGenerationJobPublic,
} from "@/lib/contracts/generation-jobs";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
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

function sanitizeCustomFields(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const normalized = Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (accumulator, [key, entry]) => {
      if (typeof entry !== "string") {
        return accumulator;
      }
      const normalizedKey = key.trim();
      if (!normalizedKey) {
        return accumulator;
      }
      accumulator[normalizedKey] = entry;
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

  const authResult = await withTimeout(
    verifyAuthToken(token),
    parsePositiveInt(process.env.AUTH_VERIFY_TIMEOUT_MS, 5_000),
    { success: false, error: "AUTH_TIMEOUT" },
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
        null,
      )
    : await withTimeout(
        loadIntlAccountProfile(
          authResult.userId,
          authResult.user && "user_metadata" in authResult.user
            ? authResult.user
            : undefined,
        ),
        parsePositiveInt(process.env.MEMBERSHIP_PROFILE_TIMEOUT_MS, 4_000),
        null,
      );

  const settings = await withTimeout(
    loadAdminSettings(),
    parsePositiveInt(process.env.MEMBERSHIP_SETTINGS_TIMEOUT_MS, 4_000),
    null,
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
    console.warn("[/api/contracts/generate/jobs] Membership settings timed out. Bypass gating.");
  }

  return {
    userId: authResult.userId,
  };
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
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
            message: t("请求体不是有效 JSON。", "Request body must be valid JSON."),
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
    const contractId = typeof body.contractId === "string" ? body.contractId.trim() : "";
    const analysisResult = body.analysisResult;
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : undefined;
    const templateName =
      typeof body.templateName === "string" ? body.templateName.trim() : undefined;
    const templateContent =
      typeof body.templateContent === "string" ? body.templateContent : undefined;
    const templateVersion =
      typeof body.templateVersion === "number" && Number.isFinite(body.templateVersion)
        ? body.templateVersion
        : undefined;
    const language =
      body.language === "zh" || body.language === "en" ? body.language : undefined;

    if (!contractId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_CONTRACT_ID",
            message: t("缺少合同草稿 ID。", "Missing contract draft ID."),
          },
        },
        { status: 400 },
      );
    }

    if (!isValidAnalysisResult(analysisResult)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ANALYSIS_RESULT",
            message: t(
              "分析结果无效或缺少关键条款，请补充后再生成。",
              "Analysis is invalid or missing key terms. Please revise it before generating.",
            ),
          },
        },
        { status: 400 },
      );
    }

    const contract = await withTimeout(
      getContractById(contractId),
      parsePositiveInt(process.env.CONTRACTS_QUERY_TIMEOUT_MS, 5_000),
      null,
    );
    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONTRACT_NOT_FOUND",
            message: t("未找到该合同草稿。", "Contract draft not found."),
          },
        },
        { status: 404 },
      );
    }

    if (contract.userId !== auth.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: t("你无权操作该合同草稿。", "You do not have access to this draft."),
          },
        },
        { status: 403 },
      );
    }

    const result = await withTimeout(
      enqueueContractGenerationJob({
        contract,
        userId: auth.userId,
        analysisResult,
        templateId,
        templateName,
        templateContent,
        templateVersion,
        customFields: sanitizeCustomFields(body.customFields),
        language,
      }),
      parsePositiveInt(process.env.CONTRACTS_ENQUEUE_TIMEOUT_MS, 7_000),
      null,
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ENQUEUE_TIMEOUT",
            message: t("创建生成任务超时，请重试。", "Creating generation job timed out. Please retry."),
          },
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          job: toGenerationJobPublic(result.job),
          reused: result.reused,
        },
      },
      { status: result.reused ? 200 : 202 },
    );
  } catch (error) {
    console.error("Failed to enqueue contract generation job:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ENQUEUE_FAILED",
          message: t("创建生成任务失败，请重试。", "Failed to create generation job. Please retry."),
        },
      },
      { status: 500 },
    );
  }
}

