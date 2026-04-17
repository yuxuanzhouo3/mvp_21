import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import {
  analyzeContractChatScreenshot,
  ContractChatOcrError,
} from "@/lib/ocr/contract-chat";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function mapOcrErrorMessage(error: ContractChatOcrError) {
  if (error.code === "OCR_KEY_UNAVAILABLE") {
    return t(
      "DASHSCOPE_API_KEY 密钥不可用，请联系管理员检查配置。",
      "DASHSCOPE_API_KEY is unavailable. Please ask the administrator to check the configuration.",
    );
  }

  return error.message;
}

export async function POST(request: NextRequest) {
  try {
    const { token, error: tokenError } = extractTokenFromRequest(request);

    if (tokenError || !token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
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
    const imageBase64 =
      typeof body?.imageBase64 === "string" ? body.imageBase64.trim() : "";
    const sourceHint =
      body?.sourceHint === "wechat" ||
      body?.sourceHint === "feishu" ||
      body?.sourceHint === "screenshot"
        ? body.sourceHint
        : undefined;

    if (!imageBase64) {
      return NextResponse.json(
        {
          success: false,
          error: t("缺少 imageBase64 图片数据。", "Missing imageBase64 payload."),
          code: "OCR_INVALID_PAYLOAD",
        },
        { status: 400 },
      );
    }

    const result = await analyzeContractChatScreenshot(imageBase64, sourceHint);

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        provider: result.provider,
      },
    });
  } catch (error) {
    if (error instanceof ContractChatOcrError) {
      return NextResponse.json(
        {
          success: false,
          error: mapOcrErrorMessage(error),
          code: error.code,
        },
        { status: error.status },
      );
    }

    console.error("[/api/contracts/import-screenshot] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: t("合同截图 OCR 识别失败。", "Contract screenshot OCR failed."),
        code: "OCR_UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
