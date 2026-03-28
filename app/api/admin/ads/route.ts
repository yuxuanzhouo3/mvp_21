import { NextRequest, NextResponse } from 'next/server';

import { getAdminAdsMetrics } from '@/lib/data/admin-insights-store';

export async function GET(_request: NextRequest) {
  try {
    const data = await getAdminAdsMetrics(7);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[admin/ads] Failed to load ad metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load ad metrics',
      },
      { status: 500 },
    );
  }
}
