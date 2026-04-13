import crypto from "crypto";

import { ContractAIError, generateContract } from "@/lib/ai";
import type { AIAnalysisResult } from "@/lib/ai/types";
import { isChinaRegion } from "@/lib/config/region";
import type { UnifiedContractRecord } from "@/lib/data/unified-models";
import { getDashboardTemplateById } from "@/lib/data/dashboard-store";
import { getContractById, updateContractRecord } from "@/lib/data/contracts-store";
import {
  appendContractVersionHistory,
  buildContractParties,
  createVersionEntry,
  deriveDraftTitle,
  normalizeContractContent,
} from "@/lib/contracts/format";

export type ContractGenerationJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export interface ContractGenerationJobError {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface ContractGenerationJobResult {
  title?: string;
  contractType?: string;
}

export interface ContractGenerationJobRequestSnapshot {
  templateId?: string;
  templateName?: string;
  templateContent?: string;
  templateVersion?: number;
  customFields?: Record<string, string>;
  language?: "zh" | "en";
}

export interface ContractGenerationJob {
  id: string;
  contractId: string;
  userId: string;
  status: ContractGenerationJobStatus;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
  attemptCount: number;
  request: ContractGenerationJobRequestSnapshot;
  error?: ContractGenerationJobError;
  result?: ContractGenerationJobResult;
}

export interface ContractGenerationJobPublic {
  id: string;
  contractId: string;
  status: ContractGenerationJobStatus;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
  attemptCount: number;
  error?: ContractGenerationJobError;
  result?: ContractGenerationJobResult;
}

interface EnqueueGenerationJobInput {
  contract: UnifiedContractRecord;
  userId: string;
  analysisResult: AIAnalysisResult;
  templateId?: string;
  templateName?: string;
  templateContent?: string;
  templateVersion?: number;
  customFields?: Record<string, string>;
  language?: "zh" | "en";
}

interface RunGenerationJobInput {
  contractId: string;
  userId: string;
  jobId: string;
}

const GENERATION_JOB_KEY = "generationJob";
const DEFAULT_JOB_TIMEOUT_MS = 180_000;
const RUNNING_JOB_STALE_MS = 12 * 60_000;

type GlobalWithLocks = typeof globalThis & {
  __contractGenerationJobLocks__?: Map<string, Promise<void>>;
};

function t(zh: string, en: string) {
  return isChinaRegion() ? zh : en;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(raw || ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function sanitizeCustomFields(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized = Object.entries(record).reduce<Record<string, string>>(
    (accumulator, [key, entry]) => {
      if (typeof entry !== "string") {
        return accumulator;
      }

      const normalizedKey = key.trim();
      if (!normalizedKey) {
        return accumulator;
      }

      accumulator[normalizedKey] = entry;
      return accumulator;
    },
    {},
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeJobRequestSnapshot(
  value: unknown,
): ContractGenerationJobRequestSnapshot {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  const languageRaw = asString(record.language);
  const language =
    languageRaw === "zh" || languageRaw === "en" ? languageRaw : undefined;

  return {
    templateId: asString(record.templateId),
    templateName: asString(record.templateName),
    templateContent: asString(record.templateContent),
    templateVersion: asNumber(record.templateVersion),
    customFields: sanitizeCustomFields(record.customFields),
    language,
  };
}

function normalizeJobError(value: unknown): ContractGenerationJobError | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const code = asString(record.code);
  const message = asString(record.message);
  if (!code || !message) {
    return undefined;
  }

  return {
    code,
    message,
    retryable: record.retryable === true,
  };
}

function normalizeJobResult(value: unknown): ContractGenerationJobResult | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const result: ContractGenerationJobResult = {
    title: asString(record.title),
    contractType: asString(record.contractType),
  };

  return result.title || result.contractType ? result : undefined;
}

export function buildContractGenerationJobId(contractId: string): string {
  const token = `${Date.now().toString(36)}${crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)}`;
  return `${contractId}~${token}`;
}

export function parseContractIdFromGenerationJobId(jobId: string): string | null {
  const dividerIndex = jobId.indexOf("~");
  if (dividerIndex <= 0) {
    return null;
  }

  return jobId.slice(0, dividerIndex);
}

export function readGenerationJobFromMetadata(
  metadata: Record<string, unknown> | undefined,
): ContractGenerationJob | null {
  const raw = metadata?.[GENERATION_JOB_KEY];
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const id = asString(record.id);
  const contractId = asString(record.contractId);
  const userId = asString(record.userId);
  const queuedAt = asString(record.queuedAt);
  const updatedAt = asString(record.updatedAt);
  const statusRaw = asString(record.status);

  if (!id || !contractId || !userId || !queuedAt || !updatedAt || !statusRaw) {
    return null;
  }

  const status: ContractGenerationJobStatus =
    statusRaw === "queued" ||
    statusRaw === "running" ||
    statusRaw === "succeeded" ||
    statusRaw === "failed"
      ? statusRaw
      : "queued";

  return {
    id,
    contractId,
    userId,
    status,
    queuedAt,
    startedAt: asString(record.startedAt),
    finishedAt: asString(record.finishedAt),
    updatedAt,
    attemptCount: Math.max(0, Math.floor(asNumber(record.attemptCount) || 0)),
    request: normalizeJobRequestSnapshot(record.request),
    error: normalizeJobError(record.error),
    result: normalizeJobResult(record.result),
  };
}

export function toGenerationJobPublic(
  job: ContractGenerationJob,
): ContractGenerationJobPublic {
  return {
    id: job.id,
    contractId: job.contractId,
    status: job.status,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    updatedAt: job.updatedAt,
    attemptCount: job.attemptCount,
    error: job.error,
    result: job.result,
  };
}

export function isGenerationJobStale(
  job: ContractGenerationJob,
  nowMs = Date.now(),
): boolean {
  if (job.status !== "running") {
    return false;
  }

  const reference = Date.parse(job.startedAt || job.updatedAt || job.queuedAt);
  if (!Number.isFinite(reference)) {
    return false;
  }

  return nowMs - reference > RUNNING_JOB_STALE_MS;
}

function withGenerationJobMetadata(
  metadata: Record<string, unknown> | undefined,
  job: ContractGenerationJob,
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    [GENERATION_JOB_KEY]: {
      id: job.id,
      contractId: job.contractId,
      userId: job.userId,
      status: job.status,
      queuedAt: job.queuedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      updatedAt: job.updatedAt,
      attemptCount: job.attemptCount,
      request: job.request,
      error: job.error,
      result: job.result,
    },
  };
}

function getRunningJobLocks() {
  const globalWithLocks = globalThis as GlobalWithLocks;
  if (!globalWithLocks.__contractGenerationJobLocks__) {
    globalWithLocks.__contractGenerationJobLocks__ = new Map();
  }
  return globalWithLocks.__contractGenerationJobLocks__;
}

function getGenerateAiTimeoutMs() {
  return parsePositiveInt(
    process.env.AI_GENERATE_JOB_TIME_BUDGET_MS,
    parsePositiveInt(process.env.AI_GENERATE_TIME_BUDGET_MS, DEFAULT_JOB_TIMEOUT_MS),
  );
}

function isValidAnalysisResult(value: unknown): value is AIAnalysisResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.contractType === "string" &&
    Array.isArray(record.keyTerms) &&
    record.keyTerms.length > 0
  );
}

function mapAiErrorMessage(error: ContractAIError): string {
  switch (error.code) {
    case "AI_KEY_UNAVAILABLE":
    case "AI_NOT_CONFIGURED":
      return t(
        "DASHSCOPE_API_KEY 密钥不可用，请联系管理员检查配置。",
        "AI API key is unavailable. Please ask the administrator to check the configuration.",
      );
    case "AI_AUTH_FAILED":
      return t(
        "DASHSCOPE_API_KEY 密钥不可用，请检查 API Key 配置。",
        "AI API key is unavailable. Please check the API key configuration.",
      );
    case "AI_RATE_LIMITED":
      return t("AI 服务当前请求较多，请稍后重试。", "AI service is currently rate-limited. Please try again shortly.");
    case "AI_TIMEOUT":
      return t(
        "AI 生成超时，请重试，或先精简合同事实后再生成。",
        "AI generation timed out. Please retry, or shorten the contract facts before generating.",
      );
    default:
      return t("AI 服务暂时不可用，请稍后重试。", "AI service is temporarily unavailable. Please try again later.");
  }
}

function mapJobFailure(error: unknown): ContractGenerationJobError {
  if (error instanceof ContractAIError) {
    return {
      code: error.code,
      message: mapAiErrorMessage(error),
      retryable: error.code === "AI_TIMEOUT" || error.code === "AI_RATE_LIMITED",
    };
  }

  if (error instanceof Error && error.message === "INVALID_ANALYSIS_RESULT") {
    return {
      code: "INVALID_ANALYSIS_RESULT",
      message: t(
        "分析结果缺失或无关键条款，请返回上一步补充后再生成。",
        "Analysis is missing required key terms. Please revise the analysis and try again.",
      ),
    };
  }

  if (error instanceof Error) {
    return {
      code: "GENERATE_FAILED",
      message: error.message || t("生成失败，请重试。", "Generation failed. Please retry."),
    };
  }

  return {
    code: "GENERATE_FAILED",
    message: t("生成失败，请重试。", "Generation failed. Please retry."),
  };
}

function summarizeGenerationHistory(hadGeneratedContent: boolean) {
  if (hadGeneratedContent) {
    return t("已根据最新分析结果重新生成合同正文。", "Regenerated contract body from the latest analysis.");
  }
  return t("已根据分析结果生成首版合同正文。", "Generated the first full contract body from analysis.");
}

async function resolveTemplateSnapshot(
  userId: string,
  request: ContractGenerationJobRequestSnapshot,
) {
  let resolvedTemplateName = request.templateName;
  let resolvedTemplateContent = request.templateContent;
  let resolvedTemplateVersion = request.templateVersion;

  if ((!resolvedTemplateContent || !resolvedTemplateContent.trim()) && request.templateId) {
    const template = await getDashboardTemplateById(userId, request.templateId).catch(() => null);
    if (template?.content) {
      resolvedTemplateName = template.name;
      resolvedTemplateContent = template.content;
      resolvedTemplateVersion = template.version;
    }
  }

  return {
    templateId: request.templateId,
    templateName: resolvedTemplateName,
    templateContent: resolvedTemplateContent,
    templateVersion: resolvedTemplateVersion,
  };
}

async function runContractGenerationJob(input: RunGenerationJobInput) {
  const contract = await getContractById(input.contractId);
  if (!contract || contract.userId !== input.userId) {
    return;
  }

  const job = readGenerationJobFromMetadata(contract.metadata);
  if (!job || job.id !== input.jobId) {
    return;
  }

  if (job.status !== "queued" && job.status !== "running") {
    return;
  }

  const runningAt = new Date().toISOString();
  const runningJob: ContractGenerationJob = {
    ...job,
    status: "running",
    startedAt: job.startedAt || runningAt,
    updatedAt: runningAt,
    attemptCount: job.attemptCount + 1,
    error: undefined,
  };

  await updateContractRecord(input.contractId, {
    metadata: withGenerationJobMetadata(contract.metadata, runningJob),
  });

  try {
    const latestContract = await getContractById(input.contractId);
    if (!latestContract || latestContract.userId !== input.userId) {
      return;
    }

    const latestJob = readGenerationJobFromMetadata(latestContract.metadata);
    if (!latestJob || latestJob.id !== input.jobId || latestJob.status !== "running") {
      return;
    }

    if (!isValidAnalysisResult(latestContract.analysisResult)) {
      throw new Error("INVALID_ANALYSIS_RESULT");
    }

    const analysisResult = latestContract.analysisResult;
    const template = await resolveTemplateSnapshot(input.userId, latestJob.request);
    const generatedContract = await generateContract({
      analysisResult,
      templateId: template.templateId,
      templateName: template.templateName,
      templateContent: template.templateContent,
      templateVersion: template.templateVersion,
      customFields: latestJob.request.customFields,
      language: latestJob.request.language,
      timeBudgetMs: getGenerateAiTimeoutMs(),
    });

    const generatedTitle = generatedContract.title || deriveDraftTitle(analysisResult);
    const completedAt = new Date().toISOString();
    const succeededJob: ContractGenerationJob = {
      ...latestJob,
      status: "succeeded",
      updatedAt: completedAt,
      finishedAt: completedAt,
      result: {
        title: generatedTitle,
        contractType:
          typeof generatedContract.contractType === "string"
            ? generatedContract.contractType
            : undefined,
      },
      error: undefined,
    };

    const hadGeneratedContent = Boolean(normalizeContractContent(latestContract.content));
    let nextMetadata: Record<string, unknown> = withGenerationJobMetadata(
      latestContract.metadata,
      succeededJob,
    );
    nextMetadata = appendContractVersionHistory(
      nextMetadata,
      createVersionEntry({
        action: "analysis_generated",
        title: generatedTitle,
        summary: summarizeGenerationHistory(hadGeneratedContent),
      }),
    );
    nextMetadata = {
      ...nextMetadata,
      draftStage: "generated",
      flowVersion: "create-v2",
      templateId:
        template.templateId ||
        (typeof latestContract.metadata?.templateId === "string"
          ? latestContract.metadata.templateId
          : undefined),
    };

    await updateContractRecord(input.contractId, {
      title: generatedTitle,
      type:
        generatedContract.contractType ||
        analysisResult.contractType ||
        latestContract.type,
      status: "draft",
      content: generatedContract as unknown as Record<string, unknown>,
      analysisResult,
      parties: buildContractParties(analysisResult),
      metadata: nextMetadata,
    });
  } catch (error) {
    console.error("[contract-generation-job] failed", {
      contractId: input.contractId,
      jobId: input.jobId,
      userId: input.userId,
      error,
    });

    const latestContract = await getContractById(input.contractId);
    if (!latestContract || latestContract.userId !== input.userId) {
      return;
    }

    const latestJob = readGenerationJobFromMetadata(latestContract.metadata);
    if (!latestJob || latestJob.id !== input.jobId) {
      return;
    }

    const failedAt = new Date().toISOString();
    const failedJob: ContractGenerationJob = {
      ...latestJob,
      status: "failed",
      updatedAt: failedAt,
      finishedAt: failedAt,
      error: mapJobFailure(error),
    };

    await updateContractRecord(input.contractId, {
      metadata: withGenerationJobMetadata(latestContract.metadata, failedJob),
    });
  }
}

export function scheduleContractGenerationJob(input: RunGenerationJobInput) {
  const lockKey = `${input.contractId}:${input.jobId}`;
  const locks = getRunningJobLocks();
  if (locks.has(lockKey)) {
    return;
  }

  const task = runContractGenerationJob(input).finally(() => {
    locks.delete(lockKey);
  });

  locks.set(lockKey, task);
}

export async function enqueueContractGenerationJob(
  input: EnqueueGenerationJobInput,
) {
  const existingJob = readGenerationJobFromMetadata(input.contract.metadata);
  if (
    existingJob &&
    existingJob.userId === input.userId &&
    existingJob.status !== "failed" &&
    existingJob.status !== "succeeded"
  ) {
    scheduleContractGenerationJob({
      contractId: input.contract.id,
      userId: input.userId,
      jobId: existingJob.id,
    });
    return {
      job: existingJob,
      reused: true,
    };
  }

  const queuedAt = new Date().toISOString();
  const resolvedTemplateId =
    input.templateId ||
    (typeof input.contract.metadata?.templateId === "string"
      ? input.contract.metadata.templateId
      : undefined);

  const job: ContractGenerationJob = {
    id: buildContractGenerationJobId(input.contract.id),
    contractId: input.contract.id,
    userId: input.userId,
    status: "queued",
    queuedAt,
    updatedAt: queuedAt,
    attemptCount: 0,
    request: {
      templateId: resolvedTemplateId,
      templateName: input.templateName,
      templateContent: input.templateContent,
      templateVersion: input.templateVersion,
      customFields: input.customFields,
      language: input.language,
    },
  };

  const nextMetadata: Record<string, unknown> = {
    ...withGenerationJobMetadata(input.contract.metadata, job),
    draftStage: "generating",
    flowVersion: "create-v2",
    templateId: resolvedTemplateId,
  };

  await updateContractRecord(input.contract.id, {
    analysisResult: input.analysisResult as unknown as Record<string, unknown>,
    metadata: nextMetadata,
  });

  scheduleContractGenerationJob({
    contractId: input.contract.id,
    userId: input.userId,
    jobId: job.id,
  });

  return {
    job,
    reused: false,
  };
}

export async function failStaleGenerationJobIfNeeded(
  contract: UnifiedContractRecord,
  expectedJobId: string,
): Promise<ContractGenerationJob | null> {
  const currentJob = readGenerationJobFromMetadata(contract.metadata);
  if (!currentJob || currentJob.id !== expectedJobId) {
    return null;
  }

  if (!isGenerationJobStale(currentJob)) {
    return currentJob;
  }

  const failedAt = new Date().toISOString();
  const staleJob: ContractGenerationJob = {
    ...currentJob,
    status: "failed",
    updatedAt: failedAt,
    finishedAt: failedAt,
    error: {
      code: "JOB_STALE",
      message: t(
        "生成任务超时未完成，请重新发起生成。",
        "The generation job timed out before completion. Please start again.",
      ),
      retryable: true,
    },
  };

  await updateContractRecord(contract.id, {
    metadata: withGenerationJobMetadata(contract.metadata, staleJob),
  });

  return staleJob;
}
