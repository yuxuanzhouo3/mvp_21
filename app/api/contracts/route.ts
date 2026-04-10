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
import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import { normalizeContractStatus } from "@/lib/data/unified-models";
import {
  buildMembershipEntitlements,
  getCurrentMonthWindow,
} from "@/lib/membership/policy";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
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

async function requireCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { token, error: tokenError } = extractTokenFromHeader(authHeader);

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

  const role =
    authResult.user?.role ||
    authResult.user?.user_metadata?.role ||
    "user";

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
      isAdmin: auth.user.role === "admin",
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

    if (auth.user.role !== "admin") {
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

    const contract = await createContractRecord({
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
      region: typeof region === "string" && region.trim() ? region.trim() : undefined,
    });

    return NextResponse.json({
      success: true,
      data: { contract },
    });
  } catch (error) {
    console.error("Failed to create contract:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create contract." } },
      { status: 500 },
    );
  }
}
