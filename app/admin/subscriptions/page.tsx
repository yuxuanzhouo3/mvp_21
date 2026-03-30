'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';

import { adminFetchJson } from '@/lib/admin/client';
import { useLanguage } from '@/components/language-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

type SubscriptionForm = {
  userId: string;
  userName: string;
  userEmail: string;
  plan: string;
  status: string;
  price: string;
  currency: string;
  billingCycle: string;
  paymentMethod: string;
  currentPeriodEnd: string;
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

const EMPTY_FORM: SubscriptionForm = {
  userId: '',
  userName: '',
  userEmail: '',
  plan: 'free',
  status: 'inactive',
  price: '0',
  currency: 'USD',
  billingCycle: 'monthly',
  paymentMethod: 'manual',
  currentPeriodEnd: '',
};

export default function SubscriptionsPage() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';

  const [tab, setTab] = useState<AdminTab>('subscriptions');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SubscriptionForm>(EMPTY_FORM);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        tab,
        page: String(page),
        limit: '20',
      });

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const result = await adminFetchJson<{
        success: true;
        data: {
          items: SubscriptionItem[] | PaymentItem[];
          stats?: Stats;
          pagination?: Pagination;
        };
      }>(`/api/admin/subscriptions?${params.toString()}`);

      setStats(result.data.stats || EMPTY_STATS);
      setPagination(result.data.pagination || EMPTY_PAGINATION);

      if (tab === 'subscriptions') {
        setSubscriptions((result.data.items || []) as SubscriptionItem[]);
      } else {
        setPayments((result.data.items || []) as PaymentItem[]);
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : isEn
            ? 'Failed to load subscription management data.'
            : '加载订阅管理数据失败。',
      );
      setSubscriptions([]);
      setPayments([]);
      setPagination(EMPTY_PAGINATION);
    } finally {
      setLoading(false);
    }
  }, [isEn, page, statusFilter, tab]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [tab, statusFilter]);

  const formatDate = useCallback(
    (value: string | null) => {
      if (!value) {
        return isEn ? 'Not set' : '未设置';
      }

      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(locale);
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

  const filteredSubscriptions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return subscriptions;
    }

    return subscriptions.filter((item) =>
      [item.userName, item.userEmail, item.plan, item.paymentMethod, item.id]
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
      [item.userName, item.userEmail, item.transactionId || '', item.paymentMethod, item.id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [payments, searchQuery]);

  const exportCurrentView = useCallback(() => {
    const data = tab === 'subscriptions' ? filteredSubscriptions : filteredPayments;
    const fileName = tab === 'subscriptions' ? 'admin-subscriptions.json' : 'admin-payments.json';

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

  const getPlanBadge = (plan: string) => {
    const labelMap: Record<string, string> = {
      free: isEn ? 'Free' : '免费',
      pro: 'Pro',
      enterprise: isEn ? 'Enterprise' : '企业版',
    };
    const variant: 'default' | 'secondary' | 'outline' =
      plan === 'enterprise' ? 'default' : plan === 'pro' ? 'secondary' : 'outline';

    return <Badge variant={variant}>{labelMap[plan] || plan}</Badge>;
  };

  const getStatusBadge = (value: string) => {
    const normalized = value?.toLowerCase?.() || 'inactive';
    const variant: 'default' | 'outline' | 'destructive' =
      normalized === 'active' || normalized === 'completed'
        ? 'default'
        : normalized === 'failed' || normalized === 'cancelled' || normalized === 'canceled'
          ? 'destructive'
          : 'outline';
    const labelMap: Record<string, string> = {
      active: isEn ? 'Active' : '有效',
      inactive: isEn ? 'Inactive' : '未生效',
      paused: isEn ? 'Paused' : '已暂停',
      cancelled: isEn ? 'Cancelled' : '已取消',
      canceled: isEn ? 'Cancelled' : '已取消',
      expired: isEn ? 'Expired' : '已过期',
      completed: isEn ? 'Completed' : '成功',
      pending: isEn ? 'Pending' : '处理中',
      failed: isEn ? 'Failed' : '失败',
      refunded: isEn ? 'Refunded' : '已退款',
    };

    return <Badge variant={variant}>{labelMap[normalized] || normalized}</Badge>;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      wechat: isEn ? 'WeChat Pay' : '微信支付',
      alipay: 'Alipay',
      stripe: 'Stripe',
      paypal: 'PayPal',
      card: isEn ? 'Card' : '银行卡',
      manual: isEn ? 'Manual' : '人工处理',
    };

    return labels[method?.toLowerCase?.() || ''] || method || '-';
  };

  const openEditDialog = (item: SubscriptionItem) => {
    setForm({
      userId: item.userId,
      userName: item.userName,
      userEmail: item.userEmail,
      plan: item.plan || 'free',
      status: item.status || 'inactive',
      price: String(item.price || 0),
      currency: item.currency || stats.baseCurrency || 'USD',
      billingCycle: item.billingCycle || 'monthly',
      paymentMethod: item.paymentMethod || 'manual',
      currentPeriodEnd: item.currentPeriodEnd ? item.currentPeriodEnd.slice(0, 16) : '',
    });
    setDialogOpen(true);
  };

  const updateForm = (key: keyof SubscriptionForm, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const saveSubscription = async () => {
    if (!form.userId) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await adminFetchJson('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: form.userId,
          plan: form.plan,
          status: form.status,
          price: Number(form.price || 0),
          currency: form.currency,
          billingCycle: form.billingCycle,
          paymentMethod: form.paymentMethod,
          currentPeriodEnd: form.currentPeriodEnd
            ? new Date(form.currentPeriodEnd).toISOString()
            : null,
        }),
      });

      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await fetchData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : isEn
            ? 'Failed to save subscription.'
            : '保存订阅失败。',
      );
    } finally {
      setSaving(false);
    }
  };

  const dataCount = tab === 'subscriptions' ? filteredSubscriptions.length : filteredPayments.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'Subscription Management' : '订阅管理'}</h1>
          <p className="text-muted-foreground">
            {isEn
              ? 'Review real subscription data, adjust plans, and validate billing records.'
              : '核对订阅真实数据、调整套餐状态，并验收支付记录。'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {isEn ? 'Refresh' : '刷新'}
          </Button>
          <Button variant="outline" onClick={exportCurrentView}>
            <Download className="mr-2 h-4 w-4" />
            {isEn ? 'Export Current View' : '导出当前视图'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border bg-card/60 p-4 text-sm text-muted-foreground">
        {isEn
          ? 'Data source: unified subscriptions/payments models. Subscription edits sync the latest plan status back to the user profile metadata.'
          : '数据来源：统一的 subscriptions / payments 模型。订阅编辑会把最新套餐状态同步回用户资料元数据。'}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Active Subscriptions' : '有效订阅'}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Monthly MRR' : '月度 MRR'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.mrr, stats.baseCurrency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Renewal Rate' : '续费率'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.renewalRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Churned Users' : '流失用户'}
            </CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.churnCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as AdminTab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscriptions">{isEn ? 'Subscriptions' : '订阅列表'}</TabsTrigger>
          <TabsTrigger value="payments">{isEn ? 'Payments' : '支付记录'}</TabsTrigger>
        </TabsList>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={
                    tab === 'subscriptions'
                      ? isEn
                        ? 'Search user, email, plan, or subscription ID...'
                        : '按用户、邮箱、套餐或订阅 ID 搜索...'
                      : isEn
                        ? 'Search user, email, or transaction ID...'
                        : '按用户、邮箱或交易 ID 搜索...'
                  }
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-52">
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

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? 'Subscription List' : '订阅列表'}</CardTitle>
              <CardDescription>
                {isEn
                  ? `Showing ${dataCount} items on this page.`
                  : `当前页展示 ${dataCount} 条订阅记录。`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredSubscriptions.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  {isEn ? 'No subscriptions found.' : '暂无订阅数据。'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEn ? 'User' : '用户'}</TableHead>
                      <TableHead>{isEn ? 'Plan' : '套餐'}</TableHead>
                      <TableHead>{isEn ? 'Price' : '价格'}</TableHead>
                      <TableHead>{isEn ? 'Cycle' : '周期'}</TableHead>
                      <TableHead>{isEn ? 'Payment Method' : '支付方式'}</TableHead>
                      <TableHead>{isEn ? 'Next Renewal' : '下次续费'}</TableHead>
                      <TableHead>{isEn ? 'Status' : '状态'}</TableHead>
                      <TableHead className="text-right">{isEn ? 'Actions' : '操作'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.userName || '-'}</p>
                            <p className="text-sm text-muted-foreground">{item.userEmail || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getPlanBadge(item.plan)}</TableCell>
                        <TableCell>{formatCurrency(item.price, item.currency)}</TableCell>
                        <TableCell>{item.billingCycle === 'yearly' ? (isEn ? 'Yearly' : '年付') : isEn ? 'Monthly' : '月付'}</TableCell>
                        <TableCell>{getPaymentMethodLabel(item.paymentMethod)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(item.currentPeriodEnd)}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {isEn ? 'Edit' : '编辑'}
                          </Button>
                        </TableCell>
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
                  : `当前页展示 ${dataCount} 条支付记录。`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  {isEn ? 'No payment records found.' : '暂无支付记录。'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isEn ? 'Transaction ID' : '交易号'}</TableHead>
                      <TableHead>{isEn ? 'User' : '用户'}</TableHead>
                      <TableHead>{isEn ? 'Amount' : '金额'}</TableHead>
                      <TableHead>{isEn ? 'Method' : '支付方式'}</TableHead>
                      <TableHead>{isEn ? 'Created At' : '创建时间'}</TableHead>
                      <TableHead>{isEn ? 'Status' : '状态'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.transactionId || item.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.userName || '-'}</p>
                            <p className="text-sm text-muted-foreground">{item.userEmail || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(item.amount, item.currency)}</TableCell>
                        <TableCell>{getPaymentMethodLabel(item.paymentMethod)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {isEn
            ? `Total ${pagination.total} records, page ${pagination.page} of ${pagination.totalPages}.`
            : `共 ${pagination.total} 条记录，第 ${pagination.page} / ${pagination.totalPages} 页。`}
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
            onClick={() => setPage((current) => Math.min(current + 1, pagination.totalPages))}
          >
            {isEn ? 'Next' : '下一页'}
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{isEn ? 'Edit Subscription' : '编辑订阅'}</DialogTitle>
            <DialogDescription>
              {isEn
                ? 'This updates the latest unified subscription record and syncs the user metadata.'
                : '这里会更新统一订阅记录，并同步用户资料中的会员状态。'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{isEn ? 'User' : '用户'}</Label>
              <Input value={form.userName} disabled />
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Email' : '邮箱'}</Label>
              <Input value={form.userEmail} disabled />
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Plan' : '套餐'}</Label>
              <Select value={form.plan} onValueChange={(value) => updateForm('plan', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">{isEn ? 'Free' : '免费'}</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">{isEn ? 'Enterprise' : '企业版'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Status' : '状态'}</Label>
              <Select value={form.status} onValueChange={(value) => updateForm('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{isEn ? 'Active' : '有效'}</SelectItem>
                  <SelectItem value="inactive">{isEn ? 'Inactive' : '未生效'}</SelectItem>
                  <SelectItem value="paused">{isEn ? 'Paused' : '已暂停'}</SelectItem>
                  <SelectItem value="cancelled">{isEn ? 'Cancelled' : '已取消'}</SelectItem>
                  <SelectItem value="expired">{isEn ? 'Expired' : '已过期'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Price' : '价格'}</Label>
              <Input value={form.price} onChange={(event) => updateForm('price', event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Currency' : '币种'}</Label>
              <Input value={form.currency} onChange={(event) => updateForm('currency', event.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Billing Cycle' : '计费周期'}</Label>
              <Select value={form.billingCycle} onValueChange={(value) => updateForm('billingCycle', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{isEn ? 'Monthly' : '月付'}</SelectItem>
                  <SelectItem value="yearly">{isEn ? 'Yearly' : '年付'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Payment Method' : '支付方式'}</Label>
              <Input value={form.paymentMethod} onChange={(event) => updateForm('paymentMethod', event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{isEn ? 'Current Period End' : '本周期结束时间'}</Label>
            <Input
              type="datetime-local"
              value={form.currentPeriodEnd}
              onChange={(event) => updateForm('currentPeriodEnd', event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {isEn ? 'Cancel' : '取消'}
            </Button>
            <Button onClick={() => void saveSubscription()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEn ? 'Save Subscription' : '保存订阅'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
