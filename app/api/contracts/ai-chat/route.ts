import { NextRequest, NextResponse } from "next/server";

import { runContractIntakeChat } from "@/lib/ai/contract-intake-chat";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import { buildMembershipEntitlements } from "@/lib/membership/policy";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { token, error: tokenError } = extractTokenFromHeader(authHeader);

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
        (item: { role: "user" | "assistant"; content: string }) => item.content.length > 0,
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

    const message = isKeyUnavailable
      ? t(
          "DASHSCOPE_API_KEY 密钥不可用，请联系管理员检查配置。",
          "DASHSCOPE_API_KEY is unavailable. Please ask the administrator to check the configuration.",
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
