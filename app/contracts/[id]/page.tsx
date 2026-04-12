"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  applyContractActionForCurrentUser,
  downloadContractForCurrentUser,
  type ContractDetail,
  getContractForCurrentUser,
} from "@/lib/contracts/client";
import {
  getAvailableContractActions,
  normalizeContractEnhancementMeta,
  type ContractWorkflowAction,
} from "@/lib/contracts/enhancements";

function formatDate(value?: string, locale = "zh-CN") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizePartyName(party: Record<string, unknown>) {
  const candidates = [
    party.name,
    party.company,
    party.companyName,
    party.company_name,
    party.position,
    party.role,
  ];
  const hit = candidates.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return hit || "-";
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const isEn = language === "en";
  const flowContext = searchParams.get("ctx") === "dashboard" ? "dashboard" : "standalone";

  const [contractRecord, setContractRecord] = useState<ContractDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState<ContractWorkflowAction | null>(null);
  const [isDownloadingHtml, setIsDownloadingHtml] = useState(false);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const contractId = typeof params?.id === "string" ? params.id : "";
  const backHref = flowContext === "dashboard" ? "/dashboard/contracts" : "/contracts";

  useEffect(() => {
    let cancelled = false;

    async function loadContract() {
      if (!contractId) {
        router.replace(backHref);
        return;
      }

      try {
        setIsLoading(true);
        const result = await getContractForCurrentUser(contractId);
        if (!cancelled) {
          setContractRecord(result);
        }
      } catch (error) {
        console.error("[ContractDetailPage] Failed to load contract:", error);
        if (!cancelled) {
          if (error instanceof Error && error.message === "UNAUTHORIZED") {
            router.replace(`/auth?redirect=${encodeURIComponent(`/contracts/${contractId}`)}`);
            return;
          }

          toast.error(isEn ? "Failed to load contract details." : "加载合同详情失败。");
          router.replace(backHref);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContract();

    return () => {
      cancelled = true;
    };
  }, [backHref, contractId, isEn, router]);

  const enhancement = useMemo(
    () =>
      contractRecord
        ? normalizeContractEnhancementMeta(contractRecord.metadata, contractRecord)
        : null,
    [contractRecord],
  );

  const availableActions = useMemo(
    () => (contractRecord ? getAvailableContractActions(contractRecord) : []),
    [contractRecord],
  );

  const handleAction = async (action: ContractWorkflowAction, note?: string) => {
    if (!contractId || !contractRecord) return;

    const allowedActions = new Set(getAvailableContractActions(contractRecord));
    if (!allowedActions.has(action)) {
      toast.error(
        isEn
          ? "This action is not available in the current signing status."
          : "当前签署状态下不允许执行该动作。",
      );
      return;
    }

    try {
      setIsActing(action);
      const updated = await applyContractActionForCurrentUser(contractId, action, note);
      setContractRecord(updated);
      toast.success(isEn ? "Contract workflow updated." : "合同流程已更新。");
    } catch (error) {
      console.error("[ContractDetailPage] Failed to apply workflow action:", error);
      toast.error(isEn ? "Failed to update workflow." : "更新流程失败。");
    } finally {
      setIsActing(null);
    }
  };

  const handleDownload = async (format: "html" | "word" | "pdf") => {
    if (!contractId) return;

    const setFlag =
      format === "html"
        ? setIsDownloadingHtml
        : format === "word"
          ? setIsDownloadingWord
          : setIsDownloadingPdf;

    try {
      setFlag(true);
      await downloadContractForCurrentUser(contractId, format);
    } catch (error) {
      console.error(`[ContractDetailPage] Failed to export ${format}:`, error);
      toast.error(
        isEn ? `Failed to export ${format.toUpperCase()}.` : `导出 ${format.toUpperCase()} 失败。`,
      );
    } finally {
      setFlag(false);
    }
  };

  if (isLoading || !contractRecord || !enhancement) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const partyNames = contractRecord.parties.map(normalizePartyName);
  const baseTitle = contractRecord.title || (isEn ? "Untitled Contract" : "未命名合同");
  const signPageHref =
    flowContext === "dashboard"
      ? `/dashboard/contracts/${contractRecord.id}/sign`
      : `/dashboard/contracts/${contractRecord.id}/sign`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="container mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" className="px-0" onClick={() => router.push(backHref)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {isEn ? "Back to Contracts" : "返回合同列表"}
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{baseTitle}</h1>
              <Badge variant="secondary">{contractRecord.status}</Badge>
              {contractRecord.region ? <Badge variant="outline">{contractRecord.region}</Badge> : null}
              {enhancement.archivedAt ? (
                <Badge variant="outline">{isEn ? "Archived" : "已归档"}</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {isEn ? "Created" : "创建于"} {formatDate(contractRecord.createdAt || contractRecord.updatedAt, isEn ? "en-US" : "zh-CN")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void handleDownload("pdf")} disabled={isDownloadingPdf}>
              {isDownloadingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isEn ? "Export PDF" : "导出 PDF"}
            </Button>
            <Button variant="outline" onClick={() => void handleDownload("word")} disabled={isDownloadingWord}>
              {isDownloadingWord ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isEn ? "Export Word" : "导出 Word"}
            </Button>
            <Button onClick={() => void handleDownload("html")} disabled={isDownloadingHtml}>
              {isDownloadingHtml ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isEn ? "Download HTML" : "下载 HTML"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Contract Info" : "合同信息"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{isEn ? "Type" : "类型"}</p>
                  <p className="font-medium">{contractRecord.type || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{isEn ? "Parties" : "签约方"}</p>
                  <p className="font-medium">{partyNames.join(" / ") || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{isEn ? "Source Type" : "来源类型"}</p>
                  <p className="font-medium">{contractRecord.sourceType || "-"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {isEn ? "Signing Workflow" : "电子签署流程"}
                </CardTitle>
                <CardDescription>
                  {isEn
                    ? "Only actions valid for the current state are shown below."
                    : "下方仅展示当前状态允许执行的操作。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>{enhancement.signFlow.status}</Badge>
                  {enhancement.signFlow.finalCopy ? (
                    <Badge variant="outline">{isEn ? "Final copy retained" : "电子版已留存"}</Badge>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {enhancement.signFlow.participants.map((participant) => (
                    <div key={participant.role} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">
                          {participant.role === "sender"
                            ? isEn
                              ? "Sender"
                              : "发起方"
                            : isEn
                              ? "Counterparty"
                              : "对方"}
                        </div>
                        <Badge variant={participant.status === "confirmed" ? "secondary" : "outline"}>
                          {participant.status === "confirmed"
                            ? isEn
                              ? "Confirmed"
                              : "已确认"
                            : isEn
                              ? "Pending"
                              : "待确认"}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{participant.name}</div>
                      {participant.confirmedAt ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(participant.confirmedAt, isEn ? "en-US" : "zh-CN")}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {availableActions.includes("start_signing") ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleAction(
                          "start_signing",
                          isEn ? "Signing package launched" : "已发起签署",
                        )
                      }
                      disabled={isActing !== null}
                    >
                      {isActing === "start_signing" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {isEn ? "Launch Signing" : "发起签署"}
                    </Button>
                  ) : null}

                  {availableActions.includes("confirm_sender") ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleAction(
                          "confirm_sender",
                          isEn ? "Sender confirmed" : "发起方已确认",
                        )
                      }
                      disabled={isActing !== null}
                    >
                      {isEn ? "Sender Confirm" : "发起方确认"}
                    </Button>
                  ) : null}

                  {availableActions.includes("confirm_counterparty") ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleAction(
                          "confirm_counterparty",
                          isEn
                            ? "Counterparty confirmed and final copy retained"
                            : "对方已确认，电子版已留存",
                        )
                      }
                      disabled={isActing !== null}
                    >
                      {isEn ? "Counterparty Confirm" : "对方确认"}
                    </Button>
                  ) : null}

                  {availableActions.includes("send_reminder") ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleAction(
                          "send_reminder",
                          isEn ? "Reminder sent to pending signers" : "已向待签署方发送提醒",
                        )
                      }
                      disabled={isActing !== null}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isEn ? "Send Reminder" : "发送提醒"}
                    </Button>
                  ) : null}
                </div>

                <Button variant="outline" className="w-full" onClick={() => router.push(signPageHref)}>
                  <FileText className="mr-2 h-4 w-4" />
                  {isEn ? "Open Unified Sign Page" : "进入统一签署页"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Archive" : "归档"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() =>
                    handleAction(
                      enhancement.archivedAt ? "unarchive" : "archive",
                      enhancement.archivedAt
                        ? isEn
                          ? "Restored to active list"
                          : "已恢复到活跃列表"
                        : isEn
                          ? "Archived from contract center"
                          : "已从合同中心归档",
                    )
                  }
                  disabled={isActing !== null}
                >
                  {enhancement.archivedAt ? (
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                  ) : (
                    <Archive className="mr-2 h-4 w-4" />
                  )}
                  {enhancement.archivedAt
                    ? isEn
                      ? "Restore Contract"
                      : "恢复合同"
                    : isEn
                      ? "Archive Contract"
                      : "归档合同"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Operation Timeline" : "操作时间线"}</CardTitle>
                <CardDescription>
                  {isEn
                    ? "Action logs from archive and signing operations."
                    : "归档与签署流程的操作日志。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {enhancement.operationLogs.length ? (
                  enhancement.operationLogs.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{entry.label}</p>
                        <Badge variant="outline">{entry.action}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.actor} · {formatDate(entry.createdAt, isEn ? "en-US" : "zh-CN")}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    {isEn ? "No operation logs yet." : "暂无操作日志。"}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Evidence Records" : "证据记录"}</CardTitle>
                <CardDescription>
                  {isEn
                    ? "Reminders, confirmations, and retained final copy are listed here."
                    : "提醒、确认和最终电子版留存会展示在这里。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {enhancement.signFlow.evidence.length ? (
                  enhancement.signFlow.evidence.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{item.label}</p>
                        <Badge variant="outline">{item.type}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(item.createdAt, isEn ? "en-US" : "zh-CN")}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    {isEn ? "No evidence records yet." : "暂无证据记录。"}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Source Snapshot" : "来源快照"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-auto rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap text-muted-foreground">
                  {contractRecord.sourceContent ||
                    (isEn ? "No source content stored." : "暂无来源内容。")}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
