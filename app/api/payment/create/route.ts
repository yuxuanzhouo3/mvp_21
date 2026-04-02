// app/api/payment/create/route.ts - Payment creation API route
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth, createAuthErrorResponse } from "@/lib/auth/auth";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { captureException } from "@/lib/integrations/sentry";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { getPayment } from "@/lib/payment/adapter";
import { buildSubscriptionPaymentFields } from "@/lib/payment/subscription-payment-sync";
import { paymentRateLimit } from "@/lib/security/rate-limit";

// Validate payment creation payloads from the client.
const createPaymentSchema = z.object({
  method: z.string().min(1, "Payment method is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().min(1, "Currency is required"),
  description: z.string().optional(),
  planType: z.string().optional(),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
  idempotencyKey: z.string().optional(),
});

/**
 * POST /api/payment/create
 * Create a new payment order after auth and rate-limit checks.
 */
export async function POST(request: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => resolve(NextResponse.json(data, { status: code })),
      }),
      setHeader: () => {},
      getHeader: () => undefined,
    };

    paymentRateLimit(request as any, mockRes as any, async () => {
      resolve(await handlePaymentCreate(request));
    });
  });
}

async function handlePaymentCreate(request: NextRequest) {
  try {
    // Ensure the caller is authenticated.
    const authResult = await requireAuth(request);
    if (!authResult) {
      return createAuthErrorResponse();
    }

    const { user } = authResult;

    // Validate the request body before touching payment state.
    const body = await request.json();
    const validationResult = createPaymentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input",
          code: "VALIDATION_ERROR",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const {
      method,
      amount,
      currency,
      description,
      planType,
      billingCycle,
      idempotencyKey,
    } = validationResult.data;

    const userId = user.id;

    // Block repeated create requests that arrive within a short window.
    let recentPayments: any[] = [];
    let checkError: any = null;

    if (isChinaRegion()) {
      try {
        const db = getDatabase();
        const _ = db.command;
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

        const result = await db
          .collection("payments")
          .where({
            user_id: userId,
            amount,
            currency,
            payment_method: method,
            created_at: _.gte(oneMinuteAgo),
            status: _.in(["pending", "completed"]),
          })
          .orderBy("created_at", "desc")
          .limit(1)
          .get();

        recentPayments = result.data || [];
      } catch (error) {
        console.error("Error checking existing CloudBase payment:", error);
        checkError = error;
      }
    } else {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from("payments")
        .select("id, status, created_at, transaction_id")
        .eq("user_id", userId)
        .eq("amount", amount)
        .eq("currency", currency)
        .eq("payment_method", method)
        .gte("created_at", oneMinuteAgo)
        .in("status", ["pending", "completed"])
        .order("created_at", { ascending: false })
        .limit(1);

      recentPayments = data || [];
      checkError = error;
    }

    if (checkError && (!isChinaRegion() || (checkError as any)?.code !== "PGRST116")) {
      console.error("Error checking existing payment:", checkError);
      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify payment uniqueness, please try again",
        },
        { status: 500 },
      );
    }

    if (recentPayments && recentPayments.length > 0) {
      const latestPayment = recentPayments[0];
      const paymentAge =
        Date.now() -
        new Date(latestPayment.created_at || latestPayment.createdAt).getTime();

      console.warn(
        `Duplicate payment request blocked: User ${userId} tried to create payment within ${Math.floor(
          paymentAge / 1000,
        )}s of existing payment ${latestPayment.id || latestPayment._id} (status: ${latestPayment.status})`,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "You have a recent payment request. Please wait a moment before trying again.",
          code: "DUPLICATE_PAYMENT_REQUEST",
          existingPaymentId: latestPayment.id || latestPayment._id,
          waitTime: Math.ceil((60000 - paymentAge) / 1000),
        },
        { status: 429 },
      );
    }

    // Derive normalized billing metadata for downstream persistence.
    const paymentFields = buildSubscriptionPaymentFields({
      planType: planType || "pro",
      billingCycle: billingCycle || "monthly",
    });

    const payment = getPayment();

    const order = {
      amount,
      currency,
      description:
        description ||
        `${billingCycle === "monthly" ? "1 Month" : "1 Year"} Premium Membership`,
      userId,
      planType: paymentFields.metadata.planType,
      billingCycle: paymentFields.metadata.billingCycle,
      method,
    };

    console.log(`Creating payment with method: ${method} using adapter`);

    // Create the provider order through the payment adapter.
    const orderResult = await payment.createOrder(amount, userId);
    const normalizedOrderResult = orderResult as typeof orderResult & {
      qrCode?: string;
      expiresAt?: string;
    };

    // Persist the pending payment record in the region-specific store.
    let paymentRecordError: any = null;

    if (isChinaRegion()) {
      try {
        const db = getDatabase();
        const paymentsCollection = db.collection("payments");

        await paymentsCollection.add({
          user_id: userId,
          amount,
          currency: currency || "CNY",
          status: "pending",
          payment_method: method,
          order_id: orderResult.orderId,
          out_trade_no: orderResult.orderId,
          transaction_id: orderResult.orderId,
          billing_cycle: paymentFields.billing_cycle,
          product_type: paymentFields.product_type,
          product_name: paymentFields.product_name,
          metadata: paymentFields.metadata,
          region: "CN",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error recording CloudBase payment:", error);
        paymentRecordError = error;
      }
    } else {
      const { error } = await supabaseAdmin.from("payments").insert({
        user_id: userId,
        amount,
        currency,
        status: "pending",
        payment_method: method,
        order_id: orderResult.orderId,
        out_trade_no: orderResult.orderId,
        transaction_id: orderResult.orderId,
        billing_cycle: paymentFields.billing_cycle,
        product_type: paymentFields.product_type,
        product_name: paymentFields.product_name,
        metadata: paymentFields.metadata,
      });

      if (!error) {
        console.log("Payment recorded with metadata:", {
          transactionId: orderResult.orderId,
          metadata: paymentFields.metadata,
        });
      }

      paymentRecordError = error;
    }

    if (paymentRecordError) {
      console.error("Error recording payment:", paymentRecordError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to record payment",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: orderResult.orderId,
        paymentUrl: orderResult.paymentUrl,
        qrCode: normalizedOrderResult.qrCode,
        expiresAt: normalizedOrderResult.expiresAt,
        method: order.method,
        amount: order.amount,
        currency: order.currency,
        description: order.description,
        planType: order.planType,
        billingCycle: order.billingCycle,
        idempotencyKey,
      },
    });
  } catch (error) {
    console.error("Payment create error:", error);
    captureException(error as Error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create payment",
      },
      { status: 500 },
    );
  }
}
