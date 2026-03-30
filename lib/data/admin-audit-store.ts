import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

export type AdminAuditStatus = "success" | "error" | "denied";
export type AdminAuditSeverity = "info" | "warn" | "error";

export interface AdminAuditLogRecord {
  id: string;
  actorUserId: string;
  action: string;
  message: string;
  path: string;
  method: string;
  ip: string;
  userAgent: string;
  status: AdminAuditStatus;
  severity: AdminAuditSeverity;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface PersistAdminAuditInput {
  actorUserId?: string;
  action?: string;
  message: string;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string | null;
  status?: AdminAuditStatus;
  severity?: AdminAuditSeverity;
  meta?: Record<string, unknown>;
}

interface ListAdminAuditOptions {
  page: number;
  limit: number;
  status?: string;
}

const AUDIT_COLLECTION = "admin_audit_logs";

function toSafeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toSafeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeAuditStatus(value: unknown): AdminAuditStatus {
  return value === "error" || value === "denied" ? value : "success";
}

function normalizeAuditSeverity(value: unknown): AdminAuditSeverity {
  return value === "warn" || value === "error" ? value : "info";
}

function normalizeAuditRecord(record: Record<string, any>): AdminAuditLogRecord {
  return {
    id: toSafeString(record.id || record._id),
    actorUserId: toSafeString(record.actor_user_id || record.actorUserId),
    action: toSafeString(record.action || record.message || "admin_event"),
    message: toSafeString(record.message || record.action || "Admin event"),
    path: toSafeString(record.path),
    method: toSafeString(record.method),
    ip: toSafeString(record.ip),
    userAgent: toSafeString(record.user_agent || record.userAgent),
    status: normalizeAuditStatus(record.status),
    severity: normalizeAuditSeverity(record.severity),
    meta: toSafeObject(record.meta),
    createdAt: toSafeString(record.created_at || record.createdAt),
  };
}

function buildAuditPayload(input: PersistAdminAuditInput) {
  const createdAt = new Date().toISOString();

  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    actor_user_id: toSafeString(input.actorUserId),
    action: toSafeString(input.action || input.message || "admin_event"),
    message: toSafeString(input.message, "Admin event"),
    path: toSafeString(input.path),
    method: toSafeString(input.method),
    ip: toSafeString(input.ip, "unknown"),
    user_agent: toSafeString(input.userAgent),
    status: normalizeAuditStatus(input.status),
    severity: normalizeAuditSeverity(input.severity),
    meta: toSafeObject(input.meta),
    created_at: createdAt,
  };
}

export async function persistAdminAuditLog(input: PersistAdminAuditInput) {
  const payload = buildAuditPayload(input);

  if (isChinaRegion()) {
    try {
      const db = getDatabase();
      await db.collection(AUDIT_COLLECTION).add(payload);
    } catch {
      // Best-effort persistence to avoid breaking admin flows.
    }
    return;
  }

  try {
    await getSupabaseAdmin().from(AUDIT_COLLECTION).insert(payload);
  } catch {
    // Best-effort persistence to avoid breaking admin flows.
  }
}

export function queueAdminAuditLog(input: PersistAdminAuditInput) {
  void persistAdminAuditLog(input);
}

async function listChinaAdminAuditLogs(options: ListAdminAuditOptions) {
  try {
    const db = getDatabase();
    const filters =
      options.status && options.status !== "all" ? { status: options.status } : {};
    const collection = db.collection(AUDIT_COLLECTION);
    const scopedCollection =
      Object.keys(filters).length > 0 ? collection.where(filters) : collection;

    const countResult = await scopedCollection.count();
    const result = await scopedCollection
      .orderBy("created_at", "desc")
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .get();

    return {
      items: (result.data || []).map((record: Record<string, any>) =>
        normalizeAuditRecord(record),
      ),
      total: countResult.total || 0,
    };
  } catch {
    return {
      items: [] as AdminAuditLogRecord[],
      total: 0,
    };
  }
}

async function listIntlAdminAuditLogs(options: ListAdminAuditOptions) {
  try {
    let query = getSupabaseAdmin()
      .from(AUDIT_COLLECTION)
      .select(
        "id,actor_user_id,action,message,path,method,ip,user_agent,status,severity,meta,created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (options.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }

    const from = (options.page - 1) * options.limit;
    const to = from + options.limit - 1;
    const { data, count, error } = await query.range(from, to);

    if (error) {
      throw error;
    }

    return {
      items: (data || []).map((record) =>
        normalizeAuditRecord(record as Record<string, any>),
      ),
      total: count || 0,
    };
  } catch {
    return {
      items: [] as AdminAuditLogRecord[],
      total: 0,
    };
  }
}

export async function listAdminAuditLogs(options: ListAdminAuditOptions) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(Math.max(1, options.limit || 20), 100);
  const normalizedOptions = {
    ...options,
    page,
    limit,
  };

  return isChinaRegion()
    ? listChinaAdminAuditLogs(normalizedOptions)
    : listIntlAdminAuditLogs(normalizedOptions);
}
