import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDb, TABLES } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'contracthub-secret-key-change-in-production'
);

interface Contract {
  id: string;
  user_id: string;
  title: string;
  type: string;
  status: string;
  content: any;
  source_text: string;
  analysis_result: any;
  created_at: string;
  updated_at: string;
}

// 获取当前用户
async function getCurrentUser(request: NextRequest) {
  const token =
    request.cookies.get('auth_token')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { id: payload.sub as string, role: payload.role as string };
  } catch {
    return null;
  }
}

// 获取合同列表
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '请先登录' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';

    const db = getDb();

    // 构建过滤条件
    const filter: Record<string, any> = { user_id: user.id };
    if (status && status !== 'all') filter.status = status;

    // 管理员可以查看所有合同
    if (user.role === 'admin') {
      delete filter.user_id;
    }

    const contracts = await db.findMany<Contract>(TABLES.CONTRACTS, filter, {
      limit,
      offset: (page - 1) * limit,
      orderBy: 'created_at',
      orderDir: 'desc',
    });

    const total = await db.count(TABLES.CONTRACTS, filter);

    return NextResponse.json({
      success: true,
      data: {
        contracts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('获取合同列表失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '获取合同列表失败' } },
      { status: 500 }
    );
  }
}

// 创建合同
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '请先登录' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, type, content, source_text, analysis_result } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: { message: '请输入合同标题' } },
        { status: 400 }
      );
    }

    const db = getDb();

    // 检查用户额度
    const userRecord = await db.findById<any>(TABLES.USERS, user.id);
    if (userRecord) {
      const monthlyLimit = userRecord.plan === 'free' ? 10 : Infinity;
      if (userRecord.contracts_this_month >= monthlyLimit) {
        return NextResponse.json(
          {
            success: false,
            error: { message: '本月额度已用完，请升级会员' },
          },
          { status: 403 }
        );
      }
    }

    const contract = await db.create(TABLES.CONTRACTS, {
      user_id: user.id,
      title,
      type: type || 'other',
      status: 'draft',
      content: content || {},
      source_text: source_text || '',
      analysis_result: analysis_result || null,
    });

    // 更新用户合同计数
    if (userRecord) {
      await db.update(TABLES.USERS, user.id, {
        contracts_count: (userRecord.contracts_count || 0) + 1,
        contracts_this_month: (userRecord.contracts_this_month || 0) + 1,
      });
    }

    return NextResponse.json({
      success: true,
      data: { contract },
    });
  } catch (error) {
    console.error('创建合同失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '创建合同失败' } },
      { status: 500 }
    );
  }
}
