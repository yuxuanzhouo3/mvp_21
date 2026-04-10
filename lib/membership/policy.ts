import { DEFAULT_ADMIN_SETTINGS, type AdminSettings } from "@/lib/admin/settings-schema";

const FREE_PLAN_CONTRACTS_PER_MONTH = 2;

export type MembershipPlan = "free" | "pro" | "enterprise";
export type MembershipStatus =
  | "active"
  | "inactive"
  | "paused"
  | "cancelled"
  | "expired";

export interface MembershipSnapshotInput {
  plan?: string | null;
  status?: string | null;
  membershipExpiresAt?: string | null;
  subscriptionExpiresAt?: string | null;
  now?: Date | string | number;
}

export interface ResolvedMembershipState {
  plan: MembershipPlan;
  status: MembershipStatus;
  expiresAt?: string;
  isPaidPlan: boolean;
  isPaidActive: boolean;
  isExpired: boolean;
  millisUntilExpiry?: number;
}

export interface MembershipEntitlements {
  membership: ResolvedMembershipState;
  limits: {
    contractsPerMonth: number | null;
  };
  features: {
    canUseAiChat: boolean;
    canGenerateContract: boolean;
    canCreateTemplate: boolean;
    canCreateTemplateVersion: boolean;
    canCopyTemplate: boolean;
  };
}

function normalizePlan(value: unknown): MembershipPlan {
  if (typeof value !== "string") {
    return "free";
  }

  const normalized = value.trim().toLowerCase();
  // Keep backward compatibility with legacy plan naming.
  if (normalized === "pro" || normalized === "premium") {
    return "pro";
  }
  if (normalized === "enterprise") {
    return "enterprise";
  }

  return "free";
}

function normalizeStatus(value: unknown, fallbackPlan: MembershipPlan): MembershipStatus {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "active") {
      return "active";
    }
    if (normalized === "paused") {
      return "paused";
    }
    if (normalized === "cancelled" || normalized === "canceled") {
      return "cancelled";
    }
    if (normalized === "expired") {
      return "expired";
    }
    if (normalized === "inactive") {
      return "inactive";
    }
  }

  return fallbackPlan === "free" ? "active" : "inactive";
}

function resolveNow(value?: Date | string | number): Date {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function resolveExpiryDate(input: MembershipSnapshotInput): Date | null {
  const candidates = [input.membershipExpiresAt, input.subscriptionExpiresAt];

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) {
      continue;
    }

    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function parseLimit(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized === "unlimited" || normalized === "infinite") {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function resolveContractsPerMonthLimit(
  plan: MembershipPlan,
  settings: AdminSettings,
): number | null {
  if (plan === "enterprise") {
    return null;
  }

  if (plan === "pro") {
    return parseLimit(settings.quota.proContractsPerMonth);
  }

  return FREE_PLAN_CONTRACTS_PER_MONTH;
}

export function resolveMembershipState(
  input: MembershipSnapshotInput,
): ResolvedMembershipState {
  const now = resolveNow(input.now);
  const rawPlan = normalizePlan(input.plan);
  const rawStatus = normalizeStatus(input.status, rawPlan);
  const expiryDate = resolveExpiryDate(input);
  const expiryTime = expiryDate?.getTime();
  const isExpired = typeof expiryTime === "number" && expiryTime <= now.getTime();
  const isPaidPlan = rawPlan !== "free";
  const isPaidActive = isPaidPlan && rawStatus === "active" && !isExpired;

  const plan: MembershipPlan = isPaidActive ? rawPlan : "free";
  const status: MembershipStatus = isPaidActive
    ? "active"
    : isExpired
      ? "expired"
      : rawPlan === "free"
        ? "active"
        : rawStatus === "active"
          ? "inactive"
          : rawStatus;

  return {
    plan,
    status,
    expiresAt: expiryDate?.toISOString(),
    isPaidPlan,
    isPaidActive,
    isExpired,
    millisUntilExpiry: expiryDate ? expiryDate.getTime() - now.getTime() : undefined,
  };
}

export function buildMembershipEntitlements(
  input: MembershipSnapshotInput,
  settings: AdminSettings = DEFAULT_ADMIN_SETTINGS,
): MembershipEntitlements {
  const membership = resolveMembershipState(input);
  const contractsPerMonth = resolveContractsPerMonthLimit(membership.plan, settings);
  const aiEnabled = settings.features.aiContractGeneration;
  const isPaidTier = membership.plan !== "free";

  return {
    membership,
    limits: {
      contractsPerMonth,
    },
    features: {
      canUseAiChat: aiEnabled,
      canGenerateContract: aiEnabled,
      canCreateTemplate: isPaidTier,
      canCreateTemplateVersion: isPaidTier,
      canCopyTemplate: isPaidTier,
    },
  };
}

export function getCurrentMonthWindow(nowInput?: Date | string | number): {
  startAt: string;
  endBefore: string;
} {
  const now = resolveNow(nowInput);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    startAt: start.toISOString(),
    endBefore: end.toISOString(),
  };
}
