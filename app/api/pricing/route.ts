import { NextResponse } from "next/server";

import { loadRuntimePricingSnapshot } from "@/lib/pricing/runtime";

export async function GET() {
  const snapshot = await loadRuntimePricingSnapshot();

  return NextResponse.json({
    success: true,
    data: snapshot,
  });
}

