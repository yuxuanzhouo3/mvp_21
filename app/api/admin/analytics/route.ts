import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30'); // 默认30天

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // 1. 获取每日新增用户趋势
    const { data: dailyUsers } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // 按日期分组统计
    const usersByDate: Record<string, number> = {};
    dailyUsers?.forEach((user) => {
      const date = new Date(user.created_at).toLocaleDateString('zh-CN');
      usersByDate[date] = (usersByDate[date] || 0) + 1;
    });

    const userTrend = Object.entries(usersByDate).map(([date, count]) => ({
      date,
      count,
    }));

    // 2. 获取每日合同生成趋势
    const { data: dailyContracts } = await supabase
      .from('contracts')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    const contractsByDate: Record<string, number> = {};
    dailyContracts?.forEach((contract) => {
      const date = new Date(contract.created_at).toLocaleDateString('zh-CN');
      contractsByDate[date] = (contractsByDate[date] || 0) + 1;
    });

    const contractTrend = Object.entries(contractsByDate).map(([date, count]) => ({
      date,
      count,
    }));

    // 3. 获取每日收入趋势
    const { data: dailyOrders } = await supabase
      .from('orders')
      .select('created_at, amount, status')
      .eq('status', 'paid')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    const revenueByDate: Record<string, number> = {};
    dailyOrders?.forEach((order) => {
      const date = new Date(order.created_at).toLocaleDateString('zh-CN');
      revenueByDate[date] = (revenueByDate[date] || 0) + Number(order.amount);
    });

    const revenueTrend = Object.entries(revenueByDate).map(([date, amount]) => ({
      date,
      amount: Math.round(amount * 100) / 100, // 保留2位小数
    }));

    // 4. 用户订阅类型分布
    const { data: subscriptionData } = await supabase
      .from('users')
      .select('subscription_type');

    const subscriptionDistribution: Record<string, number> = {};
    subscriptionData?.forEach((user) => {
      const type = user.subscription_type || 'free';
      subscriptionDistribution[type] = (subscriptionDistribution[type] || 0) + 1;
    });

    const subscriptionChart = Object.entries(subscriptionDistribution).map(([name, value]) => ({
      name: name === 'free' ? '免费版' : name === 'pro' ? '专业版' : '企业版',
      value,
    }));

    // 5. 合同类型分布
    const { data: contractTypeData } = await supabase
      .from('contracts')
      .select('type');

    const contractTypeDistribution: Record<string, number> = {};
    contractTypeData?.forEach((contract) => {
      const type = contract.type;
      contractTypeDistribution[type] = (contractTypeDistribution[type] || 0) + 1;
    });

    const contractTypeChart = Object.entries(contractTypeDistribution).map(([name, value]) => {
      const typeNames: Record<string, string> = {
        labor: '劳动合同',
        service: '服务合同',
        cooperation: '合作协议',
        nda: '保密协议',
        custom: '自定义',
      };
      return {
        name: typeNames[name] || name,
        value,
      };
    });

    // 6. 支付方式分布
    const { data: paymentMethodData } = await supabase
      .from('orders')
      .select('payment_method')
      .eq('status', 'paid');

    const paymentMethodDistribution: Record<string, number> = {};
    paymentMethodData?.forEach((order) => {
      const method = order.payment_method;
      paymentMethodDistribution[method] = (paymentMethodDistribution[method] || 0) + 1;
    });

    const paymentMethodChart = Object.entries(paymentMethodDistribution).map(([name, value]) => {
      const methodNames: Record<string, string> = {
        stripe: 'Stripe',
        paypal: 'PayPal',
        alipay: '支付宝',
        wechat: '微信支付',
      };
      return {
        name: methodNames[name] || name,
        value,
      };
    });

    // 7. 用户活跃度（最近7天内有操作的用户）
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { count: activeUsers7d } = await supabase
      .from('usage_logs')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const activeRate = totalUsers ? ((activeUsers7d || 0) / totalUsers * 100).toFixed(1) : '0';

    return NextResponse.json({
      success: true,
      data: {
        userTrend,
        contractTrend,
        revenueTrend,
        subscriptionChart,
        contractTypeChart,
        paymentMethodChart,
        stats: {
          activeUsers7d: activeUsers7d || 0,
          totalUsers: totalUsers || 0,
          activeRate,
        },
      },
    });
  } catch (error) {
    console.error('获取分析数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取分析数据失败',
      },
      { status: 500 }
    );
  }
}
