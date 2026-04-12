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
  type ContractWorkflowAction,
  normalizeContractEnhancementMeta,
  validateContractAction,
} from "@/lib/contracts/enhancements";
import { isChinaRegion } from "@/lib/config/region";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const CN_REGION = isChinaRegion();

const CONTRACT_ACTIONS: readonly ContractWorkflowAction[] = [
  "archive",
  "unarchive",
  "start_signing",
  "confirm_sender",
  "confirm_counterparty",
  "send_reminder",
] as const;

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

  const role = authResult.user?.role || authResult.user?.user_metadata?.role || "user";
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

function getActionValidationMessage(code: string | undefined) {
  if (code === "CONTRACT_ARCHIVED_RESTORE_REQUIRED") {
    return localeText(
      "This contract is archived. Restore it before continuing the signing flow.",
      "该合同已归档，请先恢复后再继续签署流程。",
    );
  }
  if (code === "CONTRACT_ALREADY_ARCHIVED") {
    return localeText("Contract is already archived.", "合同已归档。");
  }
  if (code === "CONTRACT_NOT_ARCHIVED") {
    return localeText("Contract is not archived.", "合同当前不是归档状态。");
  }
  if (code === "SIGNFLOW_ALREADY_STARTED") {
    return localeText(
      "Signing has already started. Continue with the current signing step.",
      "签署流程已发起，请按当前签署步骤继续。",
    );
  }
  if (code === "SIGNFLOW_INVALID_SENDER_STEP") {
    return localeText(
      "Sender confirmation is not available in the current signing status.",
      "当前签署状态下不能执行发起方确认。",
    );
  }
  if (code === "SIGNFLOW_INVALID_COUNTERPARTY_STEP") {
    return localeText(
      "Counterparty confirmation is not available in the current signing status.",
      "当前签署状态下不能执行对方确认。",
    );
  }
  if (code === "SIGNFLOW_INVALID_REMINDER_STEP") {
    return localeText(
      "Reminder can only be sent while waiting for signatures.",
      "仅在待签署阶段才能发送提醒。",
    );
  }

  return localeText("Action is not allowed in current status.", "当前状态不允许执行该动作。");
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
    const actionCandidate = typeof body.action === "string" ? body.action : null;
    const action: ContractWorkflowAction | null =
      actionCandidate && CONTRACT_ACTIONS.includes(actionCandidate as ContractWorkflowAction)
        ? (actionCandidate as ContractWorkflowAction)
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
      const validation = validateContractAction(existing, action);
      if (!validation.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: validation.code || "INVALID_ACTION",
              message: getActionValidationMessage(validation.code),
            },
          },
          { status: 409 },
        );
      }

      const signatureInput = ensureRecord(body.signatureInput);
      const enhancement = normalizeContractEnhancementMeta(existing.metadata, existing);
      const nextSignatures = Array.isArray(updateInput.signatures)
        ? updateInput.signatures
        : Array.isArray(existing.signatures)
          ? existing.signatures
          : [];
      const resolvedParties = Array.isArray(normalizedUpdateInput.parties)
        ? normalizedUpdateInput.parties
        : existing.parties;
      const hasParties = Array.isArray(resolvedParties) && resolvedParties.length >= 2;
      let nextMetadata = updateInput.metadata ?? existing.metadata;
      const actionExpectsSignature =
        action === "confirm_sender" || action === "confirm_counterparty";

      console.info("[/api/contracts/[id] PUT action]", {
        action,
        hasParties,
      });

      if (action === "start_signing" && !hasParties) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "SIGNFLOW_MISSING_PARTIES",
              message: localeText(
                "Please provide at least two signing parties before starting signing.",
                "发起签署前请至少配置双方签署主体。",
              ),
            },
          },
          { status: 422 },
        );
      }

      if (signatureInput && !actionExpectsSignature) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "SIGNATURE_NOT_ALLOWED_FOR_ACTION",
              message: localeText(
                "Signature payload is only allowed for confirmation actions.",
                "只有签署确认动作才允许提交签名内容。",
              ),
            },
          },
          { status: 400 },
        );
      }

      if (signatureInput && actionExpectsSignature) {
        if (signatureInput.legalConsent !== true) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "SIGNATURE_LEGAL_CONSENT_REQUIRED",
                message: localeText(
                  "Legal consent is required before recording signature.",
                  "记录签名前必须确认电子签署法律声明。",
                ),
              },
            },
            { status: 422 },
          );
        }

        const role = signatureInput.role === "counterparty" ? "counterparty" : "sender";

        if (action === "confirm_sender" && role !== "sender") {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "SIGNATURE_ROLE_MISMATCH",
                message: localeText(
                  "confirm_sender requires sender signature input.",
                  "confirm_sender 动作必须提交发起方签名。",
                ),
              },
            },
            { status: 400 },
          );
        }

        if (action === "confirm_counterparty" && role !== "counterparty") {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "SIGNATURE_ROLE_MISMATCH",
                message: localeText(
                  "confirm_counterparty requires counterparty signature input.",
                  "confirm_counterparty 动作必须提交对方签名。",
                ),
              },
            },
            { status: 400 },
          );
        }

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
          legalConsent: true,
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

        const updated = await updateContractRecord(id, {
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
        });

        return NextResponse.json({
          success: true,
          data: { contract: updated },
        });
      }

      const updated = await updateContractRecord(id, {
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
      });

      return NextResponse.json({
        success: true,
        data: { contract: updated },
      });
    }

    const nextMetadata = appendContractUpdateLog(
      existing,
      auth.user.actor,
      updateDescription ||
        localeText(
          "Contract content and workflow settings were updated",
          "合同内容与流程设置已更新",
        ),
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
