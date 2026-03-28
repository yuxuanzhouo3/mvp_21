import { NextRequest, NextResponse } from 'next/server';

import { getAdminOverviewStats } from '@/lib/data/admin-insights-store';

export async function GET(_request: NextRequest) {
  try {
    const data = await getAdminOverviewStats();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[admin/stats] Failed to load stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load admin stats',
      },
      { status: 500 },
    );
  }
}
