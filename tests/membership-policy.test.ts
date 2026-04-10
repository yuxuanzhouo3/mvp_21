import { describe, expect, test } from "@jest/globals";

import { DEFAULT_ADMIN_SETTINGS } from "@/lib/admin/settings-schema";
import {
  buildMembershipEntitlements,
  getCurrentMonthWindow,
  resolveMembershipState,
} from "@/lib/membership/policy";

describe("membership policy", () => {
  test("expired paid membership falls back to free plan", () => {
    const state = resolveMembershipState({
      plan: "pro",
      status: "active",
      membershipExpiresAt: "2025-01-01T00:00:00.000Z",
      now: "2026-01-01T00:00:00.000Z",
    });

    expect(state.plan).toBe("free");
    expect(state.status).toBe("expired");
    expect(state.isPaidActive).toBe(false);
    expect(state.isExpired).toBe(true);
  });

  test("active paid membership stays active before expiry", () => {
    const state = resolveMembershipState({
      plan: "enterprise",
      status: "active",
      membershipExpiresAt: "2026-12-31T00:00:00.000Z",
      now: "2026-04-01T00:00:00.000Z",
    });

    expect(state.plan).toBe("enterprise");
    expect(state.status).toBe("active");
    expect(state.isPaidActive).toBe(true);
    expect(state.isExpired).toBe(false);
  });

  test("legacy premium plan aliases to pro entitlements", () => {
    const state = resolveMembershipState({
      plan: "premium",
      status: "active",
      membershipExpiresAt: "2026-12-31T00:00:00.000Z",
      now: "2026-04-01T00:00:00.000Z",
    });

    expect(state.plan).toBe("pro");
    expect(state.status).toBe("active");
    expect(state.isPaidActive).toBe(true);
  });

  test("entitlements parse plan limits from admin settings", () => {
    const settings = {
      ...DEFAULT_ADMIN_SETTINGS,
      quota: {
        ...DEFAULT_ADMIN_SETTINGS.quota,
        freeContractsPerMonth: 3,
        proContractsPerMonth: "15",
      },
    };

    const free = buildMembershipEntitlements(
      {
        plan: "free",
        status: "inactive",
      },
      settings,
    );
    const pro = buildMembershipEntitlements(
      {
        plan: "pro",
        status: "active",
      },
      settings,
    );

    expect(free.limits.contractsPerMonth).toBe(3);
    expect(pro.limits.contractsPerMonth).toBe(15);
  });

  test("contract generation requires paid tier while AI chat follows feature switch", () => {
    const free = buildMembershipEntitlements({
      plan: "free",
      status: "active",
    });
    const pro = buildMembershipEntitlements({
      plan: "pro",
      status: "active",
    });

    expect(free.features.canUseAiChat).toBe(true);
    expect(free.features.canGenerateContract).toBe(false);
    expect(free.features.canCreateTemplate).toBe(false);
    expect(free.features.canCopyTemplate).toBe(false);
    expect(pro.features.canGenerateContract).toBe(true);
    expect(pro.features.canCreateTemplate).toBe(true);
    expect(pro.features.canCopyTemplate).toBe(true);
  });

  test("month window boundaries are generated in UTC", () => {
    const window = getCurrentMonthWindow("2026-04-10T08:30:00.000Z");

    expect(window.startAt).toBe("2026-04-01T00:00:00.000Z");
    expect(window.endBefore).toBe("2026-05-01T00:00:00.000Z");
  });
});
