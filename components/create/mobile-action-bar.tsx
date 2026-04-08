"use client";

import type { ReactNode } from "react";

import { useMobileKeyboardInset } from "@/hooks/use-mobile-keyboard";
import { cn } from "@/lib/utils";

interface MobileActionBarProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

export function MobileActionBar({
  children,
  className,
  innerClassName,
}: MobileActionBarProps) {
  const keyboardInset = useMobileKeyboardInset();

  return (
    <>
      <div className="h-24 md:hidden" aria-hidden />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur transition-[bottom] duration-200 md:hidden",
          className,
        )}
        style={{ bottom: keyboardInset ? `${keyboardInset}px` : undefined }}
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-6xl flex-wrap items-stretch gap-2 px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] min-[390px]:flex-nowrap min-[390px]:items-center min-[390px]:px-4 min-[430px]:gap-3",
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
