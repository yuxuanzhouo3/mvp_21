"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCheck,
  Download,
  Eye,
  FileText,
  FileType2,
  History,
  Loader2,
  PencilLine,
  RotateCcw,
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
  exportContractPdfForCurrentUser,
  type ContractDetail,
  getContractForCurrentUser,
} from "@/lib/contracts/client";
import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import {
  buildContractHtml,
  getContractVersionHistory,
  normalizeContractContent,
  type ContractVersionEntry,
} from "@/lib/contracts/format";

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

type WorkflowAction =
  | "archive"
  | "unarchive"
  | "start_signing"
  | "confirm_sender"
  | "confirm_counterparty"
  | "send_reminder";

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const isEn = language === "en";
  const flowContext = searchParams.get("ctx") === "dashboard" ? "dashboard" : "standalone";

  const [contractRecord, setContractRecord] = useState<ContractDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingHtml, setIsDownloadingHtml] = useState(false);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isPrintingPdf, setIsPrintingPdf] = useState(false);
  const [isActing, setIsActing] = useState<WorkflowAction | null>(null);

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

  const contractContent = useMemo(
    () => normalizeContractContent(contractRecord?.content),
    [contractRecord?.content],
  );

  const renderedHtml = useMemo(() => {
    if (!contractContent) return "";
    const editorHtml =
      typeof contractRecord?.metadata?.editorHtml === "string"
        ? contractRecord.metadata.editorHtml
        : null;

    return buildContractHtml(contractContent, {
      language: isEn ? "en" : "zh",
      renderedHtml: editorHtml,
    });
  }, [contractContent, contractRecord?.metadata, isEn]);

  const enhancement = useMemo(
    () =>
      contractRecord
        ? normalizeContractEnhancementMeta(contractRecord.metadata, contractRecord)
        : null,
    [contractRecord],
  );

  const versionHistory = useMemo(() => {
    const versions = getContractVersionHistory(contractRecord?.metadata);
    if (versions.length > 0) {
      return versions;
    }

    if (!contractRecord) {
      return [] as ContractVersionEntry[];
    }

    const baseTitle = contractRecord.title || (isEn ? "Untitled Contract" : "未命名合同");
    const fallback: ContractVersionEntry[] = [
      {
        id: `${contractRecord.id}-created`,
        action: "draft_created",
        label: isEn ? "Draft created" : "草稿创建",
        createdAt: contractRecord.createdAt || contractRecord.updatedAt || new Date().toISOString(),
        title: baseTitle,
        summary: isEn ? "The contract record was created." : "已创建合同草稿记录。",
      },
    ];

    if (
      contractRecord.updatedAt &&
      contractRecord.createdAt &&
      contractRecord.updatedAt !== contractRecord.createdAt
    ) {
      fallback.unshift({
        id: `${contractRecord.id}-updated`,
        action: "draft_saved",
        label: isEn ? "Latest update" : "最近更新",
        createdAt: contractRecord.updatedAt,
        title: baseTitle,
        summary: isEn ? "The contract content was updated later." : "合同内容在后续被更新过。",
      });
    }

    return fallback;
  }, [contractRecord, isEn]);

  const handleDownloadHtml = async () => {
    if (!contractId) return;
    try {
      setIsDownloadingHtml(true);
      await downloadContractForCurrentUser(contractId);
    } catch (error) {
      console.error("[ContractDetailPage] Failed to download HTML:", error);
      toast.error(isEn ? "Failed to download HTML." : "下载 HTML 失败。");
    } finally {
      setIsDownloadingHtml(false);
    }
  };

  const handleDownloadWord = async () => {
    if (!contractId) return;
    try {
      setIsDownloadingWord(true);
      await downloadContractForCurrentUser(contractId, "word");
    } catch (error) {
      console.error("[ContractDetailPage] Failed to export Word:", error);
      toast.error(isEn ? "Failed to export Word." : "导出 Word 失败。");
    } finally {
      setIsDownloadingWord(false);
    }
  };

  const handleExportPdf = async () => {
    if (!contractId) return;
    try {
      setIsPrintingPdf(true);
      await exportContractPdfForCurrentUser(contractId);
    } catch (error) {
      console.error("[ContractDetailPage] Failed to export PDF:", error);
      toast.error(
        error instanceof Error && error.message === "PRINT_WINDOW_BLOCKED"
          ? isEn
            ? "Please allow pop-ups so the print window can open."
            : "请允许弹窗，以便打开 PDF 打印窗口。"
          : isEn
            ? "Failed to export PDF."
            : "导出 PDF 失败。",
      );
    } finally {
      setIsPrintingPdf(false);
    }
  };

  const handleAction = async (action: WorkflowAction, note?: string) => {
    if (!contractId) return;

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

  if (isLoading || !contractRecord) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const partyNames = contractRecord.parties.map(normalizePartyName);
  const baseTitle = contractRecord.title || (isEn ? "Untitled Contract" : "未命名合同");

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
              {enhancement?.archivedAt ? (
                <Badge variant="outline">{isEn ? "Archived" : "已归档"}</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {isEn ? "Created" : "创建于"}{" "}
              {formatDate(contractRecord.createdAt || contractRecord.updatedAt, isEn ? "en-US" : "zh-CN")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  flowContext === "dashboard"
                    ? `/create/analyze?id=${contractRecord.id}&ctx=dashboard`
                    : `/create/analyze?id=${contractRecord.id}`,
                )
              }
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {isEn ? "Re-enter Analysis" : "重新进入分析"}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  flowContext === "dashboard"
                    ? `/create/edit?id=${contractRecord.id}&ctx=dashboard`
                    : `/create/edit?id=${contractRecord.id}`,
                )
              }
            >
              <PencilLine className="mr-2 h-4 w-4" />
              {isEn ? "Edit Draft" : "继续编辑"}
            </Button>
            <Button variant="outline" onClick={handleExportPdf} disabled={isPrintingPdf || !contractContent}>
              {isPrintingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isEn ? "Export PDF" : "导出 PDF"}
            </Button>
            <Button variant="outline" onClick={handleDownloadWord} disabled={isDownloadingWord || !contractContent}>
              {isDownloadingWord ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileType2 className="mr-2 h-4 w-4" />
              )}
              {isEn ? "Export Word" : "导出 Word"}
            </Button>
            <Button onClick={handleDownloadHtml} disabled={isDownloadingHtml || !contractContent}>
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
                    ? "Launch signing, confirm both parties, send reminders, and retain the final electronic copy."
                    : "支持发起签署、双方确认、提醒催办与签署完成后的电子版留存。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>{enhancement?.signFlow.status || "draft"}</Badge>
                  {enhancement?.signFlow.finalCopy ? (
                    <Badge variant="outline">{isEn ? "Final copy retained" : "电子版已留存"}</Badge>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {enhancement?.signFlow.participants.map((participant) => (
                    <div
                      key={participant.role}
                      className="rounded-xl border border-border/70 bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">
                          {participant.role === "sender"
                            ? isEn
                              ? "Sender"
                              : "甲方/发起方"
                            : isEn
                              ? "Counterparty"
                              : "乙方/对方"}
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
                  <Button
                    variant="outline"
                    onClick={() => handleAction("start_signing", isEn ? "Signing package launched" : "已发起签署")}
                    disabled={isActing !== null}
                  >
                    {isActing === "start_signing" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {isEn ? "Launch Signing" : "发起签署"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleAction("confirm_sender", isEn ? "Sender confirmed" : "发起方已确认")}
                    disabled={isActing !== null}
                  >
                    <CheckCheck className="mr-2 h-4 w-4" />
                    {isEn ? "Sender Confirm" : "发起方确认"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleAction(
                        "confirm_counterparty",
                        isEn ? "Counterparty confirmed and final copy retained" : "对方已确认，电子版已留存",
                      )
                    }
                    disabled={isActing !== null}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {isEn ? "Counterparty Confirm" : "对方确认"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleAction("send_reminder", isEn ? "Reminder sent to pending signers" : "已向待签署方发送提醒")}
                    disabled={isActing !== null}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {isEn ? "Send Reminder" : "发送提醒"}
                  </Button>
                </div>

                {enhancement?.signFlow.finalCopy ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <div className="font-medium">
                      {isEn ? "Retained electronic copy" : "留存电子版"}
                    </div>
                    <div className="mt-2">{enhancement.signFlow.finalCopy.filename}</div>
                    <div className="mt-1 text-xs">
                      {formatDate(
                        enhancement.signFlow.finalCopy.createdAt,
                        isEn ? "en-US" : "zh-CN",
                      )}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Contract Actions" : "合同操作"}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    handleAction(
                      enhancement?.archivedAt ? "unarchive" : "archive",
                      enhancement?.archivedAt
                        ? isEn
                          ? "Restored to active list"
                          : "已恢复到活跃列表"
                        : isEn
                          ? "Archived from contract center"
                          : "已归档到合同中心",
                    )
                  }
                  disabled={isActing !== null}
                >
                  {enhancement?.archivedAt ? (
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                  ) : (
                    <Archive className="mr-2 h-4 w-4" />
                  )}
                  {enhancement?.archivedAt
                    ? isEn
                      ? "Restore Contract"
                      : "恢复合同"
                    : isEn
                      ? "Archive Contract"
                      : "归档合同"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Evidence & Audit Trail" : "签署证据与审计痕迹"}</CardTitle>
                <CardDescription>
                  {isEn
                    ? "Every reminder, confirmation, archive action, and retained final copy appears here."
                    : "提醒、确认、归档与电子版留存都会保存在这里，便于后续审计。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {enhancement?.signFlow.evidence.length ? (
                  enhancement.signFlow.evidence.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border/70 bg-muted/20 p-3"
                    >
                      <div className="font-medium">{item.label}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {formatDate(item.createdAt, isEn ? "en-US" : "zh-CN")}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    {isEn ? "No evidence records yet." : "暂时还没有签署证据记录。"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  {isEn ? "Operation Timeline" : "操作时间线"}
                </CardTitle>
                <CardDescription>
                  {isEn
                    ? "Version milestones plus explicit operation logs for archive and signing actions."
                    : "除版本节点外，也展示归档和电子签署流程的操作日志。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(enhancement?.operationLogs.length
                  ? enhancement.operationLogs
                  : versionHistory
                ).map((entry: any, index) => (
                  <div key={entry.id || `${entry.label}-${index}`} className="relative pl-6">
                    {index < (enhancement?.operationLogs.length || versionHistory.length) - 1 ? (
                      <span className="absolute left-[7px] top-6 h-[calc(100%+12px)] w-px bg-border" />
                    ) : null}
                    <span className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-primary bg-background" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.createdAt, isEn ? "en-US" : "zh-CN")}
                      </p>
                      {"actor" in entry ? (
                        <p className="text-xs text-muted-foreground">
                          {isEn ? "Actor" : "操作人"}: {entry.actor}
                        </p>
                      ) : null}
                      <p className="text-sm text-foreground">
                        {"description" in entry ? entry.description : entry.summary}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Source Snapshot" : "原始来源"}</CardTitle>
                <CardDescription>
                  {isEn
                    ? "Conversation text or imported source used to build this draft."
                    : "生成合同时使用的原始对话、导入内容或分析结果。"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-auto rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap text-muted-foreground">
                  {contractRecord.sourceContent || (isEn ? "No source content stored." : "暂无原始来源内容。")}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  {isEn ? "Contract Preview" : "合同预览"}
                </CardTitle>
                <CardDescription>
                  {contractContent
                    ? isEn
                      ? "The preview reflects the latest saved draft and can be exported as HTML, Word, or PDF."
                      : "这里展示最新保存的合同内容，并支持 HTML、Word、PDF 导出。"
                    : isEn
                      ? "The record exists, but the formal contract body has not been generated yet."
                      : "合同记录已存在，但正式正文尚未生成。"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contractContent ? (
                  <div className="overflow-hidden rounded-xl border bg-white">
                    <div className="border-b bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      <FileText className="mr-2 inline h-4 w-4" />
                      {isEn ? "Saved Contract Content" : "已保存的合同内容"}
                    </div>
                    <div
                      className="max-h-[900px] overflow-auto p-6"
                      style={{ fontFamily: '"SimSun", "Songti SC", serif', lineHeight: 1.8 }}
                      dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-10 text-center">
                    <p className="text-muted-foreground">
                      {isEn
                        ? "Generate the contract body first, then return here to review the saved document."
                        : "请先生成合同正文，生成后即可回到这里查看正式内容。"}
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() =>
                        router.push(
                          flowContext === "dashboard"
                            ? `/create/analyze?id=${contractRecord.id}&ctx=dashboard`
                            : `/create/analyze?id=${contractRecord.id}`,
                        )
                      }
                    >
                      {isEn ? "Go to Generate" : "前往生成合同"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
