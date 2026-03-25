import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/client';

// GET - 获取所有版本
export async function GET(request: NextRequest) {
  try {
    const db = await createClient();
    
    const { data: versions, error } = await db
      .from('app_versions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取版本列表失败:', error);
      return NextResponse.json(
        { success: false, error: '获取版本列表失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    console.error('获取版本列表异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// POST - 创建新版本
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, version, buildNumber, fileUrl, fileSize, changelog, forceUpdate } = body;

    // 验证必填字段
    if (!platform || !version || !fileUrl) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    const db = await createClient();

    // 停用该平台的其他版本
    await db
      .from('app_versions')
      .update({ isActive: false })
      .eq('platform', platform);

    // 创建新版本
    const { data: newVersion, error } = await db
      .from('app_versions')
      .insert({
        platform,
        version,
        build_number: buildNumber || 1,
        file_url: fileUrl,
        file_size: fileSize || 0,
        changelog: changelog || '',
        force_update: forceUpdate || false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('创建版本失败:', error);
      return NextResponse.json(
        { success: false, error: '创建版本失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newVersion,
    });
  } catch (error) {
    console.error('创建版本异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
