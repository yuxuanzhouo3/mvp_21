"use client";

import { tokenManager } from "@/lib/auth/frontend-token-manager";

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
    id: String(raw.id || ""),
    title: typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : "Untitled Contract",
    status: (raw.status || "draft") as ContractListStatus,
    region: typeof raw.region === "string" ? raw.region : undefined,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : typeof raw.created_at === "string"
          ? raw.created_at
          : undefined,
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : typeof raw.updated_at === "string"
          ? raw.updated_at
          : undefined,
    parties,
  };
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
