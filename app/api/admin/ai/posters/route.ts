import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-auth'
import type { PosterGenerationRequest } from '@/lib/admin/types'
import { createPosterJob } from '@/lib/admin/ai/orchestrator'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if ('error' in admin) {
      return admin.error
    }
    const body = await request.json() as PosterGenerationRequest

    if (!body?.poster_goal || !body?.audience || !body?.style || !body?.aspect_ratio || !body?.title || !body?.cta) {
      return NextResponse.json({ success: false, error: 'poster_goal, audience, style, aspect_ratio, title, cta are required' }, { status: 400 })
    }

    const job = await createPosterJob(body, admin.userId)
    return NextResponse.json({ success: true, jobId: job.id, job })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to create poster job' }, { status: 500 })
  }
}
