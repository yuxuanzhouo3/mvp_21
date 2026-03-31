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

export interface AdminAuditAlert {
  id: string;
  level: "warn" | "error";
  title: string;
  description: string;
  count: number;
}

export interface AdminAuditSummary {
  total: number;
  success: number;
  denied: number;
  error: number;
  severities: Record<AdminAuditSeverity, number>;
  topActions: Array<{ action: string; count: number }>;
  alerts: AdminAuditAlert[];
}

const AUDIT_COLLECTION = "admin_audit_logs";
const DEFAULT_MAX_LIMIT = 100;
const EXPORT_MAX_LIMIT = 5000;

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

function createAlert(
  id: string,
  level: "warn" | "error",
  title: string,
  description: string,
  count: number,
): AdminAuditAlert {
  return { id, level, title, description, count };
}

export function buildAdminAuditSummary(
  items: AdminAuditLogRecord[],
): AdminAuditSummary {
  const summary: AdminAuditSummary = {
    total: items.length,
    success: 0,
    denied: 0,
    error: 0,
    severities: {
      info: 0,
      warn: 0,
      error: 0,
    },
    topActions: [],
    alerts: [],
  };
  const actionCounts = new Map<string, number>();
  const denialActors = new Map<string, number>();

  for (const item of items) {
    summary[item.status] += 1;
    summary.severities[item.severity] += 1;

    const action = item.action || item.message || "admin_event";
    actionCounts.set(action, (actionCounts.get(action) || 0) + 1);

    if (item.status === "denied" && item.actorUserId) {
      denialActors.set(
        item.actorUserId,
        (denialActors.get(item.actorUserId) || 0) + 1,
      );
    }
  }

  summary.topActions = Array.from(actionCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([action, count]) => ({ action, count }));

  if (summary.error >= 3) {
    summary.alerts.push(
      createAlert(
        "error-spike",
        "error",
        "Error spike detected",
        "Multiple admin requests failed in the current result set. Review trace context and downstream data sources.",
        summary.error,
      ),
    );
  }

  if (summary.denied >= 3) {
    summary.alerts.push(
      createAlert(
        "denied-spike",
        "warn",
        "Denied access spike detected",
        "Repeated denied requests may indicate misconfigured permissions or suspicious access attempts.",
        summary.denied,
      ),
    );
  }

  if (summary.severities.error >= 1) {
    summary.alerts.push(
      createAlert(
        "high-severity-events",
        "error",
        "High severity events present",
        "At least one high-severity audit record is present in the selected time slice.",
        summary.severities.error,
      ),
    );
  }

  const repeatedDeniedActor = Array.from(denialActors.entries()).find(
    ([, count]) => count >= 3,
  );
  if (repeatedDeniedActor) {
    summary.alerts.push(
      createAlert(
        "repeat-denials-by-actor",
        "warn",
        "Single actor has repeated denials",
        `Actor ${repeatedDeniedActor[0]} triggered repeated denied requests and should be reviewed.`,
        repeatedDeniedActor[1],
      ),
    );
  }

  return summary;
}

function escapeCsvValue(value: unknown) {
  const normalized =
    typeof value === "string" ? value : value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function convertAdminAuditLogsToCsv(items: AdminAuditLogRecord[]) {
  const header = [
    "id",
    "createdAt",
    "status",
    "severity",
    "action",
    "message",
    "method",
    "path",
    "actorUserId",
    "ip",
    "userAgent",
    "meta",
  ];

  const rows = items.map((item) =>
    [
      item.id,
      item.createdAt,
      item.status,
      item.severity,
      item.action,
      item.message,
      item.method,
      item.path,
      item.actorUserId,
      item.ip,
      item.userAgent,
      JSON.stringify(item.meta || {}),
    ]
      .map(escapeCsvValue)
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
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
    await (getSupabaseAdmin().from(AUDIT_COLLECTION) as any).insert(payload);
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
  const maxLimit =
    options.limit > DEFAULT_MAX_LIMIT ? EXPORT_MAX_LIMIT : DEFAULT_MAX_LIMIT;
  const limit = Math.min(Math.max(1, options.limit || 20), maxLimit);
  const normalizedOptions = {
    ...options,
    page,
    limit,
  };

  return isChinaRegion()
    ? listChinaAdminAuditLogs(normalizedOptions)
    : listIntlAdminAuditLogs(normalizedOptions);
}
