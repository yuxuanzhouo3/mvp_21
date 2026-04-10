import { createHash } from "node:crypto";

import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import {
  buildContractHtml,
  normalizeContractContent,
  sanitizeDownloadFileName,
} from "@/lib/contracts/format";
import { buildContractPdfBuffer } from "@/lib/contracts/pdf";
import { getContractById, listContracts } from "@/lib/data/contracts-store";
import type { UnifiedContractRecord } from "@/lib/data/unified-models";
import {
  createOrReuseDocumentShareLink,
  downloadWorkspaceDocumentFile,
  getDocumentShareLinkByDocument,
  getDocumentShareLinkByToken,
  getWorkspaceDocumentById,
  incrementDocumentShareLinkAccess,
  listDocumentShareLinksByUser,
  listWorkspaceDocumentsByUser,
  revokeDocumentShareLink,
  type WorkspaceDocumentRecord,
  type WorkspaceDocumentShareRecord,
} from "@/lib/data/workspace-documents-store";
import type {
  DashboardDocumentItem,
  DashboardDocumentSignatureRecord,
  DashboardDocumentSourceKind,
  DashboardDocumentStats,
  DashboardDocumentTimelineEvent,
  DashboardDocumentVerificationData,
  DashboardDocumentsData,
} from "@/lib/dashboard/types";
import { isChinaRegion } from "@/lib/config/region";

const CN_REGION = isChinaRegion();

function localeText(en: string, zh: string) {
  return CN_REGION ? zh : en;
}

function normalizeParticipantRole(role: string) {
  if (role === "sender") {
    return localeText("Sender", "发起方");
  }

  if (role === "counterparty") {
    return localeText("Counterparty", "对方");
  }

  return role;
}

function normalizeSignatureStatus(status: string) {
  if (!CN_REGION) {
    return status;
  }

  if (status === "confirmed") {
    return "已确认";
  }
  if (status === "pending") {
    return "待确认";
  }

  return status;
}

function normalizeReminderTarget(target: string) {
  if (!CN_REGION) {
    return target;
  }

  if (target === "all_signers") {
    return "全部签署方";
  }
  if (target === "sender") {
    return "发起方";
  }
  if (target === "counterparty") {
    return "对方";
  }

  return target;
}

function joinLine(label: string, value?: string | number | null) {
  return `${label}: ${value ?? "-"}`;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatAverageHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return localeText("N/A", "暂无");
  }

  if (hours >= 24) {
    return `${(hours / 24).toFixed(hours >= 48 ? 0 : 1)} ${localeText("d", "天")}`;
  }

  return `${hours.toFixed(hours >= 10 ? 0 : 1)} ${localeText("h", "小时")}`;
}

function buildShareUrl(origin: string | undefined, token: string) {
  const base =
    origin ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/verify/document/${token}`;
}

function isShareExpired(share?: Pick<WorkspaceDocumentShareRecord, "expiresAt"> | null) {
  if (!share?.expiresAt) {
    return false;
  }

  const expiresAt = new Date(share.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function toSafePageCount(sizeBytes: number) {
  return Math.max(1, Math.ceil(sizeBytes / 1800));
}

function normalizeCategory(value?: string | null) {
  return value && value.trim() ? value.trim() : localeText("General", "通用");
}

function normalizeGroupName(value?: string | null) {
  return value && value.trim() ? value.trim() : localeText("Workspace", "工作空间");
}

function normalizeTags(tags: string[]) {
  const seen = new Set<string>();
  return tags
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

async function listAllContractsForUser(userId: string): Promise<UnifiedContractRecord[]> {
  const batchSize = 200;
  const contracts: UnifiedContractRecord[] = [];
  let total = 0;
  let offset = 0;

  do {
    const result = await listContracts({
      userId,
      limit: batchSize,
      offset,
    });

    total = result.total;
    contracts.push(...result.contracts);
    offset += batchSize;
  } while (contracts.length < total);

  return contracts;
}

export function encodeDashboardDocumentId(sourceKind: DashboardDocumentSourceKind, rawId: string) {
  return `${sourceKind}:${rawId}`;
}

export function decodeDashboardDocumentId(documentId: string): {
  sourceKind: DashboardDocumentSourceKind;
  rawId: string;
} {
  if (documentId.startsWith("uploaded:")) {
    return {
      sourceKind: "uploaded",
      rawId: documentId.slice("uploaded:".length),
    };
  }

  if (documentId.startsWith("contract:")) {
    return {
      sourceKind: "contract",
      rawId: documentId.slice("contract:".length),
    };
  }

  return {
    sourceKind: "contract",
    rawId: documentId,
  };
}

function applyShareState<T extends DashboardDocumentItem>(
  document: T,
  share: WorkspaceDocumentShareRecord | undefined,
  origin?: string,
): T {
  if (!share) {
    return document;
  }

  return {
    ...document,
    shareUrl: isShareExpired(share) ? undefined : buildShareUrl(origin, share.token),
    shareExpiresAt: share.expiresAt,
    shareAccessCount: share.accessCount,
    shareLastAccessedAt: share.lastAccessedAt,
  };
}

function buildContractDocumentPayload(contract: UnifiedContractRecord): DashboardDocumentItem {
  const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
  const normalizedContent = normalizeContractContent(contract.content);
  const editorHtml =
    typeof contract.metadata?.editorHtml === "string" ? contract.metadata.editorHtml : null;
  const contractHtml = normalizedContent
    ? buildContractHtml(normalizedContent, { renderedHtml: editorHtml })
    : "";
  const serialized = [
    contract.title,
    contract.type,
    contract.status,
    contract.sourceType || "",
    contract.sourceContent || "",
    contractHtml,
    JSON.stringify(contract.analysisResult || {}),
    JSON.stringify(contract.parties || []),
    JSON.stringify(contract.signatures || []),
    JSON.stringify(contract.metadata || {}),
  ].join("\n");
  const sizeBytes = Buffer.byteLength(serialized, "utf8");
  const verified =
    enhancement.signFlow.status === "completed" ||
    Boolean(enhancement.signFlow.finalCopy) ||
    contract.status === "signed" ||
    contract.status === "completed";
  const fileName = `${contract.title || localeText("contract", "合同")}${verified ? ".pdf" : ".draft"}`;
  const tags = normalizeTags(
    [contract.type, contract.sourceType, enhancement.signFlow.status, contract.status].filter(
      (value): value is string => Boolean(value),
    ),
  );

  return {
    id: encodeDashboardDocumentId("contract", contract.id),
    sourceKind: "contract",
    rawId: contract.id,
    contractId: contract.id,
    title: contract.title || localeText("Untitled Contract", "未命名合同"),
    fileName,
    documentType: verified ? "contract" : "draft",
    verificationStatus: verified ? "verified" : "pending",
    contractStatus: contract.status,
    signFlowStatus: enhancement.signFlow.status,
    sourceType: contract.sourceType,
    category: normalizeCategory(contract.type || localeText("Contract", "合同")),
    groupName: localeText("Contracts", "合同"),
    tags,
    contentType: "application/pdf",
    storageProvider: "contract-record",
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    pageCount: toSafePageCount(Buffer.byteLength(contractHtml || serialized, "utf8")),
    hash: createHash("sha256").update(serialized).digest("hex"),
    uploadedAt: contract.createdAt,
    updatedAt: contract.updatedAt || contract.createdAt,
    participants: enhancement.signFlow.participants.map((participant) => ({
      role: participant.role,
      name: participant.name,
      status: participant.status,
      confirmedAt: participant.confirmedAt,
    })),
  };
}

function buildUploadedDocumentPayload(document: WorkspaceDocumentRecord): DashboardDocumentItem {
  return {
    id: encodeDashboardDocumentId("uploaded", document.id),
    sourceKind: "uploaded",
    rawId: document.id,
    title: document.title || document.fileName || localeText("Uploaded Document", "上传文档"),
    fileName: document.fileName || localeText("uploaded-document", "上传文档"),
    documentType: "uploaded",
    verificationStatus: "verified",
    sourceType: "upload",
    category: normalizeCategory(document.category),
    groupName: normalizeGroupName(document.groupName),
    tags: normalizeTags(document.tags),
    contentType: document.contentType,
    storageProvider: document.storageProvider,
    sizeBytes: document.sizeBytes,
    sizeLabel: formatBytes(document.sizeBytes),
    pageCount: toSafePageCount(document.sizeBytes),
    hash: document.hash,
    uploadedAt: document.createdAt,
    updatedAt: document.updatedAt || document.createdAt,
    participants: [],
  };
}

function buildStats(documents: DashboardDocumentItem[]): DashboardDocumentStats {
  const totalDocuments = documents.length;
  const verifiedDocuments = documents.filter((item) => item.verificationStatus === "verified").length;
  const pendingDocuments = totalDocuments - verifiedDocuments;
  const totalStorageBytes = documents.reduce((sum, item) => sum + item.sizeBytes, 0);

  const completedDurations = documents
    .filter(
      (item) =>
        item.sourceKind === "contract" &&
        item.verificationStatus === "verified" &&
        item.uploadedAt &&
        item.updatedAt,
    )
    .map((item) => {
      const start = new Date(item.uploadedAt || "").getTime();
      const end = new Date(item.updatedAt || "").getTime();
      return start > 0 && end >= start ? (end - start) / (1000 * 60 * 60) : NaN;
    })
    .filter((value) => Number.isFinite(value));

  const averageProcessingHours =
    completedDurations.length > 0
      ? completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length
      : 0;

  return {
    totalDocuments,
    verifiedDocuments,
    pendingDocuments,
    totalStorageBytes,
    totalStorageLabel: formatBytes(totalStorageBytes),
    averageProcessingHours,
    averageProcessingLabel: formatAverageHours(averageProcessingHours),
    complianceRate: totalDocuments > 0 ? Math.round((verifiedDocuments / totalDocuments) * 100) : 0,
  };
}

function buildSignatureRecords(contract: UnifiedContractRecord): DashboardDocumentSignatureRecord[] {
  const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
  const signatures = Array.isArray(contract.signatures) ? contract.signatures : [];

  return enhancement.signFlow.participants.map((participant) => {
    const matched = signatures.find(
      (item) => item && typeof item === "object" && item.role === participant.role,
    ) as Record<string, unknown> | undefined;

    return {
      id:
        typeof matched?.id === "string" && matched.id.trim()
          ? matched.id
          : `${contract.id}-${participant.role}`,
      role: participant.role,
      signerName:
        typeof matched?.signerName === "string" && matched.signerName.trim()
          ? matched.signerName
          : participant.name,
      status: participant.status,
      method: typeof matched?.method === "string" ? matched.method : undefined,
      source: typeof matched?.source === "string" ? matched.source : undefined,
      createdAt: typeof matched?.createdAt === "string" ? matched.createdAt : participant.confirmedAt,
    };
  });
}

function buildContractTimeline(contract: UnifiedContractRecord): DashboardDocumentTimelineEvent[] {
  const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
  const events: DashboardDocumentTimelineEvent[] = [];

  if (contract.createdAt) {
    events.push({
      id: `${contract.id}-created`,
      label: localeText("Draft created", "草稿已创建"),
      description: localeText("The contract draft record was created.", "合同草稿记录已创建。"),
      occurredAt: contract.createdAt,
      type: "created",
    });
  }

  if (enhancement.signFlow.initiatedAt) {
    events.push({
      id: `${contract.id}-signing-started`,
      label: localeText("Signing started", "签署流程已发起"),
      description: localeText("The signing workflow was launched.", "签署流程已启动。"),
      occurredAt: enhancement.signFlow.initiatedAt,
      type: "signing",
    });
  }

  enhancement.signFlow.participants.forEach((participant) => {
    if (!participant.confirmedAt) return;
    events.push({
      id: `${contract.id}-${participant.role}-confirmed`,
      label:
        participant.role === "sender"
          ? localeText("Sender confirmed", "发起方已确认")
          : localeText("Counterparty confirmed", "对方已确认"),
      description: localeText(
        `${participant.name} confirmed the signature package.`,
        `${participant.name}已确认签署材料。`,
      ),
      occurredAt: participant.confirmedAt,
      type: "signature",
    });
  });

  enhancement.signFlow.reminders.forEach((reminder) => {
    events.push({
      id: reminder.id,
      label: localeText("Reminder sent", "提醒已发送"),
      description:
        reminder.note ||
        localeText(
          `Reminder sent to ${reminder.target}.`,
          `已向${normalizeReminderTarget(reminder.target)}发送提醒。`,
        ),
      occurredAt: reminder.sentAt,
      type: "reminder",
    });
  });

  enhancement.operationLogs.forEach((log) => {
    events.push({
      id: log.id,
      label: log.label,
      description: log.description,
      occurredAt: log.createdAt,
      type:
        log.action === "final_copy_ready"
          ? "final_copy"
          : log.action === "reminder_sent"
            ? "reminder"
            : log.action === "sender_confirmed" || log.action === "counterparty_confirmed"
              ? "signature"
              : log.action === "signing_started"
                ? "signing"
                : "update",
    });
  });

  if (enhancement.signFlow.finalCopy) {
    events.push({
      id: `${contract.id}-final-copy`,
      label: localeText("Final copy retained", "最终电子版已留存"),
      description: enhancement.signFlow.finalCopy.note,
      occurredAt: enhancement.signFlow.finalCopy.createdAt,
      type: "final_copy",
    });
  }

  return events
    .filter((item) => Boolean(item.occurredAt))
    .sort((left, right) => {
      if (left.occurredAt === right.occurredAt) {
        return left.id.localeCompare(right.id);
      }
      return left.occurredAt.localeCompare(right.occurredAt);
    });
}

function buildUploadedTimeline(
  document: WorkspaceDocumentRecord,
  share?: WorkspaceDocumentShareRecord | null,
): DashboardDocumentTimelineEvent[] {
  const events: DashboardDocumentTimelineEvent[] = [];

  if (document.createdAt) {
    events.push({
      id: `${document.id}-uploaded`,
      label: localeText("Document uploaded", "文档已上传"),
      description: localeText(
        `${document.fileName} entered the workspace document center.`,
        `${document.fileName}已进入工作台文档中心。`,
      ),
      occurredAt: document.createdAt,
      type: "created",
    });
  }

  if (document.updatedAt && document.updatedAt !== document.createdAt) {
    events.push({
      id: `${document.id}-updated`,
      label: localeText("Metadata updated", "文档元数据已更新"),
      description: localeText(
        "Document metadata was refreshed in the workspace document center.",
        "工作台文档中心中的文档元数据已更新。",
      ),
      occurredAt: document.updatedAt,
      type: "update",
    });
  }

  if (share) {
    events.push({
      id: `${document.id}-shared`,
      label: isShareExpired(share)
        ? localeText("Share link expired", "分享链接已过期")
        : localeText("Share link active", "分享链接有效"),
      description: isShareExpired(share)
        ? localeText("The public verification link is no longer valid.", "公开验真链接已失效。")
        : localeText("A public verification page is active for this document.", "此文档的公开验真页当前可访问。"),
      occurredAt: share.updatedAt || share.createdAt || document.updatedAt || document.createdAt || new Date().toISOString(),
      type: "update",
    });
  }

  if (share?.lastAccessedAt) {
    events.push({
      id: `${document.id}-shared-accessed`,
      label: localeText("Shared page visited", "分享页已被访问"),
      description: localeText(
        `The public verification page has been opened ${share.accessCount} times.`,
        `公开验真页已被访问 ${share.accessCount} 次。`,
      ),
      occurredAt: share.lastAccessedAt,
      type: "update",
    });
  }

  return events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

async function getDocumentShareRecord(
  userId: string,
  documentId: string,
  sourceKind: DashboardDocumentSourceKind,
) {
  return getDocumentShareLinkByDocument({
    userId,
    documentId,
    documentSourceKind: sourceKind,
  });
}

async function buildContractVerificationData(
  userId: string,
  contractId: string,
  origin?: string,
): Promise<DashboardDocumentVerificationData | null> {
  const contract = await getContractById(contractId);
  if (!contract || contract.userId !== userId) {
    return null;
  }

  const share = await getDocumentShareRecord(userId, contract.id, "contract");
  const document = applyShareState(buildContractDocumentPayload(contract), share || undefined, origin);
  const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);

  return {
    document,
    integrityStatus: document.verificationStatus,
    integritySummary:
      document.verificationStatus === "verified"
        ? localeText(
            "The document hash, signing participants, and retained copy are all backed by live contract workflow data.",
            "文档哈希、签署参与方与留存副本均由真实合同流程数据支撑。",
          )
        : localeText(
            "The draft exists, but the signing workflow or retained final copy is not complete yet.",
            "草稿已存在，但签署流程或最终留存副本尚未完成。",
          ),
    contentHash: document.hash,
    finalCopy: enhancement.signFlow.finalCopy,
    evidence: enhancement.signFlow.evidence.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      createdAt: item.createdAt,
      type: item.type,
    })),
    signatures: buildSignatureRecords(contract),
    timeline: buildContractTimeline(contract),
    shareUrl: document.shareUrl,
    shareExpiresAt: document.shareExpiresAt,
    shareAccessCount: document.shareAccessCount,
    shareLastAccessedAt: document.shareLastAccessedAt,
  };
}

async function buildUploadedVerificationData(
  userId: string,
  documentId: string,
  origin?: string,
  shareOverride?: WorkspaceDocumentShareRecord | null,
): Promise<DashboardDocumentVerificationData | null> {
  const documentRecord = await getWorkspaceDocumentById(documentId);
  if (!documentRecord || documentRecord.userId !== userId) {
    return null;
  }

  const share = shareOverride ?? (await getDocumentShareRecord(userId, documentRecord.id, "uploaded"));
  const document = applyShareState(buildUploadedDocumentPayload(documentRecord), share || undefined, origin);
  const timeline = buildUploadedTimeline(documentRecord, share);
  const evidence = [
    {
      id: `${documentRecord.id}-hash`,
      label: localeText("SHA-256 hash recorded", "SHA-256 哈希已记录"),
      description: localeText(
        "The uploaded file hash was calculated and stored when the document entered the workspace.",
        "文档进入工作空间时，系统已计算并保存上传文件哈希。",
      ),
      createdAt: documentRecord.createdAt || documentRecord.updatedAt || new Date().toISOString(),
      type: "hash",
    },
    {
      id: `${documentRecord.id}-storage`,
      label: localeText("Storage receipt retained", "存储回执已留存"),
      description: localeText(
        `The original file is retained through ${documentRecord.storageProvider}.`,
        `原始文件已通过 ${documentRecord.storageProvider} 留存。`,
      ),
      createdAt: documentRecord.createdAt || documentRecord.updatedAt || new Date().toISOString(),
      type: "storage",
    },
    {
      id: `${documentRecord.id}-metadata`,
      label: localeText("Classification metadata stored", "分类元数据已存储"),
      description: localeText(
        `Category: ${normalizeCategory(documentRecord.category)} | Group: ${normalizeGroupName(documentRecord.groupName)} | Tags: ${normalizeTags(documentRecord.tags).join(", ") || "-"}`,
        `分类：${normalizeCategory(documentRecord.category)} | 分组：${normalizeGroupName(documentRecord.groupName)} | 标签：${normalizeTags(documentRecord.tags).join(", ") || "-"}`,
      ),
      createdAt: documentRecord.updatedAt || documentRecord.createdAt || new Date().toISOString(),
      type: "metadata",
    },
  ];

  if (share) {
    evidence.push({
      id: `${documentRecord.id}-share`,
      label: isShareExpired(share)
        ? localeText("Share link expired", "分享链接已过期")
        : localeText("Share link active", "分享链接有效"),
      description: isShareExpired(share)
        ? localeText(
            "The public verification link has passed its effective period.",
            "公开验真链接已超过有效期。",
          )
        : localeText(
            `Public verification is available${share.expiresAt ? ` until ${share.expiresAt}` : ""}.`,
            `公开验真页可访问${share.expiresAt ? `，有效期至 ${share.expiresAt}` : "。"} `,
          ).trim(),
      createdAt: share.updatedAt || share.createdAt || new Date().toISOString(),
      type: "share",
    });
    evidence.push({
      id: `${documentRecord.id}-share-access`,
      label: localeText("Share access statistics", "分享访问统计"),
      description: localeText(
        `This shared page has been opened ${share.accessCount} times.`,
        `该分享页面已被访问 ${share.accessCount} 次。`,
      ),
      createdAt: share.lastAccessedAt || share.updatedAt || share.createdAt || new Date().toISOString(),
      type: "share_access",
    });
  }

  return {
    document,
    integrityStatus: document.verificationStatus,
    integritySummary:
      localeText(
        "The uploaded document has a stored content hash, retained original file, and workspace audit metadata.",
        "上传文档已具备内容哈希、原始文件留存与工作空间审计元数据。",
      ),
    contentHash: document.hash,
    evidence,
    signatures: [],
    timeline,
    shareUrl: document.shareUrl,
    shareExpiresAt: document.shareExpiresAt,
    shareAccessCount: document.shareAccessCount,
    shareLastAccessedAt: document.shareLastAccessedAt,
  };
}

async function buildVerificationDataInternal(
  userId: string,
  documentId: string,
  origin?: string,
): Promise<DashboardDocumentVerificationData | null> {
  const reference = decodeDashboardDocumentId(documentId);
  if (reference.sourceKind === "uploaded") {
    return buildUploadedVerificationData(userId, reference.rawId, origin);
  }

  return buildContractVerificationData(userId, reference.rawId, origin);
}

export async function getDashboardDocumentsData(
  userId: string,
  origin?: string,
): Promise<DashboardDocumentsData> {
  const [contracts, uploadedDocuments, shareLinks] = await Promise.all([
    listAllContractsForUser(userId),
    listWorkspaceDocumentsByUser(userId),
    listDocumentShareLinksByUser(userId),
  ]);

  const shareMap = new Map(
    shareLinks.map((share) => [`${share.documentSourceKind}:${share.documentId}`, share]),
  );

  const documents = [
    ...contracts.map((contract) =>
      applyShareState(
        buildContractDocumentPayload(contract),
        shareMap.get(`contract:${contract.id}`),
        origin,
      ),
    ),
    ...uploadedDocuments.map((document) =>
      applyShareState(
        buildUploadedDocumentPayload(document),
        shareMap.get(`uploaded:${document.id}`),
        origin,
      ),
    ),
  ].sort((left, right) => (right.updatedAt || "").localeCompare(left.updatedAt || ""));

  return {
    documents,
    stats: buildStats(documents),
    generatedAt: new Date().toISOString(),
  };
}

export async function getDashboardDocumentVerificationData(
  userId: string,
  documentId: string,
  origin?: string,
): Promise<DashboardDocumentVerificationData | null> {
  return buildVerificationDataInternal(userId, documentId, origin);
}

export async function createDashboardDocumentShareLink(
  userId: string,
  documentId: string,
  origin?: string,
  options?: {
    expiresAt?: string | null;
  },
): Promise<{ shareUrl: string; expiresAt?: string; accessCount: number } | null> {
  const reference = decodeDashboardDocumentId(documentId);
  const verification = await buildVerificationDataInternal(userId, documentId, origin);
  if (!verification) {
    return null;
  }

  const share = await createOrReuseDocumentShareLink({
    userId,
    documentId: reference.rawId,
    documentSourceKind: reference.sourceKind,
    expiresAt: options?.expiresAt,
  });

  return {
    shareUrl: buildShareUrl(origin, share.token),
    expiresAt: share.expiresAt,
    accessCount: share.accessCount,
  };
}

export async function revokeDashboardDocumentShareLink(
  userId: string,
  documentId: string,
): Promise<boolean> {
  const reference = decodeDashboardDocumentId(documentId);
  const verification = await buildVerificationDataInternal(userId, documentId);
  if (!verification) {
    return false;
  }

  return revokeDocumentShareLink({
    userId,
    documentId: reference.rawId,
    documentSourceKind: reference.sourceKind,
  });
}

export async function buildDashboardDocumentDownload(
  userId: string,
  documentId: string,
): Promise<{ fileName: string; buffer: Buffer; contentType: string } | null> {
  const reference = decodeDashboardDocumentId(documentId);

  if (reference.sourceKind === "uploaded") {
    const document = await getWorkspaceDocumentById(reference.rawId);
    if (!document || document.userId !== userId) {
      return null;
    }

    const file = await downloadWorkspaceDocumentFile(document);
    return {
      fileName: document.fileName,
      buffer: file.buffer,
      contentType: file.contentType,
    };
  }

  const contract = await getContractById(reference.rawId);
  if (!contract || contract.userId !== userId) {
    return null;
  }

  const content = normalizeContractContent(contract.content);
  if (!content) {
    return null;
  }

  const pdfBuffer = await buildContractPdfBuffer(content);
  return {
    fileName: `${sanitizeDownloadFileName(content.title || contract.title || "contract")}.pdf`,
    buffer: pdfBuffer,
    contentType: "application/pdf",
  };
}

function buildCertificateLines(verification: DashboardDocumentVerificationData) {
  const { document } = verification;
  const sectionTitle = {
    main: localeText("# Document Verification Certificate", "# 文档验真证书"),
    summary: localeText("## Summary", "## 摘要"),
    signatures: localeText("## Signatures", "## 签署记录"),
    evidence: localeText("## Evidence", "## 证据记录"),
    timeline: localeText("## Timeline", "## 时间线"),
  };

  return [
    sectionTitle.main,
    "",
    joinLine(localeText("Document ID", "文档编号"), `DOC-${document.id}`),
    joinLine(localeText("Source Kind", "来源类型"), document.sourceKind),
    joinLine(localeText("Raw Document ID", "原始文档 ID"), document.rawId),
    joinLine(localeText("Contract ID", "合同 ID"), document.contractId || "-"),
    joinLine(localeText("Document Name", "文档名称"), document.fileName),
    joinLine(localeText("Document Type", "文档类型"), document.documentType),
    joinLine(localeText("Verification Status", "验真状态"), verification.integrityStatus),
    joinLine(localeText("Contract Status", "合同状态"), document.contractStatus || "-"),
    joinLine(localeText("Signing Flow", "签署流程"), document.signFlowStatus || "-"),
    joinLine(localeText("Source Type", "来源渠道"), document.sourceType || "-"),
    joinLine(localeText("Category", "分类"), document.category),
    joinLine(localeText("Group", "分组"), document.groupName || "-"),
    joinLine(localeText("Tags", "标签"), document.tags.join(", ") || "-"),
    joinLine(localeText("Hash", "哈希"), verification.contentHash),
    joinLine(localeText("Uploaded At", "上传时间"), document.uploadedAt || "-"),
    joinLine(localeText("Updated At", "更新时间"), document.updatedAt || "-"),
    joinLine(localeText("Public Share URL", "公开分享链接"), verification.shareUrl || "-"),
    joinLine(localeText("Share Expires At", "分享失效时间"), verification.shareExpiresAt || "-"),
    joinLine(localeText("Share Access Count", "分享访问次数"), verification.shareAccessCount ?? 0),
    joinLine(localeText("Share Last Accessed At", "最近访问时间"), verification.shareLastAccessedAt || "-"),
    "",
    sectionTitle.summary,
    verification.integritySummary,
    "",
    sectionTitle.signatures,
    ...(verification.signatures.length > 0
      ? verification.signatures.map((signature) =>
          `- ${normalizeParticipantRole(signature.role)}: ${signature.signerName} | ${normalizeSignatureStatus(signature.status)} | ${signature.method || "-"} | ${signature.source || "-"} | ${signature.createdAt || "-"}`,
        )
      : [localeText("- No signature records attached to this document.", "- 当前文档暂无签署记录。")]),
    "",
    sectionTitle.evidence,
    ...verification.evidence.map((item) =>
      `- ${item.createdAt} | ${item.type} | ${item.label} | ${item.description}`,
    ),
    "",
    sectionTitle.timeline,
    ...verification.timeline.map((item) =>
      `- ${item.occurredAt} | ${item.type} | ${item.label} | ${item.description}`,
    ),
  ];
}

export async function buildDashboardDocumentCertificate(
  userId: string,
  documentId: string,
  origin?: string,
): Promise<{ fileName: string; content: string } | null> {
  const verification = await buildVerificationDataInternal(userId, documentId, origin);
  if (!verification) {
    return null;
  }

  return {
    fileName: `document-certificate-${verification.document.id.replace(/[:/\\]/g, "-")}.md`,
    content: buildCertificateLines(verification).join("\n"),
  };
}

export async function getPublicDashboardDocumentVerificationData(
  token: string,
  origin?: string,
): Promise<DashboardDocumentVerificationData | null> {
  const share = await getDocumentShareLinkByToken(token);
  if (!share || isShareExpired(share)) {
    return null;
  }

  const updatedShare = await incrementDocumentShareLinkAccess(share);
  const verification =
    updatedShare.documentSourceKind === "uploaded"
      ? await buildUploadedVerificationData(
          updatedShare.userId,
          updatedShare.documentId,
          origin,
          updatedShare,
        )
      : await buildContractVerificationData(updatedShare.userId, updatedShare.documentId, origin);

  if (!verification) {
    return null;
  }

  return {
    ...verification,
    shareUrl: buildShareUrl(origin, updatedShare.token),
    shareExpiresAt: updatedShare.expiresAt,
    shareAccessCount: updatedShare.accessCount,
    shareLastAccessedAt: updatedShare.lastAccessedAt,
    document: {
      ...verification.document,
      shareUrl: buildShareUrl(origin, updatedShare.token),
      shareExpiresAt: updatedShare.expiresAt,
      shareAccessCount: updatedShare.accessCount,
      shareLastAccessedAt: updatedShare.lastAccessedAt,
    },
  };
}

export async function buildPublicDashboardDocumentCertificate(
  token: string,
  origin?: string,
): Promise<{ fileName: string; content: string } | null> {
  const share = await getDocumentShareLinkByToken(token);
  if (!share || isShareExpired(share)) {
    return null;
  }

  const verification =
    share.documentSourceKind === "uploaded"
      ? await buildUploadedVerificationData(share.userId, share.documentId, origin, share)
      : await buildContractVerificationData(share.userId, share.documentId, origin);

  if (!verification) {
    return null;
  }

  return {
    fileName: `shared-document-certificate-${verification.document.id.replace(/[:/\\]/g, "-")}.md`,
    content: buildCertificateLines({
      ...verification,
      shareUrl: buildShareUrl(origin, share.token),
      shareExpiresAt: share.expiresAt,
      shareAccessCount: share.accessCount,
      shareLastAccessedAt: share.lastAccessedAt,
    }).join("\n"),
  };
}
