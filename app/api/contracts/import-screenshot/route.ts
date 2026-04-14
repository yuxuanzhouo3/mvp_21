import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import {
  analyzeContractChatScreenshot,
  ContractChatOcrError,
  type ContractChatScreenshotData,
} from "@/lib/ocr/contract-chat";

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(raw || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function resolveStepTimeoutMs(deadlineAt: number, desiredMs: number, floorMs: number) {
  const remainingMs = deadlineAt - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= floorMs) {
    return floorMs;
  }
  return Math.max(floorMs, Math.min(desiredMs, remainingMs));
}

function buildFallbackData(
  sourceHint?: "wechat" | "feishu" | "screenshot",
): ContractChatScreenshotData {
  return {
    sourceType: sourceHint || "screenshot",
    conversationText: t(
      "OCR 降级模式：请手动粘贴聊天内容后继续分析。",
      "OCR degraded mode: please paste chat content manually before analysis.",
    ),
    summary: t(
      "OCR 超时或失败，已返回可编辑占位内容。",
      "OCR timed out or failed. Returned editable fallback content.",
    ),
  };
}

function mapOcrErrorMessage(error: ContractChatOcrError) {
  if (error.code === "OCR_KEY_UNAVAILABLE") {
    return t(
      "DASHSCOPE_API_KEY 不可用，已切换到 OCR 降级模式。",
      "DASHSCOPE_API_KEY is unavailable. Switched to OCR degraded mode.",
    );
  }
  if (error.code === "OCR_TIMEOUT") {
    return t(
      "OCR 超时，已切换到降级模式。",
      "OCR timed out. Switched to degraded mode.",
    );
  }
  return error.message;
}

export async function POST(request: NextRequest) {
  try {
    const routeBudgetMs = parsePositiveInt(process.env.OCR_ROUTE_BUDGET_MS, 10_000);
    const deadlineAt = Date.now() + routeBudgetMs;

    const { token, error: tokenError } = extractTokenFromRequest(request);

    if (tokenError || !token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const authResult = await withTimeout(
      verifyAuthToken(token),
      resolveStepTimeoutMs(
        deadlineAt,
        parsePositiveInt(process.env.AUTH_VERIFY_TIMEOUT_MS, 5_000),
        1_000,
      ),
      { success: false, error: "AUTH_TIMEOUT" },
    );
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

    let softTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        softTimeoutHandle = setTimeout(() => {
          reject(
            new ContractChatOcrError(
              "OCR soft timeout",
              "OCR_TIMEOUT",
              504,
            ),
          );
        }, resolveStepTimeoutMs(deadlineAt, parsePositiveInt(process.env.OCR_SOFT_TIMEOUT_MS, 8_000), 1_500));
      });

      const result = await Promise.race([
        analyzeContractChatScreenshot(imageBase64, sourceHint),
        timeoutPromise,
      ]);

      return NextResponse.json({
        success: true,
        data: result.data,
        meta: {
          provider: result.provider,
          degraded: false,
        },
      });
    } catch (ocrError) {
      if (
        ocrError instanceof ContractChatOcrError &&
        (ocrError.code === "OCR_TIMEOUT" ||
          ocrError.code === "OCR_PROVIDER_FAILED" ||
          ocrError.code === "OCR_KEY_UNAVAILABLE" ||
          ocrError.code === "OCR_EMPTY_RESPONSE" ||
          ocrError.code === "OCR_EMPTY_RESULT")
      ) {
        const response = NextResponse.json({
          success: true,
          data: buildFallbackData(sourceHint),
          meta: {
            provider: "degraded",
            degraded: true,
            degradedReason: ocrError.code,
            degradedMessage: mapOcrErrorMessage(ocrError),
          },
        });
        response.headers.set("X-AI-Degraded", "1");
        response.headers.set("X-AI-Degraded-Reason", ocrError.code);
        return response;
      }
      throw ocrError;
    } finally {
      if (softTimeoutHandle) {
        clearTimeout(softTimeoutHandle);
      }
    }
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
