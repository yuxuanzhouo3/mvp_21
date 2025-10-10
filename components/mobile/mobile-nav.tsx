"use client"

import { useState } from "react"
import Link from "next/link"
import { Home, FileText, Plus, Bell, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: Home, label: "Home", href: "/mobile" },
  { icon: FileText, label: "Contracts", href: "/mobile/contracts" },
  { icon: Plus, label: "New", href: "/mobile/new", isAction: true },
  { icon: Bell, label: "Alerts", href: "/mobile/alerts" },
  { icon: User, label: "Profile", href: "/mobile/profile" },
]

export function MobileNav() {
  const [active, setActive] = useState("/mobile")

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = active === item.href

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-8"
                onClick={() => setActive(item.href)}
              >
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
              onClick={() => setActive(item.href)}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
