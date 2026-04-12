"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Eye, FileText, Filter, Search, Share2 } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type ContractExportFormat,
  downloadContractForCurrentUser,
  listContractsForCurrentUser,
  type ContractListItem,
} from "@/lib/contracts/client";

type MobileFilter = "all" | "pending" | "completed" | "draft";

function toMobileStatus(contract: ContractListItem): Exclude<MobileFilter, "all"> {
  if (contract.status === "completed" || contract.status === "signed") {
    return "completed";
  }
  if (contract.status === "pending" || contract.signFlowStatus === "awaiting_counterparty") {
    return "pending";
  }
  return "draft";
}

export function MobileContractList() {
  const [filter, setFilter] = useState<MobileFilter>("all");
  const [search, setSearch] = useState("");
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { language } = useLanguage();
  const isEn = language === "en";

  const loadContracts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await listContractsForCurrentUser();
      setContracts(result);
    } catch (loadError) {
      console.error("[MobileContractList] Failed to load contracts:", loadError);
      setError(isEn ? "Failed to load contracts." : "加载合同失败。");
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  const counts = useMemo<Record<MobileFilter, number>>(
    () => ({
      all: contracts.length,
      pending: contracts.filter((contract) => toMobileStatus(contract) === "pending").length,
      completed: contracts.filter((contract) => toMobileStatus(contract) === "completed").length,
      draft: contracts.filter((contract) => toMobileStatus(contract) === "draft").length,
    }),
    [contracts],
  );

  const filteredContracts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return contracts.filter((contract) => {
      const statusMatch = filter === "all" ? true : toMobileStatus(contract) === filter;
      const keywordMatch =
        !keyword ||
        contract.title.toLowerCase().includes(keyword) ||
        contract.parties.some((party) => party.toLowerCase().includes(keyword));

      return statusMatch && keywordMatch;
    });
  }, [contracts, filter, search]);

  const statusLabel = (contract: ContractListItem) => {
    const status = toMobileStatus(contract);
    if (status === "completed") {
      return isEn ? "Completed" : "已完成";
    }
    if (status === "pending") {
      return isEn ? "Pending" : "待签署";
    }
    return isEn ? "Draft" : "草稿";
  };

  const formatDate = (value?: string) => {
    if (!value) {
      return isEn ? "No update yet" : "暂无更新";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(isEn ? "en-US" : "zh-CN", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  async function handleDownload(
    contractId: string,
    format: ContractExportFormat,
  ) {
    try {
      setDownloadingId(contractId);
      await downloadContractForCurrentUser(contractId, format);
      toast.success(isEn ? "Contract downloaded." : "合同已开始下载。");
    } catch (downloadError) {
      console.error("[MobileContractList] Failed to download contract:", downloadError);
      toast.error(isEn ? "Failed to download contract." : "下载合同失败。");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleShare(contract: ContractListItem) {
    const targetUrl = `${window.location.origin}/contracts/${contract.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: contract.title,
          url: targetUrl,
        });
      } else {
        await navigator.clipboard.writeText(targetUrl);
        toast.success(isEn ? "Contract link copied." : "合同链接已复制。");
      }
    } catch (shareError) {
      console.error("[MobileContractList] Failed to share contract:", shareError);
      toast.error(isEn ? "Failed to share contract." : "分享合同失败。");
    }
  }

  return (
    <div className="pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="px-4 py-4">
          <div className="mb-4 flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/mobile">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">{isEn ? "Contracts" : "合同"}</h1>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={isEn ? "Search contracts..." : "搜索合同..."}
              className="pl-9 pr-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              disabled
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as MobileFilter)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="text-xs">
                {isEn ? "All" : "全部"} ({counts.all})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">
                {isEn ? "Pending" : "待签署"} ({counts.pending})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">
                {isEn ? "Done" : "已完成"} ({counts.completed})
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs">
                {isEn ? "Drafts" : "草稿"} ({counts.draft})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {isEn ? "Loading contracts..." : "正在加载合同..."}
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : filteredContracts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {isEn ? "No contracts found." : "没有匹配的合同。"}
            </CardContent>
          </Card>
        ) : (
          filteredContracts.map((contract) => (
            <Card key={contract.id} className="transition-colors hover:border-primary/50">
              <CardContent className="pb-4 pt-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 line-clamp-2 font-medium">{contract.title}</h3>
                    <p className="mb-2 text-sm text-muted-foreground">
                      {contract.parties.length
                        ? contract.parties.join(" · ")
                        : isEn
                          ? "No party information"
                          : "暂无签约方信息"}
                    </p>
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant={toMobileStatus(contract) === "completed" ? "default" : "secondary"}>
                        {statusLabel(contract)}
                      </Badge>
                      {contract.region ? <Badge variant="outline">{contract.region}</Badge> : null}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(contract.updatedAt || contract.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
                        <Link href={`/contracts/${contract.id}?ctx=mobile`}>
                          <Eye className="mr-1 h-4 w-4" />
                          {isEn ? "View" : "查看"}
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
                        <Link href={`/mobile/sign?contractId=${contract.id}`}>
                          {isEn ? "Sign" : "签署"}
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={downloadingId === contract.id}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={downloadingId === contract.id}
                            onClick={() => void handleDownload(contract.id, "pdf")}
                          >
                            {isEn ? "Download PDF" : "下载 PDF"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={downloadingId === contract.id}
                            onClick={() => void handleDownload(contract.id, "word")}
                          >
                            {isEn ? "Download Word" : "下载 Word"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={downloadingId === contract.id}
                            onClick={() => void handleDownload(contract.id, "html")}
                          >
                            {isEn ? "Download HTML" : "下载 HTML"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void handleShare(contract)}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
