import { NextRequest, NextResponse } from "next/server";

import { getPayPalMode } from "@/lib/config/runtime-env";
import { observeOperationalMetric } from "@/lib/monitoring/operational-observability";
import { WebhookHandler } from "@/lib/payment/webhook-handler";
import { logBusinessEvent, logError, logSecurityEvent } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const operationId = `paypal_webhook_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const startedAt = Date.now();
  const observe = (
    outcome: "success" | "failure" | "rejected",
    statusCode: number,
    meta?: Record<string, unknown>,
  ) => {
    observeOperationalMetric({
      chain: "payment_webhook",
      scope: "paypal",
      outcome,
      statusCode,
      operationId,
      durationMs: Date.now() - startedAt,
      metadata: meta,
    });
  };

  try {
    const body = await request.text();
    const signature = request.headers.get("paypal-transmission-sig");
    const certUrl = request.headers.get("paypal-cert-url");
    const transmissionId = request.headers.get("paypal-transmission-id");
    const timestamp = request.headers.get("paypal-transmission-time");
    const authAlgo = request.headers.get("paypal-auth-algo");

    logBusinessEvent("webhook_received", operationId, {
      provider: "paypal",
      hasSignature: !!signature,
      hasTransmissionId: !!transmissionId,
      bodyLength: body.length,
      userAgent: request.headers.get("user-agent"),
      ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    });

    const skipSignatureVerification =
      process.env.PAYPAL_SKIP_SIGNATURE_VERIFICATION === "true";
    const isValidSignature = skipSignatureVerification
      ? true
      : await verifyPayPalSignature({
          body,
          signature,
          certUrl,
          transmissionId,
          timestamp,
          authAlgo,
          operationId,
        });

    if (!isValidSignature) {
      logSecurityEvent(
        "webhook_signature_invalid",
        operationId,
        request.headers.get("x-forwarded-for") || "unknown",
        {
          provider: "paypal",
          skipSignatureVerification,
          hasSignature: !!signature,
          hasCertUrl: !!certUrl,
          hasTransmissionId: !!transmissionId,
          hasTimestamp: !!timestamp,
          hasAuthAlgo: !!authAlgo,
          environment: getPayPalMode(),
        },
      );

      observe("rejected", 401, {
        reason: "invalid_signature",
        skipSignatureVerification,
        hasSignature: !!signature,
        hasTransmissionId: !!transmissionId,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const webhookData = JSON.parse(body);
    const eventType =
      typeof webhookData.event_type === "string" ? webhookData.event_type : "unknown";

    logBusinessEvent("webhook_parsed", operationId, {
      provider: "paypal",
      eventType,
      eventId: webhookData.id,
      transmissionId,
      dataSize: body.length,
    });

    if (transmissionId) {
      webhookData._paypal_transmission_id = transmissionId;
    }

    const webhookHandler = WebhookHandler.getInstance();
    const success = await webhookHandler.processWebhook("paypal", eventType, webhookData);

    if (success) {
      logBusinessEvent("webhook_processed_success", operationId, {
        provider: "paypal",
        eventType,
        eventId: webhookData.id,
        transmissionId,
      });
      observe("success", 200, {
        eventType,
        eventId: webhookData.id,
        transmissionId,
      });
      return NextResponse.json({ status: "success" });
    }

    logError("webhook_processing_failed", undefined, {
      operationId,
      provider: "paypal",
      eventType,
      eventId: webhookData.id,
      transmissionId,
    });
    observe("failure", 500, {
      reason: "handler_failed",
      eventType,
      eventId: webhookData.id,
      transmissionId,
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  } catch (error) {
    observe("failure", 500, {
      reason: "exception",
      error: error instanceof Error ? error.message : String(error),
    });
    logError(
      "webhook_processing_error",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationId,
        provider: "paypal",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function verifyPayPalSignature(args: {
  body: string;
  signature: string | null;
  certUrl: string | null;
  transmissionId: string | null;
  timestamp: string | null;
  authAlgo: string | null;
  operationId: string;
}): Promise<boolean> {
  const { body, signature, certUrl, transmissionId, timestamp, authAlgo, operationId } = args;

  try {
    if (
      process.env.NODE_ENV === "development" &&
      process.env.PAYPAL_VERIFY_WEBHOOK !== "true"
    ) {
      return true;
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!clientId || !clientSecret || !webhookId) {
      logError("paypal_webhook_missing_credentials", undefined, {
        operationId,
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasWebhookId: !!webhookId,
      });
      return false;
    }

    if (!signature || !certUrl || !transmissionId || !timestamp || !authAlgo) {
      logError("paypal_webhook_missing_signature_headers", undefined, {
        operationId,
        hasSignature: !!signature,
        hasCertUrl: !!certUrl,
        hasTransmissionId: !!transmissionId,
        hasTimestamp: !!timestamp,
        hasAuthAlgo: !!authAlgo,
      });
      return false;
    }

    const baseUrl =
      process.env.PAYPAL_API_BASE ||
      (getPayPalMode() === "sandbox"
        ? "https://api-m.sandbox.paypal.com"
        : "https://api-m.paypal.com");

    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      logError("paypal_webhook_token_request_failed", undefined, {
        operationId,
        statusCode: tokenRes.status,
      });
      return false;
    }

    const { access_token } = (await tokenRes.json()) as {
      access_token: string;
    };

    const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: timestamp,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: signature,
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    });

    if (!verifyRes.ok) {
      logError("paypal_webhook_verify_api_failed", undefined, {
        operationId,
        statusCode: verifyRes.status,
      });
      return false;
    }

    const verifyData = (await verifyRes.json()) as {
      verification_status?: string;
    };

    const verified = verifyData.verification_status === "SUCCESS";
    if (!verified) {
      logError("paypal_webhook_verification_failed", undefined, {
        operationId,
        verificationStatus: verifyData.verification_status,
      });
    }

    return verified;
  } catch (error) {
    logError(
      "paypal_webhook_signature_verification_error",
      error instanceof Error ? error : new Error(String(error)),
      {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return false;
  }
}
