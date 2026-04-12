import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";

const mockRequireDashboardUser: any = jest.fn();
const mockAcceptDashboardTeamInvite: any = jest.fn();
const mockObserveOperationalMetric: any = jest.fn();

jest.mock("@/lib/dashboard/server-auth", () => ({
  requireDashboardUser: (...args: unknown[]) => mockRequireDashboardUser(...args),
}));

jest.mock("@/lib/data/dashboard-store", () => ({
  acceptDashboardTeamInvite: (...args: unknown[]) => mockAcceptDashboardTeamInvite(...args),
}));

jest.mock("@/lib/monitoring/operational-observability", () => ({
  observeOperationalMetric: (...args: unknown[]) => mockObserveOperationalMetric(...args),
}));

import { POST } from "@/app/api/team-invites/[token]/accept/route";

describe("team invite accept observability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("records rejected metrics for auth failures", async () => {
    mockRequireDashboardUser.mockResolvedValue({
      error: NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      ),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/team-invites/tk-1/accept", {
        method: "POST",
      }),
      { params: Promise.resolve({ token: "tk-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mockObserveOperationalMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "team_invite_accept",
        outcome: "rejected",
        statusCode: 401,
      }),
    );
  });

  test("records success metrics when invite acceptance succeeds", async () => {
    mockRequireDashboardUser.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockAcceptDashboardTeamInvite.mockResolvedValue({
      joined: true,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/team-invites/tk-2/accept", {
        method: "POST",
      }),
      { params: Promise.resolve({ token: "tk-2" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockObserveOperationalMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "team_invite_accept",
        outcome: "success",
        statusCode: 200,
        userId: "user-1",
      }),
    );
  });
});
