import { NextRequest, NextResponse } from "next/server";

import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import {
  failStaleGenerationJobIfNeeded,
  parseContractIdFromGenerationJobId,
  readGenerationJobFromMetadata,
  toGenerationJobPublic,
} from "@/lib/contracts/generation-jobs";
import { isChinaRegion } from "@/lib/config/region";
import { getContractById } from "@/lib/data/contracts-store";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import { buildMembershipEntitlements } from "@/lib/membership/policy";

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(raw || ""), 10);
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

function isTimeoutError(error: unknown, marker: string) {
  return error instanceof Error && error.message.includes(marker);
}

async function requireCurrentUser(request: NextRequest) {
  const { token, error } = extractTokenFromRequest(request);
  if (error || !token) {
    return {
      error: NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please sign in first." } },
        { status: 401 },
      ),
    };
  }

  const authResult = await verifyAuthToken(token);
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid token." } },
        { status: 401 },
      ),
    };
  }

  const profile = isChinaRegion()
    ? await loadChinaAccountProfile(authResult.userId)
    : await loadIntlAccountProfile(
        authResult.userId,
        authResult.user && "user_metadata" in authResult.user
          ? authResult.user
          : undefined,
      );

  const settings = await loadAdminSettings();
  const entitlements = buildMembershipEntitlements(
    {
      plan:
        profile?.subscription_plan ||
        authResult.user?.subscription_plan ||
        authResult.user?.user_metadata?.subscription_plan,
      status:
        profile?.subscription_status ||
        authResult.user?.subscription_status ||
        authResult.user?.user_metadata?.subscription_status,
      membershipExpiresAt:
        profile?.membership_expires_at ||
        profile?.subscription_expires_at ||
        authResult.user?.membership_expires_at ||
        authResult.user?.user_metadata?.membership_expires_at ||
        authResult.user?.subscription_expires_at ||
        authResult.user?.user_metadata?.subscription_expires_at,
    },
    settings,
  );

  if (!entitlements.features.canGenerateContract) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "CONTRACT_GENERATION_DISABLED",
            message: "Contract generation is currently disabled.",
          },
        },
        { status: 403 },
      ),
    };
  }

  return { userId: authResult.userId };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const auth = await requireCurrentUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const { jobId } = await context.params;
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { success: false, error: { code: "JOB_NOT_FOUND", message: "Job not found." } },
        { status: 404 },
      );
    }

    const contractId = parseContractIdFromGenerationJobId(jobId);
    if (!contractId) {
      return NextResponse.json(
        { success: false, error: { code: "JOB_NOT_FOUND", message: "Job not found." } },
        { status: 404 },
      );
    }

    const queryTimeoutMs = parsePositiveInt(process.env.CONTRACTS_QUERY_TIMEOUT_MS, 4_000);
    const contract = await withTimeout(
      getContractById(contractId),
      queryTimeoutMs,
      "CONTRACT_QUERY_TIMEOUT",
    );

    if (!contract || contract.userId !== auth.userId) {
      return NextResponse.json(
        { success: false, error: { code: "JOB_NOT_FOUND", message: "Job not found." } },
        { status: 404 },
      );
    }

    const fromMetadata = readGenerationJobFromMetadata(contract.metadata, jobId);
    const normalized = fromMetadata
      ? await failStaleGenerationJobIfNeeded(contract, jobId)
      : null;
    const job = normalized || fromMetadata;

    if (!job) {
      return NextResponse.json(
        { success: false, error: { code: "JOB_NOT_FOUND", message: "Job not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        job: toGenerationJobPublic(job),
      },
    });
  } catch (error) {
    if (isTimeoutError(error, "CONTRACT_QUERY_TIMEOUT")) {
      return NextResponse.json(
        { success: false, error: { code: "JOB_NOT_FOUND", message: "Job not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: "JOB_QUERY_FAILED", message: "Failed to query job." } },
      { status: 500 },
    );
  }
}
