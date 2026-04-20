import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

let mockIsChinaRegion = true;
const mockLoginUser: any = jest.fn();
const mockSignupUser: any = jest.fn();
const mockSignInWithPassword: any = jest.fn();
const mockSignUpWithPassword: any = jest.fn();

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => mockIsChinaRegion,
}));

jest.mock("@/lib/config/supabase-runtime", () => ({
  assertSupabaseRuntimeEnv: () => ({
    url: "https://example.supabase.co",
    anonKey: "anon-key",
    serviceRoleKey: "",
    strictMode: false,
  }),
}));

jest.mock("@/lib/cloudbase/cloudbase-service", () => ({
  loginUser: (...args: unknown[]) => mockLoginUser(...args),
  signupUser: (...args: unknown[]) => mockSignupUser(...args),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUpWithPassword(...args),
    },
  }),
}));

import { POST } from "@/app/api/auth/route";

describe("legacy /api/auth route region split", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsChinaRegion = true;
    mockLoginUser.mockResolvedValue({
      success: true,
      userId: "cn-user-1",
      email: "cn@example.com",
      phone: "13800138000",
      name: "CN User",
      accessToken: "cn-access-token",
      refreshToken: "cn-refresh-token",
      tokenMeta: { accessTokenExpiresIn: 3600, refreshTokenExpiresIn: 604800 },
    });
    mockSignupUser.mockResolvedValue({
      success: true,
      userId: "cn-user-2",
      accessToken: "cn-signup-access-token",
      refreshToken: "cn-signup-refresh-token",
      tokenMeta: { accessTokenExpiresIn: 3600, refreshTokenExpiresIn: 604800 },
    });
    mockSignInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: "intl-access-token",
          refresh_token: "intl-refresh-token",
          expires_in: 3600,
        },
        user: {
          id: "intl-user-1",
          email: "intl@example.com",
          user_metadata: { full_name: "Intl User" },
        },
      },
      error: null,
    });
    mockSignUpWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: "intl-signup-access-token",
          refresh_token: "intl-signup-refresh-token",
          expires_in: 3600,
        },
        user: {
          id: "intl-user-2",
          email: "new@example.com",
          user_metadata: { full_name: "New Intl User" },
        },
      },
      error: null,
    });
  });

  test("CN login uses CloudBase only", async () => {
    mockIsChinaRegion = true;

    const response = await POST(
      new NextRequest("http://localhost/api/auth", {
        method: "POST",
        body: JSON.stringify({
          action: "login",
          email: "cn@example.com",
          password: "password123",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockLoginUser).toHaveBeenCalledTimes(1);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  test("INTL login uses Supabase only", async () => {
    mockIsChinaRegion = false;

    const response = await POST(
      new NextRequest("http://localhost/api/auth", {
        method: "POST",
        body: JSON.stringify({
          action: "login",
          email: "intl@example.com",
          password: "password123",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.user.id).toBe("intl-user-1");
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  test("INTL signup uses Supabase only", async () => {
    mockIsChinaRegion = false;

    const response = await POST(
      new NextRequest("http://localhost/api/auth", {
        method: "POST",
        body: JSON.stringify({
          action: "signup",
          email: "new@example.com",
          password: "password123",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.user.id).toBe("intl-user-2");
    expect(mockSignUpWithPassword).toHaveBeenCalledTimes(1);
    expect(mockSignupUser).not.toHaveBeenCalled();
  });
});
