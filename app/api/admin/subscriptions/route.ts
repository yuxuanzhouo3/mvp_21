import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import {
  buildSupabaseSubscriptionPayload,
  normalizePaymentRecord,
  normalizeSubscriptionPlan,
  normalizeSubscriptionRecord,
  normalizeSubscriptionStatus,
  type UnifiedPaymentRecord,
  type UnifiedSubscriptionRecord,
} from "@/lib/data/unified-models";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

type AdminUserSummary = {
  userName: string;
  userEmail: string;
};

type AdminSubscriptionItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  plan: string;
  price: number;
  currency: string;
  billingCycle: string;
  status: string;
  paymentMethod: string;
  currentPeriodEnd: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type AdminPaymentItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subscriptionId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  transactionId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  type: "subscription";
};

type SubscriptionStats = {
  activeCount: number;
  mrr: number;
  renewalRate: number;
  churnCount: number;
  baseCurrency: string;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const CHURN_STATUSES = ["cancelled", "canceled", "expired"];

function getPagination(searchParams: URLSearchParams) {
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || `${DEFAULT_LIMIT}`, 10), 1),
    MAX_LIMIT,
  );

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function getSafeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getDefaultCurrency() {
  return isChinaRegion() ? "CNY" : "USD";
}

function calculateMrrValue(record: UnifiedSubscriptionRecord) {
  const price = record.price || 0;
  const billingCycle = getSafeString(record.billingCycle).toLowerCase();

  if (billingCycle === "yearly" || billingCycle === "annual") {
    return price / 12;
  }

  return price;
}

function resolveBaseCurrency(subscriptions: UnifiedSubscriptionRecord[]) {
  const counts = new Map<string, number>();

  for (const subscription of subscriptions) {
    const currency = subscription.currency || getDefaultCurrency();
    counts.set(currency, (counts.get(currency) || 0) + 1);
  }

  let selectedCurrency = getDefaultCurrency();
  let highestCount = 0;

  for (const [currency, count] of counts.entries()) {
    if (count > highestCount) {
      selectedCurrency = currency;
      highestCount = count;
    }
  }

  return selectedCurrency;
}

function buildSubscriptionStats(subscriptions: UnifiedSubscriptionRecord[]): SubscriptionStats {
  const activeSubscriptions = subscriptions.filter(
    (record) => record.status === "active",
  );
  const churnCount = subscriptions.filter((record) =>
    CHURN_STATUSES.includes(record.status),
  ).length;

  const total = subscriptions.length;
  const activeCount = activeSubscriptions.length;
  const renewalRate =
    total > 0 ? Number(((activeCount / total) * 100).toFixed(1)) : 0;
  const mrr = Number(
    activeSubscriptions
      .reduce((sum, record) => sum + calculateMrrValue(record), 0)
      .toFixed(2),
  );

  return {
    activeCount,
    mrr,
    renewalRate,
    churnCount,
    baseCurrency: resolveBaseCurrency(activeSubscriptions),
  };
}

async function requireAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { token, error: tokenError } = extractTokenFromHeader(authHeader);

  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const authResult = await verifyAuthToken(token);
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        { success: false, error: authResult.error || "Invalid token" },
        { status: 401 },
      ),
    };
  }

  return {
    userId: authResult.userId,
    user: authResult.user,
  };
}

async function loadChinaUsers(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueUserIds.length) {
    return new Map<string, AdminUserSummary>();
  }

  const db = getDatabase();
  const command = db.command;
  const result = await db
    .collection("web_users")
    .where({
      _id: command.in(uniqueUserIds),
    })
    .get();

  const users = new Map<string, AdminUserSummary>();

  for (const record of result.data || []) {
    const userId = getSafeString(record._id || record.id);
    users.set(userId, {
      userName:
        getSafeString(record.name) ||
        getSafeString(record.full_name) ||
        getSafeString(record.email).split("@")[0] ||
        "User",
      userEmail: getSafeString(record.email),
    });
  }

  return users;
}

function mapSupabaseUserToSummary(user: {
  email?: string | null;
  user_metadata?: Record<string, any>;
} | null): AdminUserSummary {
  const metadata = user?.user_metadata || {};
  const email = user?.email || "";
  const userName =
    getSafeString(metadata.displayName) ||
    getSafeString(metadata.full_name) ||
    getSafeString(metadata.name) ||
    (email ? email.split("@")[0] : "User");

  return {
    userName,
    userEmail: email,
  };
}

async function loadIntlUsers(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const users = new Map<string, AdminUserSummary>();

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      try {
        const {
          data: { user },
        } = await getSupabaseAdmin().auth.admin.getUserById(userId);

        users.set(userId, mapSupabaseUserToSummary(user));
      } catch {
        users.set(userId, {
          userName: "User",
          userEmail: "",
        });
      }
    }),
  );

  return users;
}

async function loadUsers(userIds: string[]) {
  return isChinaRegion() ? loadChinaUsers(userIds) : loadIntlUsers(userIds);
}

function mapSubscriptionForAdmin(
  record: UnifiedSubscriptionRecord,
  users: Map<string, AdminUserSummary>,
): AdminSubscriptionItem {
  const userSummary = users.get(record.userId) || {
    userName: "User",
    userEmail: "",
  };

  return {
    id: record.id,
    userId: record.userId,
    userName: userSummary.userName,
    userEmail: userSummary.userEmail,
    plan: record.plan,
    price: record.price || 0,
    currency: record.currency || getDefaultCurrency(),
    billingCycle: record.billingCycle || "monthly",
    status: record.status,
    paymentMethod: record.paymentMethod || "",
    currentPeriodEnd: record.currentPeriodEnd || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

function mapPaymentForAdmin(
  record: UnifiedPaymentRecord,
  users: Map<string, AdminUserSummary>,
): AdminPaymentItem {
  const userSummary = users.get(record.userId) || {
    userName: "User",
    userEmail: "",
  };

  return {
    id: record.id,
    userId: record.userId,
    userName: userSummary.userName,
    userEmail: userSummary.userEmail,
    subscriptionId: record.subscriptionId || null,
    amount: record.amount,
    currency: record.currency || getDefaultCurrency(),
    status: record.status,
    paymentMethod: record.paymentMethod || "",
    transactionId: record.transactionId || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    type: "subscription",
  };
}

async function loadChinaSubscriptionItems(
  status: string,
  offset: number,
  limit: number,
) {
  const db = getDatabase();
  const filters = status && status !== "all" ? { status } : {};
  const collection = db.collection("subscriptions");
  const scopedCollection =
    Object.keys(filters).length > 0 ? collection.where(filters) : collection;

  const countResult = await scopedCollection.count();
  const result = await scopedCollection
    .orderBy("updated_at", "desc")
    .skip(offset)
    .limit(limit)
    .get();

  const records = (result.data || []).map((record: Record<string, any>) =>
    normalizeSubscriptionRecord(record),
  );
  const users = await loadChinaUsers(records.map((record) => record.userId));

  return {
    items: records.map((record) => mapSubscriptionForAdmin(record, users)),
    total: countResult.total || 0,
  };
}

async function loadIntlSubscriptionItems(
  status: string,
  offset: number,
  limit: number,
) {
  let query = getSupabaseAdmin()
    .from("subscriptions")
    .select(
      "id,user_id,plan,plan_id,status,price,currency,billing_cycle,payment_method,current_period_end,metadata,created_at,updated_at",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    throw error;
  }

  const records = (data || []).map((record) =>
    normalizeSubscriptionRecord(record as Record<string, any>),
  );
  const users = await loadIntlUsers(records.map((record) => record.userId));

  return {
    items: records.map((record) => mapSubscriptionForAdmin(record, users)),
    total: count || 0,
  };
}

async function loadSubscriptionItems(
  status: string,
  offset: number,
  limit: number,
) {
  return isChinaRegion()
    ? loadChinaSubscriptionItems(status, offset, limit)
    : loadIntlSubscriptionItems(status, offset, limit);
}

async function loadChinaPaymentItems(
  status: string,
  offset: number,
  limit: number,
) {
  const db = getDatabase();
  const filters = status && status !== "all" ? { status } : {};
  const collection = db.collection("payments");
  const scopedCollection =
    Object.keys(filters).length > 0 ? collection.where(filters) : collection;

  const countResult = await scopedCollection.count();
  const result = await scopedCollection
    .orderBy("created_at", "desc")
    .skip(offset)
    .limit(limit)
    .get();

  const records = (result.data || []).map((record: Record<string, any>) =>
    normalizePaymentRecord(record),
  );
  const users = await loadChinaUsers(records.map((record) => record.userId));

  return {
    items: records.map((record) => mapPaymentForAdmin(record, users)),
    total: countResult.total || 0,
  };
}

async function loadIntlPaymentItems(
  status: string,
  offset: number,
  limit: number,
) {
  let query = getSupabaseAdmin()
    .from("payments")
    .select(
      "id,user_id,subscription_id,amount,currency,status,payment_method,transaction_id,external_payment_id,metadata,created_at,updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    throw error;
  }

  const records = (data || []).map((record) =>
    normalizePaymentRecord(record as Record<string, any>),
  );
  const users = await loadIntlUsers(records.map((record) => record.userId));

  return {
    items: records.map((record) => mapPaymentForAdmin(record, users)),
    total: count || 0,
  };
}

async function loadPaymentItems(
  status: string,
  offset: number,
  limit: number,
) {
  return isChinaRegion()
    ? loadChinaPaymentItems(status, offset, limit)
    : loadIntlPaymentItems(status, offset, limit);
}

async function loadChinaSubscriptionStats() {
  const db = getDatabase();
  const command = db.command;
  const collection = db.collection("subscriptions");

  const [totalCount, activeResult, churnCount] = await Promise.all([
    collection.count(),
    collection.where({ status: "active" }).get(),
    collection.where({ status: command.in(CHURN_STATUSES) }).count(),
  ]);

  const activeRecords = (activeResult.data || []).map((record: Record<string, any>) =>
    normalizeSubscriptionRecord(record),
  );

  const stats = buildSubscriptionStats([
    ...activeRecords,
    ...Array.from({ length: Math.max((totalCount.total || 0) - activeRecords.length, 0) }).map(
      () =>
        normalizeSubscriptionRecord({
          status: "inactive",
          currency: getDefaultCurrency(),
        }),
    ),
  ]);

  return {
    ...stats,
    activeCount: activeRecords.length,
    churnCount: churnCount.total || 0,
    renewalRate:
      (totalCount.total || 0) > 0
        ? Number(((activeRecords.length / (totalCount.total || 0)) * 100).toFixed(1))
        : 0,
    mrr: Number(
      activeRecords.reduce((sum, record) => sum + calculateMrrValue(record), 0).toFixed(2),
    ),
    baseCurrency: resolveBaseCurrency(activeRecords),
  };
}

async function loadIntlSubscriptionStats() {
  const admin = getSupabaseAdmin();
  const [totalResult, activeCountResult, churnCountResult, activeRowsResult] =
    await Promise.all([
      admin.from("subscriptions").select("id", { count: "exact", head: true }),
      admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .in("status", CHURN_STATUSES),
      admin
        .from("subscriptions")
        .select("price,currency,billing_cycle,status")
        .eq("status", "active"),
    ]);

  if (totalResult.error) {
    throw totalResult.error;
  }
  if (activeCountResult.error) {
    throw activeCountResult.error;
  }
  if (churnCountResult.error) {
    throw churnCountResult.error;
  }
  if (activeRowsResult.error) {
    throw activeRowsResult.error;
  }

  const activeRecords = (activeRowsResult.data || []).map((record) =>
    normalizeSubscriptionRecord(record as Record<string, any>),
  );
  const total = totalResult.count || 0;
  const activeCount = activeCountResult.count || 0;

  return {
    activeCount,
    mrr: Number(
      activeRecords.reduce((sum, record) => sum + calculateMrrValue(record), 0).toFixed(2),
    ),
    renewalRate: total > 0 ? Number(((activeCount / total) * 100).toFixed(1)) : 0,
    churnCount: churnCountResult.count || 0,
    baseCurrency: resolveBaseCurrency(activeRecords),
  };
}

async function loadSubscriptionStats() {
  return isChinaRegion() ? loadChinaSubscriptionStats() : loadIntlSubscriptionStats();
}

async function syncChinaUserSubscription(userId: string, item: AdminSubscriptionItem) {
  const db = getDatabase();
  await db.collection("web_users").doc(userId).update({
    subscription_plan: item.plan,
    subscription_status: item.status,
    membership_expires_at: item.currentPeriodEnd,
    updated_at: new Date().toISOString(),
  });
}

async function syncIntlUserSubscription(userId: string, item: AdminSubscriptionItem) {
  const {
    data: { user },
    error,
  } = await getSupabaseAdmin().auth.admin.getUserById(userId);

  if (error || !user) {
    throw error || new Error("User not found");
  }

  const metadata = user.user_metadata || {};
  const { error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(
    userId,
    {
      user_metadata: {
        ...metadata,
        subscription_plan: item.plan,
        subscription_status: item.status,
        membership_expires_at: item.currentPeriodEnd,
        updated_at: new Date().toISOString(),
      },
    },
  );

  if (updateError) {
    throw updateError;
  }
}

async function upsertChinaSubscription(body: Record<string, any>) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const userId = getSafeString(body.userId);

  const result = await db
    .collection("subscriptions")
    .where({ user_id: userId })
    .orderBy("updated_at", "desc")
    .limit(1)
    .get();

  const existing = result.data?.[0] as Record<string, any> | undefined;
  const payload = {
    user_id: userId,
    plan: normalizeSubscriptionPlan(body.plan),
    plan_id: normalizeSubscriptionPlan(body.plan),
    status: normalizeSubscriptionStatus(body.status),
    price: Number(body.price || 0),
    currency: getSafeString(body.currency, getDefaultCurrency()),
    billing_cycle: getSafeString(body.billingCycle, "monthly"),
    payment_method: getSafeString(body.paymentMethod),
    current_period_end: body.currentPeriodEnd || null,
    metadata:
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {},
    region: "CN",
    updated_at: now,
  };

  if (existing?._id) {
    await db.collection("subscriptions").doc(existing._id).update(payload);
  } else {
    await db.collection("subscriptions").add({
      ...payload,
      created_at: now,
    });
  }

  const latestResult = await db
    .collection("subscriptions")
    .where({ user_id: userId })
    .orderBy("updated_at", "desc")
    .limit(1)
    .get();

  const latest = latestResult.data?.[0] as Record<string, any> | undefined;
  if (!latest) {
    throw new Error("Failed to save subscription");
  }

  const normalized = normalizeSubscriptionRecord(latest);
  const users = await loadChinaUsers([normalized.userId]);
  const item = mapSubscriptionForAdmin(normalized, users);
  await syncChinaUserSubscription(userId, item);

  return item;
}

async function upsertIntlSubscription(body: Record<string, any>) {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const userId = getSafeString(body.userId);

  const { data: existingRows, error: existingError } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  const payload = buildSupabaseSubscriptionPayload({
    userId,
    plan: normalizeSubscriptionPlan(body.plan),
    status: normalizeSubscriptionStatus(body.status),
    price: Number(body.price || 0),
    currency: getSafeString(body.currency, getDefaultCurrency()),
    billingCycle: getSafeString(body.billingCycle, "monthly"),
    paymentMethod: getSafeString(body.paymentMethod),
    currentPeriodEnd: body.currentPeriodEnd || undefined,
    metadata:
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {},
  });

  const targetId = existingRows?.[0]?.id;

  if (targetId) {
    const { error } = await admin
      .from("subscriptions")
      .update({
        ...payload,
        updated_at: now,
      })
      .eq("id", targetId);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await admin.from("subscriptions").insert({
      ...payload,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      throw error;
    }
  }

  const { data: latestRows, error: latestError } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,plan,plan_id,status,price,currency,billing_cycle,payment_method,current_period_end,metadata,created_at,updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (latestError || !latestRows?.length) {
    throw latestError || new Error("Failed to load saved subscription");
  }

  const normalized = normalizeSubscriptionRecord(
    latestRows[0] as Record<string, any>,
  );
  const users = await loadIntlUsers([normalized.userId]);
  const item = mapSubscriptionForAdmin(normalized, users);
  await syncIntlUserSubscription(userId, item);

  return item;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.error) {
      return auth.error;
    }

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") === "payments" ? "payments" : "subscriptions";
    const status = searchParams.get("status") || "all";
    const { page, limit, offset } = getPagination(searchParams);

    const stats = await loadSubscriptionStats();
    const { items, total } =
      tab === "payments"
        ? await loadPaymentItems(status, offset, limit)
        : await loadSubscriptionItems(status, offset, limit);

    return NextResponse.json({
      success: true,
      data: {
        tab,
        items,
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      },
    });
  } catch (error) {
    console.error("[/api/admin/subscriptions GET] Failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load subscription data",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth.error) {
      return auth.error;
    }

    const body = (await request.json()) as Record<string, any>;
    if (!body.userId || typeof body.userId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "userId is required",
        },
        { status: 400 },
      );
    }

    const subscription = isChinaRegion()
      ? await upsertChinaSubscription(body)
      : await upsertIntlSubscription(body);

    return NextResponse.json({
      success: true,
      data: {
        subscription,
      },
    });
  } catch (error) {
    console.error("[/api/admin/subscriptions POST] Failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save subscription",
      },
      { status: 500 },
    );
  }
}
