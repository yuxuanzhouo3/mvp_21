import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import { getContractById } from "@/lib/data/contracts-store";
import {
  buildContractDocumentHtml,
  buildContractHtml,
  normalizeContractContent,
  sanitizeDownloadFileName,
} from "@/lib/contracts/format";
import { buildContractExportSignatures } from "@/lib/contracts/export-signatures";
import {
  filterContractExportSignaturesByStage,
  resolveContractWorkflowStageForExport,
} from "@/lib/contracts/workflow-stage";
import { buildContractPdfBuffer } from "@/lib/contracts/pdf";
import { observeOperationalMetric } from "@/lib/monitoring/operational-observability";
import { logError } from "@/lib/utils/logger";
import { isChinaRegion } from "@/lib/config/region";

interface RouteContext {
  params: Promise<{ id: string }>;
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

  return {
    user: {
      id: authResult.userId,
      role,
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
  const operationId = `contract_export_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const startedAt = Date.now();
  const observe = (
    outcome: "success" | "failure" | "rejected",
    statusCode: number,
    meta?: Record<string, unknown>,
    userId?: string,
  ) => {
    observeOperationalMetric({
      chain: "contract_export",
      outcome,
      statusCode,
      operationId,
      userId,
      durationMs: Date.now() - startedAt,
      metadata: meta,
    });
  };

  try {
    const format = request.nextUrl.searchParams.get("format") || "html";
    const variantParam = request.nextUrl.searchParams.get("variant");
    const variant =
      variantParam === "sealed"
        ? "sealed"
        : variantParam === "signed"
          ? "signed"
          : "current";
    const language = isChinaRegion() ? "zh" : "en";
    const auth = await requireCurrentUser(request);
    if (auth.error) {
      observe("rejected", auth.error.status || 401, { reason: "auth_required", format, variant });
      return auth.error;
    }

    const { id } = await context.params;
    const contract = await getContractById(id);

    if (!contract) {
      observe(
        "rejected",
        404,
        { reason: "contract_not_found", contractId: id, format, variant },
        auth.user.id,
      );
      return NextResponse.json(
        { success: false, error: { message: "Contract not found." } },
        { status: 404 },
      );
    }

    if (!assertContractAccess(contract.userId, auth.user)) {
      observe("rejected", 403, { reason: "forbidden", contractId: id, format, variant }, auth.user.id);
      return NextResponse.json(
        { success: false, error: { message: "You do not have access to this contract." } },
        { status: 403 },
      );
    }

    const content = normalizeContractContent(contract.content);
    if (!content) {
      observe("rejected", 400, { reason: "empty_content", contractId: id, format, variant }, auth.user.id);
      return NextResponse.json(
        { success: false, error: { message: "This contract has no exportable content yet." } },
        { status: 400 },
      );
    }

    const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
    const rawSignatures = buildContractExportSignatures(contract);
    const stage = resolveContractWorkflowStageForExport(
      enhancement.signFlow.status,
      enhancement.sealFlow.status,
      rawSignatures,
    );
    const stageSignatures = filterContractExportSignaturesByStage(rawSignatures, stage);
    const sealImageDataUrl =
      typeof enhancement.sealFlow.stamp?.imageDataUrl === "string"
        ? enhancement.sealFlow.stamp.imageDataUrl.trim()
        : "";
    const sealReady = sealImageDataUrl.length > 0;
    const includeSeal =
      variant === "sealed" ? true : variant === "current" ? sealReady : false;
    const seal = includeSeal
      ? {
          stampedAt: enhancement.sealFlow.stampedAt,
          stampedBy: enhancement.sealFlow.stampedBy,
          note: enhancement.sealFlow.note,
          stamp: enhancement.sealFlow.stamp,
          placement: enhancement.sealFlow.placement,
        }
      : undefined;

    if (variant === "sealed" && !sealReady) {
      observe(
        "rejected",
        409,
        { reason: "seal_not_ready", contractId: id, format, variant },
        auth.user.id,
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SEAL_NOT_READY",
            message: "This contract has not been sealed yet.",
          },
        },
        { status: 409 },
      );
    }

    const renderedHtml =
      typeof contract.metadata?.editorHtml === "string"
        ? contract.metadata.editorHtml
        : null;
    const baseStem = sanitizeDownloadFileName(content.title || contract.title || "contract");
    const fileStem = includeSeal
        ? sanitizeDownloadFileName(`${baseStem}-sealed`)
        : baseStem;

    if (format === "pdf") {
      const pdfBuffer = await buildContractPdfBuffer(content, {
        language,
        signatures: stageSignatures,
        seal,
      });
      observe(
        "success",
        200,
        { format: "pdf", contractId: id, variant, stage, includeSeal },
        auth.user.id,
      );
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${fileStem}.pdf`)}`,
          "Cache-Control": "no-store",
        },
      });
    }

    const bodyHtml = buildContractHtml(content, {
      language,
      renderedHtml,
      signatures: stageSignatures,
      seal,
    });
    const documentHtml = buildContractDocumentHtml(content.title || contract.title, bodyHtml, {
      language,
    });
    const responseConfig =
      format === "word"
        ? {
            contentType: "application/msword; charset=utf-8",
            disposition: `attachment; filename*=UTF-8''${encodeURIComponent(`${fileStem}.doc`)}`,
          }
        : {
            contentType: "text/html; charset=utf-8",
            disposition: `attachment; filename*=UTF-8''${encodeURIComponent(`${fileStem}.html`)}`,
          };
    observe(
      "success",
      200,
      { format, contractId: id, variant, stage, includeSeal },
      auth.user.id,
    );

    return new NextResponse(documentHtml, {
      status: 200,
      headers: {
        "Content-Type": responseConfig.contentType,
        "Content-Disposition": responseConfig.disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    observe("failure", 500, {
      reason: "exception",
      error: error instanceof Error ? error.message : String(error),
    });
    logError(
      "contract_export_failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return NextResponse.json(
      { success: false, error: { message: "Failed to export contract." } },
      { status: 500 },
    );
  }
}
