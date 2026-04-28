"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  Download,
  Eye,
  FileText,
  FileType2,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyContractActionForCurrentUser,
  type ContractExportVariant,
  type ContractExportFormat,
  deleteContractForCurrentUser,
  downloadContractForCurrentUser,
  listContractsForCurrentUser,
  sealContractForCurrentUser,
  type ContractListItem,
} from "@/lib/contracts/client";
import { ContractSealDialog } from "@/components/contracts/contract-seal-dialog";
import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";

type ContractFilter = "all" | ContractListItem["status"] | "archived";
type SortMode = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";

function getSigningStageLabel(
  signFlowStatus: string | undefined,
  isEn: boolean,
) {
  if (signFlowStatus === "awaiting_sender") {
    return isEn ? "Signing Started" : "已发起签署";
  }
  if (signFlowStatus === "awaiting_counterparty") {
    return isEn ? "Sender Signed" : "发起方已签名";
  }
  if (signFlowStatus === "completed") {
    return isEn ? "Completed" : "已完成";
  }

  return isEn ? "Draft" : "草稿";
}

function formatDate(value?: string, locale = "zh-CN") {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function ContractsPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { language } = useLanguage();
  const t = useTranslations(language);
  const isEn = language === "en";
  const content = t.pages.contracts;

  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ContractFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [sealingId, setSealingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractListItem | null>(null);
  const [sealTarget, setSealTarget] = useState<ContractListItem | null>(null);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace("/auth?redirect=/contracts");
    }
  }, [router, user, userLoading]);

  useEffect(() => {
    let cancelled = false;

    async function loadContracts() {
      if (!user) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError("");
        const nextContracts = await listContractsForCurrentUser();

        if (!cancelled) {
          setContracts(nextContracts);
        }
      } catch (loadError) {
        console.error("[ContractsPage] Failed to load contracts:", loadError);
        if (!cancelled) {
          setError(content.loadFailed);
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
  }, [content.loadFailed, user]);

  const statusMeta: Record<
    ContractListItem["status"],
    { label: string; className: string }
  > = {
    draft: {
      label: content.statusDraft,
      className: "bg-muted text-muted-foreground",
    },
    pending: {
      label: content.statusPending,
      className: "bg-amber-100 text-amber-700",
    },
    active: {
      label: content.statusActive,
      className: "bg-blue-100 text-blue-700",
    },
    signed: {
      label: content.statusSigned,
      className: "bg-emerald-100 text-emerald-700",
    },
    completed: {
      label: content.statusCompleted,
      className: "bg-green-100 text-green-700",
    },
    expired: {
      label: content.statusExpired,
      className: "bg-red-100 text-red-700",
    },
    cancelled: {
      label: content.statusCancelled,
      className: "bg-slate-200 text-slate-700",
    },
  };

  const filters: Array<{ value: ContractFilter; label: string }> = [
    { value: "all", label: t.common.all },
    { value: "draft", label: content.statusDraft },
    { value: "pending", label: content.statusPending },
    { value: "signed", label: content.statusSigned },
    { value: "completed", label: content.statusCompleted },
    { value: "archived", label: isEn ? "Archived" : "已归档" },
  ];

  const filteredContracts = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    const nextContracts = contracts.filter((contract) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "archived"
            ? Boolean(contract.archivedAt)
            : contract.status === filter;
      if (!matchesFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = [
        contract.title,
        contract.region,
        contract.parties.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });

    return [...nextContracts].sort((left, right) => {
      if (sortMode === "title_asc") {
        return left.title.localeCompare(right.title);
      }

      if (sortMode === "title_desc") {
        return right.title.localeCompare(left.title);
      }

      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();

      return sortMode === "updated_asc" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [contracts, filter, searchQuery, sortMode]);

  const stats = useMemo(
    () => ({
      total: contracts.length,
      archived: contracts.filter((contract) => contract.archivedAt).length,
      signing: contracts.filter(
        (contract) =>
          contract.signFlowStatus === "awaiting_sender" ||
          contract.signFlowStatus === "awaiting_counterparty",
      ).length,
    }),
    [contracts],
  );

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
      console.error("[ContractsPage] Failed to delete contract:", deleteError);
      toast.error(content.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (
    contract: ContractListItem,
    format: ContractExportFormat,
    options?: {
      variant?: ContractExportVariant;
    },
  ) => {
    try {
      setDownloadingId(contract.id);
      await downloadContractForCurrentUser(contract.id, format, options);
    } catch (downloadError) {
      console.error("[ContractsPage] Failed to download contract:", downloadError);
      toast.error(isEn ? "Failed to download the contract." : "下载合同失败，请稍后重试。");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSeal = async (payload: {
    stampImageDataUrl: string;
    stampImageMimeType?: string;
    fileName?: string;
    source?: string;
    note?: string;
    placement?: {
      page?: number;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      opacity?: number;
    };
  }) => {
    if (!sealTarget) {
      return;
    }

    try {
      setSealingId(sealTarget.id);
      const updated = await sealContractForCurrentUser(sealTarget.id, payload);
      const enhancement = normalizeContractEnhancementMeta(updated.metadata, updated);
      setContracts((current) =>
        current.map((item) =>
          item.id === sealTarget.id
            ? {
                ...item,
                status: updated.status as ContractListItem["status"],
                updatedAt: updated.updatedAt || item.updatedAt,
                signFlowStatus: enhancement.signFlow.status,
                reminderCount: enhancement.signFlow.reminderCount,
                sealFlowStatus: enhancement.sealFlow.status,
              }
            : item,
        ),
      );
      setSealTarget(null);
      toast.success(isEn ? "Contract sealed successfully." : "合同盖章成功。");
    } catch (sealError) {
      console.error("[ContractsPage] Failed to seal contract:", sealError);
      toast.error(isEn ? "Failed to seal contract." : "合同盖章失败，请稍后重试。");
    } finally {
      setSealingId(null);
    }
  };

  const handleArchiveToggle = async (contract: ContractListItem) => {
    try {
      setArchivingId(contract.id);
      const updated = await applyContractActionForCurrentUser(
        contract.id,
        contract.archivedAt ? "unarchive" : "archive",
        contract.archivedAt
          ? isEn
            ? "Returned to the active contract list"
            : "已恢复到活跃合同列表"
          : isEn
            ? "Archived from contract center"
            : "已从合同中心归档",
      );

      setContracts((current) =>
        current.map((item) =>
          item.id === contract.id
            ? {
                ...item,
                status: updated.status as ContractListItem["status"],
                archivedAt: (
                  updated.metadata as Record<string, unknown>
                )?.archivedAt as string | undefined,
                archivedReason: (
                  updated.metadata as Record<string, unknown>
                )?.archivedReason as string | undefined,
              }
            : item,
        ),
      );
    } catch (archiveError) {
      console.error("[ContractsPage] Failed to toggle archive:", archiveError);
      toast.error(isEn ? "Failed to update archive status." : "更新归档状态失败。");
    } finally {
      setArchivingId(null);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">{content.loadingDescription}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold">{content.title}</h1>
            <p className="mt-2 text-gray-600">{content.description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push("/create")}>
              <Plus className="mr-2 h-5 w-5" />
              {content.primaryAction}
            </Button>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={content.searchPlaceholder}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <Button
                key={item.value}
                variant={filter === item.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))_220px]">
            <Card>
              <CardContent className="py-4">
                <div className="text-sm text-muted-foreground">
                  {isEn ? "Total Contracts" : "合同总数"}
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-sm text-muted-foreground">
                  {isEn ? "In Signing" : "签署中"}
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.signing}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-sm text-muted-foreground">
                  {isEn ? "Archived" : "已归档"}
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.archived}</div>
              </CardContent>
            </Card>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {isEn ? "Sort By" : "排序方式"}
              </div>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_desc">
                    {isEn ? "Latest updated" : "最近更新"}
                  </SelectItem>
                  <SelectItem value="updated_asc">
                    {isEn ? "Oldest updated" : "最早更新"}
                  </SelectItem>
                  <SelectItem value="title_asc">
                    {isEn ? "Title A-Z" : "标题 A-Z"}
                  </SelectItem>
                  <SelectItem value="title_desc">
                    {isEn ? "Title Z-A" : "标题 Z-A"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-sm text-red-700">
              {error}
            </CardContent>
          </Card>
        ) : null}

        {!error && filteredContracts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
              <h2 className="text-xl font-semibold">
                {contracts.length === 0 ? content.emptyTitle : content.noResultsTitle}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {contracts.length === 0
                  ? content.emptyDescription
                  : content.noResultsDescription}
              </p>
              {contracts.length === 0 ? (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button onClick={() => router.push("/create")}>
                    <Plus className="mr-2 h-4 w-4" />
                    {content.primaryAction}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-4">
          {filteredContracts.map((contract) => {
            const stageLabel =
              contract.sealFlowStatus === "sealed"
                ? null
                : getSigningStageLabel(contract.signFlowStatus, isEn);
            return (
            <Card key={contract.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h2 className="truncate text-lg font-semibold">
                      {contract.title || content.untitled}
                    </h2>
                    <Badge className={statusMeta[contract.status].className}>
                      {statusMeta[contract.status].label}
                    </Badge>
                    {stageLabel ? <Badge variant="outline">{stageLabel}</Badge> : null}
                    {contract.region ? (
                      <Badge variant="outline">
                        {content.regionLabel}: {contract.region}
                      </Badge>
                    ) : null}
                    {contract.archivedAt ? (
                      <Badge variant="outline" className="border-slate-300 text-slate-600">
                        {isEn ? "Archived" : "已归档"}
                      </Badge>
                    ) : null}
                    {contract.sealFlowStatus === "sealed" ? (
                      <Badge variant="outline" className="border-red-300 text-red-700">
                        {isEn ? "Sealed" : "已盖章"}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      {content.contractParties}: {contract.parties.join(", ") || "-"}
                    </p>
                    <p>
                      {content.createdAt}:{" "}
                      {formatDate(
                        contract.createdAt || contract.updatedAt,
                        isEn ? "en-US" : "zh-CN",
                      )}
                    </p>
                    <p>
                      {isEn ? "Signing Flow" : "签署流程"}:{" "}
                      {contract.signFlowStatus || (isEn ? "draft" : "草稿")}
                      {contract.reminderCount
                        ? ` · ${contract.reminderCount} ${isEn ? "reminders" : "次提醒"}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/contracts/${contract.id}`)}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    {content.viewAction}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingId === contract.id}
                      >
                        {downloadingId === contract.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-1 h-4 w-4" />
                        )}
                        {content.downloadAction}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
                      {contract.sealFlowStatus === "sealed" ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={downloadingId === contract.id}
                            onClick={() => void handleDownload(contract, "pdf", { variant: "sealed" })}
                          >
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            {isEn ? "Download Sealed PDF" : "下载已盖章 PDF"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={downloadingId === contract.id}
                            onClick={() => void handleDownload(contract, "word", { variant: "sealed" })}
                          >
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            {isEn ? "Download Sealed Word" : "下载已盖章 Word"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={downloadingId === contract.id}
                            onClick={() => void handleDownload(contract, "html", { variant: "sealed" })}
                          >
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            {isEn ? "Download Sealed HTML" : "下载已盖章 HTML"}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {(contract.signFlowStatus === "completed" || contract.sealFlowStatus === "sealed") ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSealTarget(contract)}
                      disabled={sealingId === contract.id}
                    >
                      {sealingId === contract.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-1 h-4 w-4" />
                      )}
                      {contract.sealFlowStatus === "sealed"
                        ? isEn
                          ? "Reseal"
                          : "重新盖章"
                        : isEn
                          ? "Seal"
                          : "盖章"}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleArchiveToggle(contract)}
                    disabled={archivingId === contract.id}
                  >
                    {archivingId === contract.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <ArchiveRestore className="mr-1 h-4 w-4" />
                    )}
                    {contract.archivedAt
                      ? isEn
                        ? "Restore"
                        : "恢复"
                      : isEn
                        ? "Archive"
                        : "归档"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setDeleteTarget(contract)}
                    disabled={deletingId === contract.id}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {content.deleteAction}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )})}
        </div>

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
        <ContractSealDialog
          open={Boolean(sealTarget)}
          onOpenChange={(open) => (!open ? setSealTarget(null) : null)}
          onSubmit={handleSeal}
          loading={Boolean(sealTarget && sealingId === sealTarget.id)}
          isEn={isEn}
          contractTitle={sealTarget?.title}
          reseal={sealTarget?.sealFlowStatus === "sealed"}
        />
      </main>
    </div>
  );
}
