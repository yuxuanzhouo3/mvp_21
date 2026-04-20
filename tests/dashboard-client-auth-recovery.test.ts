import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockGetAuthHeaderAsync: any = jest.fn();
const mockGetSession: any = jest.fn();
const mockRefreshSession: any = jest.fn();

jest.mock("@/lib/auth/frontend-token-manager", () => ({
  tokenManager: {
    getAuthHeaderAsync: (...args: unknown[]) => mockGetAuthHeaderAsync(...args),
  },
}));

jest.mock("@/lib/integrations/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  },
}));

import { getDashboardOverview } from "@/lib/dashboard/client";

describe("dashboard client auth recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthHeaderAsync.mockResolvedValue(null);
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  test("uses Supabase session token when token manager has no header", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "intl-session-token",
        },
      },
      error: null,
    });

    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { stats: {} } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await getDashboardOverview();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard/overview",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer intl-session-token",
        }),
      }),
    );

    fetchMock.mockRestore();
  });

  test("throws UNAUTHORIZED when no token can be recovered", async () => {
    await expect(getDashboardOverview()).rejects.toThrow("UNAUTHORIZED");
  });

  test("retries once with refreshed token after 401 response", async () => {
    mockGetAuthHeaderAsync.mockResolvedValueOnce({
      Authorization: "Bearer stale-token",
    });
    mockRefreshSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "refreshed-token",
        },
      },
      error: null,
    });

    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Please sign in first." } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { stats: {} } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await getDashboardOverview();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer refreshed-token",
        }),
      }),
    );

    fetchMock.mockRestore();
  });
});
