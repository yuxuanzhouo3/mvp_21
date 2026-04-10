import { describe, expect, test } from "@jest/globals";

import {
  DEFAULT_TEMPLATE_SEED,
  buildDashboardTeamPermissions,
  buildDashboardTemplatePermissions,
} from "@/lib/data/dashboard-store";

describe("dashboard management mainline coverage", () => {
  test("template permissions are plan-aware for managed workflow actions", () => {
    const freePermissions = buildDashboardTemplatePermissions();
    const paidPermissions = buildDashboardTemplatePermissions({
      subscriptionPlan: "pro",
      subscriptionStatus: "active",
      membershipExpiresAt: "2030-01-01T00:00:00.000Z",
    });

    expect(freePermissions.canCreate).toBe(false);
    expect(freePermissions.canEditOwned).toBe(true);
    expect(freePermissions.canCreateVersion).toBe(false);
    expect(freePermissions.canCopy).toBe(false);

    expect(paidPermissions.canCreate).toBe(true);
    expect(paidPermissions.canEditOwned).toBe(true);
    expect(paidPermissions.canCreateVersion).toBe(true);
    expect(paidPermissions.canCopy).toBe(true);
  });

  test("owner and admin workspace permissions are differentiated correctly", () => {
    const owner = buildDashboardTeamPermissions("owner");
    const admin = buildDashboardTeamPermissions("admin");
    const member = buildDashboardTeamPermissions("member");

    expect(owner.canInvite).toBe(true);
    expect(owner.canManageRoles).toBe(true);
    expect(admin.canInvite).toBe(true);
    expect(admin.canManageRoles).toBe(false);
    expect(admin.canChangeStatus).toBe(true);
    expect(member.canInvite).toBe(false);
    expect(member.canRemoveMembers).toBe(false);
  });

  test("workspace permission matrix stays strict for each role", () => {
    expect(buildDashboardTeamPermissions("owner")).toEqual({
      currentRole: "owner",
      canInvite: true,
      canManageRoles: true,
      canRemoveMembers: true,
      canChangeStatus: true,
    });

    expect(buildDashboardTeamPermissions("admin")).toEqual({
      currentRole: "admin",
      canInvite: true,
      canManageRoles: false,
      canRemoveMembers: true,
      canChangeStatus: true,
    });

    expect(buildDashboardTeamPermissions("member")).toEqual({
      currentRole: "member",
      canInvite: false,
      canManageRoles: false,
      canRemoveMembers: false,
      canChangeStatus: false,
    });
  });

  test("default template seed ships structured starter templates instead of placeholder text", () => {
    expect(DEFAULT_TEMPLATE_SEED.length).toBeGreaterThanOrEqual(6);

    for (const template of DEFAULT_TEMPLATE_SEED) {
      expect(template.is_public).toBe(true);
      expect(template.description.length).toBeGreaterThan(12);
      expect(template.content.length).toBeGreaterThan(400);
      expect(template.content).not.toContain("template content here");
      expect(template.content).toMatch(/第[一二三四五六七八九十]条|1\./);
    }
  });
});
