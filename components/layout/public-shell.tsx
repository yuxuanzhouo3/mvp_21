import type { ReactNode } from "react";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PublicShellProps {
  badge?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  heroClassName?: string;
}

export function PublicShell({
  badge,
  title,
  description,
  children,
  className,
  heroClassName,
}: PublicShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_35%)]">
      <Header />
      <main className={cn("pb-16 md:pb-20", className)}>
        {(title || description || badge) && (
          <section
            className={cn(
              "mx-auto w-full max-w-7xl px-4 pb-6 pt-12 md:pt-16 lg:pt-20",
              heroClassName,
            )}
          >
            <div className="max-w-4xl space-y-3">
              {badge ? <Badge variant="outline">{badge}</Badge> : null}
              {title ? (
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
                  {title}
                </h1>
              ) : null}
              {description ? (
                <p className="text-sm text-muted-foreground md:text-base lg:text-lg">
                  {description}
                </p>
              ) : null}
            </div>
          </section>
        )}
        {children}
      </main>
      <Footer />
    </div>
  );
}
