import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import {
  applyContractSeal,
  canSealContract,
} from "@/lib/contracts/enhancements";
import {
  getContractById,
  updateContractRecord,
} from "@/lib/data/contracts-store";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const IMAGE_DATA_URL_PATTERN = /^data:image\/(png|jpe?g);base64,[a-z0-9+/=]+$/i;

function ensureRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function toOptionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

function toOptionalOpacity(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  if (value < 0 || value > 1) {
    return undefined;
  }

  return value;
}

async function requireCurrentUser(request: NextRequest) {
  const { token, error: tokenError } = extractTokenFromRequest(request);

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
  const actor =
    authResult.user?.name ||
    authResult.user?.email ||
    authResult.user?.user_metadata?.displayName ||
    authResult.user?.user_metadata?.full_name ||
    authResult.user?.user_metadata?.email ||
    "Current User";

  return {
    user: {
      id: authResult.userId,
      role,
      actor,
    },
  };
}

function assertContractAccess(
  contractUserId: string,
  currentUser: { id: string; role: string },
) {
  return contractUserId === currentUser.id || currentUser.role === "admin";
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireCurrentUser(request);
    if (auth.error) {
      return auth.error;
    }

    const { id } = await context.params;
    const existing = await getContractById(id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Contract not found." } },
        { status: 404 },
      );
    }

    if (!assertContractAccess(existing.userId, auth.user)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have permission to seal this contract." } },
        { status: 403 },
      );
    }

    if (!canSealContract(existing)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SEAL_REQUIRES_COMPLETED_SIGNING",
            message: "Only contracts with completed signing can be sealed.",
          },
        },
        { status: 409 },
      );
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { message: "Invalid JSON body." } },
        { status: 400 },
      );
    }

    const body = ensureRecord(bodyRaw);
    if (!body) {
      return NextResponse.json(
        { success: false, error: { message: "Request body must be an object." } },
        { status: 400 },
      );
    }

    const stampImageDataUrl =
      typeof body.stampImageDataUrl === "string" ? body.stampImageDataUrl.trim() : "";
    if (!stampImageDataUrl || !IMAGE_DATA_URL_PATTERN.test(stampImageDataUrl)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SEAL_IMAGE",
            message: "Seal image must be a PNG/JPG base64 data URL.",
          },
        },
        { status: 422 },
      );
    }

    const placementRaw = ensureRecord(body.placement);
    const placement = placementRaw
      ? {
          page: toOptionalPositiveNumber(placementRaw.page),
          x: toOptionalPositiveNumber(placementRaw.x),
          y: toOptionalPositiveNumber(placementRaw.y),
          width: toOptionalPositiveNumber(placementRaw.width),
          height: toOptionalPositiveNumber(placementRaw.height),
          opacity: toOptionalOpacity(placementRaw.opacity),
        }
      : undefined;

    const note =
      typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
    const fileName =
      typeof body.fileName === "string" && body.fileName.trim()
        ? body.fileName.trim()
        : undefined;
    const stampImageMimeType =
      typeof body.stampImageMimeType === "string" && body.stampImageMimeType.trim()
        ? body.stampImageMimeType.trim()
        : undefined;
    const source =
      typeof body.source === "string" && body.source.trim()
        ? body.source.trim()
        : "contract-management";

    const applied = applyContractSeal(existing, {
      actor: auth.user.actor,
      note,
      stamp: {
        imageDataUrl: stampImageDataUrl,
        imageMimeType: stampImageMimeType,
        fileName,
        source,
      },
      placement,
    });

    const updated = await updateContractRecord(id, applied);

    return NextResponse.json({
      success: true,
      data: { contract: updated },
    });
  } catch (error) {
    console.error("Failed to seal contract:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to seal contract." } },
      { status: 500 },
    );
  }
}
