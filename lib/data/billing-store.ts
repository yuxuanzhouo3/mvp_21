import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import {
  normalizePaymentRecord,
  normalizeSubscriptionRecord,
  type UnifiedPaymentRecord,
  type UnifiedSubscriptionRecord,
} from "@/lib/data/unified-models";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

interface ListPaymentOptions {
  userId: string;
  limit?: number;
  offset?: number;
}

interface GetPaymentOptions {
  userId: string;
  paymentId: string;
}

interface BillingRepository {
  listPaymentsByUser(
    options: ListPaymentOptions,
  ): Promise<{ payments: UnifiedPaymentRecord[]; total: number }>;
  getLatestSubscriptionByUser(
    userId: string,
  ): Promise<UnifiedSubscriptionRecord | null>;
  getPaymentByIdForUser(
    options: GetPaymentOptions,
  ): Promise<UnifiedPaymentRecord | null>;
}

const cnBillingRepository: BillingRepository = {
  async listPaymentsByUser({ userId, limit = 20, offset = 0 }: ListPaymentOptions) {
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
  },

  async getLatestSubscriptionByUser(userId: string) {
    const db = getDatabase();
    const result = await db
      .collection("subscriptions")
      .where({ user_id: userId })
      .orderBy("updated_at", "desc")
      .limit(1)
      .get();

    const record = result.data?.[0] as Record<string, any> | undefined;
    return record ? normalizeSubscriptionRecord(record) : null;
  },

  async getPaymentByIdForUser({ userId, paymentId }: GetPaymentOptions) {
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
  },
};

const intlBillingRepository: BillingRepository = {
  async listPaymentsByUser({ userId, limit = 20, offset = 0 }: ListPaymentOptions) {
    const { data, count, error } = await getSupabaseAdmin()
      .from("payments")
      .select("*", { count: "exact" })
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
  },

  async getLatestSubscriptionByUser(userId: string) {
    const { data, error } = await getSupabaseAdmin()
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return normalizeSubscriptionRecord(data as Record<string, any>);
  },

  async getPaymentByIdForUser({ userId, paymentId }: GetPaymentOptions) {
    const { data, error } = await getSupabaseAdmin()
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return normalizePaymentRecord(data as Record<string, any>);
  },
};

function getBillingRepository(): BillingRepository {
  return isChinaRegion() ? cnBillingRepository : intlBillingRepository;
}

export async function listPaymentsByUser(options: ListPaymentOptions) {
  return getBillingRepository().listPaymentsByUser(options);
}

export async function getLatestSubscriptionByUser(userId: string) {
  return getBillingRepository().getLatestSubscriptionByUser(userId);
}

export async function getPaymentByIdForUser(options: GetPaymentOptions) {
  return getBillingRepository().getPaymentByIdForUser(options);
}
