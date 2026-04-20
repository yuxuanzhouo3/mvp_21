import { NextRequest, NextResponse } from "next/server";

import {
  getDashScopeBaseUrl,
  getUnifiedAIApiKey,
  getQwenModel,
} from "@/lib/config/runtime-env";

type HealthTarget = "CN" | "INTL";
type HealthStatus = "ok" | "warning" | "error";
type FailureKind =
  | "missing_key"
  | "missing_model"
  | "invalid_key"
  | "quota_exceeded"
  | "network_error"
  | "provider_error"
  | "unknown_error";

interface ProviderHealthReport {
  target: HealthTarget;
  provider: "dashscope";
  status: HealthStatus;
  checks: {
    keyConfigured: boolean;
    modelConfigured: boolean;
    apiReachable: boolean;
    authPassed: boolean;
    quotaAvailable: boolean;
  };
  failureKind?: FailureKind;
  message: string;
  model?: string;
  baseUrl?: string;
  httpStatus?: number;
  detail?: string;
}

const REQUEST_TIMEOUT_MS = 10000;

function parseTargets(searchParams: URLSearchParams): HealthTarget[] {
  const requested = (searchParams.get("target") || "both").trim().toUpperCase();
  if (requested === "CN") return ["CN"];
  if (requested === "INTL") return ["INTL"];
  return ["CN", "INTL"];
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function classifyProviderFailure(status: number, responseText: string): FailureKind {
  const normalized = responseText.toLowerCase();
  if (status === 401 || status === 403) return "invalid_key";
  if (
    status === 429 ||
    normalized.includes("insufficient_quota") ||
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("arrearage") ||
    normalized.includes("overdue-payment") ||
    normalized.includes("insufficient balance")
  ) {
    return "quota_exceeded";
  }
  if (status >= 400) return "provider_error";
  return "unknown_error";
}

function classifyNetworkError(error: unknown): { kind: FailureKind; detail: string } {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (
    normalized.includes("enotfound") ||
    normalized.includes("eai_again") ||
    normalized.includes("etimedout") ||
    normalized.includes("timeout") ||
    normalized.includes("network") ||
    normalized.includes("fetch failed")
  ) {
    return { kind: "network_error", detail: message };
  }
  return { kind: "unknown_error", detail: message };
}

async function probeOpenAI(): Promise<ProviderHealthReport> {
  return probeDashScope("INTL");
}

async function probeDashScope(target: HealthTarget): Promise<ProviderHealthReport> {
  const apiKey = getUnifiedAIApiKey();
  const baseUrl = normalizeBaseUrl(getDashScopeBaseUrl());
  const model = getQwenModel();

  if (!apiKey) {
    return {
      target,
      provider: "dashscope",
      status: "error",
      checks: {
        keyConfigured: false,
        modelConfigured: true,
        apiReachable: false,
        authPassed: false,
        quotaAvailable: false,
      },
      failureKind: "missing_key",
      message: "DASHSCOPE_API_KEY is not configured.",
      model,
      baseUrl,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "health-check" }],
        max_tokens: 1,
      }),
    });

    const bodyText = await response.text();

    if (!response.ok) {
      const failureKind = classifyProviderFailure(response.status, bodyText);
      return {
        target,
        provider: "dashscope",
        status: "error",
        checks: {
          keyConfigured: true,
          modelConfigured: true,
          apiReachable: true,
          authPassed: failureKind !== "invalid_key",
          quotaAvailable: failureKind !== "quota_exceeded",
        },
        failureKind,
        message: `DashScope health check failed with HTTP ${response.status}.`,
        model,
        baseUrl,
        httpStatus: response.status,
        detail: bodyText.slice(0, 500),
      };
    }

    return {
      target,
      provider: "dashscope",
      status: "ok",
      checks: {
        keyConfigured: true,
        modelConfigured: true,
        apiReachable: true,
        authPassed: true,
        quotaAvailable: true,
      },
      message: "DashScope health check passed.",
      model,
      baseUrl,
      httpStatus: response.status,
    };
  } catch (error) {
    const { kind, detail } = classifyNetworkError(error);
    return {
      target,
      provider: "dashscope",
      status: "error",
      checks: {
        keyConfigured: true,
        modelConfigured: true,
        apiReachable: false,
        authPassed: false,
        quotaAvailable: false,
      },
      failureKind: kind,
      message: "DashScope health check failed before receiving a valid API response.",
      model,
      baseUrl,
      detail,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const targets = parseTargets(request.nextUrl.searchParams);

  const reports: ProviderHealthReport[] = [];
  for (const target of targets) {
    reports.push(target === "CN" ? await probeDashScope("CN") : await probeOpenAI());
  }

  const hasError = reports.some((report) => report.status === "error");
  const hasWarning = reports.some((report) => report.status === "warning");

  return NextResponse.json(
    {
      success: !hasError,
      status: hasError ? "error" : hasWarning ? "warning" : "ok",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      reports,
      summary: reports.map((report) => ({
        target: report.target,
        provider: report.provider,
        status: report.status,
        failureKind: report.failureKind || null,
        message: report.message,
      })),
    },
    { status: hasError ? 503 : 200 },
  );
}
