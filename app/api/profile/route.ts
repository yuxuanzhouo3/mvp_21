import { NextRequest, NextResponse } from "next/server";

import {
  normalizeAccountSecuritySettings,
  normalizeAccountSessions,
  normalizeUserPreferences,
  type AccountProfile,
  type AccountSessionRecord,
} from "@/lib/account/profile";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { normalizeAvatarSrc } from "@/lib/account/avatar";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

async function requireUserId(request: NextRequest) {
  const { token, error: tokenError } = extractTokenFromRequest(request);

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

function detectDeviceName(userAgent: string) {
  const browser = /Edg/i.test(userAgent)
    ? "Edge"
    : /Chrome/i.test(userAgent)
      ? "Chrome"
      : /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)
        ? "Safari"
        : /Firefox/i.test(userAgent)
          ? "Firefox"
          : "Browser";
  const platform = /Windows/i.test(userAgent)
    ? "Windows"
    : /Mac OS X/i.test(userAgent)
      ? "macOS"
      : /Android/i.test(userAgent)
        ? "Android"
        : /iPhone|iPad|iOS/i.test(userAgent)
          ? "iOS"
          : "Desktop";

  return `${platform} · ${browser}`;
}

function buildCurrentSession(request: NextRequest): AccountSessionRecord {
  const userAgent = request.headers.get("user-agent") || "";
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const ipAddress = forwardedFor.split(",")[0]?.trim() || "Unknown IP";

  return {
    id: "current-session",
    device: detectDeviceName(userAgent),
    location: "Current session",
    ipAddress,
    lastActiveAt: new Date().toISOString(),
    trusted: true,
    current: true,
    userAgent: userAgent || undefined,
  };
}

function attachCurrentSession(
  profile: AccountProfile,
  request: NextRequest,
): AccountProfile {
  const currentSession = buildCurrentSession(request);
  const nextSessions = [
    currentSession,
    ...profile.sessions
      .filter((session) => session.id !== currentSession.id)
      .map((session) => ({ ...session, current: false })),
  ].slice(0, 12);

  return {
    ...profile,
    sessions: nextSessions,
  };
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

    return NextResponse.json(attachCurrentSession(profile, request));
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
      security,
      sessions,
      activeCompanyProfileId,
    }: {
      name?: string;
      avatar?: string;
      phone?: string;
      preferences?: Record<string, unknown>;
      security?: Record<string, unknown>;
      sessions?: Array<Record<string, unknown>>;
      activeCompanyProfileId?: string;
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
      if (avatar !== undefined) {
        const sanitizedAvatar =
          typeof avatar === "string" ? normalizeAvatarSrc(avatar) || "" : "";
        updateData.avatar = sanitizedAvatar;
      }
      if (phone !== undefined) updateData.phone = phone;
      if (preferences !== undefined) {
        updateData.preferences = normalizeUserPreferences({
          ...existingUser.preferences,
          ...preferences,
        });
      }
      if (security !== undefined) {
        updateData.security_settings = normalizeAccountSecuritySettings({
          ...existingUser.security_settings,
          ...security,
        });
      }
      if (sessions !== undefined) {
        updateData.account_sessions = normalizeAccountSessions(
          sessions.filter((session) => !session.current),
        );
      }
      if (activeCompanyProfileId !== undefined) {
        updateData.active_company_profile_id = activeCompanyProfileId || null;
      }

      await db.collection("web_users").doc(userId).update(updateData);

      const profile = await loadChinaAccountProfile(userId);
      if (!profile) {
        return NextResponse.json(
          { error: "Failed to load updated profile" },
          { status: 500 },
        );
      }

      return NextResponse.json(attachCurrentSession(profile, request));
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
      const sanitizedAvatar =
        typeof avatar === "string" ? normalizeAvatarSrc(avatar) || "" : "";
      nextMetadata.avatar = sanitizedAvatar;
      nextMetadata.avatar_url = sanitizedAvatar;
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
    if (security !== undefined) {
      nextMetadata.security_settings = normalizeAccountSecuritySettings({
        ...(existingMetadata.security_settings as Record<string, unknown> | undefined),
        ...security,
      });
    }
    if (sessions !== undefined) {
      nextMetadata.account_sessions = normalizeAccountSessions(
        sessions.filter((session) => !session.current),
      );
    }
    if (activeCompanyProfileId !== undefined) {
      nextMetadata.active_company_profile_id = activeCompanyProfileId || null;
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

    return NextResponse.json(attachCurrentSession(profile, request));
  } catch (error) {
    console.error("[/api/profile POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 },
    );
  }
}
