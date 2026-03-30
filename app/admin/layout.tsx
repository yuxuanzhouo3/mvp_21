import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/layout/admin-shell";
import { isAdminRole, normalizeUserRole } from "@/lib/auth/user-role";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const loggedIn = cookieStore.get("auth-logged-in")?.value;
  const role = normalizeUserRole(cookieStore.get("auth-role")?.value);

  if (!loggedIn) {
    redirect("/auth?mode=signin&redirect=/admin");
  }

  if (cookieStore.get("auth-role")?.value && !isAdminRole(role)) {
    redirect("/dashboard");
  }

  return <AdminShell>{children}</AdminShell>;
}
