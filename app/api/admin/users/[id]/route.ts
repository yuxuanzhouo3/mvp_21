import { NextRequest, NextResponse } from 'next/server';

import {
  deleteAdminUser,
  getAdminUserDetails,
  updateAdminUser,
} from '@/lib/data/admin-management-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const details = await getAdminUserDetails(params.id);
    if (!details) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error('[admin/users/:id] Failed to fetch user details:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user details',
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const details = await updateAdminUser(params.id, body);

    return NextResponse.json({
      success: true,
      data: details,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('[admin/users/:id] Failed to update user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update user',
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
    await deleteAdminUser(params.id);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('[admin/users/:id] Failed to delete user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete user',
      },
      { status: 500 },
    );
  }
}
