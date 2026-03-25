import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 创建 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // 1. 获取总用户数
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // 2. 获取今日新增用户数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: newUsersToday } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // 3. 获取活跃用户数（最近7天有活动）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: activeUsers } = await supabase
      .from('usage_logs')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    // 4. 获取总合同数
    const { count: totalContracts } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true });

    // 5. 获取今日合同数
    const { count: contractsToday } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // 6. 获取付费用户数
    const { count: paidUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('subscription_type', ['pro', 'enterprise']);

    // 7. 获取本月收入
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const { data: orders } = await supabase
      .from('orders')
      .select('amount')
      .eq('status', 'paid')
      .gte('created_at', firstDayOfMonth.toISOString());

    const revenue = orders?.reduce((sum, order) => sum + Number(order.amount), 0) || 0;

    // 8. 获取广告数据（从usage_logs中统计）
    const { count: adImpressions } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'ad_impression')
      .gte('created_at', firstDayOfMonth.toISOString());

    const { count: adClicks } = await supabase
      .from('usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'ad_click')
      .gte('created_at', firstDayOfMonth.toISOString());

    // 广告收入估算 (假设每次点击0.5元)
    const adRevenue = (adClicks || 0) * 0.5;

    // 9. 获取最近注册的用户
    const { data: recentUsers } = await supabase
      .from('users')
      .select('id, email, nickname, subscription_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // 返回统计数据
    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers: totalUsers || 0,
          newUsersToday: newUsersToday || 0,
          activeUsers: activeUsers || 0,
          totalContracts: totalContracts || 0,
          contractsToday: contractsToday || 0,
          paidUsers: paidUsers || 0,
          revenue: revenue,
          adImpressions: adImpressions || 0,
          adClicks: adClicks || 0,
          adRevenue: adRevenue,
        },
        recentUsers: recentUsers || [],
      },
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取统计数据失败',
      },
      { status: 500 }
    );
  }
}
