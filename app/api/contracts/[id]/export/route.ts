import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import { getContractById } from "@/lib/data/contracts-store";
import {
  buildContractDocumentHtml,
  buildContractHtml,
  normalizeContractContent,
  sanitizeDownloadFileName,
} from "@/lib/contracts/format";
import { buildContractPdfBuffer } from "@/lib/contracts/pdf";

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

    const content = normalizeContractContent(contract.content);
    if (!content) {
      return NextResponse.json(
        { success: false, error: { message: "This contract has no exportable content yet." } },
        { status: 400 },
      );
    }

    const renderedHtml =
      typeof contract.metadata?.editorHtml === "string"
        ? contract.metadata.editorHtml
        : null;
    const format = request.nextUrl.searchParams.get("format") || "html";
    const fileStem = sanitizeDownloadFileName(content.title || contract.title || "contract");

    if (format === "pdf") {
      const pdfBuffer = await buildContractPdfBuffer(content);
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
      renderedHtml,
    });
    const documentHtml = buildContractDocumentHtml(content.title || contract.title, bodyHtml);
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

    return new NextResponse(documentHtml, {
      status: 200,
      headers: {
        "Content-Type": responseConfig.contentType,
        "Content-Disposition": responseConfig.disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export contract:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to export contract." } },
      { status: 500 },
    );
  }
}
