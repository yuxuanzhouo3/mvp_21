import { NextRequest, NextResponse } from "next/server";

import { createAuthErrorResponse, requireAuth } from "@/lib/auth/auth";
import { getPaymentByIdForUser } from "@/lib/data/billing-store";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

function buildInvoiceHtml(args: {
  invoiceNumber: string;
  issueDate: string;
  paymentMethod: string;
  amount: string;
  currency: string;
  status: string;
  planName: string;
  transactionId: string;
}) {
  const {
    invoiceNumber,
    issueDate,
    paymentMethod,
    amount,
    currency,
    status,
    planName,
    transactionId,
  } = args;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Invoice ${escapeHtml(invoiceNumber)}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; background: #f8fafc; color: #0f172a; }
      .page { max-width: 860px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08); overflow: hidden; }
      .hero { padding: 32px; background: linear-gradient(135deg, #eff6ff, #f8fafc); border-bottom: 1px solid #e2e8f0; }
      .hero h1 { margin: 0 0 8px; font-size: 30px; }
      .hero p { margin: 0; color: #475569; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; padding: 32px; }
      .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; background: #fff; }
      .label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 8px; }
      .value { font-size: 18px; font-weight: 600; }
      .table { width: calc(100% - 64px); margin: 0 32px 32px; border-collapse: collapse; }
      .table th, .table td { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; text-align: left; }
      .table th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
      .footer { padding: 0 32px 32px; color: #64748b; font-size: 13px; }
      @media print {
        body { background: #fff; }
        .page { margin: 0; border: none; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <h1>Payment Invoice</h1>
        <p>MornContract billing record generated from the current payment ledger.</p>
      </section>
      <section class="grid">
        <div class="card">
          <span class="label">Invoice Number</span>
          <div class="value">${escapeHtml(invoiceNumber)}</div>
        </div>
        <div class="card">
          <span class="label">Issue Date</span>
          <div class="value">${escapeHtml(issueDate)}</div>
        </div>
        <div class="card">
          <span class="label">Status</span>
          <div class="value">${escapeHtml(status)}</div>
        </div>
        <div class="card">
          <span class="label">Payment Method</span>
          <div class="value">${escapeHtml(paymentMethod)}</div>
        </div>
      </section>
      <table class="table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Transaction</th>
            <th>Currency</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(planName)}</td>
            <td>${escapeHtml(transactionId)}</td>
            <td>${escapeHtml(currency)}</td>
            <td>${escapeHtml(amount)}</td>
          </tr>
        </tbody>
      </table>
      <div class="footer">
        This invoice is generated from the platform payment record and is intended for billing reference.
      </div>
    </main>
  </body>
</html>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth(request);
  if (!authResult) {
    return createAuthErrorResponse();
  }

  const { id } = await params;
  const payment = await getPaymentByIdForUser({
    userId: authResult.user.id,
    paymentId: id,
  });

  if (!payment) {
    return NextResponse.json(
      { error: "Payment record not found" },
      { status: 404 },
    );
  }

  const invoiceNumber = `INV-${payment.id.slice(0, 8).toUpperCase()}`;
  const issueDate = new Date(payment.createdAt || Date.now()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const metadata = payment.metadata || {};
  const planName =
    (typeof metadata.planType === "string" && metadata.planType) ||
    (typeof metadata.paymentType === "string" && metadata.paymentType) ||
    "Subscription payment";
  const transactionId = payment.transactionId || payment.id;
  const amount = formatAmount(payment.amount, payment.currency || "USD");
  const html = buildInvoiceHtml({
    invoiceNumber,
    issueDate,
    paymentMethod: payment.paymentMethod || "Unknown",
    amount,
    currency: payment.currency || "USD",
    status: payment.status,
    planName,
    transactionId,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=60",
    },
  });
}
