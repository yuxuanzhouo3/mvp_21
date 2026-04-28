import { NextRequest, NextResponse } from "next/server";

import {
  countContractsByUserInRange,
  createContractRecord,
  listContracts,
} from "@/lib/data/contracts-store";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import { normalizeContractStatus } from "@/lib/data/unified-models";
import {
  buildMembershipEntitlements,
  getCurrentMonthWindow,
} from "@/lib/membership/policy";
import { isAdminRole } from "@/lib/auth/user-role";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseIntlAdminEmailAllowlist(): string[] {
  const raw =
    process.env.INTL_ADMIN_EMAIL_ALLOWLIST ||
    process.env.ADMIN_ROLE_EMAIL_ALLOWLIST ||
    "";

  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isIntlAdminAllowlistedEmail(email?: string | null): boolean {
  if (isChinaRegion()) {
    return false;
  }

  if (!email || typeof email !== "string") {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const allowlist = parseIntlAdminEmailAllowlist();
  return allowlist.includes(normalized);
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, reason: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(reason)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function asPlainRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asNullableRecord(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

function toErrorDetail(error: unknown) {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    const base: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    const asRecord = error as unknown as Record<string, unknown>;
    if (typeof asRecord.code === "string") base.code = asRecord.code;
    if (typeof asRecord.details === "string") base.details = asRecord.details;
    if (typeof asRecord.hint === "string") base.hint = asRecord.hint;
    if (typeof asRecord.status === "number") base.status = asRecord.status;

    return base;
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      message:
        typeof record.message === "string" ? record.message : String(error),
      ...(typeof record.code === "string" ? { code: record.code } : {}),
      ...(typeof record.details === "string" ? { details: record.details } : {}),
      ...(typeof record.hint === "string" ? { hint: record.hint } : {}),
      ...(typeof record.status === "number" ? { status: record.status } : {}),
    };
  }

  return { message: String(error) };
}

async function requireCurrentUser(request: NextRequest) {
  const { token, error: tokenError } = extractTokenFromRequest(request);

  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        { success: false, error: { message: "Please sign in first." } },
        { status: 401 },
      ),
    };
  }

  const authResult = await verifyAuthToken(token);
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: { message: authResult.error || "Invalid token." },
        },
        { status: 401 },
      ),
    };
  }

  let role =
    authResult.user?.role ||
    authResult.user?.user_metadata?.role ||
    authResult.user?.app_metadata?.role ||
    "user";
  const email =
    authResult.user?.email ||
    authResult.user?.user_metadata?.email ||
    null;

  let subscriptionPlan =
    authResult.user?.subscription_plan ||
    authResult.user?.user_metadata?.subscription_plan ||
    "free";
  let subscriptionStatus =
    authResult.user?.subscription_status ||
    authResult.user?.user_metadata?.subscription_status ||
    "inactive";
  let membershipExpiresAt =
    authResult.user?.membership_expires_at ||
    authResult.user?.user_metadata?.membership_expires_at;
  let subscriptionExpiresAt =
    authResult.user?.subscription_expires_at ||
    authResult.user?.user_metadata?.subscription_expires_at;

  try {
    const profile = isChinaRegion()
      ? await loadChinaAccountProfile(authResult.userId)
      : await loadIntlAccountProfile(
          authResult.userId,
          authResult.user && "user_metadata" in authResult.user
            ? authResult.user
            : undefined,
        );

    if (profile) {
      role = profile.role || role;
      subscriptionPlan = profile.subscription_plan || subscriptionPlan;
      subscriptionStatus = profile.subscription_status || subscriptionStatus;
      membershipExpiresAt =
        profile.membership_expires_at || membershipExpiresAt;
      subscriptionExpiresAt =
        profile.subscription_expires_at || subscriptionExpiresAt;
    }
  } catch (error) {
    console.warn("[/api/contracts] Failed to load membership snapshot:", error);
  }

  if (isIntlAdminAllowlistedEmail(email)) {
    role = "admin";
  }

  return {
    user: {
      id: authResult.userId,
      role,
      subscriptionPlan,
      subscriptionStatus,
      membershipExpiresAt,
      subscriptionExpiresAt,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCurrentUser(request);
    if (auth.error) {
      return auth.error;
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const status = searchParams.get("status") || "";

    const { contracts, total } = await listContracts({
      userId: auth.user.id,
      status,
      isAdmin: isAdminRole(auth.user.role),
      limit,
      offset: Math.max(page - 1, 0) * limit,
    });

    return NextResponse.json({
      success: true,
      data: {
        contracts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (error) {
    console.error("Failed to load contracts:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load contracts." } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCurrentUser(request);
    if (auth.error) {
      return auth.error;
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { message: "Invalid JSON body." } },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: { message: "Request body must be an object." } },
        { status: 400 },
      );
    }

    const {
      title,
      type,
      status,
      content,
      sourceType,
      sourceContent,
      source_text,
      analysisResult,
      analysis_result,
      parties,
      signatures,
      metadata,
      region,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Please provide a contract title." },
        },
        { status: 400 },
      );
    }

    if (!isAdminRole(auth.user.role)) {
      const settings = await loadAdminSettings();
      const entitlements = buildMembershipEntitlements(
        {
          plan: auth.user.subscriptionPlan,
          status: auth.user.subscriptionStatus,
          membershipExpiresAt: auth.user.membershipExpiresAt,
          subscriptionExpiresAt: auth.user.subscriptionExpiresAt,
        },
        settings,
      );

      const contractLimit = entitlements.limits.contractsPerMonth;
      if (contractLimit !== null) {
        const monthWindow = getCurrentMonthWindow();
        const createdThisMonth = await countContractsByUserInRange({
          userId: auth.user.id,
          startAt: monthWindow.startAt,
          endBefore: monthWindow.endBefore,
        });

        if (createdThisMonth >= contractLimit) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  "Monthly contract quota exceeded for your current membership plan.",
                code: "CONTRACT_QUOTA_EXCEEDED",
              },
              data: {
                limit: contractLimit,
                used: createdThisMonth,
                plan: entitlements.membership.plan,
                resetAt: monthWindow.endBefore,
              },
            },
            { status: 403 },
          );
        }
      }
    }

    let contract: Awaited<ReturnType<typeof createContractRecord>>;
    try {
      const createTimeoutMs = parsePositiveInt(
        process.env.CONTRACTS_CREATE_TIMEOUT_MS || null,
        15_000,
      );
      contract = await withTimeout(
        createContractRecord({
          userId: auth.user.id,
          title: title.trim(),
          type: typeof type === "string" && type.trim() ? type.trim() : "custom",
          status: normalizeContractStatus(status),
          content: asPlainRecord(content),
          sourceType:
            typeof sourceType === "string" && sourceType.trim()
              ? sourceType.trim()
              : "text",
          sourceContent:
            typeof sourceContent === "string"
              ? sourceContent
              : typeof source_text === "string"
                ? source_text
                : "",
          analysisResult: asNullableRecord(analysisResult, analysis_result),
          parties: Array.isArray(parties) ? parties : [],
          signatures: Array.isArray(signatures) ? signatures : [],
          metadata: asPlainRecord(metadata),
          region:
            typeof region === "string" && region.trim() ? region.trim() : undefined,
        }),
        createTimeoutMs,
        "CONTRACT_CREATE_TIMEOUT",
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("CONTRACT_CREATE_TIMEOUT")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CONTRACT_CREATE_TIMEOUT",
              message: "Contract creation timed out. Please retry.",
            },
          },
          { status: 503 },
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: { contract },
    });
  } catch (error) {
    console.error("Failed to create contract:", error);
    const detail = toErrorDetail(error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Failed to create contract.",
          ...(process.env.NODE_ENV !== "production"
            ? {
                detail,
              }
            : {}),
        },
      },
      { status: 500 },
    );
  }
}
