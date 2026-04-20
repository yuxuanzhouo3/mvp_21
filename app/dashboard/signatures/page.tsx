"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileSignature,
  Loader2,
  Plus,
  Send,
  TimerReset,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listContractsForCurrentUser, type ContractListItem } from "@/lib/contracts/client";
import { useTranslations } from "@/lib/i18n";

function formatDateTime(value: string | undefined, isEn: boolean) {
  if (!value) {
    return isEn ? "Not yet" : "暂无";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(isEn ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function SignaturesPage() {
  const { language } = useLanguage();
  const { user, loading: userLoading } = useUser();
  const isEn = language === "en";
  const t = useTranslations(language);
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const labels = t.platform?.consoleModules || {
    overview: isEn ? "Overview" : "概览",
    signatures: isEn ? "Signatures" : "签署/待办",
  };

  const content = t.pages?.signatures || {
    title: isEn ? "Signatures & Tasks" : "签署 / 待办",
    description: isEn
      ? "Track contracts that are waiting to launch, waiting for counterparties, or already completed."
      : "集中查看待发起、待对方签署以及已完成的合同签署任务。",
    primaryAction: isEn ? "New Signature Request" : "发起签署",
    emptyTitle: isEn ? "No signature tasks yet" : "暂无签署任务",
    emptyDescription: isEn
      ? "Once contracts enter the signing workflow, real tasks will appear here."
      : "当合同进入签署流程后，这里会显示真实待办和进度。",
    createContract: isEn ? "Create Contract" : "创建合同",
    sendForSign: isEn ? "Ready to launch" : "待发起签署",
    autoReminders: isEn ? "Counterparty pending" : "待对方确认",
    completionStatus: isEn ? "Completion rate" : "完成率",
  };

  useEffect(() => {
    let cancelled = false;

    if (userLoading) {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    if (!user) {
      setContracts([]);
      setError("");
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function loadContracts() {
      try {
        setLoading(true);
        setError("");
        const result = await listContractsForCurrentUser();
        if (!cancelled) {
          setContracts(result);
        }
      } catch (loadError) {
        console.error("[SignaturesPage] Failed to load signature tasks:", loadError);
        if (!cancelled) {
          setError(isEn ? "Failed to load signature tasks." : "加载签署任务失败。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadContracts();

    return () => {
      cancelled = true;
    };
  }, [isEn, user, userLoading]);

  const signatureContracts = useMemo(() => {
    return [...contracts]
      .filter((contract) => {
        return (
          contract.signFlowStatus === "awaiting_sender" ||
          contract.signFlowStatus === "awaiting_counterparty" ||
          contract.signFlowStatus === "completed"
        );
      })
      .sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
        const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
        return rightTime - leftTime;
      });
  }, [contracts]);

  const stats = useMemo(() => {
    const awaitingSender = signatureContracts.filter(
      (contract) => contract.signFlowStatus === "awaiting_sender",
    ).length;
    const awaitingCounterparty = signatureContracts.filter(
      (contract) => contract.signFlowStatus === "awaiting_counterparty",
    ).length;
    const completed = signatureContracts.filter(
      (contract) => contract.signFlowStatus === "completed",
    ).length;
    const started = awaitingSender + awaitingCounterparty + completed;

    return {
      awaitingSender,
      awaitingCounterparty,
      reminderCount: signatureContracts.reduce(
        (sum, contract) => sum + (contract.reminderCount || 0),
        0,
      ),
      completionRate: started > 0 ? Math.round((completed / started) * 100) : 0,
    };
  }, [signatureContracts]);

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
          <p className="mt-1 text-2xl font-semibold">{stats.awaitingSender}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Send className="h-3.5 w-3.5" />
            {isEn ? "Waiting for sender confirmation" : "等待发起方确认"}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{content.autoReminders}</p>
          <p className="mt-1 text-2xl font-semibold">{stats.awaitingCounterparty}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <TimerReset className="h-3.5 w-3.5" />
            {isEn
              ? `${stats.reminderCount} reminders sent`
              : `已发送 ${stats.reminderCount} 次提醒`}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{content.completionStatus}</p>
          <p className="mt-1 text-2xl font-semibold">{stats.completionRate}%</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isEn ? "Based on launched signing flows" : "按已发起签署流程统计"}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <CardHeader className="px-0 pt-0">
          <CardTitle>{isEn ? "Active Signature Tasks" : "签署任务列表"}</CardTitle>
          <CardDescription>
            {isEn
              ? "These rows are derived from real contract signing metadata."
              : "下列任务来自真实合同记录中的签署流程元数据。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isEn ? "Loading signature tasks..." : "正在加载签署任务..."}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
              {error}
            </div>
          ) : signatureContracts.length === 0 ? (
            <div className="rounded-lg border border-border/70 bg-muted/10 px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileSignature className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-base font-medium">{content.emptyTitle}</p>
              <p className="mt-2 text-sm text-muted-foreground">{content.emptyDescription}</p>
              <Button asChild className="mt-4">
                <Link href="/dashboard/contracts/new">{content.createContract}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {signatureContracts.map((contract) => {
                const isCompleted = contract.signFlowStatus === "completed";
                const statusLabel = isCompleted
                  ? isEn
                    ? "Completed"
                    : "已完成"
                  : contract.signFlowStatus === "awaiting_counterparty"
                    ? isEn
                      ? "Awaiting counterparty"
                      : "待对方确认"
                    : isEn
                      ? "Awaiting sender"
                      : "待发起方确认";

                return (
                  <div
                    key={contract.id}
                    className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/10 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{contract.title}</p>
                        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                          {statusLabel}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {isEn ? "Updated" : "最近更新"}: {formatDateTime(contract.updatedAt || contract.createdAt, isEn)}
                        </span>
                        <span>
                          {isEn ? "Contract status" : "合同状态"}: {contract.status}
                        </span>
                        <span>
                          {isEn ? "Reminders" : "提醒次数"}: {contract.reminderCount || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" asChild>
                        <Link href={`/contracts/${contract.id}`}>
                          {isEn ? "View Contract" : "查看合同"}
                        </Link>
                      </Button>
                      <Button asChild>
                        <Link href={`/dashboard/contracts/${contract.id}/sign`}>
                          {isCompleted
                            ? isEn
                              ? "Open Signing Record"
                              : "查看签署记录"
                            : isEn
                              ? "Open Sign Flow"
                              : "进入签署流程"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </div>
    </ConsoleShell>
  );
}
