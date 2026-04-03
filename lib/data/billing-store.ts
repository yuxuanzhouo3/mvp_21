import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

import {
  normalizePaymentRecord,
  normalizeSubscriptionRecord,
  type UnifiedPaymentRecord,
  type UnifiedSubscriptionRecord,
} from "@/lib/data/unified-models";

interface ListPaymentOptions {
  userId: string;
  limit?: number;
  offset?: number;
}

interface GetPaymentOptions {
  userId: string;
  paymentId: string;
}

export async function listPaymentsByUser({
  userId,
  limit = 20,
  offset = 0,
}: ListPaymentOptions): Promise<{
  payments: UnifiedPaymentRecord[];
  total: number;
}> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const collection = db.collection("payments");
    const baseQuery = collection.where({ user_id: userId });
    const countResult = await baseQuery.count();
    const result = await baseQuery
      .orderBy("created_at", "desc")
      .skip(offset)
      .limit(limit)
      .get();

    return {
      payments: (result.data || []).map((record: Record<string, any>) =>
        normalizePaymentRecord(record),
      ),
      total: countResult.total || 0,
    };
  }

  const { data, count, error } = await getSupabaseAdmin()
    .from("payments")
    .select(
      "id,user_id,amount,currency,status,payment_method,transaction_id,external_payment_id,subscription_id,metadata,created_at,updated_at",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return {
    payments: (data || []).map((record) =>
      normalizePaymentRecord(record as Record<string, any>),
    ),
    total: count || 0,
  };
}

export async function getLatestSubscriptionByUser(
  userId: string,
): Promise<UnifiedSubscriptionRecord | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("subscriptions")
      .where({ user_id: userId })
      .orderBy("updated_at", "desc")
      .limit(1)
      .get();

    const record = result.data?.[0] as Record<string, any> | undefined;
    return record ? normalizeSubscriptionRecord(record) : null;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("subscriptions")
    .select(
      "id,user_id,plan,plan_id,status,price,currency,billing_cycle,payment_method,current_period_end,metadata,created_at,updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeSubscriptionRecord(data as Record<string, any>);
}

export async function getPaymentByIdForUser({
  userId,
  paymentId,
}: GetPaymentOptions): Promise<UnifiedPaymentRecord | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("payments")
      .where({
        _id: paymentId,
        user_id: userId,
      })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }));

    const record = result.data?.[0] as Record<string, any> | undefined;
    return record ? normalizePaymentRecord(record) : null;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("payments")
    .select(
      "id,user_id,amount,currency,status,payment_method,transaction_id,external_payment_id,subscription_id,metadata,created_at,updated_at",
    )
    .eq("id", paymentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizePaymentRecord(data as Record<string, any>);
}
