import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-auth'
import type { VideoGenerationRequest } from '@/lib/admin/types'
import { createVideoJob } from '@/lib/admin/ai/orchestrator'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if ('error' in admin) {
      return admin.error
    }
    const body = await request.json() as VideoGenerationRequest

    if (!body?.aspect_ratio || !body?.duration_seconds || !body?.headline) {
      return NextResponse.json({ success: false, error: 'aspect_ratio, duration_seconds, headline are required' }, { status: 400 })
    }

    const job = await createVideoJob(body, admin.userId)
    return NextResponse.json({ success: true, jobId: job.id, job })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create video job' }, { status: 500 })
  }
}
