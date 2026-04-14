import { NextRequest, NextResponse } from "next/server";

import {
  runContractIntakeChat,
  type IntakeChatMessage,
  type IntakeChatState,
} from "@/lib/ai/contract-intake-chat";
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

function resolveStepTimeoutMs(deadlineAt: number, desiredMs: number, floorMs: number) {
  const remainingMs = deadlineAt - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= floorMs) {
    return floorMs;
  }
  return Math.max(floorMs, Math.min(desiredMs, remainingMs));
}

function resolveRouteBudgetMs() {
  return parsePositiveInt(process.env.AI_CHAT_ROUTE_BUDGET_MS, 10_000);
}

function resolveSoftTimeoutMs() {
  return parsePositiveInt(process.env.AI_CHAT_SOFT_TIMEOUT_MS, 8_000);
}

function normalizeMessages(input: unknown): IntakeChatMessage[] {
  const rawMessages = Array.isArray(input) ? input : [];
  return rawMessages
    .map((item: Record<string, unknown>): IntakeChatMessage => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: typeof item?.content === "string" ? item.content.trim() : "",
    }))
    .filter(
      (item: IntakeChatMessage) => item.content.length > 0,
    )
    .slice(-20);
}

function buildFallbackChatState(messages: IntakeChatMessage[]): IntakeChatState {
  const latestUserContent = [...messages]
    .reverse()
    .find((item) => item.role === "user" && item.content.trim())
    ?.content || "";

  const fallbackSummary = latestUserContent
    ? latestUserContent.slice(0, 500)
    : t("请补充合同场景、双方主体、金额与期限。", "Please add contract context, both parties, amount, and timeline.");

  const reply = t(
    "AI 对话当前走快速降级通道。请一次性补充：合同类型、甲乙方名称、服务/岗位内容、金额与付款节点、起止时间、违约责任。我会继续帮你生成初稿。",
    "AI chat is in fast degraded mode. Please provide contract type, both party names, scope/role, amount and payment milestones, timeline, and liabilities in one message. I will continue preparing the draft.",
  );

  return {
    reply,
    ready: false,
    completionScore: 0.3,
    summary: fallbackSummary,
    missingFields: [
      "contractType",
      "partyAName",
      "partyBName",
      "paymentOrSalary",
      "termOrStartDate",
    ],
    suggestedTitle: t("AI 合同草稿", "AI Contract Draft"),
    collectedData: {},
    draftSourceContent: fallbackSummary,
  };
}

export async function POST(request: NextRequest) {
  try {
    const routeBudgetMs = resolveRouteBudgetMs();
    const deadlineAt = Date.now() + routeBudgetMs;

    const { token, error: tokenError } = extractTokenFromRequest(request);
    if (tokenError || !token) {
      return NextResponse.json(
        { success: false, error: tokenError || "Unauthorized" },
        { status: 401 },
      );
    }

    const authResult = await withTimeout(
      verifyAuthToken(token),
      resolveStepTimeoutMs(
        deadlineAt,
        parsePositiveInt(process.env.AUTH_VERIFY_TIMEOUT_MS, 5_000),
        1_000,
      ),
      { success: false, error: "AUTH_TIMEOUT" },
    );
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || t("登录状态无效。", "Invalid token."),
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const messages = normalizeMessages(body?.messages);
    if (messages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: t("缺少对话消息。", "Missing conversation messages."),
        },
        { status: 400 },
      );
    }

    let degraded = false;
    let degradedReason = "";
    let degradedMessage = "";

    try {
      const [profile, settings] = await Promise.all([
        isChinaRegion()
          ? withTimeout(
              loadChinaAccountProfile(authResult.userId),
              resolveStepTimeoutMs(deadlineAt, 4_000, 800),
              null,
            )
          : withTimeout(
              loadIntlAccountProfile(
                authResult.userId,
                authResult.user && "user_metadata" in authResult.user
                  ? authResult.user
                  : undefined,
              ),
              resolveStepTimeoutMs(deadlineAt, 4_000, 800),
              null,
            ),
        withTimeout(
          loadAdminSettings(),
          resolveStepTimeoutMs(deadlineAt, 4_000, 800),
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

        if (!entitlements.features.canUseAiChat) {
          return NextResponse.json(
            {
              success: false,
              error: t(
                "当前环境暂未启用 AI 对话能力。",
                "AI chat is currently disabled in this deployment.",
              ),
              code: "AI_CHAT_DISABLED",
            },
            { status: 403 },
          );
        }
      } else {
        degraded = true;
        degradedReason = "SETTINGS_TIMEOUT";
        degradedMessage = t(
          "会员配置读取超时，已切换可用性优先模式。",
          "Membership settings timed out. Switched to availability-first mode.",
        );
      }
    } catch (membershipError) {
      console.warn("[/api/contracts/ai-chat] Membership check degraded:", membershipError);
      degraded = true;
      degradedReason = "MEMBERSHIP_CHECK_FAILED";
      degradedMessage = t(
        "会员检查失败，已切换可用性优先模式。",
        "Membership check failed. Switched to availability-first mode.",
      );
    }

    let softTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        softTimeoutHandle = setTimeout(() => {
          reject(new Error("AI_CHAT_TIMEOUT"));
        }, resolveStepTimeoutMs(deadlineAt, resolveSoftTimeoutMs(), 1_200));
      });

      const result = await Promise.race([
        runContractIntakeChat(messages),
        timeoutPromise,
      ]);

      const response = NextResponse.json({
        success: true,
        data: result,
        meta: {
          degraded,
          degradedReason: degraded ? degradedReason : undefined,
          degradedMessage: degraded ? degradedMessage : undefined,
        },
      });
      if (degraded) {
        response.headers.set("X-AI-Degraded", "1");
        response.headers.set("X-AI-Degraded-Reason", degradedReason || "MEMBERSHIP_CHECK_FAILED");
      }
      return response;
    } catch (chatError) {
      const fallback = buildFallbackChatState(messages);

      const code =
        chatError instanceof Error && chatError.message === "AI_CHAT_KEY_UNAVAILABLE"
          ? "AI_CHAT_KEY_UNAVAILABLE"
          : chatError instanceof Error && chatError.message === "AI_CHAT_TIMEOUT"
            ? "AI_CHAT_TIMEOUT"
            : "AI_CHAT_FAILED";

      const message =
        code === "AI_CHAT_KEY_UNAVAILABLE"
          ? t(
              "AI Key 不可用，系统已切换为快速采集模式。",
              "AI key is unavailable. Switched to fast intake mode.",
            )
          : code === "AI_CHAT_TIMEOUT"
            ? t(
                "AI 对话超时，系统已切换为快速采集模式。",
                "AI chat timed out. Switched to fast intake mode.",
              )
            : t(
                "AI 对话异常，系统已切换为快速采集模式。",
                "AI chat failed. Switched to fast intake mode.",
              );

      const response = NextResponse.json({
        success: true,
        data: fallback,
        meta: {
          degraded: true,
          degradedReason: code,
          degradedMessage: message,
        },
      });
      response.headers.set("X-AI-Degraded", "1");
      response.headers.set("X-AI-Degraded-Reason", code);
      return response;
    } finally {
      if (softTimeoutHandle) {
        clearTimeout(softTimeoutHandle);
      }
    }
  } catch (error) {
    console.error("[/api/contracts/ai-chat] Failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: t("AI 对话请求失败。", "AI chat request failed."),
      },
      { status: 500 },
    );
  }
}
