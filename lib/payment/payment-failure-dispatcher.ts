import { loadAdminSettings } from "@/lib/data/admin-settings-store";
import {
  getPaymentFailureNotificationById,
  listDispatchablePaymentFailureNotifications,
  type PaymentFailureNotificationDeliveryAttempt,
  type PaymentFailureNotificationRecord,
  updatePaymentFailureNotification,
} from "@/lib/data/payment-failure-notifications-store";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import { logError, logInfo, logWarn } from "@/lib/utils/logger";

type RecipientProfile = {
  email?: string;
  name?: string;
};

type EmailMessage = {
  to: string[];
  subject: string;
  html: string;
  text: string;
};

type DeliverySummary = {
  processed: number;
  sent: number;
  partial: number;
  failed: number;
  suppressed: number;
};

const RETRY_BACKOFF_MINUTES = [5, 15, 60, 360, 1440];

function parseRecipients(value?: string) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[,\n;]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function addMinutes(isoTime: string, minutes: number) {
  const date = new Date(isoTime);
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function getNextRetryTime(attemptCount: number, baseTime: string) {
  const minutes = RETRY_BACKOFF_MINUTES[Math.min(attemptCount, RETRY_BACKOFF_MINUTES.length - 1)];
  return addMinutes(baseTime, minutes);
}

function formatAmount(amount?: number, currency?: string) {
  if (typeof amount !== "number") {
    return "Unavailable";
  }

  const safeCurrency = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${safeCurrency} ${amount.toFixed(2)}`;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function resolveRecipientProfile(userId: string): Promise<RecipientProfile> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("web_users")
      .where({
        $or: [{ _id: userId }, { id: userId }],
      })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }));

    const row = result.data?.[0] as Record<string, unknown> | undefined;
    return {
      email: typeof row?.email === "string" ? row.email : undefined,
      name:
        typeof row?.nickname === "string"
          ? row.nickname
          : typeof row?.name === "string"
            ? row.name
            : undefined,
    };
  }

  const admin = getSupabaseAdmin();
  const [authUserResult, userRowResult, profileRowResult] = await Promise.allSettled([
    admin.auth.admin.getUserById(userId),
    admin.from("users").select("email,nickname").eq("id", userId).maybeSingle(),
    admin.from("user_profiles").select("email,full_name").eq("id", userId).maybeSingle(),
  ]);

  const authUser =
    authUserResult.status === "fulfilled" ? authUserResult.value.data.user : null;
  const userRow = (userRowResult.status === "fulfilled" ? userRowResult.value.data : null) as
    | Record<string, unknown>
    | null;
  const profileRow = (profileRowResult.status === "fulfilled" ? profileRowResult.value.data : null) as
    | Record<string, unknown>
    | null;

  return {
    email:
      authUser?.email ||
      (typeof userRow?.email === "string" ? userRow.email : undefined) ||
      (typeof profileRow?.email === "string" ? profileRow.email : undefined),
    name:
      (typeof userRow?.nickname === "string" ? userRow.nickname : undefined) ||
      (typeof profileRow?.full_name === "string" ? profileRow.full_name : undefined) ||
      undefined,
  };
}

async function sendEmail(message: EmailMessage): Promise<{ success: boolean; detail?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress =
    process.env.NOTIFICATION_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  if (!apiKey || !fromAddress) {
    return {
      success: false,
      detail: "Email provider is not configured. Set RESEND_API_KEY and NOTIFICATION_FROM_EMAIL.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      success: false,
      detail: `Resend API ${response.status}: ${detail}`,
    };
  }

  return { success: true };
}

function buildUserMessage(
  record: PaymentFailureNotificationRecord,
  settingsName: string,
  recipientName?: string,
): EmailMessage {
  const headline = recipientName
    ? `Hi ${recipientName}, your payment needs attention`
    : "Your payment needs attention";
  const amount = formatAmount(record.amount, record.currency);
  const nextAttempt = record.nextPaymentAttempt || "We will notify you after the next retry is scheduled.";
  const reason = record.reason || "The payment provider reported a failed collection attempt.";

  const text = [
    headline,
    "",
    `${settingsName} could not collect your latest subscription payment.`,
    `Provider: ${record.provider}`,
    `Reference: ${record.paymentReference}`,
    `Amount: ${amount}`,
    `Reason: ${reason}`,
    `Next retry: ${nextAttempt}`,
    "",
    "Please review your payment method to avoid service disruption.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 12px;">${escapeHtml(headline)}</h2>
      <p>${escapeHtml(settingsName)} could not collect your latest subscription payment.</p>
      <ul>
        <li><strong>Provider:</strong> ${escapeHtml(record.provider)}</li>
        <li><strong>Reference:</strong> ${escapeHtml(record.paymentReference)}</li>
        <li><strong>Amount:</strong> ${escapeHtml(amount)}</li>
        <li><strong>Reason:</strong> ${escapeHtml(reason)}</li>
        <li><strong>Next retry:</strong> ${escapeHtml(nextAttempt)}</li>
      </ul>
      <p>Please review your payment method to avoid service disruption.</p>
    </div>
  `;

  return {
    to: [],
    subject: `[${settingsName}] Payment retry required`,
    html,
    text,
  };
}

function buildAdminMessage(
  record: PaymentFailureNotificationRecord,
  settingsName: string,
): EmailMessage {
  const amount = formatAmount(record.amount, record.currency);
  const nextAttempt = record.nextPaymentAttempt || "Not supplied";
  const reason = record.reason || "No provider reason was supplied.";

  const text = [
    `Payment collection failed in ${settingsName}.`,
    "",
    `User ID: ${record.userId}`,
    `Provider: ${record.provider}`,
    `Payment reference: ${record.paymentReference}`,
    `Subscription reference: ${record.subscriptionReference || "N/A"}`,
    `Amount: ${amount}`,
    `Reason: ${reason}`,
    `Next retry: ${nextAttempt}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 12px;">Payment collection failed</h2>
      <p>A recurring payment failure has been queued in ${escapeHtml(settingsName)}.</p>
      <ul>
        <li><strong>User ID:</strong> ${escapeHtml(record.userId)}</li>
        <li><strong>Provider:</strong> ${escapeHtml(record.provider)}</li>
        <li><strong>Payment reference:</strong> ${escapeHtml(record.paymentReference)}</li>
        <li><strong>Subscription reference:</strong> ${escapeHtml(record.subscriptionReference || "N/A")}</li>
        <li><strong>Amount:</strong> ${escapeHtml(amount)}</li>
        <li><strong>Reason:</strong> ${escapeHtml(reason)}</li>
        <li><strong>Next retry:</strong> ${escapeHtml(nextAttempt)}</li>
      </ul>
    </div>
  `;

  return {
    to: [],
    subject: `[${settingsName}] Payment failure alert`,
    html,
    text,
  };
}

async function dispatchSingleNotification(
  record: PaymentFailureNotificationRecord,
): Promise<PaymentFailureNotificationRecord> {
  const now = new Date().toISOString();
  const settings = await loadAdminSettings();
  const platformName = settings.general.platformName || "MornContract";
  const recipientProfile = await resolveRecipientProfile(record.userId);
  const adminRecipients = parseRecipients(record.adminRecipients);

  const attempts: PaymentFailureNotificationDeliveryAttempt[] = [...record.deliveryLog];
  const failedMessages: string[] = [];
  let sentCount = 0;
  let intendedCount = 0;

  if (record.notificationChannels.userEmailEnabled) {
    intendedCount += 1;
    if (recipientProfile.email) {
      const userMessage = buildUserMessage(record, platformName, recipientProfile.name);
      const delivery = await sendEmail({ ...userMessage, to: [recipientProfile.email] });
      attempts.push({
        channel: "user-email",
        recipient: recipientProfile.email,
        attemptedAt: now,
        status: delivery.success ? "sent" : "failed",
        detail: delivery.detail,
      });
      if (delivery.success) {
        sentCount += 1;
      } else if (delivery.detail) {
        failedMessages.push(`user-email: ${delivery.detail}`);
      }
    } else {
      attempts.push({
        channel: "user-email",
        recipient: record.userId,
        attemptedAt: now,
        status: "skipped",
        detail: "No user email was found for this account.",
      });
      failedMessages.push("user-email: no user email was found");
    }
  }

  if (record.notificationChannels.adminAlertEnabled) {
    intendedCount += adminRecipients.length > 0 ? 1 : 0;
    if (adminRecipients.length > 0) {
      const adminMessage = buildAdminMessage(record, platformName);
      const delivery = await sendEmail({ ...adminMessage, to: adminRecipients });
      for (const recipient of adminRecipients) {
        attempts.push({
          channel: "admin-email",
          recipient,
          attemptedAt: now,
          status: delivery.success ? "sent" : "failed",
          detail: delivery.detail,
        });
      }
      if (delivery.success) {
        sentCount += 1;
      } else if (delivery.detail) {
        failedMessages.push(`admin-email: ${delivery.detail}`);
      }
    } else {
      failedMessages.push("admin-email: no admin recipients configured");
    }
  }

  const attemptCount = record.attemptCount + 1;

  if (intendedCount === 0) {
    return (await updatePaymentFailureNotification(record.id, {
      status: "suppressed",
      attemptCount,
      lastAttemptAt: now,
      lastError: null,
      nextDispatchAt: null,
      deliveryLog: attempts,
      sentAt: null,
    })) as PaymentFailureNotificationRecord;
  }

  const allSucceeded = sentCount === intendedCount;
  const someSucceeded = sentCount > 0;
  const retryable = attemptCount < record.maxAttempts;
  const nextDispatchAt = !allSucceeded && retryable ? getNextRetryTime(attemptCount - 1, now) : null;
  const status = allSucceeded ? "sent" : someSucceeded ? "partial" : "failed";

  return (await updatePaymentFailureNotification(record.id, {
    status,
    attemptCount,
    lastAttemptAt: now,
    lastError: failedMessages.length ? failedMessages.join(" | ") : null,
    nextDispatchAt,
    sentAt: allSucceeded ? now : null,
    deliveryLog: attempts,
  })) as PaymentFailureNotificationRecord;
}

export async function dispatchQueuedPaymentFailureNotifications(options?: {
  id?: string;
  limit?: number;
}): Promise<DeliverySummary> {
  let queue: PaymentFailureNotificationRecord[] = [];

  if (options?.id) {
    const record = await getPaymentFailureNotificationById(options.id);
    if (record && ["queued", "failed", "partial"].includes(record.status)) {
      queue = [record];
    }
  } else {
    queue = await listDispatchablePaymentFailureNotifications(options?.limit || 10);
  }

  const summary: DeliverySummary = {
    processed: 0,
    sent: 0,
    partial: 0,
    failed: 0,
    suppressed: 0,
  };

  for (const record of queue) {
    try {
      summary.processed += 1;
      await updatePaymentFailureNotification(record.id, {
        status: "processing",
        lastAttemptAt: new Date().toISOString(),
      });
      const nextRecord = await dispatchSingleNotification(record);

      if (nextRecord.status === "sent") {
        summary.sent += 1;
      } else if (nextRecord.status === "partial") {
        summary.partial += 1;
      } else if (nextRecord.status === "suppressed") {
        summary.suppressed += 1;
      } else {
        summary.failed += 1;
      }
    } catch (error) {
      logError("Failed to dispatch payment failure notification", error as Error, {
        notificationId: record.id,
        userId: record.userId,
      });

      const attemptCount = record.attemptCount + 1;
      await updatePaymentFailureNotification(record.id, {
        status: "failed",
        attemptCount,
        lastAttemptAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : String(error),
        nextDispatchAt:
          attemptCount < record.maxAttempts
            ? getNextRetryTime(attemptCount - 1, new Date().toISOString())
            : null,
      });
      summary.failed += 1;
    }
  }

  logInfo("Payment failure notification dispatch completed", summary);
  if (!summary.processed) {
    logWarn("Payment failure notification dispatch ran without queued work", options || {});
  }

  return summary;
}
