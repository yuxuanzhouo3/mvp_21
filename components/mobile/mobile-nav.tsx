"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, FileText, Home, Plus, User } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  {
    icon: Home,
    label: "Home",
    href: "/mobile",
    matches: ["/mobile"],
    isAction: false,
  },
  {
    icon: FileText,
    label: "Contracts",
    href: "/mobile/contracts",
    matches: ["/mobile/contracts", "/mobile/sign"],
    isAction: false,
  },
  {
    icon: Plus,
    label: "New",
    href: "/create?ctx=mobile",
    matches: ["/create"],
    isAction: true,
  },
  {
    icon: CreditCard,
    label: "Billing",
    href: "/payment",
    matches: ["/payment", "/dashboard/billing"],
    isAction: false,
  },
  {
    icon: User,
    label: "Profile",
    href: "/profile",
    matches: ["/profile", "/settings"],
    isAction: false,
  },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.matches.some((match) =>
            match === "/mobile" ? pathname === match : pathname.startsWith(match),
          );

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-8"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
