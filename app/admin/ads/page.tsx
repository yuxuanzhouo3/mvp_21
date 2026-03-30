'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DollarSign,
  Eye,
  Loader2,
  MousePointer,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
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
import { Textarea } from '@/components/ui/textarea';

type AdStats = {
  totalImpressions: number;
  totalClicks: number;
  ctr: string;
  revenue: number;
};

type AdTrend = {
  date: string;
  impressions: number;
  clicks: number;
  ctr: string;
};

type AdRecord = {
  id: string;
  name: string;
  position: string;
  type: string;
  content: string;
  link: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  impressions?: number;
  clicks?: number;
  revenue?: number;
};

type AdFormState = {
  id?: string;
  name: string;
  position: string;
  type: string;
  content: string;
  link: string;
  status: string;
  start_date: string;
  end_date: string;
};

const EMPTY_FORM: AdFormState = {
  name: '',
  position: 'dashboard_top',
  type: 'banner',
  content: '',
  link: '',
  status: 'draft',
  start_date: '',
  end_date: '',
};

export default function AdsPage() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';

  const [stats, setStats] = useState<AdStats | null>(null);
  const [trend, setTrend] = useState<AdTrend[]>([]);
  const [items, setItems] = useState<AdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AdFormState>(EMPTY_FORM);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await adminFetchJson<{
        success: true;
        data: {
          stats: AdStats;
          trend: AdTrend[];
          items: AdRecord[];
        };
      }>('/api/admin/ads');

      setStats(result.data.stats);
      setTrend(result.data.trend || []);
      setItems(result.data.items || []);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : isEn
            ? 'Failed to load ad management data.'
            : '加载广告管理数据失败。',
      );
      setStats(null);
      setTrend([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const formatCurrency = useCallback(
    (amount: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: isEn ? 'USD' : 'CNY',
        maximumFractionDigits: 2,
      }).format(amount),
    [isEn, locale],
  );

  const formatDate = useCallback(
    (value?: string | null) => {
      if (!value) {
        return isEn ? 'Not set' : '未设置';
      }
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(locale);
    },
    [isEn, locale],
  );

  const openCreateDialog = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (item: AdRecord) => {
    setForm({
      id: item.id,
      name: item.name || '',
      position: item.position || 'dashboard_top',
      type: item.type || 'banner',
      content: item.content || '',
      link: item.link || '',
      status: item.status || 'draft',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
    });
    setDialogOpen(true);
  };

  const updateForm = (key: keyof AdFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const saveAd = async () => {
    if (!form.name.trim() || !form.position.trim() || !form.type.trim()) {
      setError(isEn ? 'Name, position, and type are required.' : '广告名称、位置和类型不能为空。');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (form.id) {
        await adminFetchJson(`/api/admin/ads/${form.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await adminFetchJson('/api/admin/ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }

      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await fetchData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : isEn
            ? 'Failed to save ad.'
            : '保存广告失败。',
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteAd = async (item: AdRecord) => {
    const confirmed = window.confirm(
      isEn ? `Delete ad slot "${item.name}"?` : `确认删除广告位“${item.name}”吗？`,
    );
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await adminFetchJson(`/api/admin/ads/${item.id}`, {
        method: 'DELETE',
      });
      await fetchData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : isEn
            ? 'Failed to delete ad.'
            : '删除广告失败。',
      );
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    const normalized = status?.toLowerCase?.() || 'draft';
    const variant: 'default' | 'secondary' | 'outline' =
      normalized === 'active'
        ? 'default'
        : normalized === 'archived'
          ? 'outline'
          : 'secondary';
    const labelMap: Record<string, string> = {
      active: isEn ? 'Active' : '投放中',
      paused: isEn ? 'Paused' : '暂停',
      archived: isEn ? 'Archived' : '已归档',
      draft: isEn ? 'Draft' : '草稿',
    };

    return <Badge variant={variant}>{labelMap[normalized] || normalized}</Badge>;
  };

  const topPerformers = useMemo(
    () => [...items].sort((left, right) => (right.clicks || 0) - (left.clicks || 0)).slice(0, 3),
    [items],
  );

  if (loading && !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'Ad Management' : '广告位管理'}</h1>
          <p className="text-muted-foreground">
            {isEn
              ? 'Validate slot inventory, monitor delivery, and maintain campaign configuration.'
              : '统一验收广告位库存、投放表现和配置状态。'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {isEn ? 'Refresh' : '刷新'}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {isEn ? 'Create Slot' : '新建广告位'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Impressions' : '展示量'}
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalImpressions.toLocaleString(locale) || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Clicks' : '点击量'}
            </CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClicks.toLocaleString(locale) || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CTR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.ctr || '0'}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Estimated Revenue' : '预估收入'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.revenue || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Delivery Trend' : '投放趋势'}</CardTitle>
            <CardDescription>
              {isEn ? 'Last 7 days of impressions and clicks.' : '最近 7 天展示与点击趋势。'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="impressions" stroke="#2563eb" strokeWidth={2} name={isEn ? 'Impressions' : '展示量'} />
                  <Line type="monotone" dataKey="clicks" stroke="#16a34a" strokeWidth={2} name={isEn ? 'Clicks' : '点击量'} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                {isEn ? 'No trend data yet.' : '暂时还没有趋势数据。'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Top Slots' : '高表现广告位'}</CardTitle>
            <CardDescription>
              {isEn ? 'Sorted by click volume.' : '按点击量排序。'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topPerformers.length > 0 ? (
              topPerformers.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.position} · {item.type}
                      </div>
                    </div>
                    {statusBadge(item.status)}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">{isEn ? 'Impressions' : '展示'}</div>
                      <div className="font-medium">{(item.impressions || 0).toLocaleString(locale)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{isEn ? 'Clicks' : '点击'}</div>
                      <div className="font-medium">{(item.clicks || 0).toLocaleString(locale)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{isEn ? 'Revenue' : '收入'}</div>
                      <div className="font-medium">{formatCurrency(item.revenue || 0)}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                {isEn ? 'Create ad slots to start acceptance.' : '创建广告位后即可开始验收。'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEn ? 'Slot Inventory' : '广告位列表'}</CardTitle>
          <CardDescription>
            {isEn
              ? `Total ${items.length} managed slots across the current data source.`
              : `当前数据源共 ${items.length} 个可管理广告位。`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {isEn ? 'No ad slots found.' : '暂无广告位数据。'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isEn ? 'Slot' : '广告位'}</TableHead>
                  <TableHead>{isEn ? 'Status' : '状态'}</TableHead>
                  <TableHead>{isEn ? 'Performance' : '表现'}</TableHead>
                  <TableHead>{isEn ? 'Schedule' : '投放周期'}</TableHead>
                  <TableHead className="text-right">{isEn ? 'Actions' : '操作'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.position} · {item.type}
                        </div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {item.link || item.content || '-'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{isEn ? 'Impressions' : '展示'}: {(item.impressions || 0).toLocaleString(locale)}</div>
                      <div>{isEn ? 'Clicks' : '点击'}: {(item.clicks || 0).toLocaleString(locale)}</div>
                      <div>{isEn ? 'Revenue' : '收入'}: {formatCurrency(item.revenue || 0)}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{formatDate(item.start_date)}</div>
                      <div>{formatDate(item.end_date)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {isEn ? 'Edit' : '编辑'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void deleteAd(item)} disabled={saving}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          {isEn ? 'Delete' : '删除'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isEn ? 'CTR Trend' : '点击率趋势'}</CardTitle>
          <CardDescription>
            {isEn ? 'Daily click-through rate derived from ad delivery data.' : '基于投放数据计算的每日点击率。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="ctr" fill="#f59e0b" name={isEn ? 'CTR (%)' : '点击率 (%)'} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-16 text-center text-muted-foreground">
              {isEn ? 'No CTR data yet.' : '暂时还没有点击率数据。'}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? (isEn ? 'Edit Ad Slot' : '编辑广告位') : isEn ? 'Create Ad Slot' : '新建广告位'}</DialogTitle>
            <DialogDescription>
              {isEn
                ? 'Manage slot metadata, delivery state, and scheduling.'
                : '维护广告位基础信息、投放状态与排期。'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ad-name">{isEn ? 'Slot Name' : '广告位名称'}</Label>
              <Input id="ad-name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-position">{isEn ? 'Position' : '位置'}</Label>
              <Input id="ad-position" value={form.position} onChange={(event) => updateForm('position', event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isEn ? 'Type' : '类型'}</Label>
              <Select value={form.type} onValueChange={(value) => updateForm('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banner">Banner</SelectItem>
                  <SelectItem value="sidebar">Sidebar</SelectItem>
                  <SelectItem value="inline">Inline</SelectItem>
                  <SelectItem value="popup">Popup</SelectItem>
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
                  <SelectItem value="draft">{isEn ? 'Draft' : '草稿'}</SelectItem>
                  <SelectItem value="active">{isEn ? 'Active' : '投放中'}</SelectItem>
                  <SelectItem value="paused">{isEn ? 'Paused' : '暂停'}</SelectItem>
                  <SelectItem value="archived">{isEn ? 'Archived' : '已归档'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-start">{isEn ? 'Start Time' : '开始时间'}</Label>
              <Input id="ad-start" value={form.start_date} onChange={(event) => updateForm('start_date', event.target.value)} placeholder="2026-03-30T09:00:00Z" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-end">{isEn ? 'End Time' : '结束时间'}</Label>
              <Input id="ad-end" value={form.end_date} onChange={(event) => updateForm('end_date', event.target.value)} placeholder="2026-04-30T23:59:59Z" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ad-link">{isEn ? 'Target Link' : '跳转链接'}</Label>
            <Input id="ad-link" value={form.link} onChange={(event) => updateForm('link', event.target.value)} placeholder="https://example.com" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ad-content">{isEn ? 'Content / Material Notes' : '广告内容 / 素材说明'}</Label>
            <Textarea id="ad-content" value={form.content} onChange={(event) => updateForm('content', event.target.value)} rows={5} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {isEn ? 'Cancel' : '取消'}
            </Button>
            <Button onClick={() => void saveAd()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? (isEn ? 'Save Changes' : '保存修改') : isEn ? 'Create Slot' : '创建广告位'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
