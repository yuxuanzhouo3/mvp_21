"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteContractForCurrentUser, listContractsForCurrentUser, type ContractListItem } from "@/lib/contracts/client";
import { useTranslations } from "@/lib/i18n";

type ContractFilter = "all" | ContractListItem["status"];

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
  ];

  const filteredContracts = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    return contracts.filter((contract) => {
      const matchesFilter = filter === "all" ? true : contract.status === filter;
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
  }, [contracts, filter, searchQuery]);

  const handleDelete = async (contract: ContractListItem) => {
    if (!window.confirm(content.deleteConfirm)) {
      return;
    }

    try {
      setDeletingId(contract.id);
      await deleteContractForCurrentUser(contract.id);
      setContracts((current) => current.filter((item) => item.id !== contract.id));
      window.alert(content.deleteSuccess);
    } catch (deleteError) {
      console.error("[ContractsPage] Failed to delete contract:", deleteError);
      window.alert(content.deleteFailed);
    } finally {
      setDeletingId(null);
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

          <Button onClick={() => router.push("/contracts/new")}>
            <Plus className="mr-2 h-5 w-5" />
            {content.primaryAction}
          </Button>
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
                <Button className="mt-6" onClick={() => router.push("/contracts/new")}>
                  <Plus className="mr-2 h-4 w-4" />
                  {content.primaryAction}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-4">
          {filteredContracts.map((contract) => (
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
                    {contract.region ? (
                      <Badge variant="outline">
                        {content.regionLabel}: {contract.region}
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
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.alert(content.openComingSoon)}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    {content.viewAction}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.alert(content.downloadComingSoon)}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    {content.downloadAction}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => void handleDelete(contract)}
                    disabled={deletingId === contract.id}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {content.deleteAction}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
