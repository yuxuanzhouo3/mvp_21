import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logAdminApiError, logAdminAudit, requireAdmin } from "@/lib/auth/admin-auth";
import { loadRuntimePricingSnapshot, saveRuntimePricingSnapshot } from "@/lib/pricing/runtime";

const pricingSchema = z.object({
  pro: z.object({
    monthly: z.number().positive(),
    yearly: z.number().positive(),
  }),
  enterprise: z.object({
    monthly: z.number().positive(),
    yearly: z.number().positive(),
  }),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const snapshot = await loadRuntimePricingSnapshot();
    logAdminAudit("admin_pricing_loaded", auth.auditContext, {
      currency: snapshot.currency,
    });

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    logAdminApiError("admin_pricing_load_failed", error, auth.auditContext);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Failed to load pricing settings." },
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const body = await request.json();
    const parsed = pricingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Invalid pricing payload.",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const saved = await saveRuntimePricingSnapshot(parsed.data);

    logAdminAudit("admin_pricing_updated", auth.auditContext, {
      currency: saved.currency,
      proMonthly: saved.plans.pro.monthly,
      proYearly: saved.plans.pro.yearly,
      enterpriseMonthly: saved.plans.enterprise.monthly,
      enterpriseYearly: saved.plans.enterprise.yearly,
    });

    return NextResponse.json({
      success: true,
      data: saved,
    });
  } catch (error) {
    logAdminApiError("admin_pricing_update_failed", error, auth.auditContext);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Failed to save pricing settings." },
      },
      { status: 500 },
    );
  }
}

