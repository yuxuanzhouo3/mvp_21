"use client";

import Link from "next/link";
import { CheckCircle2, FileSignature, Plus, Send, TimerReset } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useTranslations } from "@/lib/i18n";

export default function SignaturesPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    signatures: language === "en" ? "Signatures" : "签署/待办",
  };

  const content = t.pages?.signatures || {
    title: language === "en" ? "Signatures & Tasks" : "签署/待办",
    description:
      language === "en"
        ? "Track contracts waiting for signature, reminders, and completion status."
        : "跟踪待签署合同、催签提醒和完成状态。",
    primaryAction: language === "en" ? "New Signature Request" : "发起签署",
    emptyTitle: language === "en" ? "No pending signatures" : "暂无待签署事项",
    emptyDescription:
      language === "en"
        ? "Once you send contracts for signing, tasks will appear here."
        : "当你发送合同签署后，待办会出现在这里。",
    createContract: language === "en" ? "Create Contract" : "创建合同",
    sendForSign: language === "en" ? "Send for Signature" : "发送签署",
    autoReminders: language === "en" ? "Auto reminders enabled" : "已启用自动催签",
    completionStatus: language === "en" ? "Real-time completion status" : "实时签署进度",
    noActiveRequest: language === "en" ? "No active request" : "暂无进行中的请求",
    reminderEvery24h: language === "en" ? "Reminder every 24h" : "每 24 小时提醒一次",
    waitingFirstRequest: language === "en" ? "Waiting for first request" : "等待首个签署任务",
    remindersOn: language === "en" ? "On" : "已开启",
  };

  return (
    <ConsoleShell
      crumbs={[
        { label: labels.overview, href: "/dashboard" },
        { label: labels.signatures },
      ]}
      title={content.title}
      description={content.description}
      actions={
        <Button size="sm" asChild>
          <Link href="/dashboard/contracts/new">
            <Plus className="mr-2 h-4 w-4" />
            {content.primaryAction}
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{content.sendForSign}</p>
          <p className="mt-1 text-2xl font-semibold">0</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Send className="h-3.5 w-3.5" />
            {content.noActiveRequest}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{content.autoReminders}</p>
          <p className="mt-1 text-2xl font-semibold">{content.remindersOn}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <TimerReset className="h-3.5 w-3.5" />
            {content.reminderEvery24h}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{content.completionStatus}</p>
          <p className="mt-1 text-2xl font-semibold">0%</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {content.waitingFirstRequest}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <Empty className="border-border/70 bg-muted/10">
          <EmptyMedia variant="icon">
            <FileSignature />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{content.emptyTitle}</EmptyTitle>
            <EmptyDescription>{content.emptyDescription}</EmptyDescription>
          </EmptyHeader>
          <Button asChild>
            <Link href="/dashboard/contracts/new">{content.createContract}</Link>
          </Button>
        </Empty>
      </div>
    </ConsoleShell>
  );
}
