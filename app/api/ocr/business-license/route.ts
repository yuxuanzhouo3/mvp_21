import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import {
  analyzeBusinessLicense,
  BusinessLicenseOcrError,
} from "@/lib/ocr/business-license";
import { getDEPLOY_REGION } from "@/lib/config/region";

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
          error: error.message,
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

