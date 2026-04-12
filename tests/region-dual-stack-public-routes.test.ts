import { describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

type Region = "CN" | "INTL";

async function loadPublicRoutes(region: Region) {
  jest.resetModules();

  const mockGetInvitePreview = jest.fn(async (token: string, origin: string) =>
    token === "ok-invite" ? { token, origin, kind: "invite" } : null,
  );
  const mockGetDocVerify = jest.fn(async (token: string, origin: string) =>
    token === "ok-doc" ? { token, origin, status: "verified" } : null,
  );
  const mockRequireDashboardUser = jest.fn(async () => ({
    user: { id: `user_${region.toLowerCase()}` },
  }));
  const mockAcceptInvite = jest.fn(async () => ({ joined: true }));

  jest.doMock("@/lib/config/region", () => ({
    isChinaRegion: () => region === "CN",
  }));

  jest.doMock("@/lib/data/dashboard-store", () => ({
    getPublicDashboardTeamInvitePreview: (...args: unknown[]) =>
      mockGetInvitePreview(...args),
    acceptDashboardTeamInvite: (...args: unknown[]) => mockAcceptInvite(...args),
  }));

  jest.doMock("@/lib/data/dashboard-documents-store", () => ({
    getPublicDashboardDocumentVerificationData: (...args: unknown[]) =>
      mockGetDocVerify(...args),
  }));

  jest.doMock("@/lib/dashboard/server-auth", () => ({
    requireDashboardUser: (...args: unknown[]) => mockRequireDashboardUser(...args),
  }));

  const teamInviteRoute = await import(
    "@/app/api/public/team-invites/[token]/route"
  );
  const verifyRoute = await import(
    "@/app/api/public/documents/[token]/verify/route"
  );
  const acceptRoute = await import(
    "@/app/api/team-invites/[token]/accept/route"
  );

  return {
    teamInviteRoute,
    verifyRoute,
    acceptRoute,
    mockAcceptInvite,
  };
}

describe.each<Region>(["CN", "INTL"])(
  "region dual-stack public route consistency (%s)",
  (region) => {
    test("public invite preview status mapping stays consistent", async () => {
      const { teamInviteRoute } = await loadPublicRoutes(region);

      const okResponse = await teamInviteRoute.GET(
        new NextRequest("http://localhost/api/public/team-invites/ok-invite"),
        { params: Promise.resolve({ token: "ok-invite" }) },
      );
      expect(okResponse.status).toBe(200);
      const okPayload = await okResponse.json();
      expect(okPayload.success).toBe(true);

      const missResponse = await teamInviteRoute.GET(
        new NextRequest("http://localhost/api/public/team-invites/missing"),
        { params: Promise.resolve({ token: "missing" }) },
      );
      expect(missResponse.status).toBe(404);
      const missPayload = await missResponse.json();
      expect(missPayload.success).toBe(false);
    });

    test("public document verify status mapping stays consistent", async () => {
      const { verifyRoute } = await loadPublicRoutes(region);

      const okResponse = await verifyRoute.GET(
        new NextRequest("http://localhost/api/public/documents/ok-doc/verify"),
        { params: Promise.resolve({ token: "ok-doc" }) },
      );
      expect(okResponse.status).toBe(200);
      const okPayload = await okResponse.json();
      expect(okPayload.success).toBe(true);

      const missResponse = await verifyRoute.GET(
        new NextRequest("http://localhost/api/public/documents/missing/verify"),
        { params: Promise.resolve({ token: "missing" }) },
      );
      expect(missResponse.status).toBe(404);
      const missPayload = await missResponse.json();
      expect(missPayload.success).toBe(false);
    });

    test("team invite accept error-code mapping stays consistent", async () => {
      const { acceptRoute, mockAcceptInvite } = await loadPublicRoutes(region);
      mockAcceptInvite.mockRejectedValueOnce(
        new Error("TEAM_INVITE_EMAIL_MISMATCH"),
      );

      const response = await acceptRoute.POST(
        new NextRequest("http://localhost/api/team-invites/invite-1/accept", {
          method: "POST",
        }),
        { params: Promise.resolve({ token: "invite-1" }) },
      );
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(payload.success).toBe(false);
      expect(payload.error.message).toContain("invited email");
    });
  },
);

