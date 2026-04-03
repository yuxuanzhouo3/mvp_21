import { NextResponse } from "next/server";

import { getPaymentConfigSnapshot } from "@/lib/config/third-party-capabilities";

export async function GET() {
  const snapshot = getPaymentConfigSnapshot();

  return NextResponse.json(snapshot);
}
