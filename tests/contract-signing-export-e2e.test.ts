import { inflateSync } from "node:zlib";

import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const contractStore = new Map<string, any>();
let contractSeq = 1;

const observeOperationalMetricMock: any = jest.fn();
const logErrorMock: any = jest.fn();

jest.mock("server-only", () => ({}));

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => false,
}));

jest.mock("@/lib/auth/auth-utils", () => ({
  extractTokenFromRequest: () => ({ token: "token_ok", error: null }),
  verifyAuthToken: () =>
    Promise.resolve({
      success: true,
      userId: "user_e2e",
      user: {
        role: "user",
        name: "E2E Tester",
        subscription_plan: "pro",
        subscription_status: "active",
      },
    }),
}));

jest.mock("@/lib/account/server-profile", () => ({
  loadChinaAccountProfile: () => Promise.resolve(null),
  loadIntlAccountProfile: () =>
    Promise.resolve({
      id: "user_e2e",
      subscription_plan: "pro",
      subscription_status: "active",
    }),
}));

jest.mock("@/lib/data/admin-settings-store", () => ({
  loadAdminSettings: () => Promise.resolve({}),
}));

jest.mock("@/lib/membership/policy", () => ({
  buildMembershipEntitlements: () => ({
    membership: { plan: "pro" },
    features: { canUseAiChat: true, canGenerateContract: true },
    limits: { contractsPerMonth: null },
  }),
  getCurrentMonthWindow: () => ({
    startAt: "2026-04-01T00:00:00.000Z",
    endBefore: "2026-05-01T00:00:00.000Z",
  }),
}));

jest.mock("@/lib/auth/user-role", () => ({
  isAdminRole: () => false,
}));

jest.mock("@/lib/data/unified-models", () => ({
  normalizeContractStatus: (status: string | undefined) => status || "draft",
}));

jest.mock("@/lib/data/contracts-store", () => ({
  listContracts: async () => ({
    contracts: Array.from(contractStore.values()),
    total: contractStore.size,
  }),
  countContractsByUserInRange: async () => contractStore.size,
  createContractRecord: async (input: Record<string, unknown>) => {
    const id = `contract_e2e_${contractSeq++}`;
    const now = "2026-04-12T10:00:00.000Z";
    const next = {
      id,
      userId: input.userId,
      title: input.title,
      type: input.type || "service",
      status: input.status || "draft",
      content: input.content,
      parties: input.parties || [],
      signatures: input.signatures || [],
      metadata: input.metadata || {},
      sourceType: input.sourceType || "text",
      sourceContent: input.sourceContent || "",
      analysisResult: input.analysisResult || null,
      region: input.region || "INTL",
      createdAt: now,
      updatedAt: now,
    };
    contractStore.set(id, next);
    return next;
  },
  getContractById: async (id: string) => contractStore.get(id) || null,
  updateContractRecord: async (id: string, updates: Record<string, unknown>) => {
    const current = contractStore.get(id);
    if (!current) {
      throw new Error("Contract not found");
    }

    const next = {
      ...current,
      ...updates,
      metadata:
        updates.metadata && typeof updates.metadata === "object"
          ? updates.metadata
          : current.metadata,
      updatedAt: "2026-04-12T10:10:00.000Z",
    };
    contractStore.set(id, next);
    return next;
  },
  deleteContractRecord: async (id: string) => {
    contractStore.delete(id);
  },
}));

jest.mock("@/lib/monitoring/operational-observability", () => ({
  observeOperationalMetric: (...args: unknown[]) => observeOperationalMetricMock(...args),
}));

jest.mock("@/lib/utils/logger", () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}));

import { POST as createContractPost } from "@/app/api/contracts/route";
import { PUT as updateContractPut } from "@/app/api/contracts/[id]/route";
import { GET as exportContractGet } from "@/app/api/contracts/[id]/export/route";

function toPdfUtf16Hex(value: string) {
  const utf16 = Buffer.from(value, "utf16le");
  const bytes: string[] = [];
  for (let index = 0; index < utf16.length; index += 2) {
    bytes.push(utf16[index + 1]!.toString(16).padStart(2, "0").toUpperCase());
    bytes.push(utf16[index]!.toString(16).padStart(2, "0").toUpperCase());
  }
  return bytes.join("");
}

function extractPdfSearchSpaces(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const spaces: string[] = [raw];
  const streamMark = "stream";
  const endStreamMark = "endstream";
  let cursor = 0;

  while (cursor < raw.length) {
    const streamIndex = raw.indexOf(streamMark, cursor);
    if (streamIndex < 0) {
      break;
    }

    const afterStreamIndex = raw.indexOf("\n", streamIndex);
    if (afterStreamIndex < 0) {
      break;
    }
    const streamStart = afterStreamIndex + 1;
    const endStreamIndex = raw.indexOf(endStreamMark, streamStart);
    if (endStreamIndex < 0) {
      break;
    }

    const streamBytes = buffer.subarray(streamStart, endStreamIndex);
    spaces.push(streamBytes.toString("latin1"));

    const dictStart = raw.lastIndexOf("<<", streamIndex);
    const dictEnd = dictStart >= 0 ? raw.indexOf(">>", dictStart) : -1;
    const dict = dictStart >= 0 && dictEnd >= 0 ? raw.slice(dictStart, dictEnd + 2) : "";
    if (dict.includes("/FlateDecode")) {
      try {
        const inflated = inflateSync(streamBytes).toString("latin1");
        spaces.push(inflated);
      } catch {
        // Ignore broken streams for assertions.
      }
    }

    cursor = endStreamIndex + endStreamMark.length;
  }

  return spaces;
}

function pdfContains(buffer: Buffer, token: string) {
  const tokenUpper = token.toUpperCase();
  const asciiHexUpper = Buffer.from(token, "latin1").toString("hex").toUpperCase();
  const utf16HexUpper = toPdfUtf16Hex(token);
  const spaces = extractPdfSearchSpaces(buffer);

  return spaces.some((space) => {
    const upper = space.toUpperCase();
    return (
      upper.includes(tokenUpper) ||
      upper.includes(asciiHexUpper) ||
      upper.includes(utf16HexUpper)
    );
  });
}

describe("contract signing export e2e", () => {
  beforeEach(() => {
    contractStore.clear();
    contractSeq = 1;
    jest.clearAllMocks();
  });

  test("after both parties sign, html/word/pdf exports all include signer names and sign times", async () => {
    const senderTime = "SENDER_TIME_2026A";
    const counterpartyTime = "COUNTERPARTY_TIME_2026B";
    const senderName = "AliceSender";
    const counterpartyName = "BobCounterparty";
    const pngSignature =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pbdmLQAAAAASUVORK5CYII=";

    const createResponse = await createContractPost(
      new NextRequest("http://localhost/api/contracts", {
        method: "POST",
        body: JSON.stringify({
          title: "Service Agreement E2E",
          type: "service",
          content: {
            title: "Service Agreement E2E",
            sections: [
              {
                id: "section-1",
                title: "Scope",
                content: "Party A provides implementation service.",
                order: 1,
                editable: true,
              },
              {
                id: "section-2",
                title: "Payment",
                content: "Party B pays monthly service fees.",
                order: 2,
                editable: true,
              },
            ],
            disclaimer: "Generated for e2e regression.",
            signature: {
              partyA: { name: "Party A" },
              partyB: { name: "Party B" },
            },
          },
          parties: [
            { role: "partyA", name: "Party A" },
            { role: "partyB", name: "Party B" },
          ],
        }),
      }),
    );
    expect(createResponse.status).toBe(200);
    const createPayload = await createResponse.json();
    const contractId = createPayload.data.contract.id as string;
    expect(contractId).toBeTruthy();

    const startResponse = await updateContractPut(
      new NextRequest(`http://localhost/api/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "start_signing",
        }),
      }),
      { params: Promise.resolve({ id: contractId }) },
    );
    expect(startResponse.status).toBe(200);

    const senderConfirmResponse = await updateContractPut(
      new NextRequest(`http://localhost/api/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "confirm_sender",
          note: "Sender signed via mobile",
          signatureInput: {
            role: "sender",
            method: "draw",
            signerName: senderName,
            createdAt: senderTime,
            source: "mobile",
            legalConsent: true,
            imageDataUrl: pngSignature,
            imageMimeType: "image/png",
            fileName: "sender-signature.png",
          },
        }),
      }),
      { params: Promise.resolve({ id: contractId }) },
    );
    expect(senderConfirmResponse.status).toBe(200);

    const counterpartyConfirmResponse = await updateContractPut(
      new NextRequest(`http://localhost/api/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "confirm_counterparty",
          note: "Counterparty signed via web",
          signatureInput: {
            role: "counterparty",
            method: "type",
            signerName: counterpartyName,
            typedName: "Bob C Signature",
            createdAt: counterpartyTime,
            source: "web",
            legalConsent: true,
          },
        }),
      }),
      { params: Promise.resolve({ id: contractId }) },
    );
    expect(counterpartyConfirmResponse.status).toBe(200);
    const completedPayload = await counterpartyConfirmResponse.json();
    expect(completedPayload.data.contract.status).toBe("completed");

    const htmlResponse = await exportContractGet(
      new NextRequest(`http://localhost/api/contracts/${contractId}/export?format=html`, {
        method: "GET",
      }),
      { params: Promise.resolve({ id: contractId }) },
    );
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("Content-Type")).toContain("text/html");
    const html = await htmlResponse.text();
    expect(html).toContain(senderName);
    expect(html).toContain(counterpartyName);
    expect(html).toContain(senderTime);
    expect(html).toContain(counterpartyTime);
    expect(html).toContain(pngSignature);

    const wordResponse = await exportContractGet(
      new NextRequest(`http://localhost/api/contracts/${contractId}/export?format=word`, {
        method: "GET",
      }),
      { params: Promise.resolve({ id: contractId }) },
    );
    expect(wordResponse.status).toBe(200);
    expect(wordResponse.headers.get("Content-Type")).toContain("application/msword");
    const word = await wordResponse.text();
    expect(word).toContain(senderName);
    expect(word).toContain(counterpartyName);
    expect(word).toContain(senderTime);
    expect(word).toContain(counterpartyTime);

    const pdfResponse = await exportContractGet(
      new NextRequest(`http://localhost/api/contracts/${contractId}/export?format=pdf`, {
        method: "GET",
      }),
      { params: Promise.resolve({ id: contractId }) },
    );
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers.get("Content-Type")).toContain("application/pdf");
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    expect(pdfBuffer.toString("latin1", 0, 8)).toContain("%PDF-");
    expect(pdfContains(pdfBuffer, senderName)).toBe(true);
    expect(pdfContains(pdfBuffer, counterpartyName)).toBe(true);
    expect(pdfContains(pdfBuffer, senderTime)).toBe(true);
    expect(pdfContains(pdfBuffer, counterpartyTime)).toBe(true);
  });
});
