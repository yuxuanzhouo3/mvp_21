export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface ContractGenerationJob {
  id: string;
  status: GenerationJobStatus;
  queuedAt: string;
  updatedAt: string;
  attemptCount: number;
  contractId: string;
  userId: string;
  request: Record<string, unknown>;
  error?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStatus(value: unknown): GenerationJobStatus {
  if (
    value === "queued" ||
    value === "running" ||
    value === "succeeded" ||
    value === "failed"
  ) {
    return value;
  }
  return "queued";
}

function normalizeJob(value: unknown): ContractGenerationJob | null {
  const record = asRecord(value);
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const contractId =
    typeof record.contractId === "string" ? record.contractId.trim() : "";
  const userId = typeof record.userId === "string" ? record.userId.trim() : "";

  if (!id || !contractId || !userId) {
    return null;
  }

  const queuedAt =
    typeof record.queuedAt === "string" && record.queuedAt.trim()
      ? record.queuedAt
      : new Date().toISOString();
  const updatedAt =
    typeof record.updatedAt === "string" && record.updatedAt.trim()
      ? record.updatedAt
      : queuedAt;

  return {
    id,
    status: asStatus(record.status),
    queuedAt,
    updatedAt,
    attemptCount:
      typeof record.attemptCount === "number" && Number.isFinite(record.attemptCount)
        ? Math.max(1, Math.floor(record.attemptCount))
        : 1,
    contractId,
    userId,
    request: asRecord(record.request),
    error: typeof record.error === "string" ? record.error : undefined,
  };
}

export function buildGenerationJobId(contractId: string): string {
  return `${contractId}~${Date.now().toString(36)}`;
}

export function parseContractIdFromGenerationJobId(jobId: string): string | null {
  if (typeof jobId !== "string" || !jobId.includes("~")) {
    return null;
  }
  const [contractId] = jobId.split("~");
  const normalized = contractId?.trim();
  return normalized ? normalized : null;
}

export function readGenerationJobFromMetadata(
  metadata: unknown,
  jobId: string,
): ContractGenerationJob | null {
  const meta = asRecord(metadata);
  const map = asRecord(meta.generationJobs);
  const fromMap = normalizeJob(map[jobId]);
  if (fromMap) {
    return fromMap;
  }

  const single = normalizeJob(meta.generationJob);
  if (single?.id === jobId) {
    return single;
  }

  return null;
}

export async function enqueueContractGenerationJob(input: {
  contractId: string;
  userId: string;
  analysisResult?: unknown;
  request?: Record<string, unknown>;
}): Promise<ContractGenerationJob> {
  const now = new Date().toISOString();
  return {
    id: buildGenerationJobId(input.contractId),
    status: "queued",
    queuedAt: now,
    updatedAt: now,
    attemptCount: 1,
    contractId: input.contractId,
    userId: input.userId,
    request: asRecord(input.request || { analysisResult: input.analysisResult }),
  };
}

export async function scheduleContractGenerationJob(input: {
  contractId: string;
  userId: string;
  analysisResult?: unknown;
  request?: Record<string, unknown>;
}) {
  return enqueueContractGenerationJob(input);
}

export async function failStaleGenerationJobIfNeeded(
  contract: { metadata?: unknown } | null,
  jobId: string,
  staleAfterMs = 10 * 60 * 1000,
): Promise<ContractGenerationJob | null> {
  const job = readGenerationJobFromMetadata(contract?.metadata, jobId);
  if (!job) {
    return null;
  }

  if (job.status !== "queued" && job.status !== "running") {
    return job;
  }

  const queuedAtMs = Date.parse(job.queuedAt);
  if (!Number.isFinite(queuedAtMs)) {
    return job;
  }

  if (Date.now() - queuedAtMs < Math.max(1_000, staleAfterMs)) {
    return job;
  }

  return {
    ...job,
    status: "failed",
    updatedAt: new Date().toISOString(),
    error: "JOB_STALE_TIMEOUT",
  };
}

export function toGenerationJobPublic(job: ContractGenerationJob) {
  return {
    id: job.id,
    status: job.status,
    queuedAt: job.queuedAt,
    updatedAt: job.updatedAt,
    attemptCount: job.attemptCount,
    contractId: job.contractId,
    error: job.error,
  };
}
