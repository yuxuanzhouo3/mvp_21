import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { normalizeUserPreferences } from "@/lib/account/profile";
import {
  loadChinaAccountProfile,
  loadIntlAccountProfile,
} from "@/lib/account/server-profile";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import { logSecurityEvent } from "@/lib/utils/logger";

const updateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  data: z.record(z.any()).optional(),
});

function normalizeProfileMetadata(
  existingMetadata: Record<string, any>,
  data: Record<string, any> = {},
) {
  const nextMetadata: Record<string, unknown> = {
    ...existingMetadata,
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) {
    nextMetadata.displayName = data.name;
    nextMetadata.full_name = data.name;
    nextMetadata.name = data.name;
  }

  if (data.avatar !== undefined) {
    nextMetadata.avatar = data.avatar;
    nextMetadata.avatar_url = data.avatar;
  }

  if (data.phone !== undefined) {
    nextMetadata.phone = data.phone;
  }

  if (data.preferences !== undefined) {
    nextMetadata.preferences = normalizeUserPreferences({
      ...existingMetadata.preferences,
      ...data.preferences,
    });
  }

  for (const [key, value] of Object.entries(data)) {
    if (["name", "avatar", "phone", "preferences"].includes(key)) {
      continue;
    }
    nextMetadata[key] = value;
  }

  return nextMetadata;
}

async function requireUserId(request: NextRequest) {
  const { token, error: tokenError } = extractTokenFromRequest(request);

  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        {
          error: tokenError || "No authentication token",
          code: "NO_AUTH_TOKEN",
        },
        { status: 401 },
      ),
    };
  }

  const authResult = await verifyAuthToken(token);
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        {
          error: authResult.error || "Invalid token",
          code: "INVALID_TOKEN",
        },
        { status: 401 },
      ),
    };
  }

  return { userId: authResult.userId };
}

export async function POST(request: NextRequest) {
  try {
    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const auth = await requireUserId(request);
    if (auth.error) {
      return auth.error;
    }

    const validationResult = updateSchema.safeParse(await request.json());
    if (!validationResult.success) {
      logSecurityEvent("update_validation_failed", auth.userId, clientIP, {
        errors: validationResult.error.errors,
      });

      return NextResponse.json(
        {
          error: "Invalid input",
          code: "VALIDATION_ERROR",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { email, password, data } = validationResult.data;
    const userId = auth.userId;

    if (isChinaRegion()) {
      const db = getDatabase();
      const userResult = await db.collection("web_users").doc(userId).get();
      const existingUser = userResult?.data?.[0] as Record<string, any> | undefined;

      if (!existingUser) {
        return NextResponse.json(
          {
            error: "User not found",
            code: "USER_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (email !== undefined) {
        updateData.email = email;
      }

      if (password !== undefined) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      if (data) {
        if (data.name !== undefined) updateData.name = data.name;
        if (data.avatar !== undefined) updateData.avatar = data.avatar;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.preferences !== undefined) {
          updateData.preferences = normalizeUserPreferences({
            ...existingUser.preferences,
            ...data.preferences,
          });
        }

        for (const [key, value] of Object.entries(data)) {
          if (["name", "avatar", "phone", "preferences"].includes(key)) {
            continue;
          }
          updateData[key] = value;
        }
      }

      await db.collection("web_users").doc(userId).update(updateData);

      const profile = await loadChinaAccountProfile(userId);
      if (!profile) {
        return NextResponse.json(
          {
            error: "Failed to update user",
            code: "UPDATE_FAILED",
          },
          { status: 500 },
        );
      }

      logSecurityEvent("user_updated", userId, clientIP, {
        region: "CN",
        updatedFields: Object.keys(updateData),
      });

      return NextResponse.json({
        success: true,
        message: "User updated successfully",
        user: profile,
      });
    }

    const {
      data: { user: existingUser },
      error: existingUserError,
    } = await getSupabaseAdmin().auth.admin.getUserById(userId);

    if (existingUserError || !existingUser) {
      return NextResponse.json(
        {
          error: "User not found",
          code: "USER_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    const updatePayload: {
      email?: string;
      password?: string;
      user_metadata?: Record<string, unknown>;
    } = {
      user_metadata: normalizeProfileMetadata(existingUser.user_metadata || {}, data),
    };

    if (email !== undefined) {
      updatePayload.email = email;
    }

    if (password !== undefined) {
      updatePayload.password = password;
    }

    const { data: updatedData, error } =
      await getSupabaseAdmin().auth.admin.updateUserById(userId, updatePayload);

    if (error || !updatedData.user) {
      return NextResponse.json(
        {
          error: "Failed to update user",
          code: "UPDATE_FAILED",
          details: error?.message,
        },
        { status: 500 },
      );
    }

    const profile = await loadIntlAccountProfile(userId, updatedData.user);
    if (!profile) {
      return NextResponse.json(
        {
          error: "Failed to update user",
          code: "UPDATE_FAILED",
        },
        { status: 500 },
      );
    }

    logSecurityEvent("user_updated", userId, clientIP, {
      region: "INTL",
      updatedFields: [
        ...(email !== undefined ? ["email"] : []),
        ...(password !== undefined ? ["password"] : []),
        ...Object.keys(data || {}),
      ],
    });

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      user: profile,
    });
  } catch (error) {
    console.error("Update user error:", error);
    logSecurityEvent(
      "update_user_error",
      undefined,
      request.headers.get("x-forwarded-for") || "unknown",
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    );

    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
