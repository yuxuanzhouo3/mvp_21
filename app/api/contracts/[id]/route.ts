import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDb, TABLES } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'contracthub-secret-key-change-in-production'
);

interface RouteContext {
  params: Promise<{ id: string }>;
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

// 获取单个合同
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '请先登录' } },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const db = getDb();
    const contract = await db.findById<any>(TABLES.CONTRACTS, id);

    if (!contract) {
      return NextResponse.json(
        { success: false, error: { message: '合同不存在' } },
        { status: 404 }
      );
    }

    // 检查权限
    if (contract.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: '无权访问该合同' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { contract },
    });
  } catch (error) {
    console.error('获取合同失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '获取合同失败' } },
      { status: 500 }
    );
  }
}

// 更新合同
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '请先登录' } },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { title, type, status, content } = body;

    const db = getDb();
    const existing = await db.findById<any>(TABLES.CONTRACTS, id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: '合同不存在' } },
        { status: 404 }
      );
    }

    // 检查权限
    if (existing.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: '无权修改该合同' } },
        { status: 403 }
      );
    }

    // 构建更新数据
    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    if (content !== undefined) updateData.content = content;

    const contract = await db.update(TABLES.CONTRACTS, id, updateData);

    return NextResponse.json({
      success: true,
      data: { contract },
    });
  } catch (error) {
    console.error('更新合同失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '更新合同失败' } },
      { status: 500 }
    );
  }
}

// 删除合同
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '请先登录' } },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const db = getDb();
    const existing = await db.findById<any>(TABLES.CONTRACTS, id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: '合同不存在' } },
        { status: 404 }
      );
    }

    // 检查权限
    if (existing.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: '无权删除该合同' } },
        { status: 403 }
      );
    }

    await db.delete(TABLES.CONTRACTS, id);

    return NextResponse.json({
      success: true,
      data: { message: '合同已删除' },
    });
  } catch (error) {
    console.error('删除合同失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '删除合同失败' } },
      { status: 500 }
    );
  }
}
