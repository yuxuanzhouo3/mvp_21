"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { adminLogin, adminLogout as authLogout } from "@/lib/admin/auth";
import {
  clearAdminSessionCookie,
  requireAdminSession,
} from "@/lib/admin/session";
import { resolveDeploymentRegion } from "@/lib/config/deployment-region";

export interface LoginResult {
  success: boolean;
  error?: string;
}

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
  reLoginRequired?: boolean;
}

export interface CurrentAdmin {
  adminId: string;
  username: string;
  role: "admin" | "super_admin";
}

function isIntlDeployment(): boolean {
  return resolveDeploymentRegion() === "INTL";
}

function tx(zh: string, en: string): string {
  return isIntlDeployment() ? en : zh;
}

function normalizeIntlAuthError(error: string | undefined): string {
  if (!error) {
    return "Sign in failed. Please try again.";
  }

  const lower = error.toLowerCase();
  if (lower.includes("disabled") || lower.includes("inactive") || lower.includes("forbidden")) {
    return "This admin account is disabled. Please contact support.";
  }

  if (lower.includes("password") || lower.includes("username") || lower.includes("credential")) {
    return "Invalid username or password.";
  }

  if (/[\u4e00-\u9fff]/.test(error) || error.includes("锟") || error.includes("�")) {
    return "Invalid username or password.";
  }

  return error;
}

export async function adminLoginAction(formData: FormData): Promise<LoginResult> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return {
      success: false,
      error: tx("请输入用户名和密码", "Please enter username and password."),
    };
  }

  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for") ||
    headersList.get("x-real-ip") ||
    undefined;
  const userAgent = headersList.get("user-agent") || undefined;

  const result = await adminLogin({ username, password }, ipAddress, userAgent);

  if (!result.success && isIntlDeployment()) {
    return {
      success: false,
      error: normalizeIntlAuthError(result.error),
    };
  }

  return result;
}

export async function adminLogoutAction(): Promise<void> {
  const session = await requireAdminSession();
  await authLogout(session.adminId);
  redirect("/admin/login");
}

export async function changePasswordAction(
  formData: FormData,
): Promise<ChangePasswordResult> {
  try {
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return {
        success: false,
        error: tx("请填写所有字段", "Please fill in all fields."),
      };
    }

    if (newPassword !== confirmPassword) {
      return {
        success: false,
        error: tx("两次输入的新密码不一致", "New passwords do not match."),
      };
    }

    const session = await requireAdminSession();
    const { changePassword } = await import("@/lib/admin/auth");
    const result = await changePassword(session.adminId, currentPassword, newPassword);

    if (!result.success) {
      return {
        success: false,
        error: isIntlDeployment()
          ? normalizeIntlAuthError(result.error)
          : result.error || tx("修改密码失败", "Failed to change password."),
      };
    }

    await clearAdminSessionCookie();
    return {
      success: true,
      reLoginRequired: true,
    };
  } catch (error: any) {
    console.error("[changePasswordAction] failed:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    return {
      success: false,
      error: tx("修改密码失败，请稍后重试", "Failed to change password. Please try again later."),
    };
  }
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  try {
    const session = await requireAdminSession();

    return {
      adminId: session.adminId,
      username: session.username,
      role: session.role,
    };
  } catch {
    return null;
  }
}

export async function verifyAdminSession(): Promise<boolean> {
  try {
    await requireAdminSession();
    return true;
  } catch {
    return false;
  }
}
