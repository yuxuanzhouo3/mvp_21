import { NextRequest, NextResponse } from "next/server";

import { loadChinaAccountProfile } from "@/lib/account/server-profile";
import { loginOrCreateWechatMiniUser } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import {
  getWechatMiniAppId,
  getWechatMiniAppSecret,
} from "@/lib/config/runtime-env";

interface WechatCode2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
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
        {
          success: false,
          error: "微信小程序登录仅支持国内版部署",
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const code = String(body?.code || "").trim();
    const nickName = String(body?.nickName || "").trim();
    const avatarUrl = String(body?.avatarUrl || "").trim();

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少微信登录 code",
        },
        { status: 400 },
      );
    }

    const appId = getWechatMiniAppId();
    const appSecret = getWechatMiniAppSecret();

    if (!appId || !appSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "未配置微信小程序登录环境变量，请设置 WECHAT_MINIPROGRAM_APPID 和 WECHAT_MINIPROGRAM_SECRET",
        },
        { status: 500 },
      );
    }

    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(
      appId,
    )}&secret=${encodeURIComponent(
      appSecret,
    )}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    const wxResponse = await fetch(wxUrl, {
      method: "GET",
      cache: "no-store",
    });
    const wxData = (await wxResponse.json()) as WechatCode2SessionResponse;

    if (!wxResponse.ok || wxData.errcode || !wxData.openid) {
      return NextResponse.json(
        {
          success: false,
          error:
            wxData.errmsg ||
            "微信登录失败，请确认 code 有效且小程序配置正确",
          details: wxData.errcode
            ? `errcode=${wxData.errcode}`
            : undefined,
        },
        { status: 401 },
      );
    }

    const clientIp = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    const loginResult = await loginOrCreateWechatMiniUser(wxData.openid, {
      unionid: wxData.unionid,
      nickName,
      avatarUrl,
      deviceInfo: "wechat-mini-wxlogin",
      ipAddress: clientIp !== "unknown" ? clientIp : undefined,
      userAgent,
    });

    if (!loginResult.success || !loginResult.userId || !loginResult.accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: loginResult.error || "微信登录失败",
        },
        { status: loginResult.error === "账号已被禁用" ? 403 : 500 },
      );
    }

    const profile = await loadChinaAccountProfile(loginResult.userId);
    const responseUser = profile
      ? {
          ...profile,
          nickName: profile.name,
          avatarUrl: profile.avatar,
        }
      : {
          id: loginResult.userId,
          email: loginResult.email || `wechat_${wxData.openid}@local.wechat`,
          name: loginResult.name || "微信用户",
          nickName: loginResult.name || "微信用户",
          avatar: loginResult.avatarUrl || "",
          avatarUrl: loginResult.avatarUrl || "",
          role: "user",
          subscription_plan: "free",
          subscription_status: "inactive",
        };

    return NextResponse.json({
      success: true,
      token: loginResult.accessToken,
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      tokenMeta: loginResult.tokenMeta,
      openid: wxData.openid,
      unionid: wxData.unionid || null,
      expiresIn: loginResult.tokenMeta?.accessTokenExpiresIn || 3600,
      user: responseUser,
    });
  } catch (error) {
    console.error("[/api/wxlogin] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "微信小程序登录服务异常",
      },
      { status: 500 },
    );
  }
}
