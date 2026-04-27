import { NextRequest, NextResponse } from "next/server";

import { loadChinaAccountProfile } from "@/lib/account/server-profile";
import { verifyJwt } from "@/lib/auth/jwt";
import { createRefreshToken } from "@/lib/auth/refresh-token-manager";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";

interface DecodedAccessTokenPayload {
  userId?: string;
  email?: string;
  openid?: string;
  unionid?: string;
  region?: string;
  exp?: number;
}

function resolveAccessTokenExpiresInSeconds(exp?: number) {
  if (!exp || !Number.isFinite(exp)) {
    return 3600;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(exp - nowSeconds, 60);
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    if (!isChinaRegion()) {
      return NextResponse.json(
        { success: false, error: "小程序登录回调仅支持国内版部署" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const token = String(body?.token || body?.accessToken || "").trim();
    const openid = String(body?.openid || "").trim();
    const unionid = String(body?.unionid || "").trim();
    const nickName = String(body?.nickName || body?.mpNickName || "").trim();
    const avatarUrl = String(body?.avatarUrl || body?.mpAvatarUrl || "").trim();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "缺少登录 token" },
        { status: 400 },
      );
    }

    let decoded: DecodedAccessTokenPayload;
    try {
      const parsed = verifyJwt<DecodedAccessTokenPayload>(token);
      decoded = typeof parsed === "string" ? {} : parsed;
    } catch {
      return NextResponse.json(
        { success: false, error: "登录凭证无效或已过期" },
        { status: 401 },
      );
    }

    const userId = String(decoded.userId || "").trim();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "登录凭证缺少用户信息" },
        { status: 401 },
      );
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      updatedAt: now,
      updated_at: now,
    };

    if (openid) {
      updatePayload.wechat_openid = openid;
      updatePayload.provider = "wechat";
      updatePayload.provider_id = openid;
    }
    if (unionid) {
      updatePayload.wechat_unionid = unionid;
    }
    if (nickName) {
      updatePayload.name = nickName.slice(0, 50);
    }
    if (avatarUrl) {
      updatePayload.avatar = avatarUrl;
      updatePayload.avatar_url = avatarUrl;
    }

    if (Object.keys(updatePayload).length > 2) {
      try {
        await db.collection("web_users").doc(userId).update(updatePayload);
      } catch (updateError) {
        console.warn("[/api/auth/mp-callback] Failed to update profile fields:", updateError);
      }
    }

    const profile = await loadChinaAccountProfile(userId);
    const email = profile?.email || decoded.email || `wechat_${openid || "unknown"}@local.wechat`;

    const clientIp = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;
    const refreshTokenRecord = await createRefreshToken({
      userId,
      email,
      deviceInfo: "wechat-mini-callback",
      ipAddress: clientIp !== "unknown" ? clientIp : undefined,
      userAgent,
    });

    if (!refreshTokenRecord) {
      return NextResponse.json(
        { success: false, error: "无法生成 refresh token" },
        { status: 500 },
      );
    }

    const accessTokenExpiresIn = resolveAccessTokenExpiresInSeconds(decoded.exp);
    const refreshTokenExpiresIn = 604800;
    const response = NextResponse.json({
      success: true,
      accessToken: token,
      refreshToken: refreshTokenRecord.refreshToken,
      tokenMeta: {
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
      },
      user: profile || {
        id: userId,
        email,
        name: nickName || "微信用户",
        avatar: avatarUrl || "",
        role: "user",
        subscription_plan: "free",
        subscription_status: "inactive",
      },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: accessTokenExpiresIn,
      path: "/",
    });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: accessTokenExpiresIn,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[/api/auth/mp-callback] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "小程序登录回调失败",
      },
      { status: 500 },
    );
  }
}
