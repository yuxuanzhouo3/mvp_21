import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-auth'
import { getUserService } from '@/lib/services'

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if ('error' in admin) {
      return admin.error
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const pageValue = Number.parseInt(searchParams.get('page') || '1', 10)
    const limitValue = Number.parseInt(searchParams.get('limit') || '20', 10)
    const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 20

    const userService = getUserService()
    const reports = await userService.getAllReports(status)

    const offset = (page - 1) * limit
    const paginatedReports = reports.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: {
        items: paginatedReports,
        total: reports.length,
        page,
        limit,
        totalPages: Math.ceil(reports.length / limit),
      },
    })
  } catch (error: any) {
    console.error('Failed to get reports:', error)
    return NextResponse.json(
      { error: 'Failed to get reports', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if ('error' in admin) {
      return admin.error
    }

    const body = await request.json()
    const { reportId, status, adminNotes } = body

    if (!reportId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: reportId, status' },
        { status: 400 }
      )
    }

    if (!['resolved', 'dismissed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "resolved" or "dismissed"' },
        { status: 400 }
      )
    }

    const userService = getUserService()
    const updatedReport = await userService.updateReport(reportId, admin.userId, {
      status,
      admin_notes: adminNotes,
    })

    return NextResponse.json({
      success: true,
      data: updatedReport,
    })
  } catch (error: any) {
    console.error('Failed to update report:', error)
    return NextResponse.json(
      { error: 'Failed to update report', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
