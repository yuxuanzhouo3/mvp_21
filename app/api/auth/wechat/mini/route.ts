import { NextRequest, NextResponse } from "next/server";

import { loadChinaAccountProfile } from "@/lib/account/server-profile";
import { loginOrCreateWechatUser } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getWechatOAuthAppId } from "@/lib/config/runtime-env";

type WechatCode2SessionSuccess = {
  openid: string;
  unionid?: string;
  session_key: string;
};

type WechatCode2SessionFailure = {
  errcode: number;
  errmsg?: string;
};

type WechatCode2SessionResponse =
  | WechatCode2SessionSuccess
  | WechatCode2SessionFailure;

function getWechatAppSecret(): string {
  return String(
    process.env.WECHAT_MINI_APP_SECRET ||
      process.env.WECHAT_APP_SECRET ||
      ""
  ).trim();
}

async function exchangeMiniProgramCode(code: string) {
  const appId = getWechatOAuthAppId();
  const appSecret = getWechatAppSecret();

  if (!appId || !appSecret) {
    throw new Error(
      "WeChat mini program auth is not configured. Please set WECHAT_APP_ID and WECHAT_APP_SECRET."
    );
  }

  const params = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    js_code: code,
    grant_type: "authorization_code",
  });

  const response = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`,
    { method: "GET", cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`WeChat API request failed with status ${response.status}`);
  }

  const payload =
    (await response.json()) as WechatCode2SessionResponse;

  if ("errcode" in payload) {
    throw new Error(
      `WeChat code2session failed (${payload.errcode}): ${
        payload.errmsg || "unknown error"
      }`
    );
  }

  if (!payload.openid) {
    throw new Error("WeChat response is missing openid");
  }

  return payload;
}

export async function POST(request: NextRequest) {
  try {
    if (!isChinaRegion()) {
      return NextResponse.json(
        { success: false, error: { message: "微信登录仅支持中国区部署" } },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      code?: string;
      profile?: {
        nickname?: string;
        avatar?: string;
      };
    };

    const code = String(body?.code || "").trim();
    if (!code) {
      return NextResponse.json(
        { success: false, error: { message: "缺少微信登录 code" } },
        { status: 400 }
      );
    }

    const wechatSession = await exchangeMiniProgramCode(code);

    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    const loginResult = await loginOrCreateWechatUser(
      {
        openId: wechatSession.openid,
        unionId: wechatSession.unionid,
        nickname: body?.profile?.nickname,
        avatar: body?.profile?.avatar,
      },
      {
        deviceInfo: "wechat-mini-program",
        ipAddress: clientIP !== "unknown" ? clientIP : undefined,
        userAgent,
      }
    );

    if (!loginResult.success || !loginResult.userId || !loginResult.accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: { message: loginResult.error || "微信登录失败，请稍后重试" },
        },
        { status: loginResult.error === "账号已被禁用" ? 403 : 500 }
      );
    }

    const profile =
      (await loadChinaAccountProfile(loginResult.userId)) || {
        id: loginResult.userId,
        email: loginResult.email || `wechat_${wechatSession.openid}@local.wechat`,
        name: loginResult.name || "微信用户",
        phone: loginResult.phone || "",
        role: "user",
        subscription_plan: "free",
        subscription_status: "inactive",
      };

    const response = NextResponse.json({
      success: true,
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      tokenMeta: loginResult.tokenMeta,
      user: profile,
      token: loginResult.accessToken,
      session: {
        access_token: loginResult.accessToken,
        refresh_token: loginResult.refreshToken,
        user: profile,
      },
      data: {
        user: profile,
        token: loginResult.accessToken,
        refreshToken: loginResult.refreshToken,
      },
    });

    const maxAge = loginResult.tokenMeta?.accessTokenExpiresIn || 3600;

    response.cookies.set("auth-token", loginResult.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    response.cookies.set("auth_token", loginResult.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("微信小程序登录失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : "微信登录失败，请重试",
        },
      },
      { status: 500 }
    );
  }
}

