import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

export type PaymentFailureNotificationStatus =
  | "queued"
  | "processing"
  | "sent"
  | "partial"
  | "failed"
  | "suppressed";

export interface PaymentFailureNotificationDeliveryAttempt {
  channel: "user-email" | "admin-email";
  recipient: string;
  attemptedAt: string;
  status: "sent" | "failed" | "skipped";
  detail?: string;
}

export interface PaymentFailureNotificationRecord {
  id: string;
  userId: string;
  provider: string;
  paymentReference: string;
  subscriptionReference?: string;
  amount?: number;
  currency?: string;
  reason?: string;
  nextPaymentAttempt?: string;
  notificationChannels: {
    userEmailEnabled: boolean;
    adminAlertEnabled: boolean;
  };
  adminRecipients?: string;
  status: PaymentFailureNotificationStatus;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  nextDispatchAt?: string;
  sentAt?: string;
  deliveryLog: PaymentFailureNotificationDeliveryAttempt[];
  createdAt: string;
  updatedAt?: string;
}

interface QueuePaymentFailureNotificationInput {
  userId: string;
  provider: string;
  paymentReference: string;
  subscriptionReference?: string;
  amount?: number;
  currency?: string;
  reason?: string;
  nextPaymentAttempt?: string;
}

interface UpdatePaymentFailureNotificationInput {
  status?: PaymentFailureNotificationStatus;
  attemptCount?: number;
  maxAttempts?: number;
  lastAttemptAt?: string | null;
  lastError?: string | null;
  nextDispatchAt?: string | null;
  sentAt?: string | null;
  deliveryLog?: PaymentFailureNotificationDeliveryAttempt[];
  updatedAt?: string;
}

const MAX_NOTIFICATION_ATTEMPTS = 5;

function buildNotificationId(input: QueuePaymentFailureNotificationInput) {
  return [
    "payment-failure",
    input.provider,
    input.userId,
    input.paymentReference.replace(/[^a-zA-Z0-9_-]/g, "-"),
  ].join("-");
}

function normalizeDeliveryLog(
  value: unknown,
): PaymentFailureNotificationDeliveryAttempt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value.map((item): PaymentFailureNotificationDeliveryAttempt | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const channel = row.channel === "admin-email" ? "admin-email" : row.channel === "user-email" ? "user-email" : null;
      const recipient = typeof row.recipient === "string" ? row.recipient : "";
      const attemptedAt = typeof row.attemptedAt === "string" ? row.attemptedAt : "";
      const status =
        row.status === "failed" || row.status === "skipped" || row.status === "sent"
          ? row.status
          : null;

      if (!channel || !recipient || !attemptedAt || !status) {
        return null;
      }

      return {
        channel,
        recipient,
        attemptedAt,
        status,
        detail: typeof row.detail === "string" ? row.detail : undefined,
      };
    })
    .filter((item): item is PaymentFailureNotificationDeliveryAttempt => item !== null);

  return normalized;
}

function normalizeNotificationStatus(value: unknown): PaymentFailureNotificationStatus {
  switch (value) {
    case "processing":
    case "sent":
    case "partial":
    case "failed":
    case "suppressed":
      return value;
    default:
      return "queued";
  }
}

function normalizeNotificationRecord(row: Record<string, unknown>): PaymentFailureNotificationRecord {
  return {
    id: String(row.id || row._id || ""),
    userId: String(row.userId || row.user_id || ""),
    provider: String(row.provider || ""),
    paymentReference: String(row.paymentReference || row.payment_reference || ""),
    subscriptionReference:
      typeof row.subscriptionReference === "string"
        ? row.subscriptionReference
        : typeof row.subscription_reference === "string"
          ? row.subscription_reference
          : undefined,
    amount:
      typeof row.amount === "number"
        ? row.amount
        : typeof row.amount === "string" && row.amount.length
          ? Number(row.amount)
          : undefined,
    currency:
      typeof row.currency === "string" && row.currency.length ? row.currency : undefined,
    reason: typeof row.reason === "string" && row.reason.length ? row.reason : undefined,
    nextPaymentAttempt:
      typeof row.nextPaymentAttempt === "string"
        ? row.nextPaymentAttempt
        : typeof row.next_payment_attempt === "string"
          ? row.next_payment_attempt
          : undefined,
    notificationChannels:
      typeof row.notificationChannels === "object" && row.notificationChannels
        ? (row.notificationChannels as PaymentFailureNotificationRecord["notificationChannels"])
        : typeof row.notification_channels === "object" && row.notification_channels
          ? (row.notification_channels as PaymentFailureNotificationRecord["notificationChannels"])
          : {
              userEmailEnabled: false,
              adminAlertEnabled: false,
            },
    adminRecipients:
      typeof row.adminRecipients === "string"
        ? row.adminRecipients
        : typeof row.admin_recipients === "string"
          ? row.admin_recipients
          : undefined,
    status: normalizeNotificationStatus(row.status),
    attemptCount:
      typeof row.attemptCount === "number"
        ? row.attemptCount
        : typeof row.attempt_count === "number"
          ? row.attempt_count
          : 0,
    maxAttempts:
      typeof row.maxAttempts === "number"
        ? row.maxAttempts
        : typeof row.max_attempts === "number"
          ? row.max_attempts
          : MAX_NOTIFICATION_ATTEMPTS,
    lastAttemptAt:
      typeof row.lastAttemptAt === "string"
        ? row.lastAttemptAt
        : typeof row.last_attempt_at === "string"
          ? row.last_attempt_at
          : undefined,
    lastError:
      typeof row.lastError === "string"
        ? row.lastError
        : typeof row.last_error === "string"
          ? row.last_error
          : undefined,
    nextDispatchAt:
      typeof row.nextDispatchAt === "string"
        ? row.nextDispatchAt
        : typeof row.next_dispatch_at === "string"
          ? row.next_dispatch_at
          : undefined,
    sentAt:
      typeof row.sentAt === "string"
        ? row.sentAt
        : typeof row.sent_at === "string"
          ? row.sent_at
          : undefined,
    deliveryLog: normalizeDeliveryLog(row.deliveryLog ?? row.delivery_log),
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : typeof row.created_at === "string"
          ? row.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof row.updatedAt === "string"
        ? row.updatedAt
        : typeof row.updated_at === "string"
          ? row.updated_at
          : undefined,
  };
}

function buildPersistencePayload(
  record: PaymentFailureNotificationRecord,
  updatedAt: string,
) {
  return {
    id: record.id,
    user_id: record.userId,
    provider: record.provider,
    payment_reference: record.paymentReference,
    subscription_reference: record.subscriptionReference || null,
    amount: record.amount ?? null,
    currency: record.currency || null,
    reason: record.reason || null,
    next_payment_attempt: record.nextPaymentAttempt || null,
    notification_channels: record.notificationChannels,
    admin_recipients: record.adminRecipients || null,
    status: record.status,
    attempt_count: record.attemptCount,
    max_attempts: record.maxAttempts,
    last_attempt_at: record.lastAttemptAt || null,
    last_error: record.lastError || null,
    next_dispatch_at: record.nextDispatchAt || null,
    sent_at: record.sentAt || null,
    delivery_log: record.deliveryLog,
    created_at: record.createdAt,
    updated_at: updatedAt,
  };
}

async function persistNotificationRecord(record: PaymentFailureNotificationRecord) {
  const updatedAt = record.updatedAt || new Date().toISOString();

  if (isChinaRegion()) {
    const db = getDatabase();
    const existing = await db
      .collection("payment_failure_notifications")
      .where({ id: record.id })
      .limit(1)
      .get();

    const row = existing.data?.[0] as Record<string, unknown> | undefined;
    if (row?._id && typeof row._id === "string") {
      await db.collection("payment_failure_notifications").doc(row._id).update({
        ...record,
        updated_at: updatedAt,
      });
    } else {
      await db.collection("payment_failure_notifications").add({
        ...record,
        created_at: record.createdAt,
        updated_at: updatedAt,
      });
    }

    return;
  }

  const admin = getSupabaseAdmin() as any;
  const { error } = await admin
    .from("payment_failure_notifications")
    .upsert(buildPersistencePayload(record, updatedAt), { onConflict: "id" });

  if (error) {
    throw error;
  }
}

export async function queuePaymentFailureNotification(
  input: QueuePaymentFailureNotificationInput,
): Promise<PaymentFailureNotificationRecord> {
  const settings = await loadAdminSettings();
  const createdAt = new Date().toISOString();
  const record: PaymentFailureNotificationRecord = {
    id: buildNotificationId(input),
    userId: input.userId,
    provider: input.provider,
    paymentReference: input.paymentReference,
    subscriptionReference: input.subscriptionReference,
    amount: input.amount,
    currency: input.currency,
    reason: input.reason,
    nextPaymentAttempt: input.nextPaymentAttempt,
    notificationChannels: {
      userEmailEnabled: settings.notification.email.paymentFailure,
      adminAlertEnabled: settings.notification.admin.exceptionAlerts,
    },
    adminRecipients: settings.notification.admin.notificationEmails,
    status:
      settings.notification.email.paymentFailure || settings.notification.admin.exceptionAlerts
        ? "queued"
        : "suppressed",
    attemptCount: 0,
    maxAttempts: MAX_NOTIFICATION_ATTEMPTS,
    nextDispatchAt: createdAt,
    deliveryLog: [],
    createdAt,
    updatedAt: createdAt,
  };

  await persistNotificationRecord(record);
  return record;
}

export async function getPaymentFailureNotificationById(
  id: string,
): Promise<PaymentFailureNotificationRecord | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("payment_failure_notifications")
      .where({ id })
      .limit(1)
      .get();

    const row = result.data?.[0] as Record<string, unknown> | undefined;
    return row ? normalizeNotificationRecord(row) : null;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("payment_failure_notifications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeNotificationRecord(data as Record<string, unknown>);
}

export async function listDispatchablePaymentFailureNotifications(
  limit = 10,
): Promise<PaymentFailureNotificationRecord[]> {
  const now = new Date().toISOString();

  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("payment_failure_notifications")
      .limit(Math.max(limit * 5, 20))
      .get();

    return (result.data || [])
      .map((row: Record<string, unknown>) => normalizeNotificationRecord(row))
      .filter((row: PaymentFailureNotificationRecord) => {
        if (!["queued", "failed", "partial"].includes(row.status)) {
          return false;
        }
        return !row.nextDispatchAt || row.nextDispatchAt <= now;
      })
      .sort(
        (
          left: PaymentFailureNotificationRecord,
          right: PaymentFailureNotificationRecord,
        ) => left.createdAt.localeCompare(right.createdAt),
      )
      .slice(0, limit);
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("payment_failure_notifications")
    .select("*")
    .in("status", ["queued", "failed", "partial"])
    .or(`next_dispatch_at.is.null,next_dispatch_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map((row: Record<string, unknown>) => normalizeNotificationRecord(row));
}

export async function updatePaymentFailureNotification(
  id: string,
  updates: UpdatePaymentFailureNotificationInput,
): Promise<PaymentFailureNotificationRecord | null> {
  const current = await getPaymentFailureNotificationById(id);
  if (!current) {
    return null;
  }

  const updatedAt = updates.updatedAt || new Date().toISOString();
  const nextRecord: PaymentFailureNotificationRecord = {
    ...current,
    ...updates,
    lastAttemptAt: updates.lastAttemptAt === null ? undefined : updates.lastAttemptAt ?? current.lastAttemptAt,
    lastError: updates.lastError === null ? undefined : updates.lastError ?? current.lastError,
    nextDispatchAt:
      updates.nextDispatchAt === null ? undefined : updates.nextDispatchAt ?? current.nextDispatchAt,
    sentAt: updates.sentAt === null ? undefined : updates.sentAt ?? current.sentAt,
    deliveryLog: updates.deliveryLog ?? current.deliveryLog,
    updatedAt,
  };

  await persistNotificationRecord(nextRecord);
  return nextRecord;
}
