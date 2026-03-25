import { NextRequest, NextResponse } from 'next/server';
import { getDb, TABLES } from '@/lib/db';

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  price: number;
  billing_cycle: string;
  payment_method: string;
  start_date: string;
  next_bill_date: string;
  created_at: string;
  updated_at: string;
}

interface Payment {
  id: string;
  user_id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  created_at: string;
}

// 获取订阅列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    const tab = searchParams.get('tab') || 'subscriptions'; // subscriptions | payments

    const db = getDb();

    if (tab === 'payments') {
      // 获取支付记录
      const filter: Record<string, any> = {};
      if (status && status !== 'all') filter.status = status;

      const payments = await db.findMany<Payment>(TABLES.PAYMENTS, filter, {
        limit,
        offset: (page - 1) * limit,
        orderBy: 'created_at',
        orderDir: 'desc',
      });

      const total = await db.count(TABLES.PAYMENTS, filter);

      // 关联用户信息
      const paymentsWithUser = await Promise.all(
        payments.map(async (p) => {
          const user = await db.findById<any>(TABLES.USERS, p.user_id);
          return {
            ...p,
            user_name: user?.name || 'Unknown',
            user_email: user?.email || '',
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: {
          payments: paymentsWithUser,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    }

    // 获取订阅列表
    const filter: Record<string, any> = {};
    if (status && status !== 'all') filter.status = status;

    const subscriptions = await db.findMany<Subscription>(
      TABLES.SUBSCRIPTIONS,
      filter,
      {
        limit,
        offset: (page - 1) * limit,
        orderBy: 'created_at',
        orderDir: 'desc',
      }
    );

    const total = await db.count(TABLES.SUBSCRIPTIONS, filter);

    // 关联用户信息
    const subscriptionsWithUser = await Promise.all(
      subscriptions.map(async (sub) => {
        const user = await db.findById<any>(TABLES.USERS, sub.user_id);
        return {
          ...sub,
          user_name: user?.name || 'Unknown',
          user_email: user?.email || '',
        };
      })
    );

    // 计算统计数据
    const allActive = await db.findMany<Subscription>(TABLES.SUBSCRIPTIONS, {
      status: 'active',
    });
    const mrr = allActive.reduce((sum, sub) => {
      const monthlyPrice =
        sub.billing_cycle === 'yearly' ? sub.price / 12 : sub.price;
      return sum + monthlyPrice;
    }, 0);

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: subscriptionsWithUser,
        stats: {
          activeCount: allActive.length,
          mrr,
          renewalRate: 85.2, // 模拟数据
          churnCount: 12, // 模拟数据
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('获取订阅列表失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '获取订阅列表失败' } },
      { status: 500 }
    );
  }
}

// 创建订阅（手动添加）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, plan, price, billing_cycle, payment_method } = body;

    if (!user_id || !plan) {
      return NextResponse.json(
        { success: false, error: { message: '请填写用户ID和方案' } },
        { status: 400 }
      );
    }

    const db = getDb();

    // 检查用户是否存在
    const user = await db.findById(TABLES.USERS, user_id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: '用户不存在' } },
        { status: 404 }
      );
    }

    // 计算下次账单日期
    const startDate = new Date();
    const nextBillDate = new Date(startDate);
    if (billing_cycle === 'yearly') {
      nextBillDate.setFullYear(nextBillDate.getFullYear() + 1);
    } else {
      nextBillDate.setMonth(nextBillDate.getMonth() + 1);
    }

    const subscription = await db.create(TABLES.SUBSCRIPTIONS, {
      user_id,
      plan,
      status: 'active',
      price: price || (plan === 'pro' ? 29 : 99),
      billing_cycle: billing_cycle || 'monthly',
      payment_method: payment_method || 'manual',
      start_date: startDate.toISOString().split('T')[0],
      next_bill_date: nextBillDate.toISOString().split('T')[0],
    });

    // 更新用户的 plan
    await db.update(TABLES.USERS, user_id, { plan });

    return NextResponse.json({
      success: true,
      data: { subscription },
    });
  } catch (error) {
    console.error('创建订阅失败:', error);
    return NextResponse.json(
      { success: false, error: { message: '创建订阅失败' } },
      { status: 500 }
    );
  }
}
