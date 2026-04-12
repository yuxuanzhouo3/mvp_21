import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { getContractById } from "@/lib/data/contracts-store";
import {
  failStaleGenerationJobIfNeeded,
  parseContractIdFromGenerationJobId,
  readGenerationJobFromMetadata,
  scheduleContractGenerationJob,
  toGenerationJobPublic,
} from "@/lib/contracts/generation-jobs";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
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
            message: t("请先登录后再试。", "Please sign in first."),
          },
        },
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
          error: {
            code: "UNAUTHORIZED",
            message: t("登录状态无效。", "Invalid token."),
          },
        },
        { status: 401 },
      ),
    };
  }

  return {
    userId: authResult.userId,
  };
}

export const maxDuration = 60;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireCurrentUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const { jobId } = await context.params;
    const normalizedJobId = typeof jobId === "string" ? jobId.trim() : "";
    if (!normalizedJobId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JOB_ID",
            message: t("任务 ID 无效。", "Invalid job ID."),
          },
        },
        { status: 400 },
      );
    }

    const contractId = parseContractIdFromGenerationJobId(normalizedJobId);
    if (!contractId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JOB_ID",
            message: t("任务 ID 格式错误。", "Malformed job ID."),
          },
        },
        { status: 400 },
      );
    }

    const contract = await getContractById(contractId);
    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "JOB_NOT_FOUND",
            message: t("任务不存在。", "Job not found."),
          },
        },
        { status: 404 },
      );
    }

    if (contract.userId !== auth.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: t("你无权查看该任务。", "You do not have access to this job."),
          },
        },
        { status: 403 },
      );
    }

    let job = readGenerationJobFromMetadata(contract.metadata);
    if (!job || job.id !== normalizedJobId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "JOB_NOT_FOUND",
            message: t("任务不存在或已失效。", "Job not found or expired."),
          },
        },
        { status: 404 },
      );
    }

    job = await failStaleGenerationJobIfNeeded(contract, normalizedJobId);
    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "JOB_NOT_FOUND",
            message: t("任务不存在或已失效。", "Job not found or expired."),
          },
        },
        { status: 404 },
      );
    }

    if (job.status === "queued" || job.status === "running") {
      scheduleContractGenerationJob({
        contractId,
        userId: auth.userId,
        jobId: normalizedJobId,
      });
    }

    const refreshedContract = await getContractById(contractId);
    const refreshedJob = refreshedContract
      ? readGenerationJobFromMetadata(refreshedContract.metadata)
      : null;

    const responseJob =
      refreshedJob && refreshedJob.id === normalizedJobId ? refreshedJob : job;

    const pollAfterMs =
      responseJob.status === "queued" || responseJob.status === "running" ? 1_800 : 0;

    return NextResponse.json({
      success: true,
      data: {
        job: toGenerationJobPublic(responseJob),
        pollAfterMs,
      },
    });
  } catch (error) {
    console.error("Failed to read contract generation job:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "JOB_QUERY_FAILED",
          message: t("查询任务状态失败，请稍后重试。", "Failed to query job status. Please retry."),
        },
      },
      { status: 500 },
    );
  }
}
