import { describe, expect, test } from "@jest/globals";

import { getLegacyContractEntrypointHref } from "@/lib/contracts/legacy-entrypoints";
import {
  buildAdminAuditSummary,
  convertAdminAuditLogsToCsv,
  type AdminAuditLogRecord,
} from "@/lib/data/admin-audit-store";
import {
  normalizeCompanyProfileRecord,
  normalizeContractRecord,
  normalizePaymentRecord,
} from "@/lib/data/unified-models";
import {
  buildContractDocumentHtml,
  buildContractHtml,
  buildContractPdfBuffer,
  normalizeContractContent,
} from "@/lib/contracts/format";

describe("governance mainline coverage", () => {
  test("legacy contract routes collapse into canonical create flow", () => {
    expect(getLegacyContractEntrypointHref("create")).toBe("/create");
    expect(getLegacyContractEntrypointHref("new")).toBe("/create");
    expect(getLegacyContractEntrypointHref("aiGenerate")).toBe("/create/ai-chat");
    expect(getLegacyContractEntrypointHref("uploadTemplate")).toBe(
      "/create/import?method=screenshot&legacy=upload-template",
    );
  });

  test("audit summary builds alerts and export csv from audit-like records", () => {
    const items: AdminAuditLogRecord[] = [
      {
        id: "1",
        actorUserId: "admin-1",
        action: "Admin saved subscription",
        message: "Admin saved subscription",
        path: "/api/admin/subscriptions",
        method: "POST",
        ip: "127.0.0.1",
        userAgent: "jest",
        status: "error",
        severity: "error",
        meta: { targetUserId: "user-1" },
        createdAt: "2026-03-30T10:00:00.000Z",
      },
      {
        id: "2",
        actorUserId: "admin-1",
        action: "Admin saved subscription",
        message: "Admin saved subscription",
        path: "/api/admin/subscriptions",
        method: "POST",
        ip: "127.0.0.1",
        userAgent: "jest",
        status: "denied",
        severity: "warn",
        meta: {},
        createdAt: "2026-03-30T10:01:00.000Z",
      },
      {
        id: "3",
        actorUserId: "admin-1",
        action: "Admin saved subscription",
        message: "Admin saved subscription",
        path: "/api/admin/subscriptions",
        method: "POST",
        ip: "127.0.0.1",
        userAgent: "jest",
        status: "denied",
        severity: "warn",
        meta: {},
        createdAt: "2026-03-30T10:02:00.000Z",
      },
      {
        id: "4",
        actorUserId: "admin-1",
        action: "Admin saved subscription",
        message: "Admin saved subscription",
        path: "/api/admin/subscriptions",
        method: "POST",
        ip: "127.0.0.1",
        userAgent: "jest",
        status: "denied",
        severity: "warn",
        meta: {},
        createdAt: "2026-03-30T10:03:00.000Z",
      },
    ];

    const summary = buildAdminAuditSummary(items);
    const csv = convertAdminAuditLogsToCsv(items);

    expect(summary.total).toBe(4);
    expect(summary.error).toBe(1);
    expect(summary.denied).toBe(3);
    expect(summary.alerts.some((item) => item.id === "denied-spike")).toBe(true);
    expect(summary.alerts.some((item) => item.id === "repeat-denials-by-actor")).toBe(
      true,
    );
    expect(csv).toContain("Admin saved subscription");
    expect(csv).toContain("\"/api/admin/subscriptions\"");
  });

  test("unified models normalize company, contract, and payment records", () => {
    const company = normalizeCompanyProfileRecord({
      _id: "company-1",
      user_id: "user-1",
      company_name: "Morn Contract",
      credit_code: "91310000TEST",
      legal_person: "Alice",
      address: "Shanghai",
      contact_person: "Bob",
      contact_phone: "13800000000",
      contact_email: "ops@example.com",
      ocr_status: "failed",
      metadata: { retryable: true },
    });
    const contract = normalizeContractRecord({
      _id: "contract-1",
      user_id: "user-1",
      title: "Employment Agreement",
      type: "employment",
      status: "signed",
      content: JSON.stringify({
        document: { title: "Employment Agreement" },
        sourceType: "text",
        sourceContent: "chat content",
        parties: [{ name: "Alice" }],
        signatures: [{ signer: "Bob" }],
        metadata: { channel: "dashboard" },
      }),
    });
    const payment = normalizePaymentRecord({
      _id: "payment-1",
      user_id: "user-1",
      amount: "199",
      currency: "CNY",
      status: "completed",
      payment_method: "wechat",
      transaction_id: "wx-123",
      metadata: JSON.stringify({ source: "billing" }),
    });

    expect(company.companyName).toBe("Morn Contract");
    expect(company.metadata?.retryable).toBe(true);
    expect(contract.status).toBe("signed");
    expect(contract.sourceType).toBe("text");
    expect(contract.parties).toHaveLength(1);
    expect(payment.amount).toBe(199);
    expect(payment.paymentMethod).toBe("wechat");
    expect(payment.metadata.source).toBe("billing");
  });

  test("contract export helpers build printable html and binary pdf output", () => {
    const content = normalizeContractContent({
      title: "服务合同",
      sections: [
        { title: "第一条 服务内容", content: "乙方按照约定提供服务。", order: 1 },
        { title: "第二条 付款安排", content: "甲方按月支付费用。", order: 2 },
      ],
      disclaimer: "本合同以电子版本为准。",
    });

    expect(content).not.toBeNull();

    const html = buildContractHtml(content!);
    const documentHtml = buildContractDocumentHtml(content!.title, html);
    const pdfBuffer = buildContractPdfBuffer(content!);

    expect(documentHtml).toContain("服务合同");
    expect(documentHtml).toContain("<!DOCTYPE html>");
    expect(pdfBuffer.toString("utf8", 0, 8)).toContain("%PDF-1.4");
    expect(pdfBuffer.length).toBeGreaterThan(500);
  });
});
