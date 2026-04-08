import { Fragment, type ReactNode } from "react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface ConsoleCrumb {
  label: string;
  href?: string;
}

interface ConsoleShellProps {
  crumbs: ConsoleCrumb[];
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ConsoleShell({
  crumbs,
  title,
  description,
  actions,
  children,
}: ConsoleShellProps) {
  const lastIndex = crumbs.length - 1;

  return (
    <>
      <header className="sticky top-0 z-10 flex min-h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/90 px-3 py-2 backdrop-blur md:h-16 md:px-6 md:py-0">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />
        <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
          <BreadcrumbList className="flex-nowrap overflow-x-auto whitespace-nowrap pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {crumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                <BreadcrumbItem>
                  {index === lastIndex ? (
                    <BreadcrumbPage className="max-w-[12rem] truncate sm:max-w-none">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : crumb.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href} className="max-w-[9rem] truncate sm:max-w-none">
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="max-w-[9rem] truncate sm:max-w-none">
                      {crumb.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < lastIndex ? <BreadcrumbSeparator /> : null}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8">
        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm md:mb-8 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {actions ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end">
              {actions}
            </div>
          ) : null}
        </section>
        {children}
      </main>
    </>
  );
}
