"use client";

/**
 * 绠＄悊鍚庡彴 - 鏀粯璁板綍绠＄悊椤甸潰
 *
 * 瀹屾暣鍔熻兘锛?
 * - 鏀粯璁板綍鍒楄〃灞曠ず锛堟敮鎸佸垎椤碉級
 * - 鎼滅储鍜岀瓫閫?
 * - 鏌ョ湅鏀粯璇︽儏
 * - 鏀粯缁熻灞曠ず
 * - 鏀跺叆鍒嗘瀽
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  listPayments,
  getPaymentById,
  getPaymentStats,
} from "@/actions/admin-payments";
import type { Payment } from "@/lib/admin/types";
import { getAvailablePaymentMethods, getPaymentMethodConfig } from "@/lib/utils/payment-methods";
import { RegionConfig } from "@/lib/config/region";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  TrendingUp,
  Calendar,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownCircle,
} from "lucide-react";

export default function PaymentsManagementPage() {
  // ==================== 鐘舵€佺鐞?====================
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  // 鍒嗛〉鐘舵€?
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 绛涢€夌姸鎬?
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // ==================== 绛涢€夊悗鐨勬敮浠樺垪琛?====================
  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (filterStatus !== "all") {
        if (filterStatus === "paid" || filterStatus === "completed") {
          if (payment.status !== "paid" && payment.status !== "completed") {
            return false;
          }
        } else if (payment.status !== filterStatus) {
          return false;
        }
      }
      if (filterMethod !== "all" && payment.method !== filterMethod) {
        return false;
      }
      if (filterType !== "all" && payment.type !== filterType) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          payment.user_email?.toLowerCase().includes(query) ||
          payment.order_id?.toLowerCase().includes(query) ||
          payment.id.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [payments, filterStatus, filterMethod, filterType, searchQuery]);

  // ==================== 鏁版嵁鍔犺浇 ====================
  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const offset = (page - 1) * pageSize;
      const result = await listPayments({
        limit: pageSize,
        offset,
      });

      if (result.success && result.data) {
        setPayments(result.data.items);
        setTotal(result.data.total);
      } else {
        setError("error" in result ? result.error : "鍔犺浇澶辫触");
      }
    } catch (err) {
      setError("鍔犺浇鏀粯璁板綍澶辫触");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const result = await getPaymentStats();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (err) {
      console.error("鍔犺浇缁熻澶辫触:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

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
            宸插畬鎴?
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-600 gap-1">
            <Clock className="h-3 w-3" />
            寰呭鐞?
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            澶辫触
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="outline" className="gap-1">
            <ArrowDownCircle className="h-3 w-3" />
            宸查€€娆?
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
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  }

  function formatDate(dateStr: string | undefined) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDateOnly(dateStr: string | undefined) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  // ==================== 鍒嗛〉 ====================
  const totalPages = Math.ceil(total / pageSize);

  // ==================== 娓叉煋 ====================
  return (
    <div className="space-y-6">
      {/* 椤靛ご */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">鏀粯璁板綍绠＄悊</h1>
          <p className="text-sm text-muted-foreground mt-1">
            鏌ョ湅鍜岀鐞嗘墍鏈夋敮浠樿褰曪紝鍏?{total} 鏉¤褰?
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPayments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            鍒锋柊
          </Button>
        </div>
      </div>

      {/* 閿欒鎻愮ず */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 缁熻鍗＄墖 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statsLoading ? (
          // 楠ㄦ灦灞忥細鍔犺浇鏃舵樉绀?
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
          // 鏁版嵁鍔犺浇瀹屾垚锛氭樉绀哄疄闄呮暟鎹?
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  鎬绘敮浠樻暟
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  鎬昏鍗曟暟
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  鏈湀鏀粯
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.thisMonth}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  浠婃棩鏀粯
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.today}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  鎬绘敹鍏?
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

      {/* 鏀跺叆鍒嗘瀽鍗＄墖 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            鎸夋敮浠樻柟寮忕粺璁℃敹鍏?
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            // 楠ㄦ灦灞忥細鍔犺浇鏃舵樉绀?
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
            // 鏁版嵁鍔犺浇瀹屾垚锛氭樉绀哄疄闄呮暟鎹?
            <div className="grid grid-cols-2 gap-4">
              {getAvailablePaymentMethods().map((method) => {
                const config = getPaymentMethodConfig(method);
                const amount = stats.byMethod[method] || 0;
                const currency = RegionConfig.payment.currency;
                const colorClass = config.color.replace('bg-', '');

                return (
                  <div key={method} className={`flex items-center gap-3 p-3 bg-${colorClass.split('-')[0]}-50 dark:bg-${colorClass.split('-')[0]}-950 rounded-lg`}>
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

      {/* 鎼滅储鍜岀瓫閫夋爮 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="鎼滅储鐢ㄦ埛閭鎴栬鍗旾D..."
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
                <SelectValue placeholder="鏀粯鏂瑰紡" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">鍏ㄩ儴鏂瑰紡</SelectItem>
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
                <SelectValue placeholder="鏀粯绫诲瀷" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">鍏ㄩ儴绫诲瀷</SelectItem>
                <SelectItem value="subscription">璁㈤槄</SelectItem>
                <SelectItem value="tokens">浠ｅ竵</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>

            {/* 娓呴櫎绛涢€?*/}
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
                娓呴櫎绛涢€?
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 鏀粯璁板綍鍒楄〃 */}
      <Card>
        <CardHeader>
          <CardTitle>鏀粯璁板綍鍒楄〃</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery || filterStatus !== "all" || filterMethod !== "all" || filterType !== "all"
                ? "娌℃湁绗﹀悎绛涢€夋潯浠剁殑鏀粯璁板綍"
                : "鏆傛棤鏀粯璁板綍"}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">璁㈠崟ID</TableHead>
                      <TableHead>鐢ㄦ埛</TableHead>
                      <TableHead>閲戦</TableHead>
                      <TableHead>鏀粯鏂瑰紡</TableHead>
                      <TableHead>绫诲瀷</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>鍒涘缓鏃堕棿</TableHead>
                      <TableHead>瀹屾垚鏃堕棿</TableHead>
                      <TableHead className="text-right">鎿嶄綔</TableHead>
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
                                {payment.user_email || "鏈煡鐢ㄦ埛"}
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
                            title="鏌ョ湅璇︽儏"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 鍒嗛〉 */}
              {total > pageSize && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    鏄剧ず绗?{(page - 1) * pageSize + 1} -{" "}
                    {Math.min(page * pageSize, total)} 鏉★紝鍏?{total} 鏉?
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      涓婁竴椤?
                    </Button>
                    <div className="text-sm">
                      绗?<span className="font-medium">{page}</span> /{" "}
                      <span>{totalPages}</span> 椤?
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      涓嬩竴椤?
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 鏌ョ湅鏀粯璇︽儏瀵硅瘽妗?*/}
      <Dialog open={!!viewingPayment} onOpenChange={() => setViewingPayment(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>鏀粯璇︽儏</DialogTitle>
          </DialogHeader>
          {viewingPayment && (
            <div className="space-y-6">
              {/* 鍩烘湰淇℃伅 */}
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

              {/* 鏃堕棿绾?*/}
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
              鍏抽棴
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}





