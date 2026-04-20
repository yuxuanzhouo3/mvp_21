import { isChinaRegion } from "@/lib/config/region";
import { loadAdminSettings, saveAdminSettings } from "@/lib/data/admin-settings-store";
import {
  DEFAULT_PRICING_TABLE,
  type BillingCycle,
  type PaymentMethod,
  type PricingCurrency,
  type RuntimePricingSnapshot,
  resolvePricingFromSnapshot,
} from "@/lib/payment/payment-config";

function asFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getRegionDefaults(region: "CN" | "INTL") {
  const currency: PricingCurrency = region === "CN" ? "CNY" : "USD";
  return {
    region,
    currency,
    plans: {
      free: { ...DEFAULT_PRICING_TABLE[currency].free },
      pro: { ...DEFAULT_PRICING_TABLE[currency].pro },
      enterprise: { ...DEFAULT_PRICING_TABLE[currency].enterprise },
    },
  } satisfies RuntimePricingSnapshot;
}

export async function loadRuntimePricingSnapshot(): Promise<RuntimePricingSnapshot> {
  const region: "CN" | "INTL" = isChinaRegion() ? "CN" : "INTL";
  const defaults = getRegionDefaults(region);

  try {
    const settings = await loadAdminSettings();
    const pricing = settings.payment?.pricing || {};
    const isCn = region === "CN";

    const proMonthly = isCn
      ? asFiniteNumber(pricing.proMonthlyCny, defaults.plans.pro.monthly)
      : asFiniteNumber((pricing as { proMonthlyUsd?: unknown }).proMonthlyUsd, defaults.plans.pro.monthly);
    const proYearly = isCn
      ? asFiniteNumber(pricing.proYearlyCny, defaults.plans.pro.yearly)
      : asFiniteNumber((pricing as { proYearlyUsd?: unknown }).proYearlyUsd, defaults.plans.pro.yearly);
    const enterpriseMonthly = isCn
      ? asFiniteNumber(pricing.enterpriseMonthlyCny, defaults.plans.enterprise.monthly)
      : asFiniteNumber(
          (pricing as { enterpriseMonthlyUsd?: unknown }).enterpriseMonthlyUsd,
          defaults.plans.enterprise.monthly,
        );
    const enterpriseYearly = isCn
      ? asFiniteNumber(pricing.enterpriseYearlyCny, defaults.plans.enterprise.yearly)
      : asFiniteNumber(
          (pricing as { enterpriseYearlyUsd?: unknown }).enterpriseYearlyUsd,
          defaults.plans.enterprise.yearly,
        );

    return {
      ...defaults,
      plans: {
        free: {
          monthly: defaults.plans.free.monthly,
          yearly: defaults.plans.free.yearly,
        },
        pro: {
          monthly: proMonthly,
          yearly: proYearly,
        },
        enterprise: {
          monthly: enterpriseMonthly,
          yearly: enterpriseYearly,
        },
      },
      updatedAt: settings.updatedAt,
    };
  } catch {
    return defaults;
  }
}

export async function saveRuntimePricingSnapshot(input: {
  pro: Record<BillingCycle, number>;
  enterprise: Record<BillingCycle, number>;
}): Promise<RuntimePricingSnapshot> {
  const current = await loadAdminSettings();
  const isCn = isChinaRegion();

  const nextSettings = {
    ...current,
    payment: {
      ...current.payment,
      pricing: {
        ...current.payment.pricing,
        ...(isCn
          ? {
              proMonthlyCny: input.pro.monthly,
              proYearlyCny: input.pro.yearly,
              enterpriseMonthlyCny: input.enterprise.monthly,
              enterpriseYearlyCny: input.enterprise.yearly,
            }
          : {
              proMonthlyUsd: input.pro.monthly,
              proYearlyUsd: input.pro.yearly,
              enterpriseMonthlyUsd: input.enterprise.monthly,
              enterpriseYearlyUsd: input.enterprise.yearly,
            }),
      },
    },
  };

  await saveAdminSettings(nextSettings);
  return loadRuntimePricingSnapshot();
}

export async function getRuntimePricingByMethod(
  method: PaymentMethod,
  planType?: string | null,
) {
  const snapshot = await loadRuntimePricingSnapshot();
  return resolvePricingFromSnapshot(snapshot, method, planType);
}

