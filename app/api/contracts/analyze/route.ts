import { NextRequest, NextResponse } from "next/server";

import { ContractAIError, analyzeConversation } from "@/lib/ai";
import { isChinaRegion } from "@/lib/config/region";
import { SourceType } from "@/lib/ai/types";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function buildIntlTimeoutFallbackAnalysis(content: string) {
  const normalized = content.trim();
  const shortSummary =
    normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;

  const amountMatch = normalized.match(
    /\b(?:USD|US\$|\$|CNY|RMB|EUR|GBP)\s?[\d,]+(?:\.\d+)?\b/i,
  );
  const dateMatch = normalized.match(
    /\b(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|next\s+\w+)\b/i,
  );

  return {
    contractType: "custom",
    confidence: 0.35,
    partyA: {
      name: "",
      role: "Party A",
      identified: false,
    },
    partyB: {
      name: "",
      role: "Party B",
      identified: false,
    },
    keyTerms: [
      {
        type: "scope",
        label: "Collaboration scope",
        value: shortSummary || "To be completed manually",
        source: "fallback-parser",
        confidence: 0.4,
        suggestion: "Please refine obligations, deliverables, and acceptance criteria.",
      },
      ...(amountMatch
        ? [
            {
              type: "amount",
              label: "Amount",
              value: amountMatch[0],
              source: "fallback-parser",
              confidence: 0.55,
              suggestion: "Please confirm total amount, payment schedule, and tax terms.",
            },
          ]
        : []),
      ...(dateMatch
        ? [
            {
              type: "timeline",
              label: "Timeline",
              value: dateMatch[0],
              source: "fallback-parser",
              confidence: 0.5,
              suggestion: "Please verify start date, milestones, and final delivery date.",
            },
          ]
        : []),
    ],
    summary:
      "OpenAI request timed out. A fallback draft analysis was generated. Please review and complete key terms before finalizing.",
    riskAlerts: [
      {
        severity: "medium",
        issue: "AI timeout fallback in use",
        impact: "Some contract fields may be incomplete or generic.",
        suggestion:
          "Manually verify parties, payment amount, timeline, breach terms, and governing law before generating final contract text.",
      },
    ],
    missingInfo: [
      {
        item: "Explicit parties' legal names",
        importance: "high",
      },
      {
        item: "Payment milestones and due dates",
        importance: "high",
      },
      {
        item: "Acceptance criteria and delivery scope",
        importance: "high",
      },
    ],
    professionalAdvice: [
      "Use this fallback only as a starting point.",
      "Confirm all legal and commercial terms with both parties.",
    ],
  };
}

function getProviderKeyLabel(provider?: string) {
  if (provider === "openai") {
    return "OPENAI_API_KEY";
  }
  if (provider === "dashscope") {
    return "DASHSCOPE_API_KEY";
  }
  return isChinaRegion() ? "DASHSCOPE_API_KEY" : "OPENAI_API_KEY";
}

function getAiErrorMessage(error: ContractAIError): string {
  const keyLabel = getProviderKeyLabel(error.provider);
  switch (error.code) {
    case "AI_KEY_UNAVAILABLE":
    case "AI_NOT_CONFIGURED":
      return t(
        `${keyLabel} 密钥不可用，请联系管理员检查配置。`,
        `${keyLabel} is unavailable. Please ask the administrator to check the configuration.`,
      );
    case "AI_AUTH_FAILED":
      return t(
        `${keyLabel} 密钥不可用，请检查 API Key 配置。`,
        `${keyLabel} is unavailable. Please check the API key configuration.`,
      );
    case "AI_RATE_LIMITED":
      return t(
        "AI 服务当前请求较多，请稍后重试。",
        "AI service is currently rate-limited. Please try again shortly.",
      );
    default:
      return t(
        "AI 服务暂时不可用，请稍后重试。",
        "AI service is temporarily unavailable. Please try again later.",
      );
  }
}

function isTimeoutLikeAiError(error: ContractAIError) {
  const normalizedMessage = (error.message || "").toLowerCase();
  return (
    error.code === "AI_TIMEOUT" ||
    error.code === "AI_PROVIDER_TIMEOUT" ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out")
  );
}

export async function POST(request: NextRequest) {
  let fallbackContent = "";
  try {
    const body = await request.json();
    const { content, sourceType = "text" } = body as {
      content: string;
      sourceType?: SourceType;
    };
    fallbackContent = typeof content === "string" ? content : "";

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
    if (error instanceof ContractAIError) {
      const shouldUseTimeoutFallback =
        isTimeoutLikeAiError(error) && Boolean(fallbackContent.trim());

      if (shouldUseTimeoutFallback) {
        return NextResponse.json({
          success: true,
          data: buildIntlTimeoutFallbackAnalysis(fallbackContent),
          meta: {
            degraded: true,
            reason: "openai_timeout_fallback",
          },
        });
      }

      console.error("Analyze conversation AI error:", {
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
            ...(process.env.NODE_ENV !== "production"
              ? { detail: error.message }
              : {}),
          },
        },
        { status: error.status },
      );
    }

    console.error("Analyze conversation failed:", error);
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
