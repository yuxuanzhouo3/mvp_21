import { NextRequest, NextResponse } from "next/server";

import {
  createContractRecord,
  listContracts,
} from "@/lib/data/contracts-store";
import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import { normalizeContractStatus } from "@/lib/data/unified-models";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function asPlainRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asNullableRecord(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

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
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
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
          totalPages: Math.max(1, Math.ceil(total / limit)),
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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { message: "Invalid JSON body." } },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: { message: "Request body must be an object." } },
        { status: 400 },
      );
    }

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

    if (!title || typeof title !== "string" || !title.trim()) {
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
      title: title.trim(),
      type: typeof type === "string" && type.trim() ? type.trim() : "custom",
      status: normalizeContractStatus(status),
      content: asPlainRecord(content),
      sourceType:
        typeof sourceType === "string" && sourceType.trim()
          ? sourceType.trim()
          : "text",
      sourceContent:
        typeof sourceContent === "string"
          ? sourceContent
          : typeof source_text === "string"
            ? source_text
            : "",
      analysisResult: asNullableRecord(analysisResult, analysis_result),
      parties: Array.isArray(parties) ? parties : [],
      signatures: Array.isArray(signatures) ? signatures : [],
      metadata: asPlainRecord(metadata),
      region: typeof region === "string" && region.trim() ? region.trim() : undefined,
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
