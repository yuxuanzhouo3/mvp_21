import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/client';

// POST - 上传文件到Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'app-releases';

    if (!file) {
      return NextResponse.json(
        { success: false, error: '没有选择文件' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedExtensions = ['.apk', '.ipa', '.dmg', '.exe', '.hap'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: '不支持的文件类型' },
        { status: 400 }
      );
    }

    // 验证文件大小 (最大500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: '文件大小不能超过500MB' },
        { status: 400 }
      );
    }

    const db = await createClient();

    // 生成唯一文件名
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = `${folder}/${fileName}`;

    // 将文件转换为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // 上传到Supabase Storage
    const { data, error } = await db.storage
      .from('files')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('文件上传失败:', error);
      return NextResponse.json(
        { success: false, error: '文件上传失败: ' + error.message },
        { status: 500 }
      );
    }

    // 获取公开URL
    const { data: urlData } = db.storage
      .from('files')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      data: {
        path: data.path,
        url: urlData.publicUrl,
        size: file.size,
        name: file.name,
      },
    });
  } catch (error) {
    console.error('文件上传异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// DELETE - 删除文件
export async function DELETE(request: NextRequest) {
  try {
    const { path } = await request.json();

    if (!path) {
      return NextResponse.json(
        { success: false, error: '缺少文件路径' },
        { status: 400 }
      );
    }

    const db = await createClient();

    const { error } = await db.storage
      .from('files')
      .remove([path]);

    if (error) {
      console.error('文件删除失败:', error);
      return NextResponse.json(
        { success: false, error: '文件删除失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '文件已删除',
    });
  } catch (error) {
    console.error('文件删除异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
