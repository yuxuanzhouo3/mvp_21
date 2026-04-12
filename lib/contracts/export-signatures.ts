import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import type { UnifiedContractRecord } from "@/lib/data/unified-models";

export type ContractExportSignatureRole = "sender" | "counterparty";

export interface ContractExportSignatureRecord {
  role: ContractExportSignatureRole;
  signerName: string;
  createdAt?: string;
  method?: string;
  source?: string;
  typedName?: string;
  imageDataUrl?: string;
  imageMimeType?: string;
  fileName?: string;
}

export interface ContractExportSignatures {
  sender?: ContractExportSignatureRecord;
  counterparty?: ContractExportSignatureRecord;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toTimestamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeSignatureRecord(
  value: unknown,
): ContractExportSignatureRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const role: ContractExportSignatureRole =
    value.role === "counterparty" ? "counterparty" : "sender";
  const signerName =
    typeof value.signerName === "string" && value.signerName.trim()
      ? value.signerName.trim()
      : typeof value.typedName === "string" && value.typedName.trim()
        ? value.typedName.trim()
        : "";

  if (!signerName) {
    return null;
  }

  return {
    role,
    signerName,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
    method: typeof value.method === "string" ? value.method : undefined,
    source: typeof value.source === "string" ? value.source : undefined,
    typedName: typeof value.typedName === "string" ? value.typedName : undefined,
    imageDataUrl: typeof value.imageDataUrl === "string" ? value.imageDataUrl : undefined,
    imageMimeType: typeof value.imageMimeType === "string" ? value.imageMimeType : undefined,
    fileName: typeof value.fileName === "string" ? value.fileName : undefined,
  };
}

function pickLatest(
  current: ContractExportSignatureRecord | undefined,
  candidate: ContractExportSignatureRecord,
) {
  if (!current) {
    return candidate;
  }

  return toTimestamp(candidate.createdAt) >= toTimestamp(current.createdAt)
    ? candidate
    : current;
}

export function buildContractExportSignatures(
  contract: UnifiedContractRecord,
): ContractExportSignatures {
  const signatures = Array.isArray(contract.signatures)
    ? contract.signatures
    : [];

  const merged: ContractExportSignatures = {};
  for (const raw of signatures) {
    const normalized = normalizeSignatureRecord(raw);
    if (!normalized) {
      continue;
    }

    if (normalized.role === "sender") {
      merged.sender = pickLatest(merged.sender, normalized);
    } else {
      merged.counterparty = pickLatest(merged.counterparty, normalized);
    }
  }

  const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
  for (const participant of enhancement.signFlow.participants) {
    if (participant.status !== "confirmed") {
      continue;
    }

    const role: ContractExportSignatureRole =
      participant.role === "counterparty" ? "counterparty" : "sender";
    if (role === "sender" && !merged.sender) {
      merged.sender = {
        role,
        signerName: participant.name || "Sender",
        createdAt: participant.confirmedAt,
        method: "confirmation",
      };
    }
    if (role === "counterparty" && !merged.counterparty) {
      merged.counterparty = {
        role,
        signerName: participant.name || "Counterparty",
        createdAt: participant.confirmedAt,
        method: "confirmation",
      };
    }
  }

  return merged;
}

