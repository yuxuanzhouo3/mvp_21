import type { ReactNode } from "react";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { cn } from "@/lib/utils";

interface PublicEntryShellProps {
  children: ReactNode;
  className?: string;
}

export function PublicEntryShell({ children, className }: PublicEntryShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_35%)]">
      <Header />
      <main className={cn("pb-16 md:pb-20", className)}>{children}</main>
      <Footer />
    </div>
  );
}
