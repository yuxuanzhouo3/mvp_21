"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Download, Receipt, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { getAuthClient } from "@/lib/auth/client";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/lib/i18n";

interface BillingRecord {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded";
  description: string;
  paymentMethod: string;
  invoiceUrl?: string | null;
}

interface BillingHistoryProps {
  userId: string;
}

export function BillingHistory({ userId }: BillingHistoryProps) {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const { language } = useLanguage();
  const { refreshUser } = useUser();
  const isEn = language === "en";
  const t = useTranslations(language);

  const fetchBillingHistory = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const sessionResult = await getAuthClient().getSession();
      const token = sessionResult.data.session?.access_token;

      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const response = await fetch(`/api/payment/history?page=1&pageSize=50`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(t.payment.messages.failed);
      }

      const payload = await response.json();
      setRecords(Array.isArray(payload.records) ? payload.records : []);
      setError(null);
    } catch (fetchError) {
      console.error("[BillingHistory] Failed:", fetchError);
      setError(t.payment.messages.failed);
    } finally {
      setLoading(false);
    }
  }, [t.payment.messages.failed, userId]);

  useEffect(() => {
    void fetchBillingHistory();
  }, [fetchBillingHistory]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void refreshUser();
  }, [refreshUser, userId]);

  const getStatusBadge = (status: BillingRecord["status"]) => {
    const config = {
      paid: {
        label: "Paid",
        className: "bg-green-100 text-green-800 hover:bg-green-100",
      },
      pending: {
        label: "Pending",
        className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
      },
      failed: {
        label: "Failed",
        className: "bg-slate-100 text-slate-700 hover:bg-slate-100",
      },
      refunded: {
        label: "Refunded",
        className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
      },
    } as const;

    return (
      <Badge variant="outline" className={config[status].className}>
        {config[status].label}
      </Badge>
    );
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat(isEn ? "en-US" : "zh-CN", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(isEn ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  async function withTokenHeaders(extra?: HeadersInit) {
    const sessionResult = await getAuthClient().getSession();
    const token = sessionResult.data.session?.access_token;
    return {
      ...(extra || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function handleCancelOrder(recordId: string) {
    setProcessingId(recordId);
    try {
      const response = await fetch(`/api/payment/cancel`, {
        method: "POST",
        headers: await withTokenHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ paymentId: recordId }),
      });

      if (!response.ok) {
        throw new Error("Failed to cancel order");
      }

      setRecords((current) =>
        current.map((record) =>
          record.id === recordId ? { ...record, status: "failed" } : record,
        ),
      );
      toast.success("Payment cancelled.");
    } catch (cancelError) {
      console.error("[BillingHistory] Cancel failed:", cancelError);
      toast.error(t.payment.messages.failed);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleContinuePayment(record: BillingRecord) {
    setProcessingId(record.id);
    try {
      const response = await fetch(`/api/payment/continue`, {
        method: "POST",
        headers: await withTokenHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ paymentId: record.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to continue payment");
      }

      const result = await response.json();
      if (!result.paymentUrl) {
        throw new Error("No payment URL returned");
      }

      window.location.href = result.paymentUrl;
    } catch (continueError) {
      console.error("[BillingHistory] Continue payment failed:", continueError);
      toast.error(t.payment.messages.failed);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleOpenInvoice(record: BillingRecord) {
    setInvoiceLoadingId(record.id);

    try {
      const response = await fetch(`/api/payment/invoice/${record.id}`, {
        method: "GET",
        headers: await withTokenHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to load invoice");
      }

      const html = await response.text();
      const blob = new Blob([html], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);

      const popup = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }

      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (invoiceError) {
      console.error("[BillingHistory] Invoice failed:", invoiceError);
      toast.error(t.payment.messages.failed);
    } finally {
      setInvoiceLoadingId(null);
    }
  }

  const renderRecordActions = (record: BillingRecord) => (
    <div className="flex flex-wrap items-center gap-2">
      {record.status === "pending" ? (
        <>
          <Button
            variant="default"
            size="sm"
            onClick={() => void handleContinuePayment(record)}
            disabled={processingId === record.id}
          >
            <CreditCard className="mr-1 h-4 w-4" />
            {isEn ? "Continue" : "缁х画鏀粯"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleCancelOrder(record.id)}
            disabled={processingId === record.id}
          >
            <X className="mr-1 h-4 w-4" />
            {isEn ? "Cancel" : "鍙栨秷"}
          </Button>
        </>
      ) : null}
      {record.status === "paid" && record.invoiceUrl ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleOpenInvoice(record)}
          disabled={invoiceLoadingId === record.id}
        >
          <Download className="mr-1 h-4 w-4" />
          {isEn ? "Invoice" : "鍙戠エ"}
        </Button>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
            {t.common.loading}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="pt-6">
          <div className="py-8 text-center text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          {isEn ? "Billing History" : "璐﹀崟鍘嗗彶"}
        </CardTitle>
        <CardDescription>View and manage your payment records.</CardDescription>
      </CardHeader>

      <CardContent>
        {records.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No billing records found.</div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-xl border border-border/70 bg-muted/15 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{record.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(record.date)}</p>
                    </div>
                    {getStatusBadge(record.status)}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2 rounded-md bg-background/70 px-3 py-2">
                      <span className="text-muted-foreground">{isEn ? "Amount" : "閲戦"}</span>
                      <span className="font-medium">
                        {formatAmount(record.amount, record.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md bg-background/70 px-3 py-2">
                      <span className="text-muted-foreground">{isEn ? "Method" : "鏂瑰紡"}</span>
                      <span className="truncate">{record.paymentMethod}</span>
                    </div>
                  </div>
                  <div className="mt-3">{renderRecordActions(record)}</div>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isEn ? "Date" : "鏃ユ湡"}</TableHead>
                    <TableHead>{isEn ? "Description" : "璇存槑"}</TableHead>
                    <TableHead>{isEn ? "Amount" : "閲戦"}</TableHead>
                    <TableHead>{isEn ? "Payment Method" : "鏀粯鏂瑰紡"}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>{isEn ? "Actions" : "鎿嶄綔"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{record.description}</TableCell>
                      <TableCell className="font-medium">
                        {formatAmount(record.amount, record.currency)}
                      </TableCell>
                      <TableCell>{record.paymentMethod}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>{renderRecordActions(record)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

