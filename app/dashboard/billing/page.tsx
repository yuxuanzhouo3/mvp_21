"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, Receipt, Wallet } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import { BillingHistory } from "@/components/payment/billing-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/components/user-context";
import { getDashboardBillingSummary } from "@/lib/dashboard/client";
import type { DashboardBillingSummary } from "@/lib/dashboard/types";

export default function BillingPage() {
  const { language } = useLanguage();
  const { user } = useUser();
  const [summary, setSummary] = useState<DashboardBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isEn = language === "en";
  const locale = isEn ? "en-US" : "zh-CN";
  const labels = {
    overview: isEn ? "Overview" : "总览",
    billing: isEn ? "Billing" : "账单",
    title: isEn ? "Billing & Plans" : "账单与套餐",
    description: isEn ? "Manage your subscription summary and billing history." : "管理订阅概览、账单摘要与支付记录。",
    comparePlans: isEn ? "Compare Plans" : "比较套餐",
    manageSubscription: isEn ? "Open Payment Center" : "打开支付中心",
    currentPlan: isEn ? "Current Plan" : "当前套餐",
    totalSpent: isEn ? "Total Spent" : "累计支出",
    payments: isEn ? "Payments" : "支付笔数",
    membershipExpires: isEn ? "Membership Expires" : "会员到期",
    noMembership: isEn ? "No active membership" : "暂无有效会员",
    paymentMethod: isEn ? "Payment Method" : "支付方式",
    billingCycle: isEn ? "Billing Cycle" : "计费周期",
    lastPayment: isEn ? "Last Payment" : "最近支付",
    pendingPayments: isEn ? "Pending Payments" : "待处理支付",
    summaryTitle: isEn ? "Subscription Summary" : "订阅概览",
    summaryDescription: isEn
      ? "This page focuses on console insights. Checkout, renewals, and payment changes continue in the main payment center."
      : "当前页面聚焦控制台汇总视图，结算、续费和支付方式变更仍在主支付中心完成。",
    recentPaymentsTitle: isEn ? "Recent Payments" : "最近支付",
    recentPaymentsDescription: isEn ? "Latest payment snapshots from the unified billing model." : "来自统一账单模型的最近支付快照。",
    paymentHistoryTitle: isEn ? "Billing History" : "账单历史",
    paymentHistoryDescription: isEn ? "Review detailed payment history and invoices." : "查看完整支付记录与账单明细。",
    noPaymentHistory: isEn ? "No payment history available" : "暂无支付记录",
    loadFailed: isEn ? "Failed to load billing summary." : "加载账单概览失败。",
  };

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        setLoading(true);
        setError("");
        const result = await getDashboardBillingSummary();
        if (!cancelled) {
          setSummary(result.summary);
        }
      } catch (loadError) {
        console.error("[BillingPage] Failed to load billing summary:", loadError);
        if (!cancelled) {
          setError(labels.loadFailed);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [labels.loadFailed]);

  const pendingPayments = useMemo(
    () => summary?.recentPayments.filter((payment) => payment.status === "pending") || [],
    [summary],
  );

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);

  const formatDate = (value?: string) => {
    if (!value) {
      return labels.noMembership;
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
  };

  return (
    <ConsoleShell
      crumbs={[
        { label: labels.overview, href: "/dashboard" },
        { label: labels.billing },
      ]}
      title={labels.title}
      description={labels.description}
      actions={
        <>
          <Button size="sm" variant="outline" asChild>
            <Link href="/pricing">{labels.comparePlans}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/payment">{labels.manageSubscription}</Link>
          </Button>
        </>
      }
    >
      {loading ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {isEn ? "Loading billing summary..." : "正在加载账单概览..."}
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50 shadow-sm">
          <CardContent className="p-6 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingPayments.length ? (
            <Card className="border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-6 text-sm text-amber-900 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-medium">
                    {isEn
                      ? `You still have ${pendingPayments.length} pending payment${pendingPayments.length > 1 ? "s" : ""}.`
                      : `当前仍有 ${pendingPayments.length} 笔待处理支付。`}
                  </p>
                  <p className="mt-1 text-amber-800">
                    {isEn
                      ? "Continue checkout or cancel unfinished flows in the main payment center."
                      : "你可以前往主支付中心继续支付，或处理未完成的支付流程。"}
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href="/payment">{labels.manageSubscription}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  {labels.currentPlan}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <p className="text-2xl font-semibold uppercase">
                    {summary?.plan || user?.subscription_plan || "free"}
                  </p>
                  <Badge variant="secondary">{summary?.status || "inactive"}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  {labels.totalSpent}
                </div>
                <p className="mt-3 text-2xl font-semibold">
                  {formatCurrency(summary?.totalSpent || 0, summary?.currency || "USD")}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                  {labels.payments}
                </div>
                <p className="mt-3 text-2xl font-semibold">{summary?.totalPayments || 0}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  {labels.membershipExpires}
                </div>
                <p className="mt-3 text-lg font-semibold">{formatDate(summary?.membershipExpiresAt)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{labels.summaryTitle}</CardTitle>
                <CardDescription>{labels.summaryDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                    <p className="text-sm text-muted-foreground">{labels.paymentMethod}</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {summary?.paymentMethod || (isEn ? "Not configured" : "未配置")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                    <p className="text-sm text-muted-foreground">{labels.billingCycle}</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {summary?.billingCycle
                        ? summary.billingCycle.toUpperCase()
                        : isEn
                          ? "N/A"
                          : "暂无"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                    <p className="text-sm text-muted-foreground">{labels.lastPayment}</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatDate(summary?.lastPaymentAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                    <p className="text-sm text-muted-foreground">{labels.pendingPayments}</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{pendingPayments.length}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {isEn ? "Main Payment Operations" : "主支付操作"}
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {isEn
                          ? "Checkout, renewals, subscription changes, and payment-specific actions continue in the main payment center."
                          : "结算、续费、订阅变更与支付动作仍在主支付中心完成。"}
                      </p>
                    </div>
                    <Button asChild>
                      <Link href="/payment">{labels.manageSubscription}</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{labels.recentPaymentsTitle}</CardTitle>
                <CardDescription>{labels.recentPaymentsDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                {summary?.recentPayments?.length ? (
                  <div className="space-y-3">
                    {summary.recentPayments.slice(0, 4).map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{payment.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(payment.date)} · {payment.paymentMethod}
                            </p>
                          </div>
                          <Badge
                            variant={payment.status === "paid" ? "secondary" : "outline"}
                            className="uppercase"
                          >
                            {payment.status}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm font-medium">
                          {formatCurrency(payment.amount, payment.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{labels.noPaymentHistory}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>{labels.paymentHistoryTitle}</CardTitle>
              <CardDescription>{labels.paymentHistoryDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <BillingHistory userId={user?.id || ""} />
            </CardContent>
          </Card>
        </div>
      )}
    </ConsoleShell>
  );
}
