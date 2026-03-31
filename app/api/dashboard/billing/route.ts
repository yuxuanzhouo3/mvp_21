import { NextRequest, NextResponse } from "next/server";

import { getDashboardBillingSummary } from "@/lib/data/dashboard-store";
import { requireDashboardUser } from "@/lib/dashboard/server-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const summary = await getDashboardBillingSummary(auth.user);
    return NextResponse.json({
      success: true,
      data: {
        summary,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/billing] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load billing summary." } },
      { status: 500 },
    );
  }
}
