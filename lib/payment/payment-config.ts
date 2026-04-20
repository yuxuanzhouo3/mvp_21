/**
 * Unified payment pricing config.
 * Defaults are kept as a safe fallback when dynamic settings are unavailable.
 */

export type BillingCycle = "monthly" | "yearly";
export type PaymentMethod = "stripe" | "alipay" | "wechat";
export type SubscriptionPlanType = "free" | "pro" | "enterprise";
export type PricingCurrency = "CNY" | "USD";

const PRICING_DATA = {
  CNY: {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 10, yearly: 199 },
    enterprise: { monthly: 99, yearly: 799 },
  },
  USD: {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 9.99, yearly: 99.99 },
    enterprise: { monthly: 29.99, yearly: 299.99 },
  },
} as const;

export const PRICING_TABLE = PRICING_DATA;
export const DEFAULT_PRICING_TABLE = PRICING_DATA;

export interface RuntimePricingSnapshot {
  region: "CN" | "INTL";
  currency: PricingCurrency;
  plans: {
    free: Record<BillingCycle, number>;
    pro: Record<BillingCycle, number>;
    enterprise: Record<BillingCycle, number>;
  };
  updatedAt?: string;
}

export function normalizePlanType(planType?: string | null): SubscriptionPlanType {
  const normalized = (planType || "").trim().toLowerCase();
  if (normalized === "enterprise") {
    return "enterprise";
  }
  if (normalized === "free") {
    return "free";
  }
  return "pro";
}

export function resolvePricingFromSnapshot(
  snapshot: RuntimePricingSnapshot,
  method: PaymentMethod,
  planType?: string | null,
) {
  const resolvedPlan = normalizePlanType(planType);
  const currency: PricingCurrency = method === "alipay" || method === "wechat" ? "CNY" : "USD";

  const fallback = DEFAULT_PRICING_TABLE[currency][resolvedPlan];
  const selected = snapshot.currency === currency ? snapshot.plans[resolvedPlan] : fallback;

  return {
    currency,
    monthly: selected.monthly,
    yearly: selected.yearly,
    planType: resolvedPlan,
  };
}

export function getPricingByMethod(method: PaymentMethod, planType?: string | null) {
  const resolvedPlan = normalizePlanType(planType);
  const currency = method === "alipay" || method === "wechat" ? "CNY" : "USD";

  return {
    currency,
    monthly: PRICING_DATA[currency][resolvedPlan].monthly,
    yearly: PRICING_DATA[currency][resolvedPlan].yearly,
    planType: resolvedPlan,
  };
}

export function getAmountByCurrency(
  currency: string,
  billingCycle: BillingCycle,
  planType?: string | null,
): number {
  const key = currency === "CNY" ? "CNY" : "USD";
  const resolvedPlan = normalizePlanType(planType);
  return PRICING_DATA[key][resolvedPlan][billingCycle];
}

export function getDaysByBillingCycle(billingCycle: BillingCycle): number {
  return billingCycle === "monthly" ? 30 : 365;
}

