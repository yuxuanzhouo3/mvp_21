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
  | "final_copy_ready"
  | "sealed";

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
    | "signature"
    | "seal";
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

export interface ContractSealStamp {
  imageDataUrl: string;
  imageMimeType?: string;
  fileName?: string;
  source?: string;
}

export interface ContractSealPlacement {
  page?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  opacity?: number;
}

export interface ContractSealFlow {
  status: "not_started" | "sealed" | "failed";
  stampedAt?: string;
  stampedBy?: string;
  note?: string;
  version: number;
  stamp?: ContractSealStamp;
  placement?: ContractSealPlacement;
  outputs?: {
    filename: string;
    formats: Array<"pdf" | "word" | "html">;
    variant: "sealed";
    createdAt: string;
  };
  evidence: ContractEvidenceRecord[];
}

export interface ContractEnhancementMeta {
  archivedAt?: string;
  archivedReason?: string;
  operationLogs: ContractOperationLog[];
  signFlow: ContractSignFlow;
  sealFlow: ContractSealFlow;
}

export type ContractWorkflowAction =
  | "archive"
  | "unarchive"
  | "start_signing"
  | "confirm_sender"
  | "confirm_counterparty"
  | "send_reminder";

export interface ContractActionValidationResult {
  allowed: boolean;
  code?: string;
}

const CN_REGION = isChinaRegion();

function localeText(en: string, zh: string) {
  return CN_REGION ? zh : en;
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

function normalizeActionType(value: unknown): ContractActionType {
  if (
    value === "updated" ||
    value === "archived" ||
    value === "unarchived" ||
    value === "signing_started" ||
    value === "sender_confirmed" ||
    value === "counterparty_confirmed" ||
    value === "reminder_sent" ||
    value === "final_copy_ready" ||
    value === "sealed"
  ) {
    return value;
  }

  return "updated";
}

function normalizeEvidenceType(value: unknown): ContractEvidenceRecord["type"] {
  if (
    value === "confirmation" ||
    value === "reminder" ||
    value === "archive" ||
    value === "final_copy" ||
    value === "update" ||
    value === "signature" ||
    value === "seal"
  ) {
    return value;
  }

  return "update";
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

function buildParticipants(contract?: UnifiedContractRecord): ContractSigningParticipant[] {
  const fallbackSender = localeText("Sender", "发起方");
  const fallbackCounterparty = localeText("Counterparty", "对方");

  if (!contract) {
    return [
      { role: "sender", name: fallbackSender, status: "pending" },
      { role: "counterparty", name: fallbackCounterparty, status: "pending" },
    ];
  }

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
        ) || localeText("Pending signer", "待签署方")
      );
    })
    .slice(0, 2);

  return [
    {
      role: "sender",
      name: partyNames[0] || fallbackSender,
      status: "pending",
    },
    {
      role: "counterparty",
      name: partyNames[1] || fallbackCounterparty,
      status: "pending",
    },
  ];
}

function toOptionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

function toOptionalNumberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  if (value < minimum || value > maximum) {
    return undefined;
  }

  return value;
}

export function normalizeContractEnhancementMeta(
  metadata: Record<string, unknown> | undefined,
  contract?: UnifiedContractRecord,
): ContractEnhancementMeta {
  const source = ensureRecord(metadata);
  const signFlowSource = ensureRecord(source.signFlow);
  const sealFlowSource = ensureRecord(source.sealFlow);
  const defaultParticipants = buildParticipants(contract);

  const participantsSource = ensureArray<unknown>(signFlowSource.participants);
  const participants = (participantsSource.length ? participantsSource : defaultParticipants).map(
    (participant, index) =>
      normalizeParticipant(
        participant,
        index === 0 ? "sender" : "counterparty",
        defaultParticipants[index]?.name || localeText("Signer", "签署方"),
      ),
  );

  const finalCopySource = ensureRecord(signFlowSource.finalCopy);
  const hasFinalCopy = Object.keys(finalCopySource).length > 0;
  const sealStampSource = ensureRecord(sealFlowSource.stamp);
  const hasSealStamp =
    typeof sealStampSource.imageDataUrl === "string" &&
    sealStampSource.imageDataUrl.trim().length > 0;
  const sealPlacementSource = ensureRecord(sealFlowSource.placement);
  const hasSealPlacement = Object.keys(sealPlacementSource).length > 0;
  const sealOutputsSource = ensureRecord(sealFlowSource.outputs);
  const sealEvidence = ensureArray<Record<string, unknown>>(sealFlowSource.evidence).map(
    (evidence) => ({
      id:
        typeof evidence.id === "string" && evidence.id.trim()
          ? evidence.id
          : buildId("seal-evidence"),
      label:
        typeof evidence.label === "string" && evidence.label.trim()
          ? evidence.label
          : localeText("Seal evidence", "盖章证据"),
      description:
        typeof evidence.description === "string" ? evidence.description : "",
      createdAt:
        typeof evidence.createdAt === "string"
          ? evidence.createdAt
          : new Date().toISOString(),
      type: normalizeEvidenceType(evidence.type || "seal"),
    }),
  );
  const sealVersion =
    typeof sealFlowSource.version === "number" &&
    Number.isFinite(sealFlowSource.version) &&
    sealFlowSource.version >= 0
      ? sealFlowSource.version
      : 0;
  const sealStatus =
    sealFlowSource.status === "sealed" || sealFlowSource.status === "failed"
      ? sealFlowSource.status
      : "not_started";
  const hasSealOutputs =
    typeof sealOutputsSource.filename === "string" &&
    sealOutputsSource.filename.trim().length > 0;

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
      action: normalizeActionType(entry.action),
      label:
        typeof entry.label === "string" && entry.label.trim()
          ? entry.label
          : localeText("Updated", "已更新"),
      description:
        typeof entry.description === "string" ? entry.description : "",
      actor:
        typeof entry.actor === "string" && entry.actor.trim()
          ? entry.actor
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
        typeof signFlowSource.reminderCount === "number" && Number.isFinite(signFlowSource.reminderCount)
          ? signFlowSource.reminderCount
          : 0,
      reminders: ensureArray<Record<string, unknown>>(signFlowSource.reminders).map((reminder) => ({
        id:
          typeof reminder.id === "string" && reminder.id.trim()
            ? reminder.id
            : buildId("reminder"),
        target:
          typeof reminder.target === "string" && reminder.target.trim()
            ? reminder.target
            : "all_signers",
        note:
          typeof reminder.note === "string" ? reminder.note : undefined,
        sentAt:
          typeof reminder.sentAt === "string"
            ? reminder.sentAt
            : new Date().toISOString(),
      })),
      evidence: ensureArray<Record<string, unknown>>(signFlowSource.evidence).map((evidence) => ({
        id:
          typeof evidence.id === "string" && evidence.id.trim()
            ? evidence.id
            : buildId("evidence"),
        label:
          typeof evidence.label === "string" && evidence.label.trim()
            ? evidence.label
            : localeText("Evidence", "证据"),
        description:
          typeof evidence.description === "string" ? evidence.description : "",
        createdAt:
          typeof evidence.createdAt === "string"
            ? evidence.createdAt
            : new Date().toISOString(),
        type: normalizeEvidenceType(evidence.type),
      })),
      participants,
      finalCopy: hasFinalCopy
        ? {
            createdAt:
              typeof finalCopySource.createdAt === "string"
                ? finalCopySource.createdAt
                : new Date().toISOString(),
            filename:
              typeof finalCopySource.filename === "string" && finalCopySource.filename.trim()
                ? finalCopySource.filename
                : "contract-final.pdf",
            note:
              typeof finalCopySource.note === "string" && finalCopySource.note.trim()
                ? finalCopySource.note
                : localeText("Signed final copy retained", "签署最终版已留存"),
          }
        : undefined,
    },
    sealFlow: {
      status: sealStatus,
      stampedAt:
        typeof sealFlowSource.stampedAt === "string"
          ? sealFlowSource.stampedAt
          : undefined,
      stampedBy:
        typeof sealFlowSource.stampedBy === "string" && sealFlowSource.stampedBy.trim()
          ? sealFlowSource.stampedBy.trim()
          : undefined,
      note:
        typeof sealFlowSource.note === "string" ? sealFlowSource.note : undefined,
      version: sealVersion,
      stamp: hasSealStamp
        ? {
            imageDataUrl: sealStampSource.imageDataUrl as string,
            imageMimeType:
              typeof sealStampSource.imageMimeType === "string"
                ? sealStampSource.imageMimeType
                : undefined,
            fileName:
              typeof sealStampSource.fileName === "string"
                ? sealStampSource.fileName
                : undefined,
            source:
              typeof sealStampSource.source === "string"
                ? sealStampSource.source
                : undefined,
          }
        : undefined,
      placement: hasSealPlacement
        ? {
            page: toOptionalPositiveNumber(sealPlacementSource.page),
            x: toOptionalPositiveNumber(sealPlacementSource.x),
            y: toOptionalPositiveNumber(sealPlacementSource.y),
            width: toOptionalPositiveNumber(sealPlacementSource.width),
            height: toOptionalPositiveNumber(sealPlacementSource.height),
            opacity: toOptionalNumberInRange(sealPlacementSource.opacity, 0, 1),
          }
        : undefined,
      outputs: hasSealOutputs
        ? {
            filename: String(sealOutputsSource.filename),
            formats: ensureArray<unknown>(sealOutputsSource.formats).filter(
              (item): item is "pdf" | "word" | "html" =>
                item === "pdf" || item === "word" || item === "html",
            ),
            variant: "sealed",
            createdAt:
              typeof sealOutputsSource.createdAt === "string"
                ? sealOutputsSource.createdAt
                : new Date().toISOString(),
          }
        : undefined,
      evidence: sealEvidence,
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

export function getAvailableContractActions(
  contract: UnifiedContractRecord,
): ContractWorkflowAction[] {
  const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);

  if (enhancement.archivedAt) {
    return ["unarchive"];
  }

  const actions: ContractWorkflowAction[] = ["archive"];

  if (enhancement.signFlow.status === "draft") {
    actions.push("start_signing");
  } else if (enhancement.signFlow.status === "awaiting_sender") {
    actions.push("confirm_sender", "send_reminder");
  } else if (enhancement.signFlow.status === "awaiting_counterparty") {
    actions.push("confirm_counterparty", "send_reminder");
  }

  return actions;
}

export function canSealContract(contract: UnifiedContractRecord): boolean {
  const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
  return (
    enhancement.signFlow.status === "completed" ||
    Boolean(enhancement.signFlow.finalCopy)
  );
}

export function validateContractAction(
  contract: UnifiedContractRecord,
  action: ContractWorkflowAction,
): ContractActionValidationResult {
  const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
  const availableActions = getAvailableContractActions(contract);

  if (availableActions.includes(action)) {
    return { allowed: true };
  }

  if (enhancement.archivedAt && action !== "unarchive") {
    return { allowed: false, code: "CONTRACT_ARCHIVED_RESTORE_REQUIRED" };
  }

  if (action === "archive" && enhancement.archivedAt) {
    return { allowed: false, code: "CONTRACT_ALREADY_ARCHIVED" };
  }

  if (action === "unarchive" && !enhancement.archivedAt) {
    return { allowed: false, code: "CONTRACT_NOT_ARCHIVED" };
  }

  if (action === "start_signing") {
    return { allowed: false, code: "SIGNFLOW_ALREADY_STARTED" };
  }

  if (action === "confirm_sender") {
    return { allowed: false, code: "SIGNFLOW_INVALID_SENDER_STEP" };
  }

  if (action === "confirm_counterparty") {
    return { allowed: false, code: "SIGNFLOW_INVALID_COUNTERPARTY_STEP" };
  }

  return { allowed: false, code: "SIGNFLOW_INVALID_REMINDER_STEP" };
}

export function applyContractAction(
  contract: UnifiedContractRecord,
  action: ContractWorkflowAction,
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
    next.signFlow.completedAt = undefined;
    next.signFlow.finalCopy = undefined;
    next.signFlow.participants = next.signFlow.participants.map((participant, index) => ({
      ...participant,
      status: "pending",
      confirmedAt: undefined,
      role: index === 0 ? "sender" : "counterparty",
    }));
    status = "pending";
    addLog(
      "signing_started",
      localeText("Signing launched", "签署已发起"),
      note || localeText("Signing workflow has been initiated", "签署流程已启动"),
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
      note:
        note ||
        localeText(
          "Signed electronic copy retained for later review",
          "签署电子版已留存，可用于后续查验",
        ),
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
      localeText(
        "A retained electronic version is now available for download and audit",
        "留存电子版已可下载并用于审计",
      ),
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
    const reminder: ContractReminderRecord = {
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
      sealFlow: next.sealFlow,
    },
  };
}

export interface ApplyContractSealInput {
  actor: string;
  note?: string;
  stamp: ContractSealStamp;
  placement?: ContractSealPlacement;
}

export function applyContractSeal(
  contract: UnifiedContractRecord,
  input: ApplyContractSealInput,
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
    sealFlow: {
      ...enhancement.sealFlow,
      evidence: [...enhancement.sealFlow.evidence],
    },
  };

  const label = localeText("Contract sealed", "合同已盖章");
  const description =
    input.note ||
    localeText(
      "Seal image has been applied and sealed export files are now available.",
      "印章已应用，可下载盖章版本文件。",
    );

  next.sealFlow.status = "sealed";
  next.sealFlow.stampedAt = now;
  next.sealFlow.stampedBy = input.actor;
  next.sealFlow.note = input.note;
  next.sealFlow.version = (next.sealFlow.version || 0) + 1;
  next.sealFlow.stamp = {
    imageDataUrl: input.stamp.imageDataUrl,
    imageMimeType: input.stamp.imageMimeType,
    fileName: input.stamp.fileName,
    source: input.stamp.source || "contract-management",
  };
  next.sealFlow.placement = input.placement
    ? {
        page: toOptionalPositiveNumber(input.placement.page),
        x: toOptionalPositiveNumber(input.placement.x),
        y: toOptionalPositiveNumber(input.placement.y),
        width: toOptionalPositiveNumber(input.placement.width),
        height: toOptionalPositiveNumber(input.placement.height),
        opacity: toOptionalNumberInRange(input.placement.opacity, 0, 1),
      }
    : undefined;
  next.sealFlow.outputs = {
    filename: `${contract.title || "contract"}-sealed.pdf`,
    formats: ["pdf", "word", "html"],
    variant: "sealed",
    createdAt: now,
  };

  const sealEvidence: ContractEvidenceRecord = {
    id: buildId("seal-evidence"),
    type: "seal",
    label,
    description,
    createdAt: now,
  };
  next.sealFlow.evidence = appendUniqueEvidence(next.sealFlow.evidence, sealEvidence);
  next.signFlow.evidence = appendUniqueEvidence(next.signFlow.evidence, sealEvidence);
  next.operationLogs = appendUniqueLog(next.operationLogs, {
    id: buildId("log"),
    action: "sealed",
    label,
    description,
    actor: input.actor,
    createdAt: now,
  });

  return {
    status: contract.status,
    metadata: {
      ...contract.metadata,
      archivedAt: next.archivedAt,
      archivedReason: next.archivedReason,
      operationLogs: next.operationLogs,
      signFlow: next.signFlow,
      sealFlow: next.sealFlow,
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
    sealFlow: enhancement.sealFlow,
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
