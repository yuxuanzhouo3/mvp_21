import { NextRequest, NextResponse } from "next/server";

import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";

export interface DashboardCurrentUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  membershipExpiresAt?: string;
}

export async function requireDashboardUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { token, error: tokenError } = extractTokenFromHeader(authHeader);

  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        { success: false, error: { message: "Please sign in first." } },
        { status: 401 },
      ),
    };
  }

  const authResult = await verifyAuthToken(token);
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: { message: authResult.error || "Invalid token." },
        },
        { status: 401 },
      ),
    };
  }

  const profile = isChinaRegion()
    ? await loadChinaAccountProfile(authResult.userId)
    : await loadIntlAccountProfile(
        authResult.userId,
        authResult.user && "user_metadata" in authResult.user
          ? authResult.user
          : undefined,
      );

  if (!profile) {
    return {
      error: NextResponse.json(
        { success: false, error: { message: "User not found." } },
        { status: 404 },
      ),
    };
  }

  return {
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name || profile.email || "Workspace Owner",
      avatar: profile.avatar || "",
      role: profile.role || "user",
      subscriptionPlan: profile.subscription_plan,
      subscriptionStatus: profile.subscription_status,
      membershipExpiresAt:
        profile.membership_expires_at || profile.subscription_expires_at,
    } as DashboardCurrentUser,
  };
}
