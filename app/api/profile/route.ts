import { NextRequest, NextResponse } from "next/server";

import { normalizeUserPreferences } from "@/lib/account/profile";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserId(request);
    if (auth.error) {
      return auth.error;
    }

    const profile = isChinaRegion()
      ? await loadChinaAccountProfile(auth.userId)
      : await loadIntlAccountProfile(auth.userId);

    if (!profile) {
      return NextResponse.json(
        { error: "User not found", code: "USER_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[/api/profile GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 },
    );
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

      const profile = await loadChinaAccountProfile(userId);
      if (!profile) {
        return NextResponse.json(
          { error: "Failed to load updated profile" },
          { status: 500 },
        );
      }

      return NextResponse.json(profile);
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
        ...(existingMetadata.preferences as Record<string, unknown> | undefined),
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
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 },
      );
    }

    const profile = await loadIntlAccountProfile(userId, data.user);
    if (!profile) {
      return NextResponse.json(
        { error: "Failed to load updated profile" },
        { status: 500 },
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[/api/profile POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 },
    );
  }
}
