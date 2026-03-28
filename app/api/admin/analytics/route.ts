import { NextRequest, NextResponse } from 'next/server';

import { getAdminAnalytics } from '@/lib/data/admin-insights-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const data = await getAdminAnalytics(days);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[admin/analytics] Failed to load analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load analytics data',
      },
      { status: 500 },
    );
  }
}
