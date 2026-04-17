import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-auth'
import { listAiJobs } from '@/lib/admin/ai/orchestrator'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if ('error' in admin) {
      return admin.error
    }
    const jobs = await listAiJobs()
    return NextResponse.json({ success: true, jobs })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to list AI jobs' }, { status: 500 })
  }
}
