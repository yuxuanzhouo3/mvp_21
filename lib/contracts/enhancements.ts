import type { UnifiedContractRecord } from "@/lib/data/unified-models";
import { isChinaRegion } from "@/lib/config/region";

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
  type:
    | "confirmation"
    | "reminder"
    | "archive"
    | "final_copy"
    | "update"
    | "signature";
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

const CN_REGION = isChinaRegion();

function localeText(en: string, zh: string) {
  return CN_REGION ? zh : en;
}

const LEGACY_TEXT_MAP: Record<string, string> = {
  Updated: "已更新",
  Evidence: "证据",
  System: "系统",
  "Pending Signer": "待签署方",
  Sender: "发起方",
  Counterparty: "对方",
  Signer: "签署方",
  "Current User": "当前用户",
  "Signed final copy retained": "签署最终电子版已留存",
  "Contract archived": "合同已归档",
  "Contract moved to archive": "合同已移入归档",
  "Archive snapshot": "归档快照",
  "Contract restored": "合同已恢复",
  "Contract restored from archive": "合同已从归档中恢复",
  "Signing launched": "签署流程已发起",
  "Signing workflow has been initiated": "已发起签署流程",
  "Signing package prepared": "签署材料已准备完成",
  "Waiting for sender confirmation": "等待发起方确认",
  "Sender confirmed": "发起方已确认",
  "Sender finished confirmation": "发起方已完成确认",
  "Sender confirmation evidence": "发起方确认凭证",
  "Sender confirmation timestamp retained": "发起方确认时间戳已留存",
  "All parties confirmed": "双方已完成确认",
  "Counterparty completed final confirmation": "对方已完成最终确认",
  "Final electronic copy retained": "最终电子版已留存",
  "A retained electronic version is now available for download and audit": "留存电子版已可下载并用于审计",
  "Counterparty confirmation evidence": "对方确认凭证",
  "Counterparty confirmation timestamp retained": "对方确认时间戳已留存",
  "Signing reminder sent": "签署提醒已发送",
  "Reminder sent to all pending signers": "已向所有待签署方发送提醒",
  "Reminder dispatch record": "提醒发送记录",
  "Reminder dispatch retained for audit": "提醒发送信息已留存用于审计",
  "Contract updated": "合同已更新",
  "Signed electronic copy retained for later review": "签署电子版已留存，可用于后续查验",
};

function localizeLegacyText(value: string) {
  if (!CN_REGION) {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (trimmed.startsWith("Reminder sent to ") && trimmed.endsWith(".")) {
    const target = trimmed.slice("Reminder sent to ".length, -1);
    return `已向${target}发送提醒。`;
  }

  return LEGACY_TEXT_MAP[trimmed] || value;
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
  const partyNames = ensureArray<unknown>(contract.parties)
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
        ) || localeText("Pending Signer", "待签署方")
      );
    })
    .slice(0, 2);

  return [
    {
      role: "sender" as const,
      name: partyNames[0] || localeText("Sender", "发起方"),
      status: "pending" as const,
    },
    {
      role: "counterparty" as const,
      name: partyNames[1] || localeText("Counterparty", "对方"),
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
          ? localizeLegacyText(entry.label)
          : localeText("Updated", "已更新"),
      description:
        typeof entry.description === "string" ? localizeLegacyText(entry.description) : "",
      actor:
        typeof entry.actor === "string"
          ? localizeLegacyText(entry.actor)
          : localeText("System", "系统"),
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
          note:
            typeof reminder.note === "string"
              ? localizeLegacyText(reminder.note)
              : undefined,
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
            typeof evidence.label === "string"
              ? localizeLegacyText(evidence.label)
              : localeText("Evidence", "证据"),
          description:
            typeof evidence.description === "string"
              ? localizeLegacyText(evidence.description)
              : "",
          createdAt:
            typeof evidence.createdAt === "string"
              ? evidence.createdAt
              : new Date().toISOString(),
          type:
            evidence.type === "confirmation" ||
            evidence.type === "reminder" ||
            evidence.type === "archive" ||
            evidence.type === "final_copy" ||
            evidence.type === "signature"
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
          defaultParticipants[index]?.name || localeText("Signer", "签署方"),
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
                  : localeText("contract-final.pdf", "合同-最终版.pdf"),
              note:
                typeof ensureRecord(signFlowSource.finalCopy).note === "string"
                  ? localizeLegacyText(String(ensureRecord(signFlowSource.finalCopy).note))
                  : localeText("Signed final copy retained", "签署最终电子版已留存"),
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
    next.archivedReason = note || localeText("Archived from contract center", "已从合同中心归档");
    addLog(
      "archived",
      localeText("Contract archived", "合同已归档"),
      note || localeText("Contract moved to archive", "合同已移入归档"),
    );
    addEvidence(
      "archive",
      localeText("Archive snapshot", "归档快照"),
      note || localeText("Contract archived", "合同已归档"),
    );
  }

  if (action === "unarchive") {
    delete next.archivedAt;
    delete next.archivedReason;
    addLog(
      "unarchived",
      localeText("Contract restored", "合同已恢复"),
      note || localeText("Contract restored from archive", "合同已从归档中恢复"),
    );
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
      localeText("Signing launched", "签署流程已发起"),
      note || localeText("Signing workflow has been initiated", "已发起签署流程"),
    );
    addEvidence(
      "update",
      localeText("Signing package prepared", "签署材料已准备完成"),
      note || localeText("Waiting for sender confirmation", "等待发起方确认"),
    );
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
      localeText("Sender confirmed", "发起方已确认"),
      note || localeText("Sender finished confirmation", "发起方已完成确认"),
    );
    addEvidence(
      "confirmation",
      localeText("Sender confirmation evidence", "发起方确认凭证"),
      note || localeText("Sender confirmation timestamp retained", "发起方确认时间戳已留存"),
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
      filename: `${contract.title || localeText("contract", "合同")}${localeText("-signed.pdf", "-已签署.pdf")}`,
      note: note || localeText("Signed electronic copy retained for later review", "签署电子版已留存，可用于后续查验"),
    };
    status = "completed";
    addLog(
      "counterparty_confirmed",
      localeText("All parties confirmed", "双方已完成确认"),
      note || localeText("Counterparty completed final confirmation", "对方已完成最终确认"),
    );
    addLog(
      "final_copy_ready",
      localeText("Final electronic copy retained", "最终电子版已留存"),
      localeText("A retained electronic version is now available for download and audit", "留存电子版已可下载并用于审计"),
    );
    addEvidence(
      "confirmation",
      localeText("Counterparty confirmation evidence", "对方确认凭证"),
      note || localeText("Counterparty confirmation timestamp retained", "对方确认时间戳已留存"),
    );
    addEvidence(
      "final_copy",
      localeText("Final electronic copy retained", "最终电子版已留存"),
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
      localeText("Signing reminder sent", "签署提醒已发送"),
      note || localeText("Reminder sent to all pending signers", "已向所有待签署方发送提醒"),
    );
    addEvidence(
      "reminder",
      localeText("Reminder dispatch record", "提醒发送记录"),
      note || localeText("Reminder dispatch retained for audit", "提醒发送信息已留存用于审计"),
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
      label: localeText("Contract updated", "合同已更新"),
      description,
      actor,
      createdAt: new Date().toISOString(),
    }),
  };
}
