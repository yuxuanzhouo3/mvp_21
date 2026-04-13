import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const mockRequireDashboardUser: any = jest.fn();
const mockInviteDashboardTeamMember: any = jest.fn();

jest.mock("@/lib/dashboard/server-auth", () => ({
  requireDashboardUser: (...args: unknown[]) => mockRequireDashboardUser(...args),
}));

jest.mock("@/lib/data/dashboard-store", () => ({
  inviteDashboardTeamMember: (...args: unknown[]) =>
    mockInviteDashboardTeamMember(...args),
  listDashboardTeamMembers: jest.fn(),
}));

import { POST } from "@/app/api/dashboard/team/route";

describe("dashboard team route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 503 when invite storage is not initialized", async () => {
    mockRequireDashboardUser.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockInviteDashboardTeamMember.mockRejectedValue({
      code: "42P01",
      message: 'relation "workspace_invites" does not exist',
    });

    const response = await POST(
      new NextRequest("http://localhost/api/dashboard/team", {
        method: "POST",
        body: JSON.stringify({ email: "member@example.com" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.error.message).toContain("storage is not initialized");
  });

  test("returns 409 for already active members", async () => {
    mockRequireDashboardUser.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockInviteDashboardTeamMember.mockRejectedValue(
      new Error("TEAM_MEMBER_ALREADY_ACTIVE"),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/dashboard/team", {
        method: "POST",
        body: JSON.stringify({ email: "member@example.com" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error.message).toContain("already an active workspace member");
  });
});
