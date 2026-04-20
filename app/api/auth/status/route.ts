import { NextResponse, NextRequest } from "next/server";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isChinaRegion } from "@/lib/config/region";
import { authRateLimit } from "@/lib/security/rate-limit";
import { captureException } from "@/lib/integrations/sentry";

export async function GET(req: NextRequest) {
  return new Promise<NextResponse>((resolve) => {
    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => resolve(NextResponse.json(data, { status: code })),
      }),
      setHeader: () => {},
      getHeader: () => undefined,
    };

    authRateLimit(req as any, mockRes as any, async () => {
      resolve(await handleAuthStatus(req));
    });
  });
}

async function handleAuthStatus(req: NextRequest) {
  try {
    const { token, error: tokenError, source } = extractTokenFromRequest(req);

    if (tokenError || !token) {
      return NextResponse.json({
        hasSession: false,
        isExpired: false,
        userId: null,
        email: null,
        expiresAt: null,
        sessionData: null,
        region: isChinaRegion() ? "CN" : "INTL",
        tokenSource: source,
        timestamp: new Date().toISOString(),
      });
    }

    const authResult = await verifyAuthToken(token);

    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({
        error: authResult.error || "Invalid or expired token",
        hasSession: false,
        isExpired: true,
        userId: null,
        email: null,
        expiresAt: null,
        sessionData: null,
        region: isChinaRegion() ? "CN" : "INTL",
        tokenSource: source,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      hasSession: true,
      isExpired: false,
      userId: authResult.userId,
      email: authResult.user?.email || null,
      expiresAt: null,
      sessionData: {
        access_token: "present",
      },
      region: isChinaRegion() ? "CN" : "INTL",
      tokenSource: source,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    captureException(err);
    return NextResponse.json(
      {
        error: "Failed to check auth status",
        details: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
