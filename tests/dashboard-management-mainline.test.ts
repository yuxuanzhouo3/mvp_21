import { describe, expect, test } from "@jest/globals";

import {
  buildDashboardTeamPermissions,
  buildDashboardTemplatePermissions,
} from "@/lib/data/dashboard-store";

describe("dashboard management mainline coverage", () => {
  test("template permissions expose the managed template workflow actions", () => {
    const permissions = buildDashboardTemplatePermissions();

    expect(permissions.canCreate).toBe(true);
    expect(permissions.canEditOwned).toBe(true);
    expect(permissions.canCreateVersion).toBe(true);
    expect(permissions.canCopy).toBe(true);
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
});
