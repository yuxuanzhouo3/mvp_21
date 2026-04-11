import { NextRequest, NextResponse } from "next/server";

import {
  deleteContractRecord,
  getContractById,
  updateContractRecord,
} from "@/lib/data/contracts-store";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import {
  appendContractUpdateLog,
  applyContractAction,
  normalizeContractEnhancementMeta,
} from "@/lib/contracts/enhancements";
import { isChinaRegion } from "@/lib/config/region";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const CN_REGION = isChinaRegion();

function localeText(en: string, zh: string) {
  return CN_REGION ? zh : en;
}

function getSignatureMethodLabel(method: "draw" | "type" | "upload") {
  if (!CN_REGION) {
    return method;
  }

  if (method === "draw") {
    return "手写";
  }
  if (method === "type") {
    return "输入";
  }
  return "上传";
}

function ensureRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
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
    localeText("Current User", "当前用户");

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

    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { message: "Invalid JSON body." } },
        { status: 400 },
      );
    }

    if (!bodyRaw || typeof bodyRaw !== "object" || Array.isArray(bodyRaw)) {
      return NextResponse.json(
        { success: false, error: { message: "Request body must be an object." } },
        { status: 400 },
      );
    }

    const body = bodyRaw as Record<string, any>;
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
    const normalizedUpdateInput = omitUndefined(updateInput);
    const actionNote = typeof body.note === "string" ? body.note : undefined;
    const updateDescription =
      typeof body.updateDescription === "string" ? body.updateDescription : undefined;

    if (action) {
      const signatureInput = ensureRecord(body.signatureInput);
      const enhancement = normalizeContractEnhancementMeta(existing.metadata, existing);
      const nextSignatures = updateInput.signatures ?? existing.signatures;
      const resolvedParties = Array.isArray(normalizedUpdateInput.parties)
        ? normalizedUpdateInput.parties
        : existing.parties;
      const hasParties =
        Array.isArray(resolvedParties) && resolvedParties.length > 0;
      let nextMetadata = updateInput.metadata ?? existing.metadata;

      console.info("[/api/contracts/[id] PUT action]", {
        action,
        hasParties,
      });

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
              ? localeText("Sender", "发起方")
              : localeText("Counterparty", "对方");
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
                label:
                  role === "sender"
                    ? localeText("Sender signature captured", "发起方签名已采集")
                    : localeText("Counterparty signature captured", "对方签名已采集"),
                description: CN_REGION
                  ? `已通过移动端${getSignatureMethodLabel(method)}${signatureRecord.fileName ? `（${signatureRecord.fileName}）` : ""}采集签名。`
                  : `Signature captured on mobile via ${method}${signatureRecord.fileName ? ` (${signatureRecord.fileName})` : ""}.`,
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
                ...normalizedUpdateInput,
                signatures: mergedSignatures,
                metadata: nextMetadata,
              },
              action,
              auth.user.actor,
              actionNote,
            ),
            ...normalizedUpdateInput,
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
          ...normalizedUpdateInput,
          ...applyContractAction(
            {
              ...existing,
              ...normalizedUpdateInput,
              signatures: nextSignatures,
              metadata: nextMetadata,
            },
            action,
            auth.user.actor,
            actionNote,
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
      updateDescription ||
        localeText("Contract content and workflow settings were updated", "合同内容与流程设置已更新"),
      updateInput.metadata,
    );

    const contract = await updateContractRecord(id, {
      ...normalizedUpdateInput,
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
