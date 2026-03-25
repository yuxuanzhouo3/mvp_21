import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/lib/db';

interface Ad {
  id: string;
  name: string;
  position: string;
  type: string;
  content: string;
  link: string;
  status: string;
  start_date: string;
  end_date: string;
}

// 获取活跃广告（供前端展示）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position'); // 可选：筛选特定位置的广告

    const db = getDb();

    // 获取活跃广告
    const filter: Record<string, any> = { status: 'active' };
    if (position) filter.position = position;

    const ads = await db.findMany<Ad>(TABLES.ADS, filter);

    // 过滤已过期的广告
    const today = new Date().toISOString().split('T')[0];
    const activeAds = ads.filter((ad) => {
      if (ad.end_date && ad.end_date < today) return false;
      if (ad.start_date && ad.start_date > today) return false;
      return true;
    });

    // 只返回必要的字段
    const publicAds = activeAds.map((ad) => ({
      id: ad.id,
      position: ad.position,
      type: ad.type,
      content: ad.content,
      link: ad.link,
    }));

    return NextResponse.json({
      success: true,
      data: { ads: publicAds },
    });
  } catch (error) {
    console.error('获取广告失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '获取广告失败' } },
      { status: 500 }
    );
  }
}
