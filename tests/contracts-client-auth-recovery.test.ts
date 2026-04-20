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

import { listContractsForCurrentUser } from "@/lib/contracts/client";

describe("contracts client auth recovery", () => {
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

  test("uses Supabase session token when token manager header is missing", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "intl-contract-token",
        },
      },
      error: null,
    });

    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { contracts: [] } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    await listContractsForCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contracts?limit=100",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer intl-contract-token",
        }),
      }),
    );

    fetchMock.mockRestore();
  });

  test("returns ContractClientError UNAUTHORIZED when no token can be recovered", async () => {
    await expect(listContractsForCurrentUser()).rejects.toMatchObject({
      name: "ContractClientError",
      code: "UNAUTHORIZED",
      message: "UNAUTHORIZED",
    });
  });

  test("retries with refreshed token after 401 response", async () => {
    mockGetAuthHeaderAsync.mockResolvedValueOnce({
      Authorization: "Bearer stale-contract-token",
    });
    mockRefreshSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "refreshed-contract-token",
        },
      },
      error: null,
    });

    const fetchMock = jest
      .spyOn(global, "fetch" as any)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: "Unauthorized" } }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { contracts: [] } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    await listContractsForCurrentUser();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer refreshed-contract-token",
        }),
      }),
    );

    fetchMock.mockRestore();
  });
});
