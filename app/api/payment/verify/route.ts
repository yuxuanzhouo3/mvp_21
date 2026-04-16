import { NextRequest, NextResponse } from "next/server";

import { createAuthErrorResponse, requireAuth } from "@/lib/auth/auth";

/**
 * POST /api/payment/verify
 *
 * Legacy endpoint has been retired. All payment confirmation must go through
 * `/api/payment/confirm`, which reads provider-specific references from the
 * unified payments store.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult) {
    return createAuthErrorResponse();
  }

  return NextResponse.json(
    {
      success: false,
      code: "PAYMENT_VERIFY_DEPRECATED",
      error:
        "Legacy /api/payment/verify endpoint is retired. Use /api/payment/confirm instead.",
    },
    { status: 410 },
  );
}
