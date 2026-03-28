import { NextRequest, NextResponse } from 'next/server';

import {
  createAdminVersion,
  listAdminVersions,
} from '@/lib/data/admin-management-store';

export async function GET() {
  try {
    const versions = await listAdminVersions();

    return NextResponse.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    console.error('[admin/versions] Failed to fetch versions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch versions',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, version, buildNumber, fileUrl, fileSize, changelog, forceUpdate } = body;

    if (!platform || !version || !fileUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        { status: 400 },
      );
    }

    const created = await createAdminVersion({
      platform,
      version,
      buildNumber,
      fileUrl,
      fileSize,
      changelog,
      forceUpdate,
    });

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (error) {
    console.error('[admin/versions] Failed to create version:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create version',
      },
      { status: 500 },
    );
  }
}
