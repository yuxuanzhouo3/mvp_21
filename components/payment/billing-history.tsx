"use client";

import { useState, useEffect } from "react";
import { getAuthClient } from "@/lib/auth/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, Download, RefreshCw, CreditCard, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "@/lib/i18n";

interface BillingRecord {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded";
  description: string;
  paymentMethod: string;
  invoiceUrl?: string;
}

interface BillingHistoryProps {
  userId: string;
}

export function BillingHistory({ userId }: BillingHistoryProps) {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { language } = useLanguage();
  const isEn = language === "en";
  const t = useTranslations(language);

  useEffect(() => {
    const fetchBillingHistory = async () => {
      // 如果没有 userId，不发起请求
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // 从 API 获取历史账单（使用认证 token）
        const sessionResult = await getAuthClient().getSession();
        const token = sessionResult.data.session?.access_token;

        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};

        const resp = await fetch(`/api/payment/history?page=1&pageSize=50`, {
          method: "GET",
          headers,
        });

        if (!resp.ok) {
          throw new Error(t.payment.messages.failed);
        }

        const apiData = await resp.json();
        setRecords(apiData.records || []);
        setError(null);
      } catch (err) {
        console.error("Billing history error:", err);
        setError(t.payment.messages.failed);
      } finally {
        setLoading(false);
      }
    };

    fetchBillingHistory();
  }, [userId]);

  const getStatusBadge = (status: BillingRecord["status"]) => {
    const statusConfig = {
      paid: {
        variant: "default" as const,
        text: isEn ? "Paid" : "已支付",
        className: "bg-green-100 text-green-800 hover:bg-green-100",
      },
      pending: {
        variant: "secondary" as const,
        text: isEn ? "Pending" : "待支付",
        className: "bg-orange-100 text-orange-800 hover:bg-orange-100",
      },
      failed: {
        variant: "destructive" as const,
        text: isEn ? "Cancelled" : "已取消",
        className: "bg-gray-100 text-gray-600 hover:bg-gray-100",
      },
      refunded: {
        variant: "outline" as const,
        text: isEn ? "Refunded" : "已退款",
        className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
      },
    };

    const config = statusConfig[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.text}
      </Badge>
    );
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat(isEn ? "en-US" : "zh-CN", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(isEn ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // 取消订单
  const handleCancelOrder = async (recordId: string) => {
    setProcessingId(recordId);
    try {
      const sessionResult = await getAuthClient().getSession();
      const token = sessionResult.data.session?.access_token;

      const response = await fetch(`/api/payment/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ paymentId: recordId }),
      });

      if (!response.ok) {
        throw new Error("Failed to cancel order");
      }

      toast({
        title: t.payment.messages.success,
        description: t.payment.messages.cancelled,
      });

      // 刷新账单列表
      setRecords((prev) =>
        prev.map((r) =>
          r.id === recordId ? { ...r, status: "failed" as const } : r,
        ),
      );
    } catch (error) {
      console.error("Cancel order error:", error);
      toast({
        title: t.payment.messages.failed,
        description: t.payment.messages.failed,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // 继续支付
  const handleContinuePayment = async (record: BillingRecord) => {
    setProcessingId(record.id);
    try {
      // 尝试获取原支付链接或创建新的支付会话
      const sessionResult = await getAuthClient().getSession();
      const token = sessionResult.data.session?.access_token;

      const response = await fetch(`/api/payment/continue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ paymentId: record.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to continue payment");
      }

      const result = await response.json();

      if (result.paymentUrl) {
        // 跳转到支付页面
        window.location.href = result.paymentUrl;
      } else {
        throw new Error("No payment URL returned");
      }
    } catch (error) {
      console.error("Continue payment error:", error);
      toast({
        title: t.payment.messages.failed,
        description: t.payment.messages.failed,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const renderRecordActions = (record: BillingRecord) => {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {record.status === "pending" && (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleContinuePayment(record)}
              disabled={processingId === record.id}
            >
              <CreditCard className="h-4 w-4 mr-1" />
              {isEn ? "Continue" : "继续支付"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancelOrder(record.id)}
              disabled={processingId === record.id}
            >
              <X className="h-4 w-4 mr-1" />
              {isEn ? "Cancel" : "取消"}
            </Button>
          </>
        )}
        {record.status === "paid" && record.invoiceUrl && (
          <Button variant="ghost" size="sm" asChild>
            <a href={record.invoiceUrl} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-1" />
              {isEn ? "Invoice" : "发票"}
            </a>
          </Button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            {t.common.loading}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive py-8">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          {isEn ? "Billing History" : "账单历史"}
        </CardTitle>
        <CardDescription>
          {isEn ? "View and manage your payment records" : "查看和管理你的支付记录"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {isEn ? "No billing records found" : "暂无账单记录"}
          </div>
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
                      <span className="text-muted-foreground">{isEn ? "Amount" : "金额"}</span>
                      <span className="font-medium">
                        {formatAmount(record.amount, record.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md bg-background/70 px-3 py-2">
                      <span className="text-muted-foreground">{isEn ? "Method" : "方式"}</span>
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
                    <TableHead>{isEn ? "Date" : "日期"}</TableHead>
                    <TableHead>
                      {isEn ? "Description" : "描述"}
                    </TableHead>
                    <TableHead>{isEn ? "Amount" : "金额"}</TableHead>
                    <TableHead>
                      {isEn ? "Payment Method" : "支付方式"}
                    </TableHead>
                    <TableHead>{isEn ? "Status" : "状态"}</TableHead>
                    <TableHead>{isEn ? "Actions" : "操作"}</TableHead>
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
