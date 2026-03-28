import { NextRequest, NextResponse } from 'next/server';

import { listAdminUsers } from '@/lib/data/admin-management-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const subscriptionType = searchParams.get('subscription_type') || '';

    const data = await listAdminUsers({
      page,
      limit,
      search,
      subscriptionType,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[admin/users] Failed to fetch users:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user list',
      },
      { status: 500 },
    );
  }
}
