import { NextRequest, NextResponse } from "next/server";

import { generateContract } from "@/lib/ai";
import { type AIAnalysisResult } from "@/lib/ai/types";
import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import { getDashboardTemplateById } from "@/lib/data/dashboard-store";

async function resolveCurrentUserId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { token } = extractTokenFromHeader(authHeader);

  if (!token) {
    return "";
  }

  const authResult = await verifyAuthToken(token);
  return authResult.success && authResult.userId ? authResult.userId : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      analysisResult,
      templateId,
      templateName,
      templateContent,
      templateVersion,
      customFields,
    } = body as {
      analysisResult: AIAnalysisResult;
      templateId?: string;
      templateName?: string;
      templateContent?: string;
      templateVersion?: number;
      customFields?: Record<string, string>;
    };

    if (!analysisResult || !analysisResult.contractType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "请提供有效的分析结果。",
          },
        },
        { status: 400 },
      );
    }

    if (!analysisResult.keyTerms || analysisResult.keyTerms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_KEY_TERMS",
            message: "未提取到关键条款，请先补充合同事实后再生成。",
          },
        },
        { status: 400 },
      );
    }

    let resolvedTemplateName = templateName;
    let resolvedTemplateContent = templateContent;
    let resolvedTemplateVersion = templateVersion;

    if ((!resolvedTemplateContent || !resolvedTemplateContent.trim()) && templateId) {
      const userId = await resolveCurrentUserId(request);
      if (userId) {
        const template = await getDashboardTemplateById(userId, templateId).catch(() => null);
        if (template?.content) {
          resolvedTemplateName = template.name;
          resolvedTemplateContent = template.content;
          resolvedTemplateVersion = template.version;
        }
      }
    }

    const contract = await generateContract({
      analysisResult,
      templateId,
      templateName: resolvedTemplateName,
      templateContent: resolvedTemplateContent,
      templateVersion: resolvedTemplateVersion,
      customFields,
    });

    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error("生成合同失败:", error);

    if (error instanceof Error && error.message.includes("API")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AI_SERVICE_ERROR",
            message: "AI 服务暂时不可用，请稍后重试。",
          },
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GENERATE_FAILED",
          message: "生成失败，请稍后重试。",
        },
      },
      { status: 500 },
    );
  }
}
