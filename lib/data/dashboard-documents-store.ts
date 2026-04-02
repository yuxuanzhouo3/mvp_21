import { createHash } from "node:crypto";

import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import {
  buildContractHtml,
  buildContractPdfBuffer,
  normalizeContractContent,
  sanitizeDownloadFileName,
} from "@/lib/contracts/format";
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
    return "N/A";
  }

  if (hours >= 24) {
    return `${(hours / 24).toFixed(hours >= 48 ? 0 : 1)} d`;
  }

  return `${hours.toFixed(hours >= 10 ? 0 : 1)} h`;
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
  return value && value.trim() ? value.trim() : "General";
}

function normalizeGroupName(value?: string | null) {
  return value && value.trim() ? value.trim() : "Workspace";
}

function normalizeTags(tags: string[]) {
  return tags
    .map((item) => item.trim())
    .filter(Boolean)
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
  const fileName = `${contract.title || "contract"}${verified ? ".pdf" : ".draft"}`;
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
    title: contract.title || "Untitled Contract",
    fileName,
    documentType: verified ? "contract" : "draft",
    verificationStatus: verified ? "verified" : "pending",
    contractStatus: contract.status,
    signFlowStatus: enhancement.signFlow.status,
    sourceType: contract.sourceType,
    category: normalizeCategory(contract.type || "Contract"),
    groupName: "Contracts",
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
    title: document.title || document.fileName || "Uploaded Document",
    fileName: document.fileName || "uploaded-document",
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
      label: "Draft created",
      description: "The contract draft record was created.",
      occurredAt: contract.createdAt,
      type: "created",
    });
  }

  if (enhancement.signFlow.initiatedAt) {
    events.push({
      id: `${contract.id}-signing-started`,
      label: "Signing started",
      description: "The signing workflow was launched.",
      occurredAt: enhancement.signFlow.initiatedAt,
      type: "signing",
    });
  }

  enhancement.signFlow.participants.forEach((participant) => {
    if (!participant.confirmedAt) return;
    events.push({
      id: `${contract.id}-${participant.role}-confirmed`,
      label: participant.role === "sender" ? "Sender confirmed" : "Counterparty confirmed",
      description: `${participant.name} confirmed the signature package.`,
      occurredAt: participant.confirmedAt,
      type: "signature",
    });
  });

  enhancement.signFlow.reminders.forEach((reminder) => {
    events.push({
      id: reminder.id,
      label: "Reminder sent",
      description: reminder.note || `Reminder sent to ${reminder.target}.`,
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
      label: "Final copy retained",
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
      label: "Document uploaded",
      description: `${document.fileName} entered the workspace document center.`,
      occurredAt: document.createdAt,
      type: "created",
    });
  }

  if (document.updatedAt && document.updatedAt !== document.createdAt) {
    events.push({
      id: `${document.id}-updated`,
      label: "Metadata updated",
      description: "Document metadata was refreshed in the workspace document center.",
      occurredAt: document.updatedAt,
      type: "update",
    });
  }

  if (share) {
    events.push({
      id: `${document.id}-shared`,
      label: isShareExpired(share) ? "Share link expired" : "Share link active",
      description: isShareExpired(share)
        ? "The public verification link is no longer valid."
        : "A public verification page is active for this document.",
      occurredAt: share.updatedAt || share.createdAt || document.updatedAt || document.createdAt || new Date().toISOString(),
      type: "update",
    });
  }

  if (share?.lastAccessedAt) {
    events.push({
      id: `${document.id}-shared-accessed`,
      label: "Shared page visited",
      description: `The public verification page has been opened ${share.accessCount} times.`,
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
        ? "The document hash, signing participants, and retained copy are all backed by live contract workflow data."
        : "The draft exists, but the signing workflow or retained final copy is not complete yet.",
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
      label: "SHA-256 hash recorded",
      description: "The uploaded file hash was calculated and stored when the document entered the workspace.",
      createdAt: documentRecord.createdAt || documentRecord.updatedAt || new Date().toISOString(),
      type: "hash",
    },
    {
      id: `${documentRecord.id}-storage`,
      label: "Storage receipt retained",
      description: `The original file is retained through ${documentRecord.storageProvider}.`,
      createdAt: documentRecord.createdAt || documentRecord.updatedAt || new Date().toISOString(),
      type: "storage",
    },
    {
      id: `${documentRecord.id}-metadata`,
      label: "Classification metadata stored",
      description: `Category: ${normalizeCategory(documentRecord.category)} | Group: ${normalizeGroupName(documentRecord.groupName)} | Tags: ${normalizeTags(documentRecord.tags).join(", ") || "-"}`,
      createdAt: documentRecord.updatedAt || documentRecord.createdAt || new Date().toISOString(),
      type: "metadata",
    },
  ];

  if (share) {
    evidence.push({
      id: `${documentRecord.id}-share`,
      label: isShareExpired(share) ? "Share link expired" : "Share link active",
      description: isShareExpired(share)
        ? "The public verification link has passed its effective period."
        : `Public verification is available${share.expiresAt ? ` until ${share.expiresAt}` : ""}.`,
      createdAt: share.updatedAt || share.createdAt || new Date().toISOString(),
      type: "share",
    });
    evidence.push({
      id: `${documentRecord.id}-share-access`,
      label: "Share access statistics",
      description: `This shared page has been opened ${share.accessCount} times.`,
      createdAt: share.lastAccessedAt || share.updatedAt || share.createdAt || new Date().toISOString(),
      type: "share_access",
    });
  }

  return {
    document,
    integrityStatus: document.verificationStatus,
    integritySummary:
      "The uploaded document has a stored content hash, retained original file, and workspace audit metadata.",
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

  const pdfBuffer = buildContractPdfBuffer(content);
  return {
    fileName: `${sanitizeDownloadFileName(content.title || contract.title || "contract")}.pdf`,
    buffer: pdfBuffer,
    contentType: "application/pdf",
  };
}

function buildCertificateLines(verification: DashboardDocumentVerificationData) {
  const { document } = verification;

  return [
    "# Document Verification Certificate",
    "",
    joinLine("Document ID", `DOC-${document.id}`),
    joinLine("Source Kind", document.sourceKind),
    joinLine("Raw Document ID", document.rawId),
    joinLine("Contract ID", document.contractId || "-"),
    joinLine("Document Name", document.fileName),
    joinLine("Document Type", document.documentType),
    joinLine("Verification Status", verification.integrityStatus),
    joinLine("Contract Status", document.contractStatus || "-"),
    joinLine("Signing Flow", document.signFlowStatus || "-"),
    joinLine("Source Type", document.sourceType || "-"),
    joinLine("Category", document.category),
    joinLine("Group", document.groupName || "-"),
    joinLine("Tags", document.tags.join(", ") || "-"),
    joinLine("Hash", verification.contentHash),
    joinLine("Uploaded At", document.uploadedAt || "-"),
    joinLine("Updated At", document.updatedAt || "-"),
    joinLine("Public Share URL", verification.shareUrl || "-"),
    joinLine("Share Expires At", verification.shareExpiresAt || "-"),
    joinLine("Share Access Count", verification.shareAccessCount ?? 0),
    joinLine("Share Last Accessed At", verification.shareLastAccessedAt || "-"),
    "",
    "## Summary",
    verification.integritySummary,
    "",
    "## Signatures",
    ...(verification.signatures.length > 0
      ? verification.signatures.map((signature) =>
          `- ${signature.role}: ${signature.signerName} | ${signature.status} | ${signature.method || "-"} | ${signature.source || "-"} | ${signature.createdAt || "-"}`,
        )
      : ["- No signature records attached to this document."]),
    "",
    "## Evidence",
    ...verification.evidence.map((item) =>
      `- ${item.createdAt} | ${item.type} | ${item.label} | ${item.description}`,
    ),
    "",
    "## Timeline",
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
