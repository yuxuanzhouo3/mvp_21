import type { User as SupabaseUser } from "@supabase/supabase-js";

import {
  normalizeAccountProfile,
  normalizeUserPreferences,
  type AccountProfile,
} from "@/lib/account/profile";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

type SupabaseAuthUserLike = Pick<SupabaseUser, "id" | "email" | "user_metadata">;

interface SubscriptionSnapshot {
  plan: string;
  status: string;
  membershipExpiresAt?: string;
}

function buildSubscriptionSnapshot(
  fallback: {
    plan?: string;
    status?: string;
    membershipExpiresAt?: string;
    pro?: boolean;
  },
  subscription?: {
    plan_id?: string | null;
    status?: string | null;
    current_period_end?: string | null;
  } | null,
): SubscriptionSnapshot {
  const plan =
    subscription?.plan_id ||
    fallback.plan ||
    (fallback.pro ? "pro" : "free");

  const status =
    subscription?.status ||
    fallback.status ||
    (plan !== "free" ? "active" : "inactive");

  return {
    plan,
    status,
    membershipExpiresAt:
      subscription?.current_period_end || fallback.membershipExpiresAt,
  };
}

export async function loadChinaAccountProfile(
  userId: string,
): Promise<AccountProfile | null> {
  const db = getDatabase();
  const userResult = await db.collection("web_users").doc(userId).get();
  const user = userResult?.data?.[0] as Record<string, any> | undefined;

  if (!user) {
    return null;
  }

  let subscription:
    | { plan_id?: string | null; status?: string | null; current_period_end?: string | null }
    | null = null;

  try {
    const subscriptionResult = await db
      .collection("subscriptions")
      .where({
        user_id: userId,
        status: "active",
      })
      .get();

    subscription = subscriptionResult?.data?.[0] || null;
  } catch (error) {
    console.warn("[AccountProfile] Failed to load CN subscription snapshot:", error);
  }

  const subscriptionSnapshot = buildSubscriptionSnapshot(
    {
      plan: user.subscription_plan,
      status: user.subscription_status,
      membershipExpiresAt:
        user.membership_expires_at || user.subscription_expires_at,
      pro: user.pro,
    },
    subscription,
  );

  return normalizeAccountProfile({
    id: user._id || user.id || userId,
    email: user.email || "",
    name: user.name || user.full_name || "",
    avatar: user.avatar || user.avatar_url || "",
    phone: user.phone || "",
    subscription_plan: subscriptionSnapshot.plan,
    subscription_status: subscriptionSnapshot.status,
    subscription_expires_at:
      subscription?.current_period_end || user.subscription_expires_at,
    membership_expires_at: subscriptionSnapshot.membershipExpiresAt,
    preferences: normalizeUserPreferences(user.preferences),
  });
}

export async function loadIntlAccountProfile(
  userId: string,
  authUser?: SupabaseAuthUserLike | null,
): Promise<AccountProfile | null> {
  let resolvedUser = authUser || null;

  if (!resolvedUser) {
    const {
      data: { user },
      error,
    } = await getSupabaseAdmin().auth.admin.getUserById(userId);

    if (error || !user) {
      return null;
    }

    resolvedUser = user;
  }

  const metadata = resolvedUser.user_metadata || {};

  let subscription:
    | { plan_id?: string | null; status?: string | null; current_period_end?: string | null }
    | null = null;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("subscriptions")
      .select("plan_id, status, current_period_end")
      .eq("user_id", userId)
      .order("current_period_end", { ascending: false })
      .limit(1);

    if (!error && data?.length) {
      subscription = data[0] as {
        plan_id?: string | null;
        status?: string | null;
        current_period_end?: string | null;
      };
    }
  } catch (error) {
    console.warn("[AccountProfile] Failed to load INTL subscription snapshot:", error);
  }

  const subscriptionSnapshot = buildSubscriptionSnapshot(
    {
      plan: metadata.subscription_plan,
      status: metadata.subscription_status,
      membershipExpiresAt:
        metadata.membership_expires_at || metadata.subscription_expires_at,
      pro: metadata.pro,
    },
    subscription,
  );

  return normalizeAccountProfile({
    id: resolvedUser.id,
    email: resolvedUser.email || "",
    name: metadata.displayName || metadata.full_name || metadata.name || "",
    avatar: metadata.avatar || metadata.avatar_url || "",
    phone: metadata.phone || "",
    subscription_plan: subscriptionSnapshot.plan,
    subscription_status: subscriptionSnapshot.status,
    subscription_expires_at:
      subscription?.current_period_end || metadata.subscription_expires_at,
    membership_expires_at: subscriptionSnapshot.membershipExpiresAt,
    preferences: normalizeUserPreferences(metadata.preferences),
  });
}
