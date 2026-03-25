import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // 获取广告展示和点击统计（从usage_logs中）
    const { count: impressions } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'ad_impression');

    const { count: clicks } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'ad_click');

    // 获取最近7天的广告数据趋势
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentLogs } = await supabase
      .from('usage_logs')
      .select('action, created_at')
      .in('action', ['ad_impression', 'ad_click'])
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    // 按日期统计
    const statsByDate: Record<string, { impressions: number; clicks: number }> = {};
    recentLogs?.forEach((log) => {
      const date = new Date(log.created_at).toLocaleDateString('zh-CN');
      if (!statsByDate[date]) {
        statsByDate[date] = { impressions: 0, clicks: 0 };
      }
      if (log.action === 'ad_impression') {
        statsByDate[date].impressions++;
      } else if (log.action === 'ad_click') {
        statsByDate[date].clicks++;
      }
    });

    const trend = Object.entries(statsByDate).map(([date, stats]) => ({
      date,
      ...stats,
      ctr: stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0',
    }));

    // 计算总体CTR
    const ctr = impressions && impressions > 0 ? ((clicks || 0) / impressions * 100).toFixed(2) : '0';
    const revenue = (clicks || 0) * 0.5; // 假设每次点击0.5元

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalImpressions: impressions || 0,
          totalClicks: clicks || 0,
          ctr,
          revenue,
        },
        trend,
      },
    });
  } catch (error) {
    console.error('获取广告数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取广告数据失败',
      },
      { status: 500 }
    );
  }
}
