import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

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
  status: "queued" | "suppressed";
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

function buildNotificationId(input: QueuePaymentFailureNotificationInput) {
  return [
    "payment-failure",
    input.provider,
    input.userId,
    input.paymentReference.replace(/[^a-zA-Z0-9_-]/g, "-"),
  ].join("-");
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
    createdAt,
    updatedAt: createdAt,
  };

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
        updated_at: createdAt,
      });
    } else {
      await db.collection("payment_failure_notifications").add({
        ...record,
        created_at: createdAt,
        updated_at: createdAt,
      });
    }

    return record;
  }

  const admin = getSupabaseAdmin() as any;
  const { error } = await admin.from("payment_failure_notifications").upsert(
    {
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
      created_at: record.createdAt,
      updated_at: createdAt,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }

  return record;
}
