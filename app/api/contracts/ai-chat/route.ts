import { NextRequest, NextResponse } from "next/server";

import { runContractIntakeChat } from "@/lib/ai/contract-intake-chat";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isAdminRole } from "@/lib/auth/user-role";
import { isChinaRegion } from "@/lib/config/region";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";
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

function getAiKeyLabel() {
  return "DASHSCOPE_API_KEY";
}

function isTimeoutLikeError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("timeout") || message.includes("timed out");
}

function buildTimeoutFallbackReply() {
  const key = getAiKeyLabel();
  return isChinaRegion()
    ? `AI 对话暂时超时，已切换为降级模式。请继续补充关键事实（合作范围、金额、时间节点、违约责任），随后仍可创建草稿。${key} 配置正常后可恢复完整 AI 对话体验。`
    : `AI chat timed out and switched to degraded mode. Please continue with key facts (scope, amount, timeline, breach terms), and you can still create a draft. Full AI chat resumes once ${key} is available.`;
}

export async function POST(request: NextRequest) {
  try {
    const { token, error: tokenError } = extractTokenFromRequest(request);

    if (tokenError || !token) {
      return NextResponse.json(
        { success: false, error: tokenError || "Unauthorized" },
        { status: 401 },
      );
    }

    const authResult = await verifyAuthToken(token);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || t("登录状态无效。", "Invalid token."),
        },
        { status: 401 },
      );
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
    }

    const body = await request.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : null;
    if (!rawMessages) {
      return NextResponse.json(
        {
          success: false,
          error: t("缺少对话消息。", "Missing conversation messages."),
        },
        { status: 400 },
      );
    }

    const messages = rawMessages
      .map((item: Record<string, unknown>) => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: typeof item?.content === "string" ? item.content.trim() : "",
      }))
      .filter(
        (item: { role: "user" | "assistant"; content: string }) =>
          item.content.length > 0,
      )
      .slice(-20);

    if (messages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: t("对话内容不能为空。", "Conversation cannot be empty."),
        },
        { status: 400 },
      );
    }

    const result = await runContractIntakeChat(messages);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[/api/contracts/ai-chat] Failed:", error);

    const isKeyUnavailable =
      error instanceof Error && error.message === "AI_CHAT_KEY_UNAVAILABLE";
    const isTimeout = isTimeoutLikeError(error);

    if (isTimeout) {
      return NextResponse.json({
        success: true,
        data: {
          reply: buildTimeoutFallbackReply(),
          ready: false,
          completionScore: 0.25,
          summary: t(
            "AI 对话超时，已进入降级模式。请继续补充合同关键信息。",
            "AI chat timed out. Degraded mode is active. Please continue adding key contract facts.",
          ),
          missingFields: [
            t("合同双方", "parties"),
            t("合作范围", "scope"),
            t("金额与付款方式", "payment terms"),
            t("时间节点", "timeline"),
          ],
          suggestedTitle: t("合同草稿", "Contract Draft"),
          collectedData: {},
          draftSourceContent: t(
            "请继续输入：合同双方、合作内容、金额与付款节点、时间安排。",
            "Please continue with: parties, scope, amount/payment milestones, and timeline.",
          ),
        },
        meta: {
          degraded: true,
          reason: "ai_chat_timeout",
        },
      });
    }

    const message = isKeyUnavailable
      ? t(
          `${getAiKeyLabel()} 密钥不可用，请联系管理员检查配置。`,
          `${getAiKeyLabel()} is unavailable. Please ask the administrator to check the configuration.`,
        )
      : t("AI 对话请求失败。", "AI chat request failed.");

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: isKeyUnavailable ? 503 : 500 },
    );
  }
}
