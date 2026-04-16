import { NextResponse } from "next/server";

const DECOMMISSIONED_MESSAGE_CN =
  "微信小程序登录已下线。当前中国区仅支持邮箱/密码与短信验证码登录。";
const DECOMMISSIONED_MESSAGE_EN =
  "WeChat mini program sign-in has been retired. CN deployment supports email/password and SMS OTP.";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "WECHAT_AUTH_DECOMMISSIONED",
        message: DECOMMISSIONED_MESSAGE_CN,
        message_en: DECOMMISSIONED_MESSAGE_EN,
      },
    },
    { status: 410 },
  );
}
