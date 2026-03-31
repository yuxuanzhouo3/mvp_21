"use client";

import { tokenManager } from "@/lib/auth/frontend-token-manager";
import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import {
  normalizeContractRecord,
  type UnifiedContractRecord,
} from "@/lib/data/unified-models";

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
  reminderCount: number;
}

export type ContractDetail = UnifiedContractRecord;
export type ContractExportFormat = "html" | "word" | "pdf";
export type ContractAction =
  | "archive"
  | "unarchive"
  | "start_signing"
  | "confirm_sender"
  | "confirm_counterparty"
  | "send_reminder";

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
    reminderCount: enhancement.signFlow.reminderCount,
  };
}

function normalizeContractDetail(raw: Record<string, any>): ContractDetail {
  return normalizeContractRecord(raw);
}

async function getAuthHeaders() {
  const headers = await tokenManager.getAuthHeaderAsync();
  if (!headers) {
    throw new Error("UNAUTHORIZED");
  }
  return headers;
}

export async function listContractsForCurrentUser(): Promise<ContractListItem[]> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/contracts?limit=100", {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`LOAD_FAILED_${response.status}`);
  }

  const payload = await response.json();
  const contracts = Array.isArray(payload?.data?.contracts)
    ? payload.data.contracts
    : [];

  return contracts.map((contract: Record<string, any>) =>
    normalizeContract(contract),
  );
}

export async function deleteContractForCurrentUser(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/contracts/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error(`DELETE_FAILED_${response.status}`);
  }
}

export async function createContractForCurrentUser(
  payload: Record<string, unknown>,
): Promise<ContractDetail> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/contracts", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`CREATE_FAILED_${response.status}`);
  }

  const result = await response.json();
  return normalizeContractDetail(result?.data?.contract || {});
}

export async function getContractForCurrentUser(id: string): Promise<ContractDetail> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/contracts/${id}`, {
    headers,
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
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/contracts/${id}`, {
    method: "PUT",
    headers: {
      ...headers,
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
  },
) {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (options?.format) {
    query.set("format", options.format);
  }

  const response = await fetch(
    `/api/contracts/${id}/export${query.size ? `?${query.toString()}` : ""}`,
    {
      headers,
    },
  );

  if (!response.ok) {
    throw new Error(`EXPORT_FAILED_${response.status}`);
  }

  return response;
}

export async function downloadContractForCurrentUser(
  id: string,
  format: ContractExportFormat = "html",
): Promise<void> {
  const response = await fetchContractExportResponse(id, { format });
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
