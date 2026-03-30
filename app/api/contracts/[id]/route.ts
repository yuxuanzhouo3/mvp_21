import { NextRequest, NextResponse } from "next/server";

import {
  deleteContractRecord,
  getContractById,
  updateContractRecord,
} from "@/lib/data/contracts-store";
import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import {
  appendContractUpdateLog,
  applyContractAction,
} from "@/lib/contracts/enhancements";

interface RouteContext {
  params: Promise<{ id: string }>;
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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireCurrentUser(request);
    if (auth.error) {
      return auth.error;
    }

    const { id } = await context.params;
    const contract = await getContractById(id);

    if (!contract) {
      return NextResponse.json(
        { success: false, error: { message: "Contract not found." } },
        { status: 404 },
      );
    }

    if (!assertContractAccess(contract.userId, auth.user)) {
      return NextResponse.json(
        { success: false, error: { message: "You do not have access to this contract." } },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { contract },
    });
  } catch (error) {
    console.error("Failed to load contract:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load contract." } },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
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
        { success: false, error: { message: "You do not have permission to update this contract." } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const action =
      body.action === "archive" ||
      body.action === "unarchive" ||
      body.action === "start_signing" ||
      body.action === "confirm_sender" ||
      body.action === "confirm_counterparty" ||
      body.action === "send_reminder"
        ? body.action
        : null;

    if (action) {
      const updated = await updateContractRecord(id, applyContractAction(existing, action, auth.user.actor, body.note));

      return NextResponse.json({
        success: true,
        data: { contract: updated },
      });
    }

    const updateInput = {
      title: body.title,
      type: body.type,
      status: body.status,
      content:
        body.content && typeof body.content === "object" && !Array.isArray(body.content)
          ? body.content
          : undefined,
      sourceType: body.sourceType,
      sourceContent: body.sourceContent || body.source_text,
      analysisResult: body.analysisResult || body.analysis_result,
      parties: Array.isArray(body.parties) ? body.parties : undefined,
      signatures: Array.isArray(body.signatures) ? body.signatures : undefined,
      metadata:
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? body.metadata
          : undefined,
      region: body.region,
    };

    const nextMetadata = appendContractUpdateLog(
      existing,
      auth.user.actor,
      body.updateDescription || "Contract content and workflow settings were updated",
      updateInput.metadata,
    );

    const contract = await updateContractRecord(id, {
      ...updateInput,
      metadata: nextMetadata,
    });

    return NextResponse.json({
      success: true,
      data: { contract },
    });
  } catch (error) {
    console.error("Failed to update contract:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update contract." } },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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
        { success: false, error: { message: "You do not have permission to delete this contract." } },
        { status: 403 },
      );
    }

    await deleteContractRecord(id);

    return NextResponse.json({
      success: true,
      data: { message: "Contract deleted successfully." },
    });
  } catch (error) {
    console.error("Failed to delete contract:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete contract." } },
      { status: 500 },
    );
  }
}
