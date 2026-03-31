import { NextRequest, NextResponse } from "next/server";

import { getDashboardOverviewData } from "@/lib/data/dashboard-store";
import { requireDashboardUser } from "@/lib/dashboard/server-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const data = await getDashboardOverviewData(auth.user.id);
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[/api/dashboard/overview] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load dashboard overview." } },
      { status: 500 },
    );
  }
}
