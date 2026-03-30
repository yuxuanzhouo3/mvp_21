export const DEFAULT_USER_ROLE = "user";
const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export function normalizeUserRole(role?: string | null): string {
  if (!role) {
    return DEFAULT_USER_ROLE;
  }

  return role.trim().toLowerCase() || DEFAULT_USER_ROLE;
}

export function resolveUserRole(user: unknown): string {
  if (!user || typeof user !== "object") {
    return DEFAULT_USER_ROLE;
  }

  const candidate = user as {
    role?: string | null;
    user_metadata?: { role?: string | null } | null;
    app_metadata?: { role?: string | null } | null;
  };

  return normalizeUserRole(
    candidate.role ||
      candidate.user_metadata?.role ||
      candidate.app_metadata?.role,
  );
}

export function isAdminRole(role?: string | null): boolean {
  return ADMIN_ROLES.has(normalizeUserRole(role));
}

