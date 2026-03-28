import { NextRequest, NextResponse } from "next/server";

import {
  createContractRecord,
  listContracts,
} from "@/lib/data/contracts-store";
import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";

async function requireCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { token, error: tokenError } = extractTokenFromHeader(authHeader);

  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        { success: false, error: { message: "Please sign in first." } },
        { status: 401 },
      ),
    };
  }

  const authResult = await verifyAuthToken(token);
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: { message: authResult.error || "Invalid token." },
        },
        { status: 401 },
      ),
    };
  }

  const role =
    authResult.user?.role ||
    authResult.user?.user_metadata?.role ||
    "user";

  return {
    user: {
      id: authResult.userId,
      role,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCurrentUser(request);
    if (auth.error) {
      return auth.error;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status") || "";

    const { contracts, total } = await listContracts({
      userId: auth.user.id,
      status,
      isAdmin: auth.user.role === "admin",
      limit,
      offset: Math.max(page - 1, 0) * limit,
    });

    return NextResponse.json({
      success: true,
      data: {
        contracts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Failed to load contracts:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load contracts." } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCurrentUser(request);
    if (auth.error) {
      return auth.error;
    }

    const body = await request.json();
    const {
      title,
      type,
      status,
      content,
      sourceType,
      sourceContent,
      source_text,
      analysisResult,
      analysis_result,
      parties,
      signatures,
      metadata,
      region,
    } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Please provide a contract title." },
        },
        { status: 400 },
      );
    }

    const contract = await createContractRecord({
      userId: auth.user.id,
      title,
      type: type || "custom",
      status: status || "draft",
      content:
        content && typeof content === "object" && !Array.isArray(content)
          ? content
          : {},
      sourceType: sourceType || "text",
      sourceContent: sourceContent || source_text || "",
      analysisResult:
        analysisResult ||
        analysis_result ||
        null,
      parties: Array.isArray(parties) ? parties : [],
      signatures: Array.isArray(signatures) ? signatures : [],
      metadata:
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? metadata
          : {},
      region,
    });

    return NextResponse.json({
      success: true,
      data: { contract },
    });
  } catch (error) {
    console.error("Failed to create contract:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create contract." } },
      { status: 500 },
    );
  }
}
