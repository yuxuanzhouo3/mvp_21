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
  normalizeContractEnhancementMeta,
} from "@/lib/contracts/enhancements";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function ensureRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
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

    if (action) {
      const signatureInput = ensureRecord(body.signatureInput);
      const enhancement = normalizeContractEnhancementMeta(existing.metadata, existing);
      const nextSignatures = updateInput.signatures ?? existing.signatures;
      let nextMetadata = updateInput.metadata ?? existing.metadata;

      if (signatureInput) {
        const role =
          signatureInput.role === "counterparty" ? "counterparty" : "sender";
        const method =
          signatureInput.method === "draw" ||
          signatureInput.method === "type" ||
          signatureInput.method === "upload"
            ? signatureInput.method
            : "type";
        const signerName =
          typeof signatureInput.signerName === "string" && signatureInput.signerName.trim()
            ? signatureInput.signerName.trim()
            : role === "sender"
              ? "Sender"
              : "Counterparty";
        const createdAt =
          typeof signatureInput.createdAt === "string"
            ? signatureInput.createdAt
            : new Date().toISOString();

        const signatureRecord = {
          id:
            typeof signatureInput.id === "string" && signatureInput.id.trim()
              ? signatureInput.id
              : `signature-${Date.now()}`,
          role,
          method,
          signerName,
          source:
            typeof signatureInput.source === "string" && signatureInput.source.trim()
              ? signatureInput.source.trim()
              : "mobile",
          legalConsent: signatureInput.legalConsent === true,
          typedName:
            typeof signatureInput.typedName === "string"
              ? signatureInput.typedName
              : undefined,
          imageDataUrl:
            typeof signatureInput.imageDataUrl === "string"
              ? signatureInput.imageDataUrl
              : undefined,
          imageMimeType:
            typeof signatureInput.imageMimeType === "string"
              ? signatureInput.imageMimeType
              : undefined,
          fileName:
            typeof signatureInput.fileName === "string"
              ? signatureInput.fileName
              : undefined,
          createdAt,
        };

        nextMetadata = {
          ...nextMetadata,
          signFlow: {
            ...enhancement.signFlow,
            evidence: [
              {
                id: `signature-evidence-${Date.now()}`,
                label: role === "sender" ? "Sender signature captured" : "Counterparty signature captured",
                description: `Signature captured on mobile via ${method}${signatureRecord.fileName ? ` (${signatureRecord.fileName})` : ""}.`,
                createdAt,
                type: "signature",
              },
              ...enhancement.signFlow.evidence,
            ].slice(0, 20),
          },
        };

        const mergedSignatures = [...nextSignatures, signatureRecord].slice(-20);

        const updated = await updateContractRecord(
          id,
          {
            ...applyContractAction(
              {
                ...existing,
                signatures: mergedSignatures,
                metadata: nextMetadata,
              },
              action,
              auth.user.actor,
              body.note,
            ),
            ...updateInput,
            signatures: mergedSignatures,
          },
        );

        return NextResponse.json({
          success: true,
          data: { contract: updated },
        });
      }

      const updated = await updateContractRecord(
        id,
        {
          ...updateInput,
          ...applyContractAction(
            {
              ...existing,
              ...updateInput,
              signatures: nextSignatures,
              metadata: nextMetadata,
            },
            action,
            auth.user.actor,
            body.note,
          ),
        },
      );

      return NextResponse.json({
        success: true,
        data: { contract: updated },
      });
    }

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
