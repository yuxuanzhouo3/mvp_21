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
  const rawRole = cookieStore.get("auth-role")?.value;
  const role = normalizeUserRole(rawRole);

  if (!loggedIn) {
    redirect("/auth?mode=signin&redirect=/admin");
  }

  // Fail closed: admin pages should only render for explicit admin roles.
  if (!isAdminRole(role)) {
    redirect("/dashboard");
  }

  return <AdminShell>{children}</AdminShell>;
}
