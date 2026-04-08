import { NextRequest, NextResponse } from "next/server";

import { analyzeConversation } from "@/lib/ai";
import { isChinaRegion } from "@/lib/config/region";
import { SourceType } from "@/lib/ai/types";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, sourceType = "text" } = body as {
      content: string;
      sourceType?: SourceType;
    };

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: t("请提供对话内容。", "Please provide conversation content."),
          },
        },
        { status: 400 },
      );
    }

    if (content.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONTENT_TOO_SHORT",
            message: t(
              "对话内容太短，请提供更详细的对话。",
              "Conversation is too short. Please provide more detail.",
            ),
          },
        },
        { status: 400 },
      );
    }

    if (content.length > 50000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONTENT_TOO_LONG",
            message: t(
              "对话内容过长，请精简后重试。",
              "Conversation is too long. Please shorten it and try again.",
            ),
          },
        },
        { status: 400 },
      );
    }

    const result = await analyzeConversation({
      content,
      sourceType,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Analyze conversation failed:", error);

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
          code: "ANALYZE_FAILED",
          message: t("分析失败，请重试。", "Analysis failed. Please try again."),
        },
      },
      { status: 500 },
    );
  }
}
