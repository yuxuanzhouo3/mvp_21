"use client";

import { tokenManager } from "@/lib/auth/frontend-token-manager";
import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import {
  normalizeContractRecord,
  type UnifiedContractRecord,
} from "@/lib/data/unified-models";
import { supabase } from "@/lib/integrations/supabase";

export type ContractListStatus =
  | "draft"
  | "pending"
  | "active"
  | "signed"
  | "completed"
  | "expired"
  | "cancelled";

export interface ContractListItem {
  id: string;
  title: string;
  status: ContractListStatus;
  region?: string;
  createdAt?: string;
  updatedAt?: string;
  parties: string[];
  archivedAt?: string;
  archivedReason?: string;
  signFlowStatus?: string;
  sealFlowStatus?: "not_started" | "sealed" | "failed";
  reminderCount: number;
}

export type ContractDetail = UnifiedContractRecord;
export type ContractExportFormat = "html" | "word" | "pdf";
export type ContractExportVariant = "signed" | "sealed";
export type ContractAction =
  | "archive"
  | "unarchive"
  | "start_signing"
  | "confirm_sender"
  | "confirm_counterparty"
  | "send_reminder";

export type ContractLoadErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export class ContractClientError extends Error {
  readonly code: ContractLoadErrorCode;
  readonly status?: number;
  readonly retriable: boolean;

  constructor(
    code: ContractLoadErrorCode,
    message: string,
    options?: {
      status?: number;
      retriable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "ContractClientError";
    this.code = code;
    this.status = options?.status;
    this.retriable =
      options?.retriable ?? (code !== "UNAUTHORIZED" && code !== "FORBIDDEN");
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export type ContractCreateErrorCode =
  | "CONTRACT_QUOTA_EXCEEDED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "UNKNOWN";

export class ContractCreateError extends Error {
  readonly code: ContractCreateErrorCode;
  readonly status: number;
  readonly data?: Record<string, unknown>;

  constructor(
    code: ContractCreateErrorCode,
    message: string,
    options: {
      status: number;
      data?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "ContractCreateError";
    this.code = code;
    this.status = options.status;
    this.data = options.data;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapLoadStatusToCode(status: number): ContractLoadErrorCode {
  if (status === 401) {
    return "UNAUTHORIZED";
  }
  if (status === 403) {
    return "FORBIDDEN";
  }
  if (status === 404) {
    return "NOT_FOUND";
  }
  if (status === 429) {
    return "RATE_LIMITED";
  }
  if (status >= 500) {
    return "SERVER_ERROR";
  }
  return "UNKNOWN";
}

function createLoadStatusError(status: number) {
  const code = mapLoadStatusToCode(status);
  return new ContractClientError(code, `LOAD_FAILED_${status}`, {
    status,
    retriable: code === "RATE_LIMITED" || code === "SERVER_ERROR" || code === "UNKNOWN",
  });
}

function normalizePartyName(party: Record<string, unknown>): string | null {
  const candidates = [
    party.name,
    party.fullName,
    party.companyName,
    party.company_name,
    party.nickname,
    party.role,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeContract(raw: Record<string, any>): ContractListItem {
  const detail = normalizeContractRecord(raw);
  const enhancement = normalizeContractEnhancementMeta(detail.metadata, detail);

  const parties = Array.isArray(raw.parties)
    ? raw.parties
        .filter(
          (party): party is Record<string, unknown> =>
            typeof party === "object" && party !== null && !Array.isArray(party),
        )
        .map(normalizePartyName)
        .filter((value): value is string => Boolean(value))
    : [];

  return {
    id: detail.id,
    title: typeof detail.title === "string" && detail.title.trim()
      ? detail.title.trim()
      : "Untitled Contract",
    status: detail.status as ContractListStatus,
    region: detail.region,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    parties,
    archivedAt: enhancement.archivedAt,
    archivedReason: enhancement.archivedReason,
    signFlowStatus: enhancement.signFlow.status,
    sealFlowStatus: enhancement.sealFlow.status,
    reminderCount: enhancement.signFlow.reminderCount,
  };
}

function normalizeContractDetail(raw: Record<string, any>): ContractDetail {
  return normalizeContractRecord(raw);
}

async function getAuthHeaders() {
  const headers = await tokenManager.getAuthHeaderAsync();
  if (headers?.Authorization) {
    return headers;
  }

  const sessionHeaders = await getSupabaseSessionHeaders();
  if (sessionHeaders) {
    return sessionHeaders;
  }

  if (headers && Object.keys(headers).length > 0) {
    return headers;
  }

  throw new Error("UNAUTHORIZED");
}

function buildBearerHeaders(accessToken: unknown): Record<string, string> | null {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    return null;
  }

  return { Authorization: `Bearer ${accessToken.trim()}` };
}

async function getSupabaseSessionHeaders() {
  try {
    const sessionResult = await supabase.auth.getSession();
    return buildBearerHeaders(sessionResult?.data?.session?.access_token);
  } catch {
    return null;
  }
}

async function refreshSupabaseSessionHeaders() {
  try {
    const refreshResult = await supabase.auth.refreshSession();
    return buildBearerHeaders(refreshResult?.data?.session?.access_token);
  } catch {
    return null;
  }
}

async function getAuthHeadersWithRetry(
  attempts = 3,
  delayMs = 250,
): Promise<Record<string, string>> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const headers = await getAuthHeaders();
      if (headers) {
        return headers;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("UNAUTHORIZED");
}

async function fetchWithAuthRetry(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = await getAuthHeadersWithRetry();
  const requestInit: RequestInit = {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...headers,
    },
  };

  const response = await fetch(input, requestInit);
  if (response.status !== 401) {
    return response;
  }

  await sleep(150);
  let retryHeaders = await tokenManager.getAuthHeaderAsync();
  if (!retryHeaders?.Authorization) {
    retryHeaders =
      (await refreshSupabaseSessionHeaders()) ||
      (await getSupabaseSessionHeaders()) ||
      retryHeaders;
  }

  if (!retryHeaders) {
    return response;
  }

  if (retryHeaders.Authorization === headers.Authorization) {
    return response;
  }

  return fetch(input, {
    ...requestInit,
    headers: {
      ...(init.headers || {}),
      ...retryHeaders,
    },
  });
}

function toCreateErrorCode(status: number, code?: string): ContractCreateErrorCode {
  if (code === "CONTRACT_QUOTA_EXCEEDED") {
    return "CONTRACT_QUOTA_EXCEEDED";
  }
  if (status === 401) {
    return "UNAUTHORIZED";
  }
  if (status === 403) {
    return "FORBIDDEN";
  }
  if (status === 404) {
    return "NOT_FOUND";
  }
  if (status === 429) {
    return "RATE_LIMITED";
  }
  if (status >= 500) {
    return "SERVER_ERROR";
  }
  return "UNKNOWN";
}

async function readCreateErrorPayload(response: Response): Promise<{
  code: ContractCreateErrorCode;
  message: string;
  status: number;
  data?: Record<string, unknown>;
}> {
  const fallbackMessage =
    response.status === 401
      ? "UNAUTHORIZED"
      : `CREATE_FAILED_${response.status}`;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {
      code: toCreateErrorCode(response.status),
      message: fallbackMessage,
      status: response.status,
    };
  }

  try {
    const payload = (await response.json()) as {
      error?: { message?: string; code?: string };
      data?: Record<string, unknown>;
    };
    const errorMessage = payload?.error?.message;
    const errorCode = payload?.error?.code;
    const normalizedMessage =
      typeof errorMessage === "string" && errorMessage.trim()
        ? errorMessage
        : fallbackMessage;
    return {
      code: toCreateErrorCode(response.status, errorCode),
      message: response.status === 401 ? "UNAUTHORIZED" : normalizedMessage,
      status: response.status,
      data: payload?.data,
    };
  } catch {
    return {
      code: toCreateErrorCode(response.status),
      message: fallbackMessage,
      status: response.status,
    };
  }
}

export async function listContractsForCurrentUser(): Promise<ContractListItem[]> {
  try {
    const response = await fetchWithAuthRetry("/api/contracts?limit=100", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw createLoadStatusError(response.status);
    }

    const payload = await response.json();
    const contracts = Array.isArray(payload?.data?.contracts)
      ? payload.data.contracts
      : [];

    return contracts.map((contract: Record<string, any>) =>
      normalizeContract(contract),
    );
  } catch (error) {
    if (error instanceof ContractClientError) {
      throw error;
    }

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      throw new ContractClientError("UNAUTHORIZED", "UNAUTHORIZED", {
        retriable: false,
        cause: error,
      });
    }

    if (error instanceof Error) {
      throw new ContractClientError("NETWORK_ERROR", "LOAD_FAILED_NETWORK", {
        retriable: true,
        cause: error,
      });
    }

    throw new ContractClientError("UNKNOWN", "LOAD_FAILED_UNKNOWN", {
      retriable: true,
      cause: error,
    });
  }
}

export async function deleteContractForCurrentUser(id: string): Promise<void> {
  const response = await fetchWithAuthRetry(`/api/contracts/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`DELETE_FAILED_${response.status}`);
  }
}

export async function createContractForCurrentUser(
  payload: Record<string, unknown>,
): Promise<ContractDetail> {
  const response = await fetchWithAuthRetry("/api/contracts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const payloadError = await readCreateErrorPayload(response);
    throw new ContractCreateError(payloadError.code, payloadError.message, {
      status: payloadError.status,
      data: payloadError.data,
    });
  }

  const result = await response.json();
  return normalizeContractDetail(result?.data?.contract || {});
}

export async function getContractForCurrentUser(id: string): Promise<ContractDetail> {
  const response = await fetchWithAuthRetry(`/api/contracts/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`LOAD_FAILED_${response.status}`);
  }

  const result = await response.json();
  return normalizeContractDetail(result?.data?.contract || {});
}

export async function updateContractForCurrentUser(
  id: string,
  payload: Record<string, unknown>,
): Promise<ContractDetail> {
  const response = await fetchWithAuthRetry(`/api/contracts/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`UPDATE_FAILED_${response.status}`);
  }

  const result = await response.json();
  return normalizeContractDetail(result?.data?.contract || {});
}

export async function applyContractActionForCurrentUser(
  id: string,
  action: ContractAction,
  note?: string,
): Promise<ContractDetail> {
  return updateContractForCurrentUser(id, { action, note });
}

function getDownloadFileName(disposition: string | null, fallback: string) {
  if (!disposition) {
    return fallback;
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = disposition.match(/filename="([^"]+)"/i);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }

  return fallback;
}

async function fetchContractExportResponse(
  id: string,
  options?: {
    format?: ContractExportFormat | "pdf";
    variant?: ContractExportVariant;
  },
) {
  const query = new URLSearchParams();
  if (options?.format) {
    query.set("format", options.format);
  }
  if (options?.variant) {
    query.set("variant", options.variant);
  }

  const response = await fetchWithAuthRetry(
    `/api/contracts/${id}/export${query.size ? `?${query.toString()}` : ""}`,
    {},
  );

  if (!response.ok) {
    throw new Error(`EXPORT_FAILED_${response.status}`);
  }

  return response;
}

export async function downloadContractForCurrentUser(
  id: string,
  format: ContractExportFormat = "html",
  options?: {
    variant?: ContractExportVariant;
  },
): Promise<void> {
  const response = await fetchContractExportResponse(id, {
    format,
    variant: options?.variant,
  });
  const blob = await response.blob();
  const fileName = getDownloadFileName(
    response.headers.get("content-disposition"),
    `contract-${id}.${format === "word" ? "doc" : format}`,
  );

  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export async function exportContractPdfForCurrentUser(id: string): Promise<void> {
  await downloadContractForCurrentUser(id, "pdf");
}

export interface ContractSealPayload {
  stampImageDataUrl: string;
  stampImageMimeType?: string;
  fileName?: string;
  source?: string;
  note?: string;
  placement?: {
    page?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    opacity?: number;
  };
}

export async function sealContractForCurrentUser(
  id: string,
  payload: ContractSealPayload,
): Promise<ContractDetail> {
  const response = await fetchWithAuthRetry(`/api/contracts/${id}/seal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`SEAL_FAILED_${response.status}`);
  }

  const result = await response.json();
  return normalizeContractDetail(result?.data?.contract || {});
}
