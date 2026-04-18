"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  FileText,
  FileType2,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";
import {
  ContractClientError,
  type ContractExportFormat,
  deleteContractForCurrentUser,
  downloadContractForCurrentUser,
  listContractsForCurrentUser,
  type ContractListItem,
} from "@/lib/contracts/client";
import { toast } from "sonner";

type ContractFilter = "all" | "pending" | "completed" | "draft" | "signed";

function formatDate(value?: string, locale = "zh-CN") {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function ContractList() {
  const router = useRouter();
  const { language, deploymentRegion } = useLanguage();
  const { user, loading: userLoading } = useUser();
  const isEn = language === "en";
  const isIntlDeployment = deploymentRegion === "INTL";

  const content = useMemo(() => ({
    title: isEn ? "Contracts" : "合同管理",
    primaryAction: isEn ? "New Contract" : "新建合同",
    searchPlaceholder: isEn ? "Search contract title, parties, or region..." : "搜索合同标题、签约方或地区...",
    emptyTitle: isEn ? "No contracts yet" : "暂无合同",
    emptyDescription: isEn ? "Create your first contract to get started." : "开始创建你的第一份合同吧。",
    noResultsTitle: isEn ? "No matching contracts" : "没有匹配的合同",
    noResultsDescription: isEn ? "Try a different keyword or status filter." : "试试更换关键字或筛选状态。",
    loadFailed: isEn ? "Failed to load contracts." : "加载合同失败，请稍后重试。",
    loadSessionExpiredIntl: isEn
      ? "Your session expired. Please sign in again."
      : "登录状态已过期，请重新登录。",
    loadSessionExpiredCn: isEn
      ? "Your session expired. Please sign in again."
      : "登录状态已过期，请重新登录。",
    loadNoPermission: isEn
      ? "You don't have permission to view these contracts."
      : "你没有查看该合同的权限。",
    loadTooFrequent: isEn
      ? "Too many requests. Please try again in a moment."
      : "请求过于频繁，请稍后再试。",
    loadServerError: isEn
      ? "Contract service is temporarily unavailable. Please try again later."
      : "合同服务暂时不可用，请稍后再试。",
    loadNetworkError: isEn
      ? "Network error. Check your connection and retry."
      : "网络异常，请检查网络后重试。",
    loadNotFound: isEn
      ? "Contract resource was not found."
      : "合同资源不存在或已被删除。",
    deleteConfirm: isEn ? "Delete this contract? This action cannot be undone." : "确定要删除这份合同吗？此操作无法撤销。",
    deleteSuccess: isEn ? "Contract deleted." : "合同已删除。",
    deleteFailed: isEn ? "Failed to delete contract." : "删除合同失败，请稍后重试。",
    viewAction: isEn ? "View" : "查看",
    downloadAction: isEn ? "Download" : "下载",
    deleteAction: isEn ? "Delete" : "删除",
    statusDraft: isEn ? "Draft" : "草稿",
    statusPending: isEn ? "Pending" : "待处理",
    statusActive: isEn ? "Active" : "生效中",
    statusSigned: isEn ? "Signed" : "已签署",
    statusCompleted: isEn ? "Completed" : "已完成",
    statusExpired: isEn ? "Expired" : "已过期",
    statusCancelled: isEn ? "Cancelled" : "已取消",
    untitled: isEn ? "Untitled Contract" : "未命名合同",
    loadingDescription: isEn ? "Loading contracts..." : "正在加载合同列表...",
    allLabel: isEn ? "All" : "全部",
  }), [isEn]);

  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ContractFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractListItem | null>(null);

  const getLoadErrorMessage = useCallback((loadError: unknown) => {
    if (loadError instanceof ContractClientError) {
      switch (loadError.code) {
        case "UNAUTHORIZED":
          return isIntlDeployment
            ? content.loadSessionExpiredIntl
            : content.loadSessionExpiredCn;
        case "FORBIDDEN":
          return content.loadNoPermission;
        case "NOT_FOUND":
          return content.loadNotFound;
        case "RATE_LIMITED":
          return content.loadTooFrequent;
        case "SERVER_ERROR":
          return content.loadServerError;
        case "NETWORK_ERROR":
          return content.loadNetworkError;
        default:
          return content.loadFailed;
      }
    }

    if (loadError instanceof Error) {
      const message = loadError.message.toUpperCase();
      if (message.includes("LOAD_FAILED_401") || message.includes("UNAUTHORIZED")) {
        return isIntlDeployment
          ? content.loadSessionExpiredIntl
          : content.loadSessionExpiredCn;
      }
      if (message.includes("LOAD_FAILED_403")) {
        return content.loadNoPermission;
      }
      if (message.includes("LOAD_FAILED_404")) {
        return content.loadNotFound;
      }
      if (message.includes("LOAD_FAILED_429")) {
        return content.loadTooFrequent;
      }
      if (message.includes("LOAD_FAILED_5")) {
        return content.loadServerError;
      }
      if (message.includes("NETWORK") || message.includes("FETCH")) {
        return content.loadNetworkError;
      }
    }

    return content.loadFailed;
  }, [content, isIntlDeployment]);

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
        const nextContracts = await listContractsForCurrentUser();

        if (!cancelled) {
          setContracts(nextContracts);
        }
      } catch (loadError) {
        console.error("[ContractList] Failed to load contracts:", loadError);
        if (!cancelled) {
          setError(getLoadErrorMessage(loadError));
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
  }, [content, getLoadErrorMessage, user, userLoading]);

  const statusMeta: Record<
    ContractListItem["status"],
    { label: string; className: string }
  > = {
    draft: {
      label: content.statusDraft,
      className: "bg-muted text-muted-foreground border-border",
    },
    pending: {
      label: content.statusPending,
      className: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    },
    active: {
      label: content.statusActive,
      className: "bg-blue-500/10 text-blue-700 border-blue-200",
    },
    signed: {
      label: content.statusSigned,
      className: "bg-green-500/10 text-green-700 border-green-200",
    },
    completed: {
      label: content.statusCompleted,
      className: "bg-accent/10 text-accent border-accent/20",
    },
    expired: {
      label: content.statusExpired,
      className: "bg-red-500/10 text-red-700 border-red-200",
    },
    cancelled: {
      label: content.statusCancelled,
      className: "bg-slate-200 text-slate-700 border-slate-300",
    },
  };

  const tabItems: Array<{ value: ContractFilter; label: string }> = [
    { value: "all", label: content.allLabel },
    { value: "pending", label: content.statusPending },
    { value: "completed", label: content.statusCompleted },
    { value: "draft", label: content.statusDraft },
    { value: "signed", label: content.statusSigned },
  ];

  const counts = useMemo<Record<ContractFilter, number>>(() => {
    return {
      all: contracts.length,
      pending: contracts.filter((item) => item.status === "pending").length,
      completed: contracts.filter((item) => item.status === "completed").length,
      draft: contracts.filter((item) => item.status === "draft").length,
      signed: contracts.filter((item) => item.status === "signed").length,
    };
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return contracts
      .filter((contract) => (filter === "all" ? true : contract.status === filter))
      .filter((contract) => {
        if (!normalizedSearch) {
          return true;
        }

        return [contract.title, contract.region, contract.parties.join(" ")]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) =>
        (left.createdAt || left.updatedAt || "") <
        (right.createdAt || right.updatedAt || "")
          ? 1
          : -1,
      );
  }, [contracts, filter, searchQuery]);

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeletingId(deleteTarget.id);
      await deleteContractForCurrentUser(deleteTarget.id);
      setContracts((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(content.deleteSuccess);
    } catch (deleteError) {
      console.error("[ContractList] Failed to delete contract:", deleteError);
      toast.error(content.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (
    contract: ContractListItem,
    format: ContractExportFormat,
  ) => {
    try {
      setDownloadingId(contract.id);
      await downloadContractForCurrentUser(contract.id, format);
    } catch (downloadError) {
      console.error("[ContractList] Failed to download contract:", downloadError);
      toast.error(isEn ? "Failed to download the contract." : "下载合同失败，请稍后重试。");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">{content.title}</CardTitle>
          <Button size="sm" asChild>
            <Link href="/dashboard/contracts/new">
              <Plus className="mr-2 h-4 w-4" />
              {content.primaryAction}
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as ContractFilter)}>
            <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-5">
              {tabItems.map((tabItem) => (
                <TabsTrigger key={tabItem.value} value={tabItem.value}>
                  {tabItem.label} ({counts[tabItem.value]})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={content.searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {content.loadingDescription}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : filteredContracts.length === 0 ? (
          <Empty className="border-border/70 bg-muted/10">
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>
                {contracts.length === 0 ? content.emptyTitle : content.noResultsTitle}
              </EmptyTitle>
              <EmptyDescription>
                {contracts.length === 0
                  ? content.emptyDescription
                  : content.noResultsDescription}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-3">
            {filteredContracts.map((contract) => {
              const meta = statusMeta[contract.status];
              return (
                <div
                  key={contract.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/15 p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {contract.title || content.untitled}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(
                          contract.createdAt || contract.updatedAt,
                          isEn ? "en-US" : "zh-CN",
                        )}{" "}
                        · {contract.parties.join(", ") || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {contract.region ? <Badge variant="outline">{contract.region}</Badge> : null}
                    <Badge className={cn("border", meta.className)}>{meta.label}</Badge>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Contract actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/contracts/${contract.id}?ctx=dashboard`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {content.viewAction}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={downloadingId === contract.id}
                          onClick={() => void handleDownload(contract, "pdf")}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          {isEn ? "Download PDF" : "下载 PDF"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={downloadingId === contract.id}
                          onClick={() => void handleDownload(contract, "word")}
                        >
                          <FileType2 className="mr-2 h-4 w-4" />
                          {isEn ? "Download Word" : "下载 Word"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={downloadingId === contract.id}
                          onClick={() => void handleDownload(contract, "html")}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {isEn ? "Download HTML" : "下载 HTML"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={deletingId === contract.id}
                          onClick={() => setDeleteTarget(contract)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {content.deleteAction}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isEn ? "Delete Contract?" : "删除合同？"}</AlertDialogTitle>
            <AlertDialogDescription>{content.deleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isEn ? "Cancel" : "取消"}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={deletingId === deleteTarget?.id}>
              {deletingId === deleteTarget?.id ? (isEn ? "Deleting..." : "删除中...") : content.deleteAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
