import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import { runContractIntakeChat } from "@/lib/ai/contract-intake-chat";

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
        { success: false, error: authResult.error || "Invalid token" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const rawMessages = Array.isArray(body?.messages) ? body.messages : null;
    if (!rawMessages) {
      return NextResponse.json(
        { success: false, error: "Missing conversation messages." },
        { status: 400 },
      );
    }

    const messages = rawMessages
      .map((item: Record<string, unknown>) => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: typeof item?.content === "string" ? item.content.trim() : "",
      }))
      .filter((item: { role: "user" | "assistant"; content: string }) => item.content.length > 0)
      .slice(-20);

    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Conversation cannot be empty." },
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

    const message =
      error instanceof Error && error.message === "AI_CHAT_NOT_CONFIGURED"
        ? "AI chat service is not configured."
        : "AI chat request failed.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
