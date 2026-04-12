import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { logError, logInfo, logWarn } from "@/lib/utils/logger";

import {
  applySubscriptionPaymentSuccess,
  buildSubscriptionPaymentFields,
  getPaymentRecordById,
  getPaymentRecordForUserByReference,
  type PaymentRecordLike,
  updatePaymentRecordFields,
} from "./subscription-payment-sync";

interface EnsureOnetimeMembershipInput {
  userId: string;
  transactionId: string;
  days: number;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  providerReference?: string;
  referenceAliases?: string[];
  source?: string;
}

interface EnsureOnetimeMembershipResult {
  success: boolean;
  paymentId?: string;
  subscriptionId?: string;
  reason?: string;
}

function normalizeBillingCycle(days: number): "monthly" | "yearly" {
  return days >= 365 ? "yearly" : "monthly";
}

function normalizeCurrency(currency: string | undefined) {
  if (currency && currency.trim()) {
    return currency.toUpperCase();
  }
  return isChinaRegion() ? "CNY" : "USD";
}

function pickPaymentId(payment: PaymentRecordLike | null | undefined) {
  if (!payment) {
    return null;
  }
  return payment.id || payment._id || null;
}

async function findPaymentByReferences(
  userId: string,
  references: string[],
): Promise<PaymentRecordLike | null> {
  for (const reference of references) {
    const record = await getPaymentRecordForUserByReference(userId, reference);
    if (record) {
      return record;
    }
  }

  return null;
}

async function createFallbackPayment(
  input: EnsureOnetimeMembershipInput,
  metadata: Record<string, unknown>,
): Promise<PaymentRecordLike> {
  const nowIso = new Date().toISOString();
  const paymentMethod = input.paymentMethod || "onetime";
  const amount = input.amount ?? 0;
  const currency = normalizeCurrency(input.currency);

  if (isChinaRegion()) {
    const db = getDatabase();
    const payload = {
      user_id: input.userId,
      amount,
      currency,
      status: "pending",
      payment_method: paymentMethod,
      transaction_id: input.transactionId,
      metadata,
      created_at: nowIso,
      updated_at: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const insertResult = await db.collection("payments").add(payload);
    const createdId = insertResult.id || insertResult._id;
    if (!createdId) {
      return payload as PaymentRecordLike;
    }

    const inserted = await db.collection("payments").doc(createdId).get();
    return (
      inserted.data?.[0] || {
        _id: createdId,
        ...payload,
      }
    ) as PaymentRecordLike;
  }

  const { data, error } = await supabaseAdmin
    .from("payments")
    .insert({
      user_id: input.userId,
      amount,
      currency,
      status: "pending",
      payment_method: paymentMethod,
      transaction_id: input.transactionId,
      metadata,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PaymentRecordLike;
}

export async function ensureOnetimeMembershipApplied(
  input: EnsureOnetimeMembershipInput,
): Promise<EnsureOnetimeMembershipResult> {
  const references = Array.from(
    new Set(
      [
        input.transactionId,
        input.providerReference,
        ...(input.referenceAliases || []),
      ].filter((item): item is string => typeof item === "string" && item.trim().length > 0),
    ),
  );

  if (!input.userId || references.length === 0) {
    return {
      success: false,
      reason: "MISSING_REQUIRED_IDENTIFIERS",
    };
  }

  const billingCycle = normalizeBillingCycle(input.days);
  const normalized = buildSubscriptionPaymentFields({
    planType: "pro",
    billingCycle,
    days: input.days,
  });
  const normalizedMetadata = {
    ...normalized.metadata,
    paymentType: "onetime",
    source: input.source || "onetime-unified-sync",
  };

  try {
    let payment = await findPaymentByReferences(input.userId, references);
    if (!payment) {
      payment = await createFallbackPayment(input, normalizedMetadata);
      logInfo("Created fallback payment before unified membership sync", {
        userId: input.userId,
        transactionId: input.transactionId,
        paymentId: pickPaymentId(payment),
      });
    }

    const paymentId = pickPaymentId(payment);
    if (!paymentId) {
      return {
        success: false,
        reason: "PAYMENT_ID_MISSING",
      };
    }

    const nowIso = new Date().toISOString();
    const mergedMetadata = {
      ...(payment.metadata || {}),
      ...normalizedMetadata,
    };

    await updatePaymentRecordFields(paymentId, {
      billing_cycle: normalized.billing_cycle,
      product_type: normalized.product_type,
      product_name: normalized.product_name,
      payment_method: input.paymentMethod || payment.payment_method || "onetime",
      metadata: mergedMetadata,
      updated_at: nowIso,
      updatedAt: nowIso,
    });

    const latestPayment = (await getPaymentRecordById(paymentId)) || {
      ...payment,
      metadata: mergedMetadata,
      billing_cycle: normalized.billing_cycle,
      product_type: normalized.product_type,
      product_name: normalized.product_name,
    };

    const applyResult = await applySubscriptionPaymentSuccess({
      payment: latestPayment,
      finalTransactionId: input.transactionId,
      providerReference: input.providerReference || input.transactionId,
      amount: input.amount ?? latestPayment.amount ?? 0,
      currency: normalizeCurrency(input.currency || latestPayment.currency),
      paymentMethod: input.paymentMethod || latestPayment.payment_method || "onetime",
    });

    return {
      success: true,
      paymentId: applyResult.paymentId,
      subscriptionId: applyResult.subscriptionId,
    };
  } catch (error) {
    logError(
      "Failed to apply unified onetime membership sync",
      error as Error,
      {
        userId: input.userId,
        transactionId: input.transactionId,
        references,
      },
    );
    return {
      success: false,
      reason: "UNIFIED_MEMBERSHIP_SYNC_FAILED",
    };
  }
}

