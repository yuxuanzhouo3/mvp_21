import { NextRequest, NextResponse } from "next/server";

import { ContractAIError, analyzeConversation } from "@/lib/ai";
import { isChinaRegion } from "@/lib/config/region";
import { SourceType } from "@/lib/ai/types";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function buildDegradedFallbackAnalysis(content: string) {
  const isCn = isChinaRegion();
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
      role: isCn ? "甲方" : "Party A",
      identified: false,
    },
    partyB: {
      name: "",
      role: isCn ? "乙方" : "Party B",
      identified: false,
    },
    keyTerms: [
      {
        type: "scope",
        label: isCn ? "合作范围" : "Collaboration scope",
        value: shortSummary || (isCn ? "请手动补充" : "To be completed manually"),
        source: "fallback-parser",
        confidence: 0.4,
        suggestion: isCn
          ? "请补充双方义务、交付内容与验收标准。"
          : "Please refine obligations, deliverables, and acceptance criteria.",
      },
      ...(amountMatch
        ? [
            {
              type: "amount",
              label: isCn ? "金额" : "Amount",
              value: amountMatch[0],
              source: "fallback-parser",
              confidence: 0.55,
              suggestion: isCn
                ? "请确认总金额、付款节点与税费约定。"
                : "Please confirm total amount, payment schedule, and tax terms.",
            },
          ]
        : []),
      ...(dateMatch
        ? [
            {
              type: "timeline",
              label: isCn ? "时间节点" : "Timeline",
              value: dateMatch[0],
              source: "fallback-parser",
              confidence: 0.5,
              suggestion: isCn
                ? "请确认开始日期、里程碑与最终交付日期。"
                : "Please verify start date, milestones, and final delivery date.",
            },
          ]
        : []),
    ],
    summary: isCn
      ? "DashScope 服务暂时不可用，已生成降级分析草稿。请在定稿前补全并确认关键条款。"
      : "DashScope service is temporarily unavailable. A fallback draft analysis was generated. Please review and complete key terms before finalizing.",
    riskAlerts: [
      {
        severity: "medium",
        issue: isCn ? "当前使用 AI 降级分析" : "AI degraded fallback in use",
        impact: isCn
          ? "部分合同字段可能不完整或较为通用。"
          : "Some contract fields may be incomplete or generic.",
        suggestion: isCn
          ? "生成正式合同前，请手动核对主体信息、金额、时间节点、违约责任与适用法律。"
          : "Manually verify parties, payment amount, timeline, breach terms, and governing law before generating final contract text.",
      },
    ],
    missingInfo: [
      {
        item: isCn ? "双方完整法定名称" : "Explicit parties' legal names",
        importance: "high",
      },
      {
        item: isCn ? "付款节点与到期日" : "Payment milestones and due dates",
        importance: "high",
      },
      {
        item: isCn ? "验收标准与交付范围" : "Acceptance criteria and delivery scope",
        importance: "high",
      },
    ],
    professionalAdvice: isCn
      ? [
          "降级分析仅可作为起草起点使用。",
          "请与双方确认全部法律与商务条款后再签署。",
        ]
      : [
          "Use this fallback only as a starting point.",
          "Confirm all legal and commercial terms with both parties.",
        ],
  };
}

function getProviderKeyLabel(provider?: string) {
  if (provider === "dashscope") {
    return "DASHSCOPE_API_KEY";
  }
  return "DASHSCOPE_API_KEY";
}

function getAiErrorMessage(error: ContractAIError): string {
  const keyLabel = getProviderKeyLabel(error.provider);
  const detail = (error.message || "").toLowerCase();
  const isAccountStandingIssue =
    detail.includes("overdue-payment") ||
    detail.includes("account is in good standing") ||
    detail.includes("access denied");

  if (isAccountStandingIssue) {
    return t(
      "AI 账号当前不可用（可能欠费或被限制），已无法调用模型。请联系管理员处理 DashScope 账户状态。",
      "AI account is currently unavailable (possibly overdue or restricted). Please ask the administrator to restore DashScope account standing.",
    );
  }

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

function shouldUseIntlDegradedFallback(error: ContractAIError) {
  const message = (error.message || "").toLowerCase();
  const isAccountStandingIssue =
    message.includes("overdue-payment") ||
    message.includes("account is in good standing") ||
    message.includes("access denied");

  if (
    error.code === "AI_TIMEOUT" ||
    error.code === "AI_PROVIDER_TIMEOUT" ||
    isTimeoutLikeAiError(error)
  ) {
    return true;
  }

  if (
    error.code === "AI_PROVIDER_FAILED" ||
    error.code === "AI_KEY_UNAVAILABLE" ||
    error.code === "AI_NOT_CONFIGURED" ||
    error.code === "AI_RATE_LIMITED" ||
    isAccountStandingIssue
  ) {
    return true;
  }

  return false;
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
        shouldUseIntlDegradedFallback(error) && Boolean(fallbackContent.trim());

      if (shouldUseTimeoutFallback) {
        const message = (error.message || "").toLowerCase();
        const isAccountStandingIssue =
          message.includes("overdue-payment") ||
          message.includes("account is in good standing") ||
          message.includes("access denied");
        const fallbackReason = isTimeoutLikeAiError(error)
          ? "dashscope_timeout_fallback"
          : isAccountStandingIssue
            ? "dashscope_account_standing_fallback"
            : "dashscope_unavailable_fallback";
        return NextResponse.json({
          success: true,
          data: buildDegradedFallbackAnalysis(fallbackContent),
          meta: {
            degraded: true,
            reason: fallbackReason,
            provider: error.provider,
            code: error.code,
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
