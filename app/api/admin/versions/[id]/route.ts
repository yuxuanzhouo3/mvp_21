import { NextRequest, NextResponse } from 'next/server';

import {
  deleteAdminVersion,
  updateAdminVersion,
} from '@/lib/data/admin-management-store';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const version = await updateAdminVersion(params.id, body);

    if (!version) {
      return NextResponse.json(
        {
          success: false,
          error: 'Version not found',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: version,
    });
  } catch (error) {
    console.error('[admin/versions/:id] Failed to update version:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update version',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await deleteAdminVersion(params.id);

    return NextResponse.json({
      success: true,
      message: 'Version deleted successfully',
    });
  } catch (error) {
    console.error('[admin/versions/:id] Failed to delete version:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete version',
      },
      { status: 500 },
    );
  }
}
