'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Filter,
  Download,
  TrendingUp,
  Users,
  DollarSign,
  RefreshCw,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

type AdminTab = 'subscriptions' | 'payments';

type Stats = {
  activeCount: number;
  mrr: number;
  renewalRate: number;
  churnCount: number;
  baseCurrency: string;
};

type SubscriptionItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  plan: string;
  price: number;
  currency: string;
  billingCycle: string;
  status: string;
  paymentMethod: string;
  currentPeriodEnd: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type PaymentItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subscriptionId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  transactionId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  type: 'subscription';
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const EMPTY_STATS: Stats = {
  activeCount: 0,
  mrr: 0,
  renewalRate: 0,
  churnCount: 0,
  baseCurrency: 'USD',
};

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

export default function SubscriptionsPage() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';

  const [tab, setTab] = useState<AdminTab>('subscriptions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);

  const statusOptions = useMemo(
    () =>
      tab === 'subscriptions'
        ? [
            { value: 'all', label: isEn ? 'All Status' : '全部状态' },
            { value: 'active', label: isEn ? 'Active' : '有效' },
            { value: 'inactive', label: isEn ? 'Inactive' : '未生效' },
            { value: 'paused', label: isEn ? 'Paused' : '已暂停' },
            { value: 'cancelled', label: isEn ? 'Cancelled' : '已取消' },
            { value: 'expired', label: isEn ? 'Expired' : '已过期' },
          ]
        : [
            { value: 'all', label: isEn ? 'All Status' : '全部状态' },
            { value: 'completed', label: isEn ? 'Completed' : '成功' },
            { value: 'pending', label: isEn ? 'Pending' : '处理中' },
            { value: 'failed', label: isEn ? 'Failed' : '失败' },
            { value: 'refunded', label: isEn ? 'Refunded' : '已退款' },
          ],
    [isEn, tab],
  );

  const getAuthHeaders = useCallback(async () => {
    const { tokenManager } = await import('@/lib/auth/frontend-token-manager');
    const authHeaders = await tokenManager.getAuthHeaderAsync();
    if (!authHeaders) {
      throw new Error(isEn ? 'Please sign in again.' : '请重新登录后再试。');
    }
    return authHeaders;
  }, [isEn]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        tab,
        page: page.toString(),
        limit: '20',
      });

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/admin/subscriptions?${params.toString()}`, {
        headers,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            (isEn ? 'Failed to load subscription data.' : '加载订阅数据失败。'),
        );
      }

      setStats(result.data.stats || EMPTY_STATS);
      setPagination(result.data.pagination || EMPTY_PAGINATION);

      if (tab === 'subscriptions') {
        setSubscriptions(result.data.items || []);
      } else {
        setPayments(result.data.items || []);
      }
    } catch (fetchError) {
      console.error('Failed to load admin subscriptions:', fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : isEn
            ? 'Failed to load subscription data.'
            : '加载订阅数据失败。',
      );
      if (tab === 'subscriptions') {
        setSubscriptions([]);
      } else {
        setPayments([]);
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, isEn, page, statusFilter, tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [tab, statusFilter]);

  useEffect(() => {
    setStatusFilter('all');
  }, [tab]);

  const filteredSubscriptions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return subscriptions;
    }

    return subscriptions.filter((item) =>
      [
        item.userName,
        item.userEmail,
        item.plan,
        item.paymentMethod,
        item.id,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [searchQuery, subscriptions]);

  const filteredPayments = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return payments;
    }

    return payments.filter((item) =>
      [
        item.userName,
        item.userEmail,
        item.transactionId || '',
        item.paymentMethod,
        item.id,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [payments, searchQuery]);

  const exportCurrentView = useCallback(() => {
    const data = tab === 'subscriptions' ? filteredSubscriptions : filteredPayments;
    const fileName =
      tab === 'subscriptions'
        ? 'admin-subscriptions.json'
        : 'admin-payments.json';

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredPayments, filteredSubscriptions, tab]);

  const formatDate = useCallback(
    (value: string | null) => {
      if (!value) {
        return isEn ? 'Not set' : '未设置';
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }

      return parsed.toLocaleString(locale);
    },
    [isEn, locale],
  );

  const formatCurrency = useCallback(
    (amount: number, currency: string) => {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currency || stats.baseCurrency || 'USD',
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${currency || stats.baseCurrency || 'USD'} ${amount.toFixed(2)}`;
      }
    },
    [locale, stats.baseCurrency],
  );

  const getPlanBadge = (plan: string) => {
    const styles: Record<string, string> = {
      free: 'bg-gray-100 text-gray-700',
      pro: 'bg-blue-100 text-blue-700',
      enterprise: 'bg-amber-100 text-amber-700',
    };
    const labels: Record<string, string> = {
      free: isEn ? 'Free' : '免费版',
      pro: 'Pro',
      enterprise: isEn ? 'Enterprise' : '企业版',
    };

    return (
      <span className={`rounded-full px-2 py-1 text-xs ${styles[plan] || 'bg-gray-100 text-gray-700'}`}>
        {labels[plan] || plan}
      </span>
    );
  };

  const getSubscriptionStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-slate-100 text-slate-700',
      paused: 'bg-amber-100 text-amber-700',
      cancelled: 'bg-red-100 text-red-700',
      canceled: 'bg-red-100 text-red-700',
      expired: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = {
      active: isEn ? 'Active' : '有效',
      inactive: isEn ? 'Inactive' : '未生效',
      paused: isEn ? 'Paused' : '已暂停',
      cancelled: isEn ? 'Cancelled' : '已取消',
      canceled: isEn ? 'Cancelled' : '已取消',
      expired: isEn ? 'Expired' : '已过期',
    };

    return (
      <span className={`rounded-full px-2 py-1 text-xs ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      pending: 'bg-amber-100 text-amber-700',
      failed: 'bg-red-100 text-red-700',
      refunded: 'bg-slate-100 text-slate-700',
    };
    const labels: Record<string, string> = {
      completed: isEn ? 'Completed' : '成功',
      pending: isEn ? 'Pending' : '处理中',
      failed: isEn ? 'Failed' : '失败',
      refunded: isEn ? 'Refunded' : '已退款',
    };

    return (
      <span className={`rounded-full px-2 py-1 text-xs ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      wechat: isEn ? 'WeChat Pay' : '微信支付',
      alipay: 'Alipay',
      stripe: 'Stripe',
      paypal: 'PayPal',
      card: isEn ? 'Card' : '银行卡',
    };

    return labels[method?.toLowerCase?.() || ''] || method || '-';
  };

  const dataCount =
    tab === 'subscriptions' ? filteredSubscriptions.length : filteredPayments.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isEn ? 'Subscription Management' : '订阅管理'}
          </h1>
          <p className="text-gray-500">
            {isEn
              ? 'Review subscriptions, revenue trends, and payment records.'
              : '查看订阅状态、营收趋势和支付记录。'}
          </p>
        </div>
        <Button variant="outline" onClick={exportCurrentView}>
          <Download className="mr-2 h-4 w-4" />
          {isEn ? 'Export Current View' : '导出当前列表'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Active Subscriptions' : '有效订阅数'}
            </CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
            <p className="text-xs text-gray-500">
              {isEn ? 'Current paying accounts' : '当前付费账户'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Monthly MRR' : '月度 MRR'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.mrr, stats.baseCurrency)}
            </div>
            <p className="flex items-center gap-1 text-xs text-gray-500">
              <TrendingUp className="h-3 w-3" />
              {isEn ? 'Normalized monthly recurring revenue' : '按月折算后的经常性收入'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Renewal Rate' : '续费率'}
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.renewalRate}%</div>
            <p className="text-xs text-gray-500">
              {isEn ? 'Based on current active subscriptions' : '基于当前有效订阅占比'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Churned Users' : '流失用户数'}
            </CardTitle>
            <XCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.churnCount}</div>
            <p className="text-xs text-gray-500">
              {isEn ? 'Cancelled or expired subscriptions' : '已取消或已过期订阅'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as AdminTab)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="subscriptions">
            {isEn ? 'Subscriptions' : '订阅列表'}
          </TabsTrigger>
          <TabsTrigger value="payments">
            {isEn ? 'Payments' : '支付记录'}
          </TabsTrigger>
        </TabsList>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder={
                    tab === 'subscriptions'
                      ? isEn
                        ? 'Search by user, email, plan, or subscription ID...'
                        : '按用户、邮箱、方案或订阅 ID 搜索...'
                      : isEn
                        ? 'Search by user, email, transaction ID...'
                        : '按用户、邮箱或交易 ID 搜索...'
                  }
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card>
            <CardContent className="py-10 text-sm text-red-600">{error}</CardContent>
          </Card>
        ) : null}

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {isEn ? 'Subscription List' : '订阅列表'}
              </CardTitle>
              <CardDescription>
                {isEn
                  ? `Showing ${dataCount} items on this page.`
                  : `当前页显示 ${dataCount} 条数据。`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredSubscriptions.length === 0 ? (
                <div className="py-16 text-center text-gray-500">
                  {isEn ? 'No subscriptions found.' : '暂无订阅数据。'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEn ? 'User' : '用户'}</TableHead>
                      <TableHead>{isEn ? 'Plan' : '方案'}</TableHead>
                      <TableHead>{isEn ? 'Price' : '价格'}</TableHead>
                      <TableHead>{isEn ? 'Cycle' : '周期'}</TableHead>
                      <TableHead>{isEn ? 'Payment Method' : '支付方式'}</TableHead>
                      <TableHead>{isEn ? 'Next Renewal' : '下次续费'}</TableHead>
                      <TableHead>{isEn ? 'Status' : '状态'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.userName || '-'}</p>
                            <p className="text-sm text-gray-500">{item.userEmail || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getPlanBadge(item.plan)}</TableCell>
                        <TableCell>{formatCurrency(item.price, item.currency)}</TableCell>
                        <TableCell>
                          {item.billingCycle === 'yearly'
                            ? isEn
                              ? 'Yearly'
                              : '年付'
                            : isEn
                              ? 'Monthly'
                              : '月付'}
                        </TableCell>
                        <TableCell>{getPaymentMethodLabel(item.paymentMethod)}</TableCell>
                        <TableCell className="text-gray-500">
                          {formatDate(item.currentPeriodEnd)}
                        </TableCell>
                        <TableCell>{getSubscriptionStatusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Payment Records' : '支付记录'}</CardTitle>
              <CardDescription>
                {isEn
                  ? `Showing ${dataCount} items on this page.`
                  : `当前页显示 ${dataCount} 条数据。`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="py-16 text-center text-gray-500">
                  {isEn ? 'No payment records found.' : '暂无支付记录。'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEn ? 'Transaction ID' : '交易号'}</TableHead>
                      <TableHead>{isEn ? 'User' : '用户'}</TableHead>
                      <TableHead>{isEn ? 'Amount' : '金额'}</TableHead>
                      <TableHead>{isEn ? 'Type' : '类型'}</TableHead>
                      <TableHead>{isEn ? 'Method' : '支付方式'}</TableHead>
                      <TableHead>{isEn ? 'Created At' : '创建时间'}</TableHead>
                      <TableHead>{isEn ? 'Status' : '状态'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">
                          {item.transactionId || item.id}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.userName || '-'}</p>
                            <p className="text-sm text-gray-500">{item.userEmail || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(item.amount, item.currency)}</TableCell>
                        <TableCell>{isEn ? 'Subscription' : '订阅'}</TableCell>
                        <TableCell>{getPaymentMethodLabel(item.paymentMethod)}</TableCell>
                        <TableCell className="text-gray-500">
                          {formatDate(item.createdAt)}
                        </TableCell>
                        <TableCell>{getPaymentStatusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <p>
          {isEn
            ? `Total ${pagination.total} records, page ${pagination.page} of ${pagination.totalPages}`
            : `共 ${pagination.total} 条记录，第 ${pagination.page} / ${pagination.totalPages} 页`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || pagination.page <= 1}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
          >
            {isEn ? 'Previous' : '上一页'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() =>
              setPage((current) => Math.min(current + 1, pagination.totalPages))
            }
          >
            {isEn ? 'Next' : '下一页'}
          </Button>
        </div>
      </div>
    </div>
  );
}
