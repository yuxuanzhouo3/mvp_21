import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const mockVerifyMarketAdminLogin: any = jest.fn();
const mockCreateMarketAdminSessionToken: any = jest.fn();
const mockAttachMarketAdminSessionCookie: any = jest.fn();
const mockResolveDeploymentRegion: any = jest.fn();
const mockAssertSupabaseRuntimeEnv: any = jest.fn();
const mockSignInWithPassword: any = jest.fn();
const mockCreateClient: any = jest.fn();

jest.mock("@/lib/market/admin-auth", () => ({
  verifyMarketAdminLogin: (...args: unknown[]) => mockVerifyMarketAdminLogin(...args),
  createMarketAdminSessionToken: (...args: unknown[]) => mockCreateMarketAdminSessionToken(...args),
  attachMarketAdminSessionCookie: (...args: unknown[]) => mockAttachMarketAdminSessionCookie(...args),
}));

jest.mock("@/lib/config/deployment-region", () => ({
  resolveDeploymentRegion: () => mockResolveDeploymentRegion(),
}));

jest.mock("@/lib/config/supabase-runtime", () => ({
  assertSupabaseRuntimeEnv: (...args: unknown[]) => mockAssertSupabaseRuntimeEnv(...args),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { POST } from "@/app/api/market/auth/login/route";

describe("market auth login route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveDeploymentRegion.mockReturnValue("CN");
    mockVerifyMarketAdminLogin.mockReturnValue(false);
    mockCreateMarketAdminSessionToken.mockReturnValue("market-token");
    mockAttachMarketAdminSessionCookie.mockImplementation(() => undefined);
    mockAssertSupabaseRuntimeEnv.mockReturnValue({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
      serviceRoleKey: "",
      strictMode: false,
    });
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });
    mockCreateClient.mockReturnValue({
      auth: {
        signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      },
    });
  });

  test("returns CN chinese validation error when username or password missing", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/market/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "", password: "" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("请输入账号和密码");
  });

  test("returns CN chinese invalid credentials error", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/market/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "alice", password: "bad-pass" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("账号或密码错误");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  test("uses local market admin auth directly when verify passes", async () => {
    mockResolveDeploymentRegion.mockReturnValue("INTL");
    mockVerifyMarketAdminLogin.mockReturnValue(true);

    const response = await POST(
      new NextRequest("http://localhost/api/market/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "zyx!213416" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockCreateMarketAdminSessionToken).toHaveBeenCalledWith("admin");
    expect(mockAttachMarketAdminSessionCookie).toHaveBeenCalledTimes(1);
  });

  test("falls back to supabase email login for INTL when local verification fails", async () => {
    mockResolveDeploymentRegion.mockReturnValue("INTL");
    mockVerifyMarketAdminLogin.mockReturnValue(false);
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: "u1", email: "intl@example.com" },
        session: { access_token: "token" },
      },
      error: null,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/market/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "INTL@EXAMPLE.COM", password: "pass-1" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "intl@example.com",
      password: "pass-1",
    });
    expect(mockCreateMarketAdminSessionToken).toHaveBeenCalledWith("intl@example.com");
    expect(mockAttachMarketAdminSessionCookie).toHaveBeenCalledTimes(1);
  });

  test("returns INTL english invalid credentials when both local and supabase login fail", async () => {
    mockResolveDeploymentRegion.mockReturnValue("INTL");
    mockVerifyMarketAdminLogin.mockReturnValue(false);
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/market/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "intl@example.com", password: "bad-pass" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Invalid credentials");
  });
});

