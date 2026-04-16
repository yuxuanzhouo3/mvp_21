import { NextRequest, NextResponse } from "next/server";

import { listPublicActiveAds } from "@/lib/data/ads-store";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get("position") || undefined;
    const ads = await listPublicActiveAds(position);

    return NextResponse.json({
      success: true,
      data: {
        ads,
      },
    });
  } catch (error) {
    console.error("Failed to load public ads:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Failed to load ads",
        },
      },
      { status: 500 },
    );
  }
}
