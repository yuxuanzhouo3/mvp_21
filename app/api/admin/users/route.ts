import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const subscriptionType = searchParams.get('subscription_type') || '';

    const offset = (page - 1) * limit;

    // 构建查询
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' });

    // 搜索过滤
    if (search) {
      query = query.or(`email.ilike.%${search}%,nickname.ilike.%${search}%`);
    }

    // 订阅类型过滤
    if (subscriptionType) {
      query = query.eq('subscription_type', subscriptionType);
    }

    // 分页和排序
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: users, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        users: users || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取用户列表失败',
      },
      { status: 500 }
    );
  }
}
