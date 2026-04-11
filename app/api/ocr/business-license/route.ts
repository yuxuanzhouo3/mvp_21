import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import {
  analyzeBusinessLicense,
  BusinessLicenseOcrError,
} from "@/lib/ocr/business-license";
import { getDEPLOY_REGION, isChinaRegion } from "@/lib/config/region";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function mapOcrErrorMessage(error: BusinessLicenseOcrError) {
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
    const imageBase64 =
      typeof body?.imageBase64 === "string" ? body.imageBase64.trim() : "";

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

    const result = await analyzeBusinessLicense(imageBase64);

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        provider: result.provider,
        region: getDEPLOY_REGION(),
      },
    });
  } catch (error) {
    if (error instanceof BusinessLicenseOcrError) {
      return NextResponse.json(
        {
          success: false,
          error: mapOcrErrorMessage(error),
          code: error.code,
          region: getDEPLOY_REGION(),
        },
        { status: error.status },
      );
    }

    console.error("[/api/ocr/business-license] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Business license OCR failed",
        code: "OCR_UNKNOWN_ERROR",
        region: getDEPLOY_REGION(),
      },
      { status: 500 },
    );
  }
}
