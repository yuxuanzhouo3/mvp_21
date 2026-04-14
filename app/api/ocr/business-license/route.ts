import { NextRequest, NextResponse } from "next/server";

import {
  BusinessLicenseOcrError,
  analyzeBusinessLicense,
  getBusinessLicenseOcrModel,
  getBusinessLicenseOcrProvider,
} from "@/lib/ocr/business-license";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackFactory: () => T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve, reject) => {
        timer = setTimeout(() => {
          try {
            resolve(fallbackFactory());
          } catch (error) {
            reject(error);
          }
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function resolveRouteBudgetMs() {
  return clamp(
    parsePositiveInt(process.env.OCR_ROUTE_BUDGET_MS, 25_000),
    2_000,
    120_000,
  );
}

function normalizeImageBase64(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function validateImageBase64(value: string): string | null {
  if (!value) {
    return t("缺少图片数据。", "Missing image data.");
  }
  if (!value.startsWith("data:image/")) {
    return t("图片数据格式不正确。", "Invalid image data format.");
  }
  if (value.length > 15 * 1024 * 1024) {
    return t("图片体积过大，请压缩后再试。", "Image payload is too large. Please compress and retry.");
  }
  return null;
}

async function requireCurrentUser(request: NextRequest) {
  const { token, error: tokenError } = extractTokenFromRequest(request);
  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: t("请先登录后再继续。", "Please sign in first."),
          },
        },
        { status: 401 },
      ),
    };
  }

  const authResult = await withTimeout(
    verifyAuthToken(token),
    parsePositiveInt(process.env.AUTH_VERIFY_TIMEOUT_MS, 5_000),
    () => ({ success: false, error: "AUTH_TIMEOUT" }),
  );
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: t("登录状态无效。", "Invalid token."),
          },
        },
        { status: 401 },
      ),
    };
  }

  return { userId: authResult.userId };
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireCurrentUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_JSON",
          message: t("请求体必须是有效 JSON。", "Request body must be valid JSON."),
        },
      },
      { status: 400 },
    );
  }

  if (!bodyRaw || typeof bodyRaw !== "object" || Array.isArray(bodyRaw)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_BODY",
          message: t("请求体必须是对象。", "Request body must be an object."),
        },
      },
      { status: 400 },
    );
  }

  const body = bodyRaw as Record<string, unknown>;
  const imageBase64 = normalizeImageBase64(body.imageBase64);
  const imageError = validateImageBase64(imageBase64);
  if (imageError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_IMAGE",
          message: imageError,
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await withTimeout(
      analyzeBusinessLicense(imageBase64),
      resolveRouteBudgetMs(),
      () => {
        throw new BusinessLicenseOcrError(
          "OCR route timeout",
          "OCR_TIMEOUT",
          504,
          getBusinessLicenseOcrProvider(),
        );
      },
    );

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        provider: result.provider,
        model: getBusinessLicenseOcrModel(),
      },
    });
  } catch (error) {
    const status = error instanceof BusinessLicenseOcrError ? error.status : 500;
    const code =
      error instanceof BusinessLicenseOcrError ? error.code : "OCR_FAILED";
    const message =
      error instanceof Error
        ? error.message
        : t("营业执照识别失败，请稍后重试。", "Business license OCR failed. Please retry later.");

    return NextResponse.json(
      {
        success: false,
        error: { code, message },
        meta: {
          provider:
            error instanceof BusinessLicenseOcrError
              ? error.provider || getBusinessLicenseOcrProvider()
              : getBusinessLicenseOcrProvider(),
          model: getBusinessLicenseOcrModel(),
        },
      },
      { status },
    );
  }
}
