import { NextRequest, NextResponse } from "next/server";

import { AdNotFoundError, trackAdEvent, type AdTrackType } from "@/lib/data/ads-store";

function normalizeTrackType(value: unknown): AdTrackType | null {
  return value === "impression" || value === "click" ? value : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const adId = typeof body.adId === "string" ? body.adId.trim() : "";
    const type = normalizeTrackType(body.type);

    if (!adId || !type) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Invalid ad track payload",
          },
        },
        { status: 400 },
      );
    }

    await trackAdEvent({
      adId,
      type,
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({
      success: true,
      data: {
        message: "Tracked",
      },
    });
  } catch (error) {
    if (error instanceof AdNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Ad not found",
          },
        },
        { status: 404 },
      );
    }

    console.error("Failed to track ad event:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Failed to track ad event",
        },
      },
      { status: 500 },
    );
  }
}
