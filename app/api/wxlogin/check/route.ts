import { NextRequest, NextResponse } from "next/server";

import { loadChinaAccountProfile } from "@/lib/account/server-profile";
import {
  getDatabase,
  loginOrCreateWechatMiniUser,
} from "@/lib/cloudbase/cloudbase-service";
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

type WechatUserRecord = Record<string, unknown>;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function readString(record: WechatUserRecord | null | undefined, key: string) {
  if (!record) {
    return "";
  }

  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function hasCompletedWechatMiniProfile(
  user: WechatUserRecord | null | undefined,
  openid: string,
) {
  const name =
    readString(user, "name") ||
    readString(user, "full_name");
  const avatar =
    readString(user, "avatar") ||
    readString(user, "avatar_url");

  if (!name || !avatar) {
    return false;
  }

  const generatedName = `微信用户${openid.slice(-6)}`;
  return name !== generatedName;
}

async function findExistingWechatMiniUser(
  openid: string,
  unionid: string,
) {
  const db = getDatabase();
  const usersCollection = db.collection("web_users");
  const syntheticEmail = `wechat_${openid}@local.wechat`;

  if (unionid) {
    const byUnionId = await usersCollection
      .where({ wechat_unionid: unionid })
      .limit(1)
      .get();
    if (byUnionId.data?.[0]) {
      return byUnionId.data[0] as WechatUserRecord;
    }
  }

  const byOpenId = await usersCollection
    .where({ wechat_openid: openid })
    .limit(1)
    .get();
  if (byOpenId.data?.[0]) {
    return byOpenId.data[0] as WechatUserRecord;
  }

  const bySyntheticEmail = await usersCollection
    .where({ email: syntheticEmail })
    .limit(1)
    .get();
  return (bySyntheticEmail.data?.[0] as WechatUserRecord | undefined) || null;
}

export async function POST(request: NextRequest) {
  try {
    if (!isChinaRegion()) {
      return NextResponse.json(
        {
          success: false,
          error: "微信小程序登录预检查仅支持国内版部署",
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const code = String(body?.code || "").trim();

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
            "微信登录预检查失败，请确认 code 有效且小程序配置正确",
          details: wxData.errcode
            ? `errcode=${wxData.errcode}`
            : undefined,
        },
        { status: 401 },
      );
    }

    const openid = String(wxData.openid || "").trim();
    const unionid = String(wxData.unionid || "").trim();
    const existingUser = await findExistingWechatMiniUser(openid, unionid);
    const existedBeforeLogin = Boolean(existingUser);

    const clientIp = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;
    const loginResult = await loginOrCreateWechatMiniUser(openid, {
      unionid,
      nickName:
        readString(existingUser, "name") ||
        readString(existingUser, "full_name") ||
        undefined,
      avatarUrl:
        readString(existingUser, "avatar") ||
        readString(existingUser, "avatar_url") ||
        undefined,
      deviceInfo: "wechat-mini-wxlogin-check",
      ipAddress: clientIp !== "unknown" ? clientIp : undefined,
      userAgent,
    });

    if (
      !loginResult.success ||
      !loginResult.userId ||
      !loginResult.accessToken
    ) {
      return NextResponse.json(
        {
          success: false,
          error: loginResult.error || "微信登录预检查失败",
        },
        { status: loginResult.error === "账号已被禁用" ? 403 : 500 },
      );
    }

    const profile = await loadChinaAccountProfile(loginResult.userId);
    const fallbackUser = {
      id: loginResult.userId,
      email: loginResult.email || `wechat_${openid}@local.wechat`,
      name: loginResult.name || "微信用户",
      avatar:
        loginResult.avatarUrl ||
        readString(existingUser, "avatar") ||
        readString(existingUser, "avatar_url") ||
        "",
      role: "user",
      subscription_plan: "free",
      subscription_status: "inactive",
    };
    const responseUser = profile || fallbackUser;
    const hasProfile = hasCompletedWechatMiniProfile(
      {
        name: responseUser.name,
        avatar: responseUser.avatar,
      },
      openid,
    );

    return NextResponse.json({
      success: true,
      exists: existedBeforeLogin,
      hasProfile,
      needsProfile: !hasProfile,
      token: loginResult.accessToken,
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      tokenMeta: loginResult.tokenMeta,
      openid,
      unionid: unionid || null,
      expiresIn: loginResult.tokenMeta?.accessTokenExpiresIn || 3600,
      userId: loginResult.userId,
      userName: responseUser.name || "",
      userAvatar: responseUser.avatar || "",
      user: responseUser,
    });
  } catch (error) {
    console.error("[/api/wxlogin/check] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "微信小程序登录预检查服务异常",
      },
      { status: 500 },
    );
  }
}
