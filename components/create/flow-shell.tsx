import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronLeft, FileText } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getAppDisplayName } from "@/lib/config/deployment.config";
import { cn } from "@/lib/utils";

const CREATE_FLOW_STEPS = {
  zh: [
    { id: 1, title: "选择导入方式", subtitle: "确定来源" },
    { id: 2, title: "导入对话内容", subtitle: "准备材料" },
    { id: 3, title: "确认 AI 分析", subtitle: "校对信息" },
    { id: 4, title: "编辑并导出合同", subtitle: "生成结果" },
  ],
  en: [
    { id: 1, title: "Choose Import Method", subtitle: "Select channel" },
    { id: 2, title: "Import Conversation", subtitle: "Prepare content" },
    { id: 3, title: "Confirm AI Analysis", subtitle: "Review fields" },
    { id: 4, title: "Edit & Export Contract", subtitle: "Generate result" },
  ],
} as const;

interface CreateFlowShellProps {
  step: number;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  actions?: ReactNode;
  showSidebarTrigger?: boolean;
  children: ReactNode;
}

function StepCircle({
  stepId,
  currentStep,
}: {
  stepId: number;
  currentStep: number;
}) {
  if (stepId < currentStep) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-4 w-4" />
      </span>
    );
  }

  if (stepId === currentStep) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-sm font-semibold text-primary">
        {stepId}
      </span>
    );
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-sm font-medium text-muted-foreground">
      {stepId}
    </span>
  );
}

export function CreateFlowShell({
  step,
  title,
  description,
  backHref,
  backLabel,
  actions,
  showSidebarTrigger = false,
  children,
}: CreateFlowShellProps) {
  const { language } = useLanguage();
  const locale = language === "en" ? "en" : "zh";
  const steps = CREATE_FLOW_STEPS[locale];
  const appName = getAppDisplayName();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,hsl(var(--primary)/0.08),transparent_40%),radial-gradient(circle_at_100%_0%,hsl(var(--accent)/0.1),transparent_35%)]">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-2.5 min-[390px]:px-3 min-[430px]:px-4 sm:h-16">
          <div className="flex items-center gap-2">
            {showSidebarTrigger ? <SidebarTrigger className="size-8" /> : null}
            <Link
              href="/"
              className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80"
            >
              <FileText className="h-5 w-5 text-primary" />
              <span className="max-w-[10rem] truncate text-sm font-semibold min-[430px]:max-w-none min-[430px]:text-base">
                {appName}
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="ghost" size="sm" className="px-2 sm:px-3" asChild>
              <Link href={backHref}>
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="sr-only sm:hidden">{backLabel}</span>
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            </Button>
            {actions}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2.5 py-5 min-[390px]:px-3 min-[390px]:py-6 min-[430px]:px-4 sm:py-8 md:py-10">
        <section className="mb-5 rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm min-[390px]:mb-6 min-[390px]:p-4 min-[430px]:p-5 md:p-6">
          <ol className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-4">
            {steps.map((item, index) => {
              const isActive = item.id === step;
              const isCompleted = item.id < step;

              return (
                <li key={item.id} className="relative flex items-start gap-3">
                  <StepCircle stepId={item.id} currentStep={step} />
                  <div className="min-w-0 pt-0.5">
                    <p
                      className={cn(
                        "text-sm font-medium leading-snug break-words",
                        isActive || isCompleted
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground min-[390px]:text-xs">
                      {item.subtitle}
                    </p>
                  </div>
                  {index < steps.length - 1 ? (
                    <span className="pointer-events-none absolute -right-2 top-4 hidden h-px w-4 bg-border lg:block" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mb-5 min-[390px]:mb-6">
          <h1 className="text-xl font-semibold tracking-tight min-[390px]:text-2xl md:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-xs text-muted-foreground min-[390px]:text-sm md:text-base">
            {description}
          </p>
        </section>

        {children}
      </main>
    </div>
  );
}
