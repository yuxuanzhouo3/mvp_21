import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/lib/db';

// 记录广告展示/点击
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adId, type } = body; // type: 'impression' | 'click'

    if (!adId || !type) {
      return NextResponse.json(
        { success: false, error: { message: '参数错误' } },
        { status: 400 }
      );
    }

    const db = getDb();
    const ad = await db.findById<any>(TABLES.ADS, adId);

    if (!ad) {
      return NextResponse.json(
        { success: false, error: { message: '广告不存在' } },
        { status: 404 }
      );
    }

    // 更新统计数据
    const updateData: Record<string, any> = {};
    if (type === 'impression') {
      updateData.impressions = (ad.impressions || 0) + 1;
    } else if (type === 'click') {
      updateData.clicks = (ad.clicks || 0) + 1;
      // 简单的收入计算：每次点击 0.5 元
      updateData.revenue = (ad.revenue || 0) + 0.5;
    }

    await db.update(TABLES.ADS, adId, updateData);

    // 记录详细统计（可选）
    try {
      await db.create(TABLES.AD_STATS, {
        ad_id: adId,
        type,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      // 忽略统计记录失败
    }

    return NextResponse.json({
      success: true,
      data: { message: '已记录' },
    });
  } catch (error) {
    console.error('记录广告统计失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '记录失败' } },
      { status: 500 }
    );
  }
}
