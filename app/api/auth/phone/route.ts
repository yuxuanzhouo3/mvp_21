/**
 * 手机号验证码登录 API
 * POST /api/auth/phone
 */

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getDb, TABLES } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'contracthub-secret-key-change-in-production'
);

// 验证码存储（从 send 路由导入会有问题，这里重新定义）
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// 验证验证码
function verifyCode(phone: string, code: string): boolean {
  const stored = verificationCodes.get(phone);
  if (!stored) {
    // 开发环境允许任意验证码
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }
  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(phone);
    return false;
  }
  if (stored.code !== code) return false;
  verificationCodes.delete(phone);
  return true;
}

// 生成 JWT Token
async function generateToken(user: any): Promise<string> {
  const token = await new SignJWT({
    sub: user.id,
    phone: user.phone,
    role: user.role || 'user',
    plan: user.plan || 'free',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(user.plan === 'free' ? '30d' : '90d')
    .sign(JWT_SECRET);

  return token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { success: false, error: { message: '请输入手机号和验证码' } },
        { status: 400 }
      );
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { success: false, error: { message: '手机号格式不正确' } },
        { status: 400 }
      );
    }

    // 验证验证码
    if (!verifyCode(phone, code)) {
      return NextResponse.json(
        { success: false, error: { message: '验证码错误或已过期' } },
        { status: 400 }
      );
    }

    const db = getDb();

    // 查找用户
    let user = await db.findOne<any>(TABLES.USERS, { phone });

    if (!user) {
      // 自动注册新用户
      user = await db.create(TABLES.USERS, {
        phone,
        name: `用户${phone.slice(-4)}`,
        role: 'user',
        plan: 'free',
        status: 'active',
        contracts_count: 0,
        contracts_this_month: 0,
      });
      console.log(`📱 新用户注册: ${phone}`);
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, error: { message: '账号已被禁用' } },
        { status: 403 }
      );
    }

    // 更新最后登录时间
    await db.update(TABLES.USERS, user.id, {
      last_login_at: new Date().toISOString(),
    });

    // 生成 token
    const token = await generateToken(user);

    // 创建会话
    await db.create(TABLES.USER_SESSIONS, {
      user_id: user.id,
      token,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    });

    // 返回用户信息
    const { password_hash, ...safeUser } = user;

    const response = NextResponse.json({
      success: true,
      data: {
        user: safeUser,
        token,
      },
    });

    // 设置 cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('手机登录失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '登录失败，请重试' } },
      { status: 500 }
    );
  }
}

// 导出验证码 Map 供发送验证码路由使用
export { verificationCodes };
