import { NextRequest, NextResponse } from "next/server";

import {
  ContractChatOcrError,
  analyzeContractChatScreenshot,
} from "@/lib/ocr/contract-chat";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import { buildMembershipEntitlements } from "@/lib/membership/policy";

type SourceHint = "wechat" | "feishu" | "screenshot";

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

function normalizeSourceHint(value: unknown): SourceHint {
  if (value === "wechat" || value === "feishu") {
    return value;
  }
  return "screenshot";
}

function normalizeImageBase64(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function validateImageBase64(value: string): string | null {
  if (!value) {
    return t("缺少图片数据。", "Missing image data.");
  }

  if (!value.startsWith("data:image/")) {
    return t("图片数据格式不正确。", "Invalid image data format.");
  }

  if (value.length > 15 * 1024 * 1024) {
    return t("图片体积过大，请压缩后再试。", "Image payload is too large. Please compress and retry.");
  }

  return null;
}

function resolveRouteBudgetMs() {
  return clamp(
    parsePositiveInt(process.env.OCR_ROUTE_BUDGET_MS, 20_000),
    2_000,
    120_000,
  );
}

function resolveSoftTimeoutMs() {
  return clamp(
    parsePositiveInt(process.env.OCR_SOFT_TIMEOUT_MS, 8_000),
    1_000,
    60_000,
  );
}

function isRetryableOcrFailure(error: unknown) {
  if (error instanceof ContractChatOcrError) {
    return (
      error.code === "OCR_TIMEOUT" ||
      error.code === "OCR_PROVIDER_FAILED" ||
      error.code === "OCR_KEY_UNAVAILABLE"
    );
  }
  if (error instanceof Error) {
    return /timeout|timed out|temporarily unavailable|OCR_/i.test(error.message);
  }
  return false;
}

function buildFallbackOcrPayload(sourceHint: SourceHint) {
  const conversationText = isChinaRegion()
    ? "【OCR 降级模式】\n系统暂时无法自动识别截图，请手动粘贴聊天文本后继续分析。"
    : "[OCR degraded mode]\nScreenshot OCR is temporarily unavailable. Please paste the chat text manually and continue.";

  return {
    sourceType: sourceHint,
    conversationText,
    summary: isChinaRegion()
      ? "OCR 暂不可用，已切换为手动补录模式。"
      : "OCR unavailable. Switched to manual input mode.",
  };
}

async function requireCurrentUserWithAiChatPermission(request: NextRequest) {
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

    if (!entitlements.features.canUseAiChat) {
      return {
        error: NextResponse.json(
          {
            success: false,
            error: {
              code: "AI_CHAT_DISABLED",
              message: t(
                "AI 对话功能当前不可用，请联系管理员。",
                "AI chat is currently unavailable.",
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

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireCurrentUserWithAiChatPermission(request);
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
  const imageBase64 = normalizeImageBase64(body.imageBase64);
  const sourceHint = normalizeSourceHint(body.sourceHint);
  const imageValidationError = validateImageBase64(imageBase64);
  if (imageValidationError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_IMAGE",
          message: imageValidationError,
        },
      },
      { status: 400 },
    );
  }

  const softTimeoutMs = resolveSoftTimeoutMs();
  const routeBudgetMs = resolveRouteBudgetMs();
  const startedAt = Date.now();

  try {
    const result = await withTimeout(
      withTimeout(
        analyzeContractChatScreenshot(imageBase64, sourceHint),
        softTimeoutMs,
        () => {
          throw new ContractChatOcrError(
            `OCR soft timeout after ${softTimeoutMs}ms`,
            "OCR_TIMEOUT",
            504,
          );
        },
      ),
      routeBudgetMs,
      () => {
        throw new ContractChatOcrError(
          `OCR route timeout after ${routeBudgetMs}ms`,
          "OCR_TIMEOUT",
          504,
        );
      },
    );

    return NextResponse.json({
      success: true,
      data: {
        sourceType: result.data.sourceType,
        conversationText: result.data.conversationText,
        summary: result.data.summary,
      },
      meta: {
        degraded: false,
        provider: result.provider,
        latencyMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    if (isRetryableOcrFailure(error)) {
      return NextResponse.json({
        success: true,
        data: buildFallbackOcrPayload(sourceHint),
        meta: {
          degraded: true,
          reason: error instanceof Error ? error.message : "OCR unavailable",
          latencyMs: Date.now() - startedAt,
        },
      });
    }

    const status = error instanceof ContractChatOcrError ? error.status : 500;
    const code = error instanceof ContractChatOcrError ? error.code : "OCR_FAILED";
    const message =
      error instanceof Error
        ? error.message
        : t("截图识别失败，请稍后重试。", "Failed to import screenshot. Please retry later.");

    return NextResponse.json(
      {
        success: false,
        error: { code, message },
      },
      { status },
    );
  }
}
