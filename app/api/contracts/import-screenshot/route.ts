import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import {
  analyzeContractChatScreenshot,
  ContractChatOcrError,
} from "@/lib/ocr/contract-chat";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { token, error: tokenError } = extractTokenFromHeader(authHeader);

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
          error: "Missing imageBase64 payload",
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
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    console.error("[/api/contracts/import-screenshot] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Contract screenshot OCR failed",
        code: "OCR_UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
