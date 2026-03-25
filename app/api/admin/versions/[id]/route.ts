import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/client';

// PUT - 更新版本
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { isActive, forceUpdate } = body;

    const db = await createClient();

    const { data: version, error } = await db
      .from('app_versions')
      .update({
        is_active: isActive,
        force_update: forceUpdate,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('更新版本失败:', error);
      return NextResponse.json(
        { success: false, error: '更新版本失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: version,
    });
  } catch (error) {
    console.error('更新版本异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// DELETE - 删除版本
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await createClient();

    const { error } = await db
      .from('app_versions')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('删除版本失败:', error);
      return NextResponse.json(
        { success: false, error: '删除版本失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '版本已删除',
    });
  } catch (error) {
    console.error('删除版本异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
