import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

let mockIsChinaRegion = true;
const mockExtractTokenFromRequest: any = jest.fn();
const mockVerifyAuthToken: any = jest.fn();
const mockCaptureException: any = jest.fn();

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => mockIsChinaRegion,
}));

jest.mock("@/lib/auth/auth-utils", () => ({
  extractTokenFromRequest: (...args: unknown[]) => mockExtractTokenFromRequest(...args),
  verifyAuthToken: (...args: unknown[]) => mockVerifyAuthToken(...args),
}));

jest.mock("@/lib/security/rate-limit", () => ({
  authRateLimit: (_req: unknown, _res: unknown, next: () => Promise<void> | void) => next(),
}));

jest.mock("@/lib/integrations/sentry", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { GET } from "@/app/api/auth/status/route";

describe("/api/auth/status region-safe token check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsChinaRegion = true;
    mockExtractTokenFromRequest.mockReturnValue({
      token: null,
      error: "Missing authentication token",
      source: "none",
    });
    mockVerifyAuthToken.mockResolvedValue({
      success: false,
      error: "Invalid token",
    });
  });

  test("returns hasSession=false when no token", async () => {
    const response = await GET(new NextRequest("http://localhost/api/auth/status"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.hasSession).toBe(false);
    expect(payload.region).toBe("CN");
    expect(mockVerifyAuthToken).not.toHaveBeenCalled();
  });

  test("returns hasSession=true for valid token in INTL", async () => {
    mockIsChinaRegion = false;
    mockExtractTokenFromRequest.mockReturnValue({
      token: "intl-token",
      error: null,
      source: "cookie",
    });
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      userId: "intl-user-1",
      user: { email: "intl@example.com" },
    });

    const response = await GET(new NextRequest("http://localhost/api/auth/status"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.hasSession).toBe(true);
    expect(payload.userId).toBe("intl-user-1");
    expect(payload.region).toBe("INTL");
    expect(mockVerifyAuthToken).toHaveBeenCalledWith("intl-token");
  });

  test("returns hasSession=false when token invalid", async () => {
    mockExtractTokenFromRequest.mockReturnValue({
      token: "bad-token",
      error: null,
      source: "authorization",
    });
    mockVerifyAuthToken.mockResolvedValue({
      success: false,
      error: "Invalid or expired token",
    });

    const response = await GET(new NextRequest("http://localhost/api/auth/status"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.hasSession).toBe(false);
    expect(payload.isExpired).toBe(true);
    expect(payload.tokenSource).toBe("authorization");
  });
});
