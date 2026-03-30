import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import { isAdminRole, normalizeUserRole, resolveUserRole } from "@/lib/auth/user-role";
import { queueAdminAuditLog } from "@/lib/data/admin-audit-store";
import { logError, logInfo, logSecurityEvent, logWarn } from "@/lib/utils/logger";

export interface AdminAuditContext {
  actorUserId?: string;
  path: string;
  method: string;
  ip: string;
  userAgent?: string | null;
}

export interface AdminRequestContext {
  user: any;
  userId: string;
  role: string;
  auditContext: AdminAuditContext;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [ip] = forwardedFor.split(",");
    if (ip?.trim()) {
      return ip.trim();
    }
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function buildAuditContext(
  request: NextRequest,
  actorUserId?: string,
): AdminAuditContext {
  return {
    actorUserId,
    path: request.nextUrl.pathname,
    method: request.method,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  };
}

function createAdminAuthErrorResponse(status: 401 | 403, message: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  );
}

export function logAdminAudit(
  message: string,
  auditContext: Partial<AdminAuditContext> = {},
  meta?: Record<string, unknown>,
) {
  queueAdminAuditLog({
    actorUserId: auditContext.actorUserId,
    action: message,
    message,
    path: auditContext.path,
    method: auditContext.method,
    ip: auditContext.ip,
    userAgent: auditContext.userAgent,
    status: "success",
    severity: "info",
    meta,
  });

  logInfo(message, {
    area: "admin-api",
    ...auditContext,
    ...meta,
  });
}

export function logAdminApiError(
  message: string,
  error: unknown,
  auditContext: Partial<AdminAuditContext> = {},
  meta?: Record<string, unknown>,
) {
  queueAdminAuditLog({
    actorUserId: auditContext.actorUserId,
    action: message,
    message,
    path: auditContext.path,
    method: auditContext.method,
    ip: auditContext.ip,
    userAgent: auditContext.userAgent,
    status: "error",
    severity: "error",
    meta: {
      ...meta,
      error:
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : String(error),
    },
  });

  if (error instanceof Error) {
    logError(message, error, {
      area: "admin-api",
      ...auditContext,
      ...meta,
    });
    return;
  }

  logWarn(message, {
    area: "admin-api",
    error: String(error),
    ...auditContext,
    ...meta,
  });
}

export async function requireAdmin(
  request: NextRequest,
): Promise<AdminRequestContext | { error: NextResponse }> {
  const initialAuditContext = buildAuditContext(request);
  const authHeader = request.headers.get("authorization");
  const { token, error: tokenError } = extractTokenFromHeader(authHeader);

  if (tokenError || !token) {
    queueAdminAuditLog({
      action: "admin_api_missing_token",
      message: "Admin API denied: missing token",
      path: initialAuditContext.path,
      method: initialAuditContext.method,
      ip: initialAuditContext.ip,
      userAgent: initialAuditContext.userAgent,
      status: "denied",
      severity: "warn",
      meta: {
        reason: tokenError || "Missing admin token",
      },
    });

    logSecurityEvent("admin_api_missing_token", undefined, initialAuditContext.ip, {
      ...initialAuditContext,
      reason: tokenError || "Missing admin token",
    });

    return {
      error: createAdminAuthErrorResponse(401, "Admin authentication required"),
    };
  }

  const authResult = await verifyAuthToken(token);
  if (!authResult.success || !authResult.userId || !authResult.user) {
    queueAdminAuditLog({
      action: "admin_api_invalid_token",
      message: "Admin API denied: invalid token",
      path: initialAuditContext.path,
      method: initialAuditContext.method,
      ip: initialAuditContext.ip,
      userAgent: initialAuditContext.userAgent,
      status: "denied",
      severity: "warn",
      meta: {
        reason: authResult.error || "Invalid token",
      },
    });

    logSecurityEvent("admin_api_invalid_token", undefined, initialAuditContext.ip, {
      ...initialAuditContext,
      reason: authResult.error || "Invalid token",
    });

    return {
      error: createAdminAuthErrorResponse(401, "Invalid admin token"),
    };
  }

  const role = normalizeUserRole(resolveUserRole(authResult.user));
  const auditContext = buildAuditContext(request, authResult.userId);

  if (!isAdminRole(role)) {
    queueAdminAuditLog({
      actorUserId: authResult.userId,
      action: "admin_api_forbidden",
      message: "Admin API denied: forbidden role",
      path: auditContext.path,
      method: auditContext.method,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      status: "denied",
      severity: "warn",
      meta: {
        role,
      },
    });

    logSecurityEvent("admin_api_forbidden", authResult.userId, auditContext.ip, {
      ...auditContext,
      role,
    });

    return {
      error: createAdminAuthErrorResponse(403, "Administrator access required"),
    };
  }

  logAdminAudit("Admin API access granted", auditContext, { role });

  return {
    user: authResult.user,
    userId: authResult.userId,
    role,
    auditContext,
  };
}
