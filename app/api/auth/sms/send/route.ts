/**
 * 发送短信验证码 API
 * POST /api/auth/sms/send
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/lib/db';

// 验证码存储（生产环境应使用 Redis）
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// 生成6位验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: { message: '请输入手机号' } },
        { status: 400 }
      );
    }

    // 验证手机号格式（中国大陆）
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { success: false, error: { message: '手机号格式不正确' } },
        { status: 400 }
      );
    }

    // 检查发送频率（1分钟内只能发一次）
    const existing = verificationCodes.get(phone);
    if (existing && existing.expiresAt - Date.now() > 4 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: { message: '发送太频繁，请稍后再试' } },
        { status: 429 }
      );
    }

    // 生成验证码
    const code = generateCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟有效

    // 存储验证码
    verificationCodes.set(phone, { code, expiresAt });

    // TODO: 调用腾讯云短信服务发送验证码
    // 开发阶段直接打印验证码
    console.log(`📱 验证码发送到 ${phone}: ${code}`);

    // 实际发送短信的代码（需要配置腾讯云短信服务）
    /*
    const tencentcloud = require('tencentcloud-sdk-nodejs');
    const SmsClient = tencentcloud.sms.v20210111.Client;

    const client = new SmsClient({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY,
      },
      region: 'ap-guangzhou',
    });

    await client.SendSms({
      SmsSdkAppId: process.env.TENCENT_SMS_APP_ID,
      SignName: process.env.TENCENT_SMS_SIGN,
      TemplateId: process.env.TENCENT_SMS_TEMPLATE_ID,
      PhoneNumberSet: [`+86${phone}`],
      TemplateParamSet: [code, '5'],
    });
    */

    return NextResponse.json({
      success: true,
      data: {
        message: '验证码已发送',
        // 开发环境返回验证码，生产环境不要返回
        ...(process.env.NODE_ENV === 'development' && { code }),
      },
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '发送失败，请重试' } },
      { status: 500 }
    );
  }
}

// 导出验证函数供其他路由使用
export function verifyCode(phone: string, code: string): boolean {
  const stored = verificationCodes.get(phone);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(phone);
    return false;
  }
  if (stored.code !== code) return false;
  // 验证成功后删除
  verificationCodes.delete(phone);
  return true;
}

// 导出 Map 供手机登录路由使用
export { verificationCodes };
