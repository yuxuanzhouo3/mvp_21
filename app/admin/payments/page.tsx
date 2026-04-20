"use client";

/**
 * 管理后台 - 支付记录管理页面
 *
 * 功能：
 * - 支付记录列表（支持分页）
 * - 搜索和筛选
 * - 查看支付详情
 * - 支付统计展示
 * - 收入分析
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  listPayments,
  getPaymentStats,
} from "@/actions/admin-payments";
import type { Payment } from "@/lib/admin/types";
import { getAvailablePaymentMethods, getPaymentMethodConfig } from "@/lib/utils/payment-methods";
import { RegionConfig, isChinaRegion } from "@/lib/config/region";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Calendar,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownCircle,
} from "lucide-react";

function getRegion(): "CN" | "INTL" {
  return isChinaRegion() ? "CN" : "INTL";
}

const isIntlRegion = getRegion() === "INTL";
const tx = (zh: string, en: string) => (isIntlRegion ? en : zh);

export default function PaymentsManagementPage() {
  // ==================== 状态管理 ====================
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // ==================== 筛选后的支付列表 ====================
  const filteredPayments = useMemo(() => {
    if (!searchQuery) {
      return payments;
    }

    const query = searchQuery.toLowerCase();

    return payments.filter((payment) => {
      return (
        payment.user_email?.toLowerCase().includes(query) ||
        payment.order_id?.toLowerCase().includes(query) ||
        payment.id.toLowerCase().includes(query)
      );
    });
  }, [payments, searchQuery]);

  // ==================== 数据加载 ====================
  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const offset = (page - 1) * pageSize;
      const result = await listPayments({
        status: filterStatus === "all" ? undefined : (filterStatus as any),
        method: filterMethod === "all" ? undefined : (filterMethod as any),
        type: filterType === "all" ? undefined : (filterType as any),
        limit: pageSize,
        offset,
      });

      if (result.success && result.data) {
        setPayments(result.data.items);
        setTotal(result.data.total);
      } else {
        setError("error" in result ? result.error : tx("加载失败", "Failed to load records"));
      }
    } catch (err) {
      setError(tx("加载支付记录失败", "Failed to load payments"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterStatus, filterMethod, filterType]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const result = await getPaymentStats();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (err) {
      console.error("Failed to load payment stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterMethod, filterType]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // ==================== 宸ュ叿鍑芥暟 ====================
  function getStatusBadge(status: string) {
    switch (status) {
      case "completed":
      case "paid":
        return (
          <Badge variant="default" className="bg-green-600 gap-1">
            <CheckCircle className="h-3 w-3" />
            {tx("已完成", "Completed")}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-600 gap-1">
            <Clock className="h-3 w-3" />
            {tx("待处理", "Pending")}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {tx("失败", "Failed")}
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="outline" className="gap-1">
            <ArrowDownCircle className="h-3 w-3" />
            {tx("已退款", "Refunded")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getMethodBadge(method: string) {
    const config = getPaymentMethodConfig(method);
    return (
      <Badge variant="secondary" className={`${config.color} gap-1`}>
        <span>{config.icon}</span>
        {config.label}
      </Badge>
    );
  }

  function getTypeBadge(type: string) {
    const typeConfig: Record<string, { label: string; variant: any }> = {
      subscription: { label: "Subscription", variant: "default" as const },
      tokens: { label: "Tokens", variant: "secondary" as const },
      pro: { label: "Pro", variant: "outline" as const },
    };

    const config = typeConfig[type] || { label: type, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  function formatAmount(amount: number, currency: string) {
    return new Intl.NumberFormat(isIntlRegion ? "en-US" : "zh-CN", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  }

  function formatDate(dateStr: string | undefined) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString(isIntlRegion ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDateOnly(dateStr: string | undefined) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString(isIntlRegion ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  // ==================== 分页 ====================
  const totalPages = Math.ceil(total / pageSize);

  // ==================== 渲染 ====================
  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tx("支付记录管理", "Payment Records")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tx("查看和管理所有支付记录，共", "Review and manage all payment records,")} {total} {tx("条记录", "records")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPayments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {tx("刷新", "Refresh")}
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statsLoading ? (
          // 骨架屏：加载中显示
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : stats ? (
          // 数据加载完成：显示真实数据
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tx("总支付数", "Total Payments")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tx("总订单数", "Total orders")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tx("本月支付", "This month")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.thisMonth}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tx("今日支付", "Today")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.today}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tx("总收入", "Total revenue")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatAmount(stats.totalRevenue, RegionConfig.payment.currency)}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* 收入分析卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {tx("按支付方式统计收入", "Revenue by payment method")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            // 骨架屏：加载中显示
            <div className="grid grid-cols-2 gap-4">
              {getAvailablePaymentMethods().map((method, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats ? (
            // 数据加载完成：显示真实数据
            <div className="grid grid-cols-2 gap-4">
              {getAvailablePaymentMethods().map((method) => {
                const config = getPaymentMethodConfig(method);
                const amount = stats.byMethod[method] || 0;
                const currency = RegionConfig.payment.currency;
                const methodCardClass =
                  method === "stripe"
                    ? "bg-blue-50 dark:bg-blue-950"
                    : method === "wechat"
                      ? "bg-green-50 dark:bg-green-950"
                      : method === "alipay"
                        ? "bg-sky-50 dark:bg-sky-950"
                        : "bg-muted";

                return (
                  <div key={method} className={`flex items-center gap-3 p-3 rounded-lg ${methodCardClass}`}>
                    <div className={`h-10 w-10 rounded-full ${config.color} flex items-center justify-center text-white`}>
                      {config.icon}
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{config.label}</div>
                      <div className="font-semibold">{formatAmount(amount, currency)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 搜索和筛选栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tx("搜索用户邮箱或订单 ID...", "Search email or order ID...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="paid">Paid (Legacy)</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={tx("支付方式", "Method")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("全部方式", "All methods")}</SelectItem>
                {getAvailablePaymentMethods().map((method) => {
                  const config = getPaymentMethodConfig(method);
                  return (
                    <SelectItem key={method} value={method}>
                      {config.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={tx("支付类型", "Payment type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("全部类型", "All types")}</SelectItem>
                <SelectItem value="subscription">{tx("订阅", "Subscription")}</SelectItem>
                <SelectItem value="tokens">{tx("代币", "Tokens")}</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>

            {/* 清除筛选 */}
            {(searchQuery || filterStatus !== "all" || filterMethod !== "all" || filterType !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                  setFilterMethod("all");
                  setFilterType("all");
                }}
              >
                {tx("清除筛选", "Clear filters")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 支付记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{tx("支付记录列表", "Payment List")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery || filterStatus !== "all" || filterMethod !== "all" || filterType !== "all"
                ? tx("没有符合筛选条件的支付记录", "No records match current filters")
                : tx("暂无支付记录", "No payment records yet")}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">订单 ID</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead>金额</TableHead>
                      <TableHead>支付方式</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>完成时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div className="font-mono text-xs">
                            {payment.order_id || payment.id.slice(0, 12)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Wallet className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                {payment.user_email || tx("未知用户", "Unknown user")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ID: {payment.user_id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">
                            {formatAmount(payment.amount, payment.currency)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getMethodBadge(payment.method)}
                        </TableCell>
                        <TableCell>
                          {getTypeBadge(payment.type)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(payment.status)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateOnly(payment.created_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateOnly(payment.completed_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewingPayment(payment)}
                            title={tx("查看详情", "View details")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

	              {/* 分页 */}
              {total > pageSize && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {tx("显示第", "Showing")} {(page - 1) * pageSize + 1} -{" "}
                    {Math.min(page * pageSize, total)} {tx("条，共", "of")} {total} {tx("条", "")}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {tx("上一页", "Previous")}
                    </Button>
                    <div className="text-sm">
                      {tx("第", "Page")} <span className="font-medium">{page}</span> /{" "}
                      <span>{totalPages}</span> {tx("页", "")}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      {tx("下一页", "Next")}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 查看支付详情对话框 */}
      <Dialog open={!!viewingPayment} onOpenChange={() => setViewingPayment(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{tx("支付详情", "Payment Details")}</DialogTitle>
          </DialogHeader>
          {viewingPayment && (
            <div className="space-y-6">
	              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Order ID:</span>
                  <div className="font-mono text-xs mt-1">{viewingPayment.order_id || viewingPayment.id}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">User ID:</span>
                  <div className="font-mono text-xs mt-1">{viewingPayment.user_id}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">User Email:</span>
                  <div className="mt-1">{viewingPayment.user_email || "Unknown"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <div className="mt-1 font-semibold text-lg">
                    {formatAmount(viewingPayment.amount, viewingPayment.currency)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Method:</span>
                  <div className="mt-1">{getMethodBadge(viewingPayment.method)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <div className="mt-1">{getTypeBadge(viewingPayment.type)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-1">{getStatusBadge(viewingPayment.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Product ID:</span>
                  <div className="mt-1">{viewingPayment.product_id || "-"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Created At:</span>
                  <div className="mt-1">{formatDate(viewingPayment.created_at)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed At:</span>
                  <div className="mt-1">{formatDate(viewingPayment.completed_at)}</div>
                </div>
              </div>

	              {/* 时间线 */}
              <div>
                <h3 className="text-sm font-medium mb-3">Payment Timeline</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">Order Created</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(viewingPayment.created_at)}
                        </div>
                    </div>
                  </div>
                  {viewingPayment.completed_at && (
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">Payment Completed</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(viewingPayment.completed_at)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewingPayment(null)}
            >
              {tx("关闭", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}





