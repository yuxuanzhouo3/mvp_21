import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

let mockIsChinaRegion = true;
const mockLoginUser: any = jest.fn();
const mockLoadChinaAccountProfile: any = jest.fn();
const mockLoadIntlAccountProfile: any = jest.fn();
const mockLogSecurityEvent: any = jest.fn();
const mockAccountLockout: any = {
  isLocked: jest.fn(),
  recordFailedAttempt: jest.fn(),
  recordSuccessfulLogin: jest.fn(),
};

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => mockIsChinaRegion,
}));

jest.mock("@/lib/cloudbase/cloudbase-service", () => ({
  loginUser: (...args: unknown[]) => mockLoginUser(...args),
}));

jest.mock("@/lib/account/server-profile", () => ({
  loadChinaAccountProfile: (...args: unknown[]) => mockLoadChinaAccountProfile(...args),
  loadIntlAccountProfile: (...args: unknown[]) => mockLoadIntlAccountProfile(...args),
}));

jest.mock("@/lib/security/account-lockout", () => ({
  accountLockout: mockAccountLockout,
}));

jest.mock("@/lib/utils/logger", () => ({
  logSecurityEvent: (...args: unknown[]) => mockLogSecurityEvent(...args),
}));

import { POST } from "@/app/api/auth/login/route";

describe("auth login multi-identifier (CN)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsChinaRegion = true;
    mockAccountLockout.isLocked.mockReturnValue({ locked: false });
    mockLoginUser.mockResolvedValue({
      success: true,
      userId: "user-1",
      email: "alice@example.com",
      name: "Alice",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenMeta: {
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 604800,
      },
    });
    mockLoadChinaAccountProfile.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
    });
  });

  test("supports email + password login", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "Alice@Example.com",
          password: "password123",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockLoginUser).toHaveBeenCalledWith(
      "alice@example.com",
      "password123",
      expect.any(Object),
    );
    expect(response.headers.get("set-cookie")).toContain("auth-token=access-token");
  });

  test("supports phone + password login", async () => {
    mockLoginUser.mockResolvedValueOnce({
      success: true,
      userId: "user-phone-1",
      email: "phone_13800138000@local.phone",
      phone: "13800138000",
      name: "User8000",
      accessToken: "phone-access-token",
      refreshToken: "phone-refresh-token",
      tokenMeta: {
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 604800,
      },
    });
    mockLoadChinaAccountProfile.mockResolvedValueOnce({
      id: "user-phone-1",
      email: "phone_13800138000@local.phone",
      phone: "13800138000",
      name: "User8000",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          phone: "13800138000",
          password: "password123",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockLoginUser).toHaveBeenCalledWith(
      "13800138000",
      "password123",
      expect.any(Object),
    );
    expect(payload.user.phone).toBe("13800138000");
  });

  test("rejects invalid identifier format", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: "not-an-email-or-phone",
          password: "password123",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  test("rejects phone password login outside CN deployment", async () => {
    mockIsChinaRegion = false;

    const response = await POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          phone: "13800138000",
          password: "password123",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Phone number login");
    expect(mockLoginUser).not.toHaveBeenCalled();
  });
});
