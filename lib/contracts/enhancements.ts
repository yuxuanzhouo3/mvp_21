import type { UnifiedContractRecord } from "@/lib/data/unified-models";

export type ContractActionType =
  | "updated"
  | "archived"
  | "unarchived"
  | "signing_started"
  | "sender_confirmed"
  | "counterparty_confirmed"
  | "reminder_sent"
  | "final_copy_ready";

export interface ContractOperationLog {
  id: string;
  action: ContractActionType;
  label: string;
  description: string;
  actor: string;
  createdAt: string;
}

export interface ContractReminderRecord {
  id: string;
  target: string;
  note?: string;
  sentAt: string;
}

export interface ContractEvidenceRecord {
  id: string;
  label: string;
  description: string;
  createdAt: string;
  type: "confirmation" | "reminder" | "archive" | "final_copy" | "update";
}

export interface ContractSigningParticipant {
  role: "sender" | "counterparty";
  name: string;
  status: "pending" | "confirmed";
  confirmedAt?: string;
}

export interface ContractSignFlow {
  status: "draft" | "awaiting_sender" | "awaiting_counterparty" | "completed";
  initiatedAt?: string;
  completedAt?: string;
  reminderCount: number;
  reminders: ContractReminderRecord[];
  evidence: ContractEvidenceRecord[];
  participants: ContractSigningParticipant[];
  finalCopy?: {
    createdAt: string;
    filename: string;
    note: string;
  };
}

export interface ContractEnhancementMeta {
  archivedAt?: string;
  archivedReason?: string;
  operationLogs: ContractOperationLog[];
  signFlow: ContractSignFlow;
}

function ensureRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeParticipant(
  value: unknown,
  fallbackRole: ContractSigningParticipant["role"],
  fallbackName: string,
): ContractSigningParticipant {
  const record = ensureRecord(value);

  return {
    role:
      record.role === "sender" || record.role === "counterparty"
        ? record.role
        : fallbackRole,
    name:
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : fallbackName,
    status: record.status === "confirmed" ? "confirmed" : "pending",
    confirmedAt:
      typeof record.confirmedAt === "string" ? record.confirmedAt : undefined,
  };
}

function buildParticipants(contract: UnifiedContractRecord) {
  const partyNames = contract.parties
    .map((party) => {
      const record = ensureRecord(party);
      const candidates = [
        record.name,
        record.company,
        record.companyName,
        record.company_name,
        record.fullName,
        record.role,
      ];

      return (
        candidates.find(
          (candidate): candidate is string =>
            typeof candidate === "string" && candidate.trim().length > 0,
        ) || "Pending Signer"
      );
    })
    .slice(0, 2);

  return [
    { role: "sender" as const, name: partyNames[0] || "Sender", status: "pending" as const },
    {
      role: "counterparty" as const,
      name: partyNames[1] || "Counterparty",
      status: "pending" as const,
    },
  ];
}

export function normalizeContractEnhancementMeta(
  metadata: Record<string, unknown> | undefined,
  contract?: UnifiedContractRecord,
): ContractEnhancementMeta {
  const source = ensureRecord(metadata);
  const signFlowSource = ensureRecord(source.signFlow);
  const defaultParticipants = contract ? buildParticipants(contract) : [];

  return {
    archivedAt:
      typeof source.archivedAt === "string" ? source.archivedAt : undefined,
    archivedReason:
      typeof source.archivedReason === "string" ? source.archivedReason : undefined,
    operationLogs: ensureArray<Record<string, unknown>>(source.operationLogs).map((entry) => ({
      id:
        typeof entry.id === "string" && entry.id.trim()
          ? entry.id
          : buildId("log"),
      action: (entry.action as ContractActionType) || "updated",
      label:
        typeof entry.label === "string" && entry.label.trim()
          ? entry.label
          : "Updated",
      description:
        typeof entry.description === "string" ? entry.description : "",
      actor: typeof entry.actor === "string" ? entry.actor : "System",
      createdAt:
        typeof entry.createdAt === "string"
          ? entry.createdAt
          : new Date().toISOString(),
    })),
    signFlow: {
      status:
        signFlowSource.status === "awaiting_sender" ||
        signFlowSource.status === "awaiting_counterparty" ||
        signFlowSource.status === "completed"
          ? signFlowSource.status
          : "draft",
      initiatedAt:
        typeof signFlowSource.initiatedAt === "string"
          ? signFlowSource.initiatedAt
          : undefined,
      completedAt:
        typeof signFlowSource.completedAt === "string"
          ? signFlowSource.completedAt
          : undefined,
      reminderCount:
        typeof signFlowSource.reminderCount === "number"
          ? signFlowSource.reminderCount
          : 0,
      reminders: ensureArray<Record<string, unknown>>(signFlowSource.reminders).map(
        (reminder) => ({
          id:
            typeof reminder.id === "string" && reminder.id.trim()
              ? reminder.id
              : buildId("reminder"),
          target:
            typeof reminder.target === "string" ? reminder.target : "all_signers",
          note: typeof reminder.note === "string" ? reminder.note : undefined,
          sentAt:
            typeof reminder.sentAt === "string"
              ? reminder.sentAt
              : new Date().toISOString(),
        }),
      ),
      evidence: ensureArray<Record<string, unknown>>(signFlowSource.evidence).map(
        (evidence) => ({
          id:
            typeof evidence.id === "string" && evidence.id.trim()
              ? evidence.id
              : buildId("evidence"),
          label:
            typeof evidence.label === "string" ? evidence.label : "Evidence",
          description:
            typeof evidence.description === "string" ? evidence.description : "",
          createdAt:
            typeof evidence.createdAt === "string"
              ? evidence.createdAt
              : new Date().toISOString(),
          type:
            evidence.type === "confirmation" ||
            evidence.type === "reminder" ||
            evidence.type === "archive" ||
            evidence.type === "final_copy"
              ? evidence.type
              : "update",
        }),
      ),
      participants: (
        ensureArray(signFlowSource.participants).length
          ? ensureArray(signFlowSource.participants)
          : defaultParticipants
      ).map((participant, index) =>
        normalizeParticipant(
          participant,
          index === 0 ? "sender" : "counterparty",
          defaultParticipants[index]?.name || "Signer",
        ),
      ),
      finalCopy:
        typeof signFlowSource.finalCopy === "object" && signFlowSource.finalCopy !== null
          ? {
              createdAt:
                typeof ensureRecord(signFlowSource.finalCopy).createdAt === "string"
                  ? String(ensureRecord(signFlowSource.finalCopy).createdAt)
                  : new Date().toISOString(),
              filename:
                typeof ensureRecord(signFlowSource.finalCopy).filename === "string"
                  ? String(ensureRecord(signFlowSource.finalCopy).filename)
                  : "contract-final.pdf",
              note:
                typeof ensureRecord(signFlowSource.finalCopy).note === "string"
                  ? String(ensureRecord(signFlowSource.finalCopy).note)
                  : "Signed final copy retained",
            }
          : undefined,
    },
  };
}

function appendUniqueLog(
  logs: ContractOperationLog[],
  nextLog: ContractOperationLog,
) {
  return [nextLog, ...logs].slice(0, 30);
}

function appendUniqueEvidence(
  evidence: ContractEvidenceRecord[],
  nextEvidence: ContractEvidenceRecord,
) {
  return [nextEvidence, ...evidence].slice(0, 20);
}

export function applyContractAction(
  contract: UnifiedContractRecord,
  action: "archive" | "unarchive" | "start_signing" | "confirm_sender" | "confirm_counterparty" | "send_reminder",
  actor: string,
  note?: string,
) {
  const now = new Date().toISOString();
  const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
  const next = {
    ...enhancement,
    signFlow: {
      ...enhancement.signFlow,
      reminders: [...enhancement.signFlow.reminders],
      evidence: [...enhancement.signFlow.evidence],
      participants: enhancement.signFlow.participants.map((participant) => ({ ...participant })),
    },
  };

  const addLog = (
    type: ContractActionType,
    label: string,
    description: string,
  ) => {
    next.operationLogs = appendUniqueLog(next.operationLogs, {
      id: buildId("log"),
      action: type,
      label,
      description,
      actor,
      createdAt: now,
    });
  };

  const addEvidence = (
    type: ContractEvidenceRecord["type"],
    label: string,
    description: string,
  ) => {
    next.signFlow.evidence = appendUniqueEvidence(next.signFlow.evidence, {
      id: buildId("evidence"),
      type,
      label,
      description,
      createdAt: now,
    });
  };

  let status = contract.status;

  if (action === "archive") {
    next.archivedAt = now;
    next.archivedReason = note || "Archived from contract center";
    addLog("archived", "Contract archived", note || "Contract moved to archive");
    addEvidence("archive", "Archive snapshot", note || "Contract archived");
  }

  if (action === "unarchive") {
    delete next.archivedAt;
    delete next.archivedReason;
    addLog("unarchived", "Contract restored", note || "Contract restored from archive");
  }

  if (action === "start_signing") {
    next.signFlow.status = "awaiting_sender";
    next.signFlow.initiatedAt = now;
    next.signFlow.participants = next.signFlow.participants.map((participant, index) => ({
      ...participant,
      status: "pending",
      confirmedAt: undefined,
      role: index === 0 ? "sender" : "counterparty",
    }));
    status = "pending";
    addLog(
      "signing_started",
      "Signing launched",
      note || "Signing workflow has been initiated",
    );
    addEvidence("update", "Signing package prepared", note || "Waiting for sender confirmation");
  }

  if (action === "confirm_sender") {
    next.signFlow.status = "awaiting_counterparty";
    next.signFlow.participants = next.signFlow.participants.map((participant) =>
      participant.role === "sender"
        ? { ...participant, status: "confirmed", confirmedAt: now }
        : participant,
    );
    addLog(
      "sender_confirmed",
      "Sender confirmed",
      note || "Sender finished confirmation",
    );
    addEvidence(
      "confirmation",
      "Sender confirmation evidence",
      note || "Sender confirmation timestamp retained",
    );
  }

  if (action === "confirm_counterparty") {
    next.signFlow.status = "completed";
    next.signFlow.completedAt = now;
    next.signFlow.participants = next.signFlow.participants.map((participant) => ({
      ...participant,
      status: "confirmed",
      confirmedAt: participant.confirmedAt || now,
    }));
    next.signFlow.finalCopy = {
      createdAt: now,
      filename: `${contract.title || "contract"}-signed.pdf`,
      note: note || "Signed electronic copy retained for later review",
    };
    status = "completed";
    addLog(
      "counterparty_confirmed",
      "All parties confirmed",
      note || "Counterparty completed final confirmation",
    );
    addLog(
      "final_copy_ready",
      "Final electronic copy retained",
      "A retained electronic version is now available for download and audit",
    );
    addEvidence(
      "confirmation",
      "Counterparty confirmation evidence",
      note || "Counterparty confirmation timestamp retained",
    );
    addEvidence(
      "final_copy",
      "Final electronic copy retained",
      next.signFlow.finalCopy.note,
    );
  }

  if (action === "send_reminder") {
    const reminder = {
      id: buildId("reminder"),
      target: "all_signers",
      note,
      sentAt: now,
    };
    next.signFlow.reminders = [reminder, ...next.signFlow.reminders].slice(0, 20);
    next.signFlow.reminderCount += 1;
    addLog(
      "reminder_sent",
      "Signing reminder sent",
      note || "Reminder sent to all pending signers",
    );
    addEvidence(
      "reminder",
      "Reminder dispatch record",
      note || "Reminder dispatch retained for audit",
    );
  }

  return {
    status,
    metadata: {
      ...contract.metadata,
      archivedAt: next.archivedAt,
      archivedReason: next.archivedReason,
      operationLogs: next.operationLogs,
      signFlow: next.signFlow,
    },
  };
}

export function appendContractUpdateLog(
  contract: UnifiedContractRecord,
  actor: string,
  description: string,
  nextMetadata?: Record<string, unknown>,
) {
  const enhancement = normalizeContractEnhancementMeta(nextMetadata || contract.metadata, contract);

  return {
    ...((nextMetadata || contract.metadata) as Record<string, unknown>),
    archivedAt: enhancement.archivedAt,
    archivedReason: enhancement.archivedReason,
    signFlow: enhancement.signFlow,
    operationLogs: appendUniqueLog(enhancement.operationLogs, {
      id: buildId("log"),
      action: "updated",
      label: "Contract updated",
      description,
      actor,
      createdAt: new Date().toISOString(),
    }),
  };
}
