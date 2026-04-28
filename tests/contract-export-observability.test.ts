import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const mockExtractTokenFromRequest: any = jest.fn();
const mockVerifyAuthToken: any = jest.fn();
const mockGetContractById: any = jest.fn();
const mockBuildContractDocumentHtml: any = jest.fn();
const mockBuildContractHtml: any = jest.fn();
const mockNormalizeContractContent: any = jest.fn();
const mockSanitizeDownloadFileName: any = jest.fn();
const mockBuildContractPdfBuffer: any = jest.fn();
const mockObserveOperationalMetric: any = jest.fn();
const mockLogError: any = jest.fn();
const mockBuildContractExportSignatures: any = jest.fn();

jest.mock("@/lib/auth/auth-utils", () => ({
  extractTokenFromRequest: (...args: unknown[]) => mockExtractTokenFromRequest(...args),
  verifyAuthToken: (...args: unknown[]) => mockVerifyAuthToken(...args),
}));

jest.mock("@/lib/data/contracts-store", () => ({
  getContractById: (...args: unknown[]) => mockGetContractById(...args),
}));

jest.mock("@/lib/contracts/format", () => ({
  buildContractDocumentHtml: (...args: unknown[]) => mockBuildContractDocumentHtml(...args),
  buildContractHtml: (...args: unknown[]) => mockBuildContractHtml(...args),
  normalizeContractContent: (...args: unknown[]) => mockNormalizeContractContent(...args),
  sanitizeDownloadFileName: (...args: unknown[]) => mockSanitizeDownloadFileName(...args),
}));

jest.mock("@/lib/contracts/pdf", () => ({
  buildContractPdfBuffer: (...args: unknown[]) => mockBuildContractPdfBuffer(...args),
}));

jest.mock("@/lib/contracts/export-signatures", () => ({
  buildContractExportSignatures: (...args: unknown[]) =>
    mockBuildContractExportSignatures(...args),
}));

jest.mock("@/lib/monitoring/operational-observability", () => ({
  observeOperationalMetric: (...args: unknown[]) => mockObserveOperationalMetric(...args),
}));

jest.mock("@/lib/utils/logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

import { GET } from "@/app/api/contracts/[id]/export/route";

describe("contract export observability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("records rejected metrics when authentication is missing", async () => {
    mockExtractTokenFromRequest.mockReturnValue({
      token: null,
      error: null,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/contracts/ct-1/export?format=html"),
      { params: Promise.resolve({ id: "ct-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mockObserveOperationalMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "contract_export",
        outcome: "rejected",
        statusCode: 401,
      }),
    );
  });

  test("records success metrics when html export succeeds", async () => {
    mockExtractTokenFromRequest.mockReturnValue({
      token: "token-1",
      error: null,
    });
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      userId: "user-1",
      user: { role: "user" },
    });
    mockGetContractById.mockResolvedValue({
      id: "ct-1",
      userId: "user-1",
      title: "Demo Contract",
      content: { title: "Demo Contract", sections: [] },
      metadata: {
        signFlow: {
          status: "awaiting_counterparty",
        },
      },
    });
    mockNormalizeContractContent.mockReturnValue({
      title: "Demo Contract",
      sections: [],
    });
    mockSanitizeDownloadFileName.mockReturnValue("demo-contract");
    const signatures = {
      sender: {
        role: "sender",
        signerName: "Alice",
        createdAt: "2026-04-12T08:00:00.000Z",
        method: "draw",
      },
    };
    mockBuildContractExportSignatures.mockReturnValue(signatures);
    mockBuildContractHtml.mockReturnValue("<main>demo</main>");
    mockBuildContractDocumentHtml.mockReturnValue("<html><main>demo</main></html>");

    const response = await GET(
      new NextRequest("http://localhost/api/contracts/ct-1/export?format=html"),
      { params: Promise.resolve({ id: "ct-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockObserveOperationalMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "contract_export",
        outcome: "success",
        statusCode: 200,
        userId: "user-1",
      }),
    );
    expect(mockBuildContractHtml).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Demo Contract", sections: [] }),
      expect.objectContaining({
        signatures,
      }),
    );
  });

  test("falls back to signature-derived export stage when signFlow status is inconsistent", async () => {
    mockExtractTokenFromRequest.mockReturnValue({
      token: "token-1",
      error: null,
    });
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      userId: "user-1",
      user: { role: "user" },
    });
    mockGetContractById.mockResolvedValue({
      id: "ct-1",
      userId: "user-1",
      title: "Demo Contract",
      content: { title: "Demo Contract", sections: [] },
      metadata: {},
    });
    mockNormalizeContractContent.mockReturnValue({
      title: "Demo Contract",
      sections: [],
    });
    mockSanitizeDownloadFileName.mockReturnValue("demo-contract");
    const signatures = {
      sender: {
        role: "sender",
        signerName: "Alice",
        createdAt: "2026-04-12T08:00:00.000Z",
        method: "draw",
      },
      counterparty: {
        role: "counterparty",
        signerName: "Bob",
        createdAt: "2026-04-12T09:00:00.000Z",
        method: "type",
      },
    };
    mockBuildContractExportSignatures.mockReturnValue(signatures);
    mockBuildContractHtml.mockReturnValue("<main>demo</main>");
    mockBuildContractDocumentHtml.mockReturnValue("<html><main>demo</main></html>");

    const response = await GET(
      new NextRequest("http://localhost/api/contracts/ct-1/export?format=html"),
      { params: Promise.resolve({ id: "ct-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockBuildContractHtml).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Demo Contract", sections: [] }),
      expect.objectContaining({
        signatures,
      }),
    );
  });

  test("current export includes seal payload when stamp image exists", async () => {
    const stampImage =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pbdmLQAAAAASUVORK5CYII=";

    mockExtractTokenFromRequest.mockReturnValue({
      token: "token-1",
      error: null,
    });
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      userId: "user-1",
      user: { role: "user" },
    });
    mockGetContractById.mockResolvedValue({
      id: "ct-1",
      userId: "user-1",
      title: "Demo Contract",
      content: { title: "Demo Contract", sections: [] },
      metadata: {
        signFlow: {
          status: "completed",
        },
        sealFlow: {
          status: "not_started",
          stamp: {
            imageDataUrl: stampImage,
            source: "test",
          },
        },
      },
    });
    mockNormalizeContractContent.mockReturnValue({
      title: "Demo Contract",
      sections: [],
    });
    mockSanitizeDownloadFileName.mockReturnValue("demo-contract");
    mockBuildContractExportSignatures.mockReturnValue({
      sender: {
        role: "sender",
        signerName: "Alice",
      },
      counterparty: {
        role: "counterparty",
        signerName: "Bob",
      },
    });
    mockBuildContractHtml.mockReturnValue("<main>demo</main>");
    mockBuildContractDocumentHtml.mockReturnValue("<html><main>demo</main></html>");

    const response = await GET(
      new NextRequest("http://localhost/api/contracts/ct-1/export?format=html&variant=current"),
      { params: Promise.resolve({ id: "ct-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockBuildContractHtml).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        seal: expect.objectContaining({
          stamp: expect.objectContaining({
            imageDataUrl: stampImage,
          }),
        }),
      }),
    );
  });

  test("records failure metrics when pdf generation throws", async () => {
    mockExtractTokenFromRequest.mockReturnValue({
      token: "token-1",
      error: null,
    });
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      userId: "user-1",
      user: { role: "user" },
    });
    mockGetContractById.mockResolvedValue({
      id: "ct-1",
      userId: "user-1",
      title: "Demo Contract",
      content: { title: "Demo Contract", sections: [] },
      metadata: {
        signFlow: {
          status: "completed",
        },
      },
    });
    mockNormalizeContractContent.mockReturnValue({
      title: "Demo Contract",
      sections: [],
    });
    mockSanitizeDownloadFileName.mockReturnValue("demo-contract");
    const signatures = {
      sender: {
        role: "sender",
        signerName: "Alice",
        createdAt: "2026-04-12T08:00:00.000Z",
        method: "draw",
      },
      counterparty: {
        role: "counterparty",
        signerName: "Bob",
        createdAt: "2026-04-12T09:00:00.000Z",
        method: "type",
      },
    };
    mockBuildContractExportSignatures.mockReturnValue(signatures);
    mockBuildContractPdfBuffer.mockRejectedValue(new Error("pdf failed"));

    const response = await GET(
      new NextRequest("http://localhost/api/contracts/ct-1/export?format=pdf"),
      { params: Promise.resolve({ id: "ct-1" }) },
    );

    expect(response.status).toBe(500);
    expect(mockObserveOperationalMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "contract_export",
        outcome: "failure",
        statusCode: 500,
      }),
    );
    expect(mockBuildContractPdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Demo Contract", sections: [] }),
      expect.objectContaining({
        signatures,
      }),
    );
    expect(mockLogError).toHaveBeenCalled();
  });
});
