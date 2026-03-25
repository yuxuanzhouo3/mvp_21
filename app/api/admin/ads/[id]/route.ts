import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// 获取单个广告
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const ad = await db.findById(TABLES.ADS, id);

    if (!ad) {
      return NextResponse.json(
        { success: false, error: { message: '广告不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { ad },
    });
  } catch (error) {
    console.error('获取广告失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '获取广告失败' } },
      { status: 500 }
    );
  }
}

// 更新广告
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, position, type, content, link, status, start_date, end_date } = body;

    const db = getDb();

    // 检查广告是否存在
    const existing = await db.findById(TABLES.ADS, id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: '广告不存在' } },
        { status: 404 }
      );
    }

    // 构建更新数据
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (position !== undefined) updateData.position = position;
    if (type !== undefined) updateData.type = type;
    if (content !== undefined) updateData.content = content;
    if (link !== undefined) updateData.link = link;
    if (status !== undefined) updateData.status = status;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;

    const ad = await db.update(TABLES.ADS, id, updateData);

    return NextResponse.json({
      success: true,
      data: { ad },
    });
  } catch (error) {
    console.error('更新广告失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '更新广告失败' } },
      { status: 500 }
    );
  }
}

// 删除广告
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDb();

    // 检查广告是否存在
    const existing = await db.findById(TABLES.ADS, id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: '广告不存在' } },
        { status: 404 }
      );
    }

    await db.delete(TABLES.ADS, id);

    return NextResponse.json({
      success: true,
      data: { message: '广告已删除' },
    });
  } catch (error) {
    console.error('删除广告失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '删除广告失败' } },
      { status: 500 }
    );
  }
}
