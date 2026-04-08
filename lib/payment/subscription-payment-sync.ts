import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";

type BillingCycle = "monthly" | "yearly";
type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
type SubscriptionStatus =
  | "active"
  | "paused"
  | "canceled"
  | "cancelled"
  | "expired"
  | "inactive";

export interface SubscriptionOrderMetadata {
  planType: string;
  billingCycle: BillingCycle;
  days: number;
  productType: "subscription";
  productName: string;
}

export interface PaymentRecordLike {
  id?: string;
  _id?: string;
  user_id?: string;
  amount?: number;
  currency?: string;
  status?: PaymentStatus | string;
  payment_method?: string;
  transaction_id?: string;
  out_trade_no?: string;
  code_url?: string;
  order_id?: string;
  subscription_id?: string;
  billing_cycle?: BillingCycle | string;
  product_type?: string;
  product_name?: string;
  metadata?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
}

interface ApplySuccessOptions {
  payment: PaymentRecordLike;
  finalTransactionId?: string;
  providerReference?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
}

interface ApplyTerminalStatusOptions {
  payment: PaymentRecordLike;
  paymentStatus: Extract<PaymentStatus, "failed" | "refunded">;
  finalTransactionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  effectivePeriodEnd?: string;
}

interface DirectSubscriptionStatusOptions {
  userId: string;
  providerReference?: string;
  subscriptionId?: string;
  subscriptionStatus: SubscriptionStatus;
  paymentMethod?: string;
  effectivePeriodEnd?: string;
}

function getDeploymentRegion() {
  return isChinaRegion() ? "CN" : "INTL";
}

function defaultDaysForBillingCycle(billingCycle: BillingCycle): number {
  return billingCycle === "yearly" ? 365 : 30;
}

function normalizeBillingCycle(value: unknown): BillingCycle | null {
  if (value === "monthly" || value === "yearly") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toLowerCase();
  return normalized === "yearly" || normalized === "annual"
    ? "yearly"
    : normalized === "monthly"
      ? "monthly"
      : null;
}

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function normalizePlanType(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function buildProductName(planType: string, billingCycle: BillingCycle): string {
  const normalizedPlan = planType.trim() || "pro";
  const label = normalizedPlan.charAt(0).toUpperCase() + normalizedPlan.slice(1);
  return `${label} ${billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

function pickRecordId(record: PaymentRecordLike | null | undefined): string | null {
  if (!record) {
    return null;
  }

  return record.id || record._id || null;
}

function pickTransactionReference(record: PaymentRecordLike | null | undefined): string | null {
  if (!record) {
    return null;
  }

  return record.transaction_id || record.out_trade_no || record.order_id || null;
}

function buildReferenceCandidates(
  payment: PaymentRecordLike,
  overrides?: {
    finalTransactionId?: string;
    providerReference?: string;
  },
): string[] {
  return Array.from(
    new Set(
      [
        overrides?.finalTransactionId,
        overrides?.providerReference,
        payment.transaction_id,
        payment.out_trade_no,
        payment.order_id,
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  );
}

export function hasProcessedSubscriptionPaymentSuccess(
  subscription: Record<string, any> | null | undefined,
  references: string[],
): boolean {
  if (!subscription || references.length === 0) {
    return false;
  }

  const metadata = subscription.metadata || {};
  const knownReferences = new Set(
    [
      subscription.transaction_id,
      subscription.provider_subscription_id,
      metadata.lastSuccessfulTransactionId,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  );

  return references.some((reference) => knownReferences.has(reference));
}

export function buildSubscriptionPaymentFields(input: {
  planType?: string | null;
  billingCycle?: BillingCycle | null;
  days?: number | null;
}): {
  billing_cycle: BillingCycle;
  product_type: "subscription";
  product_name: string;
  metadata: SubscriptionOrderMetadata;
} {
  const billingCycle = input.billingCycle || "monthly";
  const days = input.days && input.days > 0 ? input.days : defaultDaysForBillingCycle(billingCycle);
  const planType = input.planType?.trim() || "pro";

  return {
    billing_cycle: billingCycle,
    product_type: "subscription",
    product_name: buildProductName(planType, billingCycle),
    metadata: {
      planType,
      billingCycle,
      days,
      productType: "subscription",
      productName: buildProductName(planType, billingCycle),
    },
  };
}

export function extractSubscriptionOrderMetadata(
  payment: PaymentRecordLike | null | undefined,
): SubscriptionOrderMetadata {
  if (!payment) {
    throw new Error("Payment record is required");
  }

  const metadata = payment.metadata || {};
  const planType =
    normalizePlanType(metadata.planType) ||
    normalizePlanType((payment as any).planType) ||
    normalizePlanType((payment as any).plan_id) ||
    (payment.product_type && payment.product_type !== "subscription"
      ? normalizePlanType(payment.product_type)
      : null);

  const billingCycle =
    normalizeBillingCycle(payment.billing_cycle) ||
    normalizeBillingCycle(metadata.billingCycle) ||
    normalizeBillingCycle(metadata.billing_cycle) ||
    (normalizePositiveInteger(metadata.days) === 365 ? "yearly" : null) ||
    (normalizePositiveInteger(metadata.days) === 30 ? "monthly" : null);

  if (!planType || !billingCycle) {
    throw new Error("Missing subscription order metadata, please recreate the payment");
  }

  const days =
    normalizePositiveInteger(metadata.days) ||
    normalizePositiveInteger((payment as any).days) ||
    defaultDaysForBillingCycle(billingCycle);

  return {
    planType,
    billingCycle,
    days,
    productType: "subscription",
    productName:
      normalizePlanType(metadata.productName) ||
      normalizePlanType(payment.product_name) ||
      buildProductName(planType, billingCycle),
  };
}

async function getIntlUserMetadata(userId: string) {
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error || !user) {
    throw error || new Error("User not found");
  }

  return user.user_metadata || {};
}

async function findRelevantSubscription(userId: string) {
  if (isChinaRegion()) {
    const db = getDatabase();
    const activeResult = await db
      .collection("subscriptions")
      .where({
        user_id: userId,
        status: "active",
      })
      .orderBy("current_period_end", "desc")
      .limit(1)
      .get();

    if (activeResult.data?.length) {
      return activeResult.data[0];
    }

    const latestResult = await db
      .collection("subscriptions")
      .where({
        user_id: userId,
      })
      .orderBy("updated_at", "desc")
      .limit(1)
      .get();

    return latestResult.data?.[0] || null;
  }

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("status", { ascending: true })
    .order("current_period_end", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] || null;
}

export async function updatePaymentRecordFields(
  paymentId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const payload = compactObject(updates);

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("payments").doc(paymentId).update(payload);
    return;
  }

  const { error } = await supabaseAdmin.from("payments").update(payload).eq("id", paymentId);
  if (error) {
    throw error;
  }
}

async function updateSubscriptionRecord(
  subscriptionId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const payload = compactObject(updates);

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("subscriptions").doc(subscriptionId).update(payload);
    return;
  }

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update(payload)
    .eq("id", subscriptionId);

  if (error) {
    throw error;
  }
}

async function createSubscriptionRecord(input: Record<string, unknown>) {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("subscriptions").add(input);
    return {
      id: result.id || result._id,
      ...(input as Record<string, unknown>),
    };
  }

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .insert(input)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function syncUserFromRelevantSubscription(userId: string): Promise<void> {
  const subscription = await findRelevantSubscription(userId);
  const now = new Date();

  const plan =
    (subscription?.plan_id as string | undefined) ||
    (subscription?.plan as string | undefined) ||
    "free";
  const status = (subscription?.status as string | undefined) || "inactive";
  const currentPeriodEnd =
    (subscription?.current_period_end as string | undefined) ||
    (subscription?.end_date as string | undefined);
  const isActive =
    status === "active" &&
    !!currentPeriodEnd &&
    new Date(currentPeriodEnd).getTime() > now.getTime();

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("web_users").doc(userId).update({
      pro: isActive,
      subscription_plan: isActive ? plan : "free",
      subscription_status: isActive ? status : "inactive",
      subscription_expires_at: currentPeriodEnd || null,
      membership_expires_at: currentPeriodEnd || null,
      updated_at: now.toISOString(),
    });
    return;
  }

  const existingMetadata = await getIntlUserMetadata(userId);
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...existingMetadata,
      pro: isActive,
      subscription_plan: isActive ? plan : "free",
      subscription_status: isActive ? status : "inactive",
      subscription_expires_at: currentPeriodEnd || null,
      membership_expires_at: currentPeriodEnd || null,
      updated_at: now.toISOString(),
    },
  });

  if (error) {
    throw error;
  }
}

async function findSubscriptionForPayment(
  payment: PaymentRecordLike,
  providerReference?: string,
) {
  const subscriptionId = payment.subscription_id;
  const transactionReference = providerReference || pickTransactionReference(payment);
  const userId = payment.user_id;

  if (isChinaRegion()) {
    const db = getDatabase();

    if (subscriptionId) {
      const subscriptionResult = await db
        .collection("subscriptions")
        .doc(subscriptionId)
        .get();
      return subscriptionResult.data?.[0] || null;
    }

    if (!userId) {
      return null;
    }

    if (transactionReference) {
      const referenceResult = await db
        .collection("subscriptions")
        .where({
          user_id: userId,
          $or: [
            { provider_subscription_id: transactionReference },
            { transaction_id: transactionReference },
          ],
        })
        .limit(1)
        .get();

      if (referenceResult.data?.length) {
        return referenceResult.data[0];
      }
    }

    const result = await db
      .collection("subscriptions")
      .where({
        user_id: userId,
      })
      .orderBy("current_period_end", "desc")
      .limit(1)
      .get();

    return result.data?.[0] || null;
  }

  if (subscriptionId) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  if (!userId) {
    return null;
  }

  if (transactionReference) {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .or(
        `provider_subscription_id.eq.${transactionReference},transaction_id.eq.${transactionReference}`,
      )
      .limit(1);

    if (error) {
      throw error;
    }

    if (data?.length) {
      return data[0];
    }
  }

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("current_period_end", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] || null;
}

export async function getPaymentRecordById(paymentId: string): Promise<PaymentRecordLike | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("payments").doc(paymentId).get();
    return result.data?.[0] || null;
  }

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data;
}

export async function getPaymentRecordForUserByReference(
  userId: string,
  reference: string,
): Promise<PaymentRecordLike | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const _ = db.command;
    const result = await db
      .collection("payments")
      .where({
        user_id: userId,
        transaction_id: _.eq(reference),
      })
      .limit(1)
      .get();

    if (result.data?.length) {
      return result.data[0];
    }

    const fallback = await db
      .collection("payments")
      .where({
        user_id: userId,
        order_id: _.eq(reference),
      })
      .limit(1)
      .get();

    if (fallback.data?.length) {
      return fallback.data[0];
    }

    const outTradeResult = await db
      .collection("payments")
      .where({
        user_id: userId,
        out_trade_no: _.eq(reference),
      })
      .limit(1)
      .get();

    return outTradeResult.data?.[0] || null;
  }

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .or(`transaction_id.eq.${reference},order_id.eq.${reference},out_trade_no.eq.${reference}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] || null;
}

export async function applySubscriptionPaymentSuccess(
  options: ApplySuccessOptions,
): Promise<{
  paymentId: string;
  subscriptionId: string;
  metadata: SubscriptionOrderMetadata;
}> {
  const { payment } = options;
  const userId = payment.user_id;
  const paymentId = pickRecordId(payment);

  if (!userId || !paymentId) {
    throw new Error("Payment record is missing user linkage");
  }

  const metadata = extractSubscriptionOrderMetadata(payment);
  const latestPayment = (await getPaymentRecordById(paymentId)) || payment;
  const now = new Date();
  const paymentMethod =
    options.paymentMethod || latestPayment.payment_method || payment.payment_method || "unknown";
  const finalTransactionId =
    options.finalTransactionId ||
    pickTransactionReference(latestPayment) ||
    pickTransactionReference(payment) ||
    paymentId;
  const providerReference = options.providerReference || finalTransactionId;
  const referenceCandidates = buildReferenceCandidates(latestPayment, {
    finalTransactionId,
    providerReference,
  });

  if (latestPayment.status === "completed" && latestPayment.subscription_id) {
    await syncUserFromRelevantSubscription(userId);
    return {
      paymentId,
      subscriptionId: latestPayment.subscription_id,
      metadata,
    };
  }

  const existingSubscription = await findSubscriptionForPayment(latestPayment, providerReference);
  const paymentMetadata = {
    ...latestPayment.metadata,
    ...metadata,
    source: "subscription-payment-sync",
    lastSuccessfulTransactionId: finalTransactionId,
  };

  if (hasProcessedSubscriptionPaymentSuccess(existingSubscription, referenceCandidates)) {
    const existingSubscriptionId = existingSubscription.id || existingSubscription._id;

    await updatePaymentRecordFields(paymentId, {
      amount: options.amount ?? latestPayment.amount ?? payment.amount ?? 0,
      currency:
        options.currency ??
        latestPayment.currency ??
        payment.currency ??
        (isChinaRegion() ? "CNY" : "USD"),
      status: "completed",
      payment_method: paymentMethod,
      transaction_id: finalTransactionId,
      subscription_id: existingSubscriptionId,
      billing_cycle: metadata.billingCycle,
      product_type: metadata.productType,
      product_name: metadata.productName,
      metadata: paymentMetadata,
      completed_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    await syncUserFromRelevantSubscription(userId);

    return {
      paymentId,
      subscriptionId: existingSubscriptionId,
      metadata,
    };
  }

  const amount = options.amount ?? latestPayment.amount ?? payment.amount ?? 0;
  const currency =
    options.currency ??
    latestPayment.currency ??
    payment.currency ??
    (isChinaRegion() ? "CNY" : "USD");
  const currentPeriodStart = now.toISOString();
  const existingEnd =
    existingSubscription?.current_period_end
      ? new Date(existingSubscription.current_period_end)
      : null;
  const periodBase =
    existingEnd && existingEnd.getTime() > now.getTime() ? existingEnd : now;
  const newPeriodEnd = new Date(
    periodBase.getTime() + metadata.days * 24 * 60 * 60 * 1000,
  ).toISOString();

  let subscriptionId: string;

  if (existingSubscription?.id || existingSubscription?._id) {
    subscriptionId = existingSubscription.id || existingSubscription._id;
    await updateSubscriptionRecord(subscriptionId, {
      plan: metadata.planType,
      plan_id: metadata.planType,
      status: "active",
      billing_cycle: metadata.billingCycle,
      payment_method: paymentMethod,
      provider_subscription_id: providerReference,
      transaction_id: finalTransactionId,
      current_period_start: currentPeriodStart,
      current_period_end: newPeriodEnd,
      cancel_at_period_end: false,
      price: amount,
      currency,
      metadata: paymentMetadata,
      updated_at: now.toISOString(),
    });
  } else {
    const createdSubscription = await createSubscriptionRecord({
      user_id: userId,
      plan: metadata.planType,
      plan_id: metadata.planType,
      status: "active",
      billing_cycle: metadata.billingCycle,
      payment_method: paymentMethod,
      provider_subscription_id: providerReference,
      transaction_id: finalTransactionId,
      current_period_start: currentPeriodStart,
      current_period_end: newPeriodEnd,
      cancel_at_period_end: false,
      price: amount,
      currency,
      metadata: paymentMetadata,
      region: getDeploymentRegion(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    subscriptionId = createdSubscription.id || createdSubscription._id;
  }

  await updatePaymentRecordFields(paymentId, {
    amount,
    currency,
    status: "completed",
    payment_method: paymentMethod,
    transaction_id: finalTransactionId,
    subscription_id: subscriptionId,
    billing_cycle: metadata.billingCycle,
    product_type: metadata.productType,
    product_name: metadata.productName,
    metadata: paymentMetadata,
    completed_at: now.toISOString(),
    updated_at: now.toISOString(),
  });

  await syncUserFromRelevantSubscription(userId);

  return {
    paymentId,
    subscriptionId,
    metadata,
  };
}

export async function applySubscriptionPaymentTerminalStatus(
  options: ApplyTerminalStatusOptions,
): Promise<void> {
  const { payment, paymentStatus } = options;
  const paymentId = pickRecordId(payment);
  const userId = payment.user_id;

  if (!paymentId || !userId) {
    throw new Error("Payment record is missing required identifiers");
  }

  const nowIso = new Date().toISOString();
  const transactionReference =
    options.finalTransactionId || pickTransactionReference(payment) || paymentId;

  await updatePaymentRecordFields(paymentId, {
    status: paymentStatus,
    transaction_id: transactionReference,
    updated_at: nowIso,
  });

  if (options.subscriptionStatus) {
    const linkedSubscription = await findSubscriptionForPayment(payment, transactionReference);

    if (linkedSubscription?.id || linkedSubscription?._id) {
      const linkedSubscriptionId = linkedSubscription.id || linkedSubscription._id;
      await updateSubscriptionRecord(linkedSubscriptionId, {
        status: options.subscriptionStatus,
        current_period_end:
          options.effectivePeriodEnd || (paymentStatus === "refunded" ? nowIso : undefined),
        cancel_at_period_end:
          options.subscriptionStatus === "cancelled" ||
          options.subscriptionStatus === "canceled"
            ? true
            : undefined,
        updated_at: nowIso,
      });
    }
  }

  await syncUserFromRelevantSubscription(userId);
}

export async function applyDirectSubscriptionStatusChange(
  options: DirectSubscriptionStatusOptions,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const effectivePeriodEnd =
    options.effectivePeriodEnd ||
    (options.subscriptionStatus === "cancelled" ||
    options.subscriptionStatus === "canceled" ||
    options.subscriptionStatus === "expired"
      ? nowIso
      : undefined);

  if (isChinaRegion()) {
    const db = getDatabase();
    const conditions: Record<string, unknown>[] = [];

    if (options.subscriptionId) {
      const subscription = await db.collection("subscriptions").doc(options.subscriptionId).get();
      const record = subscription.data?.[0];
      if (!record) {
        return false;
      }

      await db.collection("subscriptions").doc(options.subscriptionId).update({
        ...compactObject({
          status: options.subscriptionStatus,
          payment_method: options.paymentMethod,
          current_period_end: effectivePeriodEnd,
          updated_at: nowIso,
        }),
      });
      await syncUserFromRelevantSubscription(options.userId);
      return true;
    }

    if (options.providerReference) {
      conditions.push({ provider_subscription_id: options.providerReference });
      conditions.push({ transaction_id: options.providerReference });
    }

    if (!conditions.length) {
      return false;
    }

    const result = await db
      .collection("subscriptions")
      .where({
        user_id: options.userId,
        $or: conditions,
      })
      .limit(1)
      .get();

    const record = result.data?.[0];
    if (!record?._id) {
      return false;
    }

    await db.collection("subscriptions").doc(record._id).update({
      ...compactObject({
        status: options.subscriptionStatus,
        payment_method: options.paymentMethod || record.payment_method,
        current_period_end: effectivePeriodEnd,
        updated_at: nowIso,
      }),
    });

    await syncUserFromRelevantSubscription(options.userId);
    return true;
  }

  let query = supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", options.userId);

  if (options.subscriptionId) {
    query = query.eq("id", options.subscriptionId);
  } else if (options.providerReference) {
    query = query.or(
      `provider_subscription_id.eq.${options.providerReference},transaction_id.eq.${options.providerReference}`,
    );
  } else {
    return false;
  }

  const { data, error } = await query.limit(1);
  if (error) {
    throw error;
  }

  const subscription = data?.[0];
  if (!subscription?.id) {
    return false;
  }

  const { error: updateError } = await supabaseAdmin
    .from("subscriptions")
    .update(compactObject({
      status: options.subscriptionStatus,
      payment_method: options.paymentMethod || subscription.payment_method,
      current_period_end: effectivePeriodEnd,
      cancel_at_period_end:
        options.subscriptionStatus === "cancelled" ||
        options.subscriptionStatus === "canceled",
      updated_at: nowIso,
    }))
    .eq("id", subscription.id);

  if (updateError) {
    throw updateError;
  }

  await syncUserFromRelevantSubscription(options.userId);
  return true;
}
