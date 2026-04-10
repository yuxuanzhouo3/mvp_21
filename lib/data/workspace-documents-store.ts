import { randomBytes } from "node:crypto";
import path from "node:path";

import {
  deleteFileFromCloudBase,
  downloadFileFromCloudBase,
  getDatabase,
  uploadFileToCloudBase,
} from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

export interface WorkspaceDocumentRecord {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  category: string;
  groupName: string;
  tags: string[];
  contentType?: string;
  sizeBytes: number;
  hash: string;
  storagePath: string;
  storageProvider: "cloudbase" | "supabase";
  previewText?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceDocumentShareRecord {
  id: string;
  userId: string;
  documentId: string;
  documentSourceKind: "contract" | "uploaded";
  token: string;
  expiresAt?: string;
  accessCount: number;
  lastAccessedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

function getIntlTable(table: string) {
  return getSupabaseAdmin().from(table as any) as any;
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTags(value: unknown) {
  const source = Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : ""))
    : typeof value === "string" && value.trim()
      ? value.split(",")
      : [];

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const raw of source) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(tag);
    if (deduped.length >= 10) break;
  }

  return deduped;
}

function normalizeGroupName(value: unknown, fallback = "Workspace") {
  const text = toStringValue(value).trim();
  return text || fallback;
}

function normalizeWorkspaceDocumentRecord(record: Record<string, any>): WorkspaceDocumentRecord {
  return {
    id: String(record.id || record._id || ""),
    userId: String(record.user_id || record.userId || ""),
    title: toStringValue(record.title || record.name || record.file_name || record.fileName),
    fileName: toStringValue(record.file_name || record.fileName || record.name),
    category: toStringValue(record.category, "General"),
    groupName: normalizeGroupName(record.group_name || record.groupName, "Workspace"),
    tags: normalizeTags(record.tags),
    contentType: toStringValue(record.content_type || record.contentType) || undefined,
    sizeBytes: toNumberValue(record.size_bytes || record.sizeBytes),
    hash: toStringValue(record.hash),
    storagePath: toStringValue(record.storage_path || record.storagePath),
    storageProvider:
      toStringValue(record.storage_provider || record.storageProvider) === "supabase"
        ? "supabase"
        : "cloudbase",
    previewText: toStringValue(record.preview_text || record.previewText) || undefined,
    createdAt: toStringValue(record.created_at || record.createdAt) || undefined,
    updatedAt: toStringValue(record.updated_at || record.updatedAt) || undefined,
  };
}

function normalizeShareRecord(record: Record<string, any>): WorkspaceDocumentShareRecord {
  return {
    id: String(record.id || record._id || ""),
    userId: String(record.user_id || record.userId || ""),
    documentId: String(record.document_id || record.documentId || ""),
    documentSourceKind:
      toStringValue(record.document_source_kind || record.documentSourceKind) === "uploaded"
        ? "uploaded"
        : "contract",
    token: toStringValue(record.token),
    expiresAt: toStringValue(record.expires_at || record.expiresAt) || undefined,
    accessCount: toNumberValue(record.access_count || record.accessCount, 0),
    lastAccessedAt: toStringValue(record.last_accessed_at || record.lastAccessedAt) || undefined,
    createdAt: toStringValue(record.created_at || record.createdAt) || undefined,
    updatedAt: toStringValue(record.updated_at || record.updatedAt) || undefined,
  };
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function buildUploadKey(fileName: string) {
  const ext = path.extname(fileName);
  const name = path.basename(fileName, ext);
  return `workspace-documents/${Date.now()}-${sanitizeFileName(name)}${ext}`;
}

function getDocumentSelectFields() {
  return "id,user_id,title,file_name,category,group_name,tags,content_type,size_bytes,hash,storage_path,storage_provider,preview_text,created_at,updated_at";
}

function getShareSelectFields() {
  return "id,user_id,document_id,document_source_kind,token,expires_at,access_count,last_accessed_at,created_at,updated_at";
}

export async function listWorkspaceDocumentsByUser(userId: string): Promise<WorkspaceDocumentRecord[]> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("workspace_documents")
      .where({ user_id: userId })
      .orderBy("updated_at", "desc")
      .get()
      .catch(() => ({ data: [] }));

    return (result.data || []).map((item: Record<string, any>) =>
      normalizeWorkspaceDocumentRecord(item),
    );
  }

  const { data, error } = await getIntlTable("workspace_documents")
    .select(getDocumentSelectFields())
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data || []).map((item: Record<string, any>) =>
    normalizeWorkspaceDocumentRecord(item),
  );
}

export async function getWorkspaceDocumentById(id: string): Promise<WorkspaceDocumentRecord | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("workspace_documents").doc(id).get().catch(() => null);
    const record = result?.data?.[0] as Record<string, any> | undefined;
    return record ? normalizeWorkspaceDocumentRecord(record) : null;
  }

  const { data, error } = await getIntlTable("workspace_documents")
    .select(getDocumentSelectFields())
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return normalizeWorkspaceDocumentRecord(data as Record<string, any>);
}

export async function createWorkspaceDocument(input: {
  userId: string;
  title: string;
  fileName: string;
  category: string;
  groupName?: string;
  tags: string[];
  contentType?: string;
  sizeBytes: number;
  hash: string;
  previewText?: string;
  fileContent: Buffer;
}): Promise<WorkspaceDocumentRecord> {
  const now = new Date().toISOString();
  const uploadKey = buildUploadKey(input.fileName);
  const payload = {
    user_id: input.userId,
    title: input.title,
    file_name: input.fileName,
    category: input.category || "General",
    group_name: normalizeGroupName(input.groupName, "Workspace"),
    tags: normalizeTags(input.tags),
    content_type: input.contentType || "",
    size_bytes: input.sizeBytes,
    hash: input.hash,
    preview_text: input.previewText || "",
    created_at: now,
    updated_at: now,
  };

  if (isChinaRegion()) {
    const uploaded = await uploadFileToCloudBase(uploadKey, input.fileContent);
    const db = getDatabase();
    const result = await db.collection("workspace_documents").add({
      ...payload,
      storage_path: uploaded.fileID,
      storage_provider: "cloudbase",
    });

    return normalizeWorkspaceDocumentRecord({
      ...payload,
      storage_path: uploaded.fileID,
      storage_provider: "cloudbase",
      _id: result.id,
    });
  }

  const storage = getSupabaseAdmin().storage.from("files");
  const uploadResult = await storage.upload(uploadKey, input.fileContent, {
    contentType: input.contentType || "application/octet-stream",
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const { data, error } = await getIntlTable("workspace_documents")
    .insert({
      ...payload,
      storage_path: uploadResult.data.path,
      storage_provider: "supabase",
    })
    .select(getDocumentSelectFields())
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create workspace document");
  }

  return normalizeWorkspaceDocumentRecord(data as Record<string, any>);
}

export async function downloadWorkspaceDocumentFile(document: WorkspaceDocumentRecord): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  if (document.storageProvider === "cloudbase") {
    const buffer = await downloadFileFromCloudBase(document.storagePath);
    return {
      buffer,
      contentType: document.contentType || "application/octet-stream",
    };
  }

  const storage = getSupabaseAdmin().storage.from("files");
  const { data, error } = await storage.download(document.storagePath);
  if (error || !data) {
    throw error || new Error("Failed to download workspace document");
  }

  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: document.contentType || data.type || "application/octet-stream",
  };
}

export async function createOrReuseDocumentShareLink(input: {
  userId: string;
  documentId: string;
  documentSourceKind: "contract" | "uploaded";
  expiresAt?: string | null;
}): Promise<WorkspaceDocumentShareRecord> {
  const now = new Date().toISOString();
  const normalizedExpiresAt = typeof input.expiresAt === "string" && input.expiresAt.trim()
    ? input.expiresAt
    : null;

  if (isChinaRegion()) {
    const db = getDatabase();
    const existing = await db
      .collection("document_share_links")
      .where({
        user_id: input.userId,
        document_id: input.documentId,
        document_source_kind: input.documentSourceKind,
      })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }));

    const record = (existing.data || [])[0] as Record<string, any> | undefined;
    if (record) {
      await db
        .collection("document_share_links")
        .doc(String(record._id || record.id))
        .update({
          expires_at: normalizedExpiresAt || "",
          updated_at: now,
        })
        .catch(() => null);

      return normalizeShareRecord({
        ...record,
        expires_at: normalizedExpiresAt || "",
        updated_at: now,
      });
    }

    const payload = {
      user_id: input.userId,
      document_id: input.documentId,
      document_source_kind: input.documentSourceKind,
      token: randomBytes(18).toString("hex"),
      expires_at: normalizedExpiresAt || "",
      access_count: 0,
      last_accessed_at: "",
      created_at: now,
      updated_at: now,
    };
    const result = await db.collection("document_share_links").add(payload);
    return normalizeShareRecord({
      ...payload,
      _id: result.id,
    });
  }

  const { data: existingData, error: existingError } = await getIntlTable("document_share_links")
    .select(getShareSelectFields())
    .eq("user_id", input.userId)
    .eq("document_id", input.documentId)
    .eq("document_source_kind", input.documentSourceKind)
    .limit(1)
    .maybeSingle();

  if (!existingError && existingData) {
    const { data, error } = await getIntlTable("document_share_links")
      .update({
        expires_at: normalizedExpiresAt,
        updated_at: now,
      })
      .eq("id", String((existingData as Record<string, any>).id))
      .select(getShareSelectFields())
      .single();

    if (!error && data) {
      return normalizeShareRecord(data as Record<string, any>);
    }

    return normalizeShareRecord(existingData as Record<string, any>);
  }

  const payload = {
    user_id: input.userId,
    document_id: input.documentId,
    document_source_kind: input.documentSourceKind,
    token: randomBytes(18).toString("hex"),
    expires_at: normalizedExpiresAt,
    access_count: 0,
    last_accessed_at: null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await getIntlTable("document_share_links")
    .insert(payload)
    .select(getShareSelectFields())
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create share link");
  }

  return normalizeShareRecord(data as Record<string, any>);
}

export async function listDocumentShareLinksByUser(
  userId: string,
): Promise<WorkspaceDocumentShareRecord[]> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("document_share_links")
      .where({ user_id: userId })
      .get()
      .catch(() => ({ data: [] }));

    return (result.data || []).map((item: Record<string, any>) => normalizeShareRecord(item));
  }

  const { data, error } = await getIntlTable("document_share_links")
    .select(getShareSelectFields())
    .eq("user_id", userId);

  if (error) {
    return [];
  }

  return (data || []).map((item: Record<string, any>) => normalizeShareRecord(item));
}

export async function getDocumentShareLinkByDocument(input: {
  userId: string;
  documentId: string;
  documentSourceKind: "contract" | "uploaded";
}): Promise<WorkspaceDocumentShareRecord | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("document_share_links")
      .where({
        user_id: input.userId,
        document_id: input.documentId,
        document_source_kind: input.documentSourceKind,
      })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }));

    const record = (result.data || [])[0] as Record<string, any> | undefined;
    return record ? normalizeShareRecord(record) : null;
  }

  const { data, error } = await getIntlTable("document_share_links")
    .select(getShareSelectFields())
    .eq("user_id", input.userId)
    .eq("document_id", input.documentId)
    .eq("document_source_kind", input.documentSourceKind)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeShareRecord(data as Record<string, any>);
}

export async function revokeDocumentShareLink(input: {
  userId: string;
  documentId: string;
  documentSourceKind: "contract" | "uploaded";
}): Promise<boolean> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("document_share_links")
      .where({
        user_id: input.userId,
        document_id: input.documentId,
        document_source_kind: input.documentSourceKind,
      })
      .remove()
      .catch(() => ({ deleted: 0 }));

    return Number(result.deleted || 0) > 0;
  }

  const { error, count } = await getIntlTable("document_share_links")
    .delete({ count: "exact" })
    .eq("user_id", input.userId)
    .eq("document_id", input.documentId)
    .eq("document_source_kind", input.documentSourceKind);

  if (error) {
    return false;
  }

  return Number(count || 0) > 0;
}

export async function getDocumentShareLinkByToken(token: string): Promise<WorkspaceDocumentShareRecord | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("document_share_links")
      .where({ token })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }));

    const record = (result.data || [])[0] as Record<string, any> | undefined;
    return record ? normalizeShareRecord(record) : null;
  }

  const { data, error } = await getIntlTable("document_share_links")
    .select(getShareSelectFields())
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeShareRecord(data as Record<string, any>);
}

export async function incrementDocumentShareLinkAccess(
  share: WorkspaceDocumentShareRecord,
): Promise<WorkspaceDocumentShareRecord> {
  const now = new Date().toISOString();
  const nextCount = (share.accessCount || 0) + 1;

  if (isChinaRegion()) {
    const db = getDatabase();
    await db
      .collection("document_share_links")
      .doc(share.id)
      .update({
        access_count: nextCount,
        last_accessed_at: now,
        updated_at: now,
      })
      .catch(() => null);

    return {
      ...share,
      accessCount: nextCount,
      lastAccessedAt: now,
      updatedAt: now,
    };
  }

  const { data, error } = await getIntlTable("document_share_links")
    .update({
      access_count: nextCount,
      last_accessed_at: now,
      updated_at: now,
    })
    .eq("id", share.id)
    .select(getShareSelectFields())
    .single();

  if (error || !data) {
    return {
      ...share,
      accessCount: nextCount,
      lastAccessedAt: now,
      updatedAt: now,
    };
  }

  return normalizeShareRecord(data as Record<string, any>);
}

export async function updateWorkspaceDocument(
  document: WorkspaceDocumentRecord,
  patch: Partial<{
    title: string;
    category: string;
    groupName: string;
    tags: string[];
  }>,
): Promise<WorkspaceDocumentRecord> {
  const now = new Date().toISOString();
  const payload = {
    title: typeof patch.title === "string" ? patch.title.trim() || document.title : document.title,
    category:
      typeof patch.category === "string"
        ? patch.category.trim() || document.category || "General"
        : document.category || "General",
    group_name:
      typeof patch.groupName === "string"
        ? normalizeGroupName(patch.groupName, document.groupName || "Workspace")
        : normalizeGroupName(document.groupName, "Workspace"),
    tags: Array.isArray(patch.tags) ? normalizeTags(patch.tags) : normalizeTags(document.tags),
    updated_at: now,
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    await db
      .collection("workspace_documents")
      .doc(document.id)
      .update({
        title: payload.title,
        category: payload.category,
        group_name: payload.group_name,
        tags: payload.tags,
        updated_at: payload.updated_at,
      })
      .catch(() => null);

    return normalizeWorkspaceDocumentRecord({
      ...document,
      title: payload.title,
      category: payload.category,
      group_name: payload.group_name,
      tags: payload.tags,
      updated_at: payload.updated_at,
    });
  }

  const { data, error } = await getIntlTable("workspace_documents")
    .update({
      title: payload.title,
      category: payload.category,
      group_name: payload.group_name,
      tags: payload.tags,
      updated_at: payload.updated_at,
    })
    .eq("id", document.id)
    .select(getDocumentSelectFields())
    .single();

  if (error || !data) {
    throw error || new Error("Failed to update workspace document");
  }

  return normalizeWorkspaceDocumentRecord(data as Record<string, any>);
}

export async function updateWorkspaceDocumentsTags(input: {
  userId: string;
  documentIds: string[];
  mode: "add" | "replace" | "remove";
  tags: string[];
}): Promise<WorkspaceDocumentRecord[]> {
  const desiredTags = normalizeTags(input.tags);
  const records = await Promise.all(input.documentIds.map((id) => getWorkspaceDocumentById(id)));
  const ownedDocuments = records.filter(
    (item): item is WorkspaceDocumentRecord => Boolean(item && item.userId === input.userId),
  );

  return Promise.all(
    ownedDocuments.map(async (document) => {
      const current = normalizeTags(document.tags);
      let nextTags = current;

      if (input.mode === "replace") {
        nextTags = desiredTags;
      } else if (input.mode === "add") {
        nextTags = Array.from(new Set([...current, ...desiredTags])).slice(0, 10);
      } else if (input.mode === "remove") {
        const removeSet = new Set(desiredTags);
        nextTags = current.filter((tag) => !removeSet.has(tag));
      }

      return updateWorkspaceDocument(document, {
        tags: nextTags,
      });
    }),
  );
}

export async function updateWorkspaceDocumentsOrganization(input: {
  userId: string;
  documentIds: string[];
  category?: string;
  groupName?: string;
}): Promise<WorkspaceDocumentRecord[]> {
  const records = await Promise.all(input.documentIds.map((id) => getWorkspaceDocumentById(id)));
  const ownedDocuments = records.filter(
    (item): item is WorkspaceDocumentRecord => Boolean(item && item.userId === input.userId),
  );

  return Promise.all(
    ownedDocuments.map((document) =>
      updateWorkspaceDocument(document, {
        category: input.category,
        groupName: input.groupName,
      }),
    ),
  );
}

export async function deleteWorkspaceDocument(document: WorkspaceDocumentRecord): Promise<void> {
  if (document.storageProvider === "cloudbase") {
    await deleteFileFromCloudBase([document.storagePath]);
    const db = getDatabase();
    await db
      .collection("document_share_links")
      .where({
        user_id: document.userId,
        document_id: document.id,
        document_source_kind: "uploaded",
      })
      .remove()
      .catch(() => null);
    await db.collection("workspace_documents").doc(document.id).remove().catch(() => null);
    return;
  }

  await getSupabaseAdmin().storage.from("files").remove([document.storagePath]);
  await getIntlTable("document_share_links")
    .delete()
    .eq("user_id", document.userId)
    .eq("document_id", document.id)
    .eq("document_source_kind", "uploaded");
  await getIntlTable("workspace_documents").delete().eq("id", document.id);
}
