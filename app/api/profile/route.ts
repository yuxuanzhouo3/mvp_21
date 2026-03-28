import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  normalizeAccountProfile,
  normalizeUserPreferences,
} from "@/lib/account/profile";
import { verifyAuthToken, extractTokenFromHeader } from "@/lib/auth/auth-utils";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";

let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  supabaseAdminInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );

  return supabaseAdminInstance;
}

async function requireUserId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { token, error: tokenError } = extractTokenFromHeader(authHeader);

  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        { error: tokenError || "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const authResult = await verifyAuthToken(token);
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        { error: authResult.error || "Invalid token" },
        { status: 401 },
      ),
    };
  }

  return { userId: authResult.userId };
}

async function loadChinaMembershipExpiry(userId: string, fallback?: string) {
  try {
    const db = getDatabase();
    const subscriptionResult = await db
      .collection("subscriptions")
      .where({
        user_id: userId,
        status: "active",
      })
      .get();

    if (subscriptionResult.data?.length) {
      return subscriptionResult.data[0]?.current_period_end || fallback;
    }
  } catch (error) {
    console.warn("[/api/profile] Failed to load CN membership expiry:", error);
  }

  return fallback;
}

async function loadIntlMembershipExpiry(userId: string, fallback?: string) {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();
    const subscription = data as { current_period_end?: string } | null;

    if (!error && subscription?.current_period_end) {
      return subscription.current_period_end;
    }
  } catch (error) {
    console.warn("[/api/profile] Failed to load INTL membership expiry:", error);
  }

  return fallback;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserId(request);
    if (auth.error) {
      return auth.error;
    }

    const { userId } = auth;

    if (isChinaRegion()) {
      const db = getDatabase();
      const userResult = await db.collection("web_users").doc(userId).get();
      const user = userResult?.data?.[0] as Record<string, any> | undefined;

      if (!user) {
        return NextResponse.json(
          { error: "User not found", code: "USER_NOT_FOUND" },
          { status: 404 },
        );
      }

      const membershipExpiresAt = await loadChinaMembershipExpiry(
        userId,
        user.membership_expires_at,
      );

      return NextResponse.json(
        normalizeAccountProfile({
          id: user._id || user.id || userId,
          email: user.email,
          name: user.name || "",
          avatar: user.avatar || "",
          phone: user.phone || "",
          subscription_plan: user.subscription_plan || (user.pro ? "pro" : "free"),
          subscription_status:
            user.subscription_status || (user.pro ? "active" : "inactive"),
          subscription_expires_at: user.subscription_expires_at,
          membership_expires_at: membershipExpiresAt,
          preferences: normalizeUserPreferences(user.preferences),
        }),
      );
    }

    const {
      data: { user },
      error,
    } = await getSupabaseAdmin().auth.admin.getUserById(userId);

    if (error || !user) {
      return NextResponse.json(
        { error: "User not found", code: "USER_NOT_FOUND" },
        { status: 404 },
      );
    }

    const metadata = user.user_metadata || {};
    const membershipExpiresAt = await loadIntlMembershipExpiry(
      userId,
      metadata.membership_expires_at,
    );

    return NextResponse.json(
      normalizeAccountProfile({
        id: user.id,
        email: user.email || "",
        name: metadata.displayName || metadata.full_name || "",
        avatar: metadata.avatar || metadata.avatar_url || "",
        phone: metadata.phone || "",
        subscription_plan:
          metadata.subscription_plan || (metadata.pro ? "pro" : "free"),
        subscription_status:
          metadata.subscription_status || (metadata.pro ? "active" : "inactive"),
        subscription_expires_at: metadata.subscription_expires_at,
        membership_expires_at: membershipExpiresAt,
        preferences: normalizeUserPreferences(metadata.preferences),
      }),
    );
  } catch (error) {
    console.error("[/api/profile GET] Error:", error);
    return NextResponse.json({ error: "获取用户资料失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserId(request);
    if (auth.error) {
      return auth.error;
    }

    const { userId } = auth;
    const body = await request.json();
    const {
      name,
      avatar,
      phone,
      preferences,
    }: {
      name?: string;
      avatar?: string;
      phone?: string;
      preferences?: Record<string, unknown>;
    } = body;

    if (isChinaRegion()) {
      const db = getDatabase();
      const existingUserResult = await db.collection("web_users").doc(userId).get();
      const existingUser = existingUserResult?.data?.[0] as Record<string, any> | undefined;

      if (!existingUser) {
        return NextResponse.json(
          { error: "User not found", code: "USER_NOT_FOUND" },
          { status: 404 },
        );
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updateData.name = name;
      if (avatar !== undefined) updateData.avatar = avatar;
      if (phone !== undefined) updateData.phone = phone;
      if (preferences !== undefined) {
        updateData.preferences = normalizeUserPreferences({
          ...existingUser.preferences,
          ...preferences,
        });
      }

      await db.collection("web_users").doc(userId).update(updateData);

      const updatedUserResult = await db.collection("web_users").doc(userId).get();
      const updatedUser = updatedUserResult?.data?.[0] as Record<string, any> | undefined;

      if (!updatedUser) {
        return NextResponse.json({ error: "更新失败" }, { status: 500 });
      }

      return NextResponse.json(
        normalizeAccountProfile({
          id: updatedUser._id || updatedUser.id || userId,
          email: updatedUser.email,
          name: updatedUser.name || "",
          avatar: updatedUser.avatar || "",
          phone: updatedUser.phone || "",
          subscription_plan:
            updatedUser.subscription_plan || (updatedUser.pro ? "pro" : "free"),
          subscription_status:
            updatedUser.subscription_status ||
            (updatedUser.pro ? "active" : "inactive"),
          subscription_expires_at: updatedUser.subscription_expires_at,
          membership_expires_at: updatedUser.membership_expires_at,
          preferences: normalizeUserPreferences(updatedUser.preferences),
        }),
      );
    }

    const {
      data: { user: existingUser },
      error: existingUserError,
    } = await getSupabaseAdmin().auth.admin.getUserById(userId);

    if (existingUserError || !existingUser) {
      return NextResponse.json(
        { error: "User not found", code: "USER_NOT_FOUND" },
        { status: 404 },
      );
    }

    const existingMetadata = existingUser.user_metadata || {};
    const nextMetadata: Record<string, unknown> = {
      ...existingMetadata,
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      nextMetadata.displayName = name;
      nextMetadata.full_name = name;
    }
    if (avatar !== undefined) {
      nextMetadata.avatar = avatar;
      nextMetadata.avatar_url = avatar;
    }
    if (phone !== undefined) {
      nextMetadata.phone = phone;
    }
    if (preferences !== undefined) {
      nextMetadata.preferences = normalizeUserPreferences({
        ...existingMetadata.preferences,
        ...preferences,
      });
    }

    const { data, error } = await getSupabaseAdmin().auth.admin.updateUserById(
      userId,
      {
        user_metadata: nextMetadata,
      },
    );

    if (error || !data?.user) {
      console.error("[/api/profile] Failed to update INTL profile:", error);
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    const updatedMetadata = data.user.user_metadata || {};

    return NextResponse.json(
      normalizeAccountProfile({
        id: data.user.id,
        email: data.user.email || "",
        name: updatedMetadata.displayName || updatedMetadata.full_name || "",
        avatar: updatedMetadata.avatar || updatedMetadata.avatar_url || "",
        phone: updatedMetadata.phone || "",
        subscription_plan:
          updatedMetadata.subscription_plan || (updatedMetadata.pro ? "pro" : "free"),
        subscription_status:
          updatedMetadata.subscription_status ||
          (updatedMetadata.pro ? "active" : "inactive"),
        subscription_expires_at: updatedMetadata.subscription_expires_at,
        membership_expires_at: updatedMetadata.membership_expires_at,
        preferences: normalizeUserPreferences(updatedMetadata.preferences),
      }),
    );
  } catch (error) {
    console.error("[/api/profile POST] Error:", error);
    return NextResponse.json({ error: "更新用户资料失败" }, { status: 500 });
  }
}
