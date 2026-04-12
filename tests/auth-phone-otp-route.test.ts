import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

let mockIsChinaRegion = true;
const mockVerifyVerificationCode: any = jest.fn();
const mockLoginOrCreatePhoneUser: any = jest.fn();
const mockLoadChinaAccountProfile: any = jest.fn();

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => mockIsChinaRegion,
}));

jest.mock("@/lib/auth/verification-code-store", () => ({
  verifyVerificationCode: (...args: unknown[]) => mockVerifyVerificationCode(...args),
}));

jest.mock("@/lib/cloudbase/cloudbase-service", () => ({
  loginOrCreatePhoneUser: (...args: unknown[]) => mockLoginOrCreatePhoneUser(...args),
}));

jest.mock("@/lib/account/server-profile", () => ({
  loadChinaAccountProfile: (...args: unknown[]) => mockLoadChinaAccountProfile(...args),
}));

import { POST } from "@/app/api/auth/phone/route";

describe("auth phone otp route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsChinaRegion = true;
    mockVerifyVerificationCode.mockReturnValue(true);
    mockLoginOrCreatePhoneUser.mockResolvedValue({
      success: true,
      userId: "user-phone-otp-1",
      email: "phone_13800138000@local.phone",
      name: "User8000",
      accessToken: "otp-access-token",
      refreshToken: "otp-refresh-token",
      tokenMeta: {
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 604800,
      },
    });
    mockLoadChinaAccountProfile.mockResolvedValue(null);
  });

  test("logs in or auto-creates user with phone + otp", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/phone", {
        method: "POST",
        body: JSON.stringify({
          phone: "13800138000",
          code: "123456",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockLoginOrCreatePhoneUser).toHaveBeenCalledWith(
      "13800138000",
      expect.any(Object),
    );
    expect(payload.success).toBe(true);
    expect(payload.user.phone).toBe("13800138000");
    expect(response.headers.get("set-cookie")).toContain("auth-token=otp-access-token");
  });

  test("rejects invalid otp", async () => {
    mockVerifyVerificationCode.mockReturnValue(false);

    const response = await POST(
      new NextRequest("http://localhost/api/auth/phone", {
        method: "POST",
        body: JSON.stringify({
          phone: "13800138000",
          code: "000000",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockLoginOrCreatePhoneUser).not.toHaveBeenCalled();
  });
});
