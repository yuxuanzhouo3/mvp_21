"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  MoreVertical,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

type ContractStatus = "completed" | "pending" | "draft";
type ContractFilter = "all" | ContractStatus;

const contracts = [
  {
    id: 1,
    title: "Service Agreement - TechBridge Inc.",
    status: "completed" as ContractStatus,
    date: "2026-01-05",
    parties: ["Sarah Chen", "Li Wei"],
    region: "US-CN",
  },
  {
    id: 2,
    title: "Non-Disclosure Agreement",
    status: "pending" as ContractStatus,
    date: "2026-01-08",
    parties: ["Michael Rodriguez", "Wang Fang"],
    region: "US-CN",
  },
  {
    id: 3,
    title: "Partnership Agreement",
    status: "draft" as ContractStatus,
    date: "2026-01-10",
    parties: ["Global Trade Co."],
    region: "US",
  },
  {
    id: 4,
    title: "供应商合同 (Supplier Contract)",
    status: "completed" as ContractStatus,
    date: "2026-01-03",
    parties: ["Dragon Enterprises", "Zhang Ming"],
    region: "CN",
  },
  {
    id: 5,
    title: "Employment Contract",
    status: "pending" as ContractStatus,
    date: "2026-01-09",
    parties: ["TechBridge Inc.", "John Smith"],
    region: "US",
  },
];

export function ContractList() {
  const { language } = useLanguage();
  const isEn = language === "en";
  const [filter, setFilter] = useState<ContractFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const statusMeta: Record<
    ContractStatus,
    {
      label: string;
      className: string;
    }
  > = {
    completed: {
      label: isEn ? "Completed" : "已完成",
      className: "bg-accent/10 text-accent border-accent/20",
    },
    pending: {
      label: isEn ? "Pending" : "待处理",
      className: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    },
    draft: {
      label: isEn ? "Draft" : "草稿",
      className: "bg-muted text-muted-foreground border-border",
    },
  };

  const tabItems: Array<{ value: ContractFilter; label: string }> = [
    { value: "all", label: isEn ? "All" : "全部" },
    { value: "pending", label: isEn ? "Pending" : "待处理" },
    { value: "completed", label: isEn ? "Completed" : "已完成" },
    { value: "draft", label: isEn ? "Drafts" : "草稿" },
  ];

  const dateFormatter = new Intl.DateTimeFormat(isEn ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const counts = useMemo(() => {
    return {
      all: contracts.length,
      pending: contracts.filter((item) => item.status === "pending").length,
      completed: contracts.filter((item) => item.status === "completed").length,
      draft: contracts.filter((item) => item.status === "draft").length,
    };
  }, []);

  const filteredContracts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return contracts
      .filter((contract) => (filter === "all" ? true : contract.status === filter))
      .filter((contract) => {
        if (!normalizedSearch) return true;
        return (
          contract.title.toLowerCase().includes(normalizedSearch) ||
          contract.parties.join(" ").toLowerCase().includes(normalizedSearch) ||
          contract.region.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((left, right) => (left.date < right.date ? 1 : -1));
  }, [filter, searchQuery]);

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">{isEn ? "Contracts" : "合同列表"}</CardTitle>
          <Button size="sm" asChild>
            <Link href="/dashboard/contracts/new">
              <Plus className="mr-2 h-4 w-4" />
              {isEn ? "New Contract" : "新建合同"}
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as ContractFilter)}>
            <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
              {tabItems.map((tabItem) => (
                <TabsTrigger key={tabItem.value} value={tabItem.value}>
                  {tabItem.label} ({counts[tabItem.value]})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={isEn ? "Search contracts..." : "搜索合同..."}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredContracts.length === 0 ? (
          <Empty className="border-border/70 bg-muted/10">
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>{isEn ? "No matching contracts" : "未找到匹配合同"}</EmptyTitle>
              <EmptyDescription>
                {isEn
                  ? "Try another keyword or switch status tabs."
                  : "请尝试其他关键词或切换状态标签。"}
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
                      <p className="truncate text-sm font-medium text-foreground">{contract.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dateFormatter.format(new Date(contract.date))} • {contract.parties.join(", ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Badge variant="outline">{contract.region}</Badge>
                    <Badge className={cn("border", meta.className)}>{meta.label}</Badge>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label="Contract actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          {isEn ? "View" : "查看"}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="mr-2 h-4 w-4" />
                          {isEn ? "Download" : "下载"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          {isEn ? "Delete" : "删除"}
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
    </Card>
  );
}
