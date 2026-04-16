import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import type { PaymentMethod } from "@/lib/payment/payment-config";

export interface PaymentRecordLike {
  id?: string;
  _id?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  transaction_id?: string;
}

function isSupabaseMissingTableError(error: unknown) {
  return typeof (error as { code?: unknown })?.code === "string"
    && (error as { code: string }).code === "PGRST116";
}

export async function findRecentPaymentByFingerprint(input: {
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  sinceIso: string;
}): Promise<PaymentRecordLike | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const _ = db.command;
    const result = await db
      .collection("payments")
      .where({
        user_id: input.userId,
        amount: input.amount,
        currency: input.currency,
        payment_method: input.paymentMethod,
        created_at: _.gte(input.sinceIso),
        status: _.in(["pending", "completed"]),
      })
      .orderBy("created_at", "desc")
      .limit(1)
      .get();

    return (result.data?.[0] || null) as PaymentRecordLike | null;
  }

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("id, status, created_at, transaction_id")
    .eq("user_id", input.userId)
    .eq("amount", input.amount)
    .eq("currency", input.currency)
    .eq("payment_method", input.paymentMethod)
    .gte("created_at", input.sinceIso)
    .in("status", ["pending", "completed"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error && !isSupabaseMissingTableError(error)) {
    throw error;
  }

  return (data?.[0] || null) as PaymentRecordLike | null;
}

export async function createPendingPaymentRecord(input: {
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  orderId: string;
  transactionId?: string;
  codeUrl?: string;
  nowIso: string;
  paymentFields: {
    billing_cycle: "monthly" | "yearly";
    product_type: "subscription";
    product_name: string;
    metadata: unknown;
  };
  clientType?: "native";
}) {
  const basePayload = {
    user_id: input.userId,
    amount: input.amount,
    currency: input.currency,
    status: "pending",
    payment_method: input.paymentMethod,
    order_id: input.orderId,
    out_trade_no: input.orderId,
    transaction_id: input.transactionId || input.orderId,
    code_url: input.codeUrl,
    billing_cycle: input.paymentFields.billing_cycle,
    product_type: input.paymentFields.product_type,
    product_name: input.paymentFields.product_name,
    metadata: input.paymentFields.metadata,
    updated_at: input.nowIso,
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("payments").add({
      ...basePayload,
      client_type: input.clientType,
      region: "CN",
      created_at: input.nowIso,
    });
    return;
  }

  const { error } = await supabaseAdmin.from("payments").insert({
    ...basePayload,
    created_at: input.nowIso,
  });

  if (error) {
    throw error;
  }
}
