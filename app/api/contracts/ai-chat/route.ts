import { NextRequest, NextResponse } from "next/server";

import type { IntakeChatMessage, IntakeChatState } from "@/lib/ai/contract-intake-chat";
import { runContractIntakeChat } from "@/lib/ai/contract-intake-chat";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";
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

function normalizeMessageList(value: unknown): IntakeChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: IntakeChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const role = record.role;
    const content = typeof record.content === "string" ? record.content.trim() : "";
    if (!content) {
      continue;
    }
    if (role !== "user" && role !== "assistant") {
      continue;
    }

    normalized.push({
      role,
      content: content.slice(0, 4_000),
    });
  }

  return normalized.slice(-24);
}

function resolveRouteBudgetMs() {
  return clamp(
    parsePositiveInt(process.env.AI_CHAT_ROUTE_BUDGET_MS, 30_000),
    3_000,
    120_000,
  );
}

function resolveSoftTimeoutMs() {
  return clamp(
    parsePositiveInt(process.env.AI_CHAT_SOFT_TIMEOUT_MS, 10_000),
    1_000,
    60_000,
  );
}

function isRetryableChatFailure(error: unknown) {
  if (error instanceof Error) {
    return /timeout|timed out|rate limit|temporarily unavailable|AI_CHAT_/i.test(
      error.message,
    );
  }

  return false;
}

function buildFallbackState(messages: IntakeChatMessage[]): IntakeChatState {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim())
    ?.content;

  const fallbackReply = isChinaRegion()
    ? "AI 对话服务暂时拥挤，我先帮你继续采集关键信息。请补充：1）甲乙双方名称；2）金额/薪酬与付款方式；3）起止时间或交付周期。"
    : "AI chat is temporarily busy. Let's continue intake manually. Please add: 1) Party names, 2) amount/payment terms, 3) start date or delivery timeline.";

  return {
    reply: fallbackReply,
    ready: false,
    completionScore: 0.35,
    summary:
      lastUserMessage ||
      (isChinaRegion()
        ? "已进入降级采集模式，等待补充合同关键事实。"
        : "Degraded intake mode enabled. Waiting for key contract facts."),
    missingFields: [
      "contractType",
      "partyAName",
      "partyBName",
      "paymentOrSalary",
      "termOrStartDate",
    ],
    suggestedTitle: isChinaRegion() ? "AI 合同草稿" : "AI Contract Draft",
    collectedData: {},
    draftSourceContent: lastUserMessage || "",
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
  const messages = normalizeMessageList(body.messages);
  if (messages.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "MISSING_MESSAGES",
          message: t("请至少提供一条对话消息。", "Please provide at least one chat message."),
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
        runContractIntakeChat(messages),
        softTimeoutMs,
        () => {
          throw new Error(`AI_CHAT_TIMEOUT (${softTimeoutMs}ms)`);
        },
      ),
      routeBudgetMs,
      () => {
        throw new Error(`AI_CHAT_ROUTE_TIMEOUT (${routeBudgetMs}ms)`);
      },
    );

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        degraded: false,
        latencyMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    if (isRetryableChatFailure(error)) {
      return NextResponse.json({
        success: true,
        data: buildFallbackState(messages),
        meta: {
          degraded: true,
          reason: error instanceof Error ? error.message : "AI chat unavailable",
          latencyMs: Date.now() - startedAt,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AI_CHAT_FAILED",
          message:
            error instanceof Error
              ? error.message
              : t("AI 对话失败，请稍后重试。", "AI chat failed. Please retry later."),
        },
      },
      { status: 500 },
    );
  }
}
