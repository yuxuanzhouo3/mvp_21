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

  const copy = useMemo(
    () => ({
      title: isEn ? 'Ad Management' : '广告位管理',
      subtitle: isEn
        ? 'Validate slot inventory, monitor delivery, and maintain campaign configuration.'
        : '核对广告位库存、监控投放表现，并维护广告配置。',
      refresh: isEn ? 'Refresh' : '刷新',
      createSlot: isEn ? 'Create Slot' : '新建广告位',
      loadFailed: isEn ? 'Failed to load ad management data.' : '加载广告位管理数据失败。',
      saveFailed: isEn ? 'Failed to save ad.' : '保存广告位失败。',
      deleteFailed: isEn ? 'Failed to delete ad.' : '删除广告位失败。',
      requiredFields: isEn
        ? 'Name, position, and type are required.'
        : '广告位名称、位置和类型不能为空。',
      notSet: isEn ? 'Not set' : '未设置',
      impressions: isEn ? 'Impressions' : '展示量',
      clicks: isEn ? 'Clicks' : '点击量',
      revenue: isEn ? 'Estimated Revenue' : '预估收入',
      deliveryTrend: isEn ? 'Delivery Trend' : '投放趋势',
      deliveryTrendDesc: isEn ? 'Last 7 days of impressions and clicks.' : '最近 7 天展示与点击走势。',
      noTrend: isEn ? 'No trend data yet.' : '暂时还没有趋势数据。',
      topSlots: isEn ? 'Top Slots' : '高表现广告位',
      topSlotsDesc: isEn ? 'Sorted by click volume.' : '按点击量排序。',
      createToStart: isEn ? 'Create ad slots to start acceptance.' : '创建广告位后即可开始验收。',
      slotInventory: isEn ? 'Slot Inventory' : '广告位列表',
      inventoryDesc: isEn
        ? `Total ${items.length} managed slots across the current data source.`
        : `当前数据源共 ${items.length} 个可管理广告位。`,
      noSlots: isEn ? 'No ad slots found.' : '暂无广告位数据。',
      slot: isEn ? 'Slot' : '广告位',
      status: isEn ? 'Status' : '状态',
      performance: isEn ? 'Performance' : '表现',
      schedule: isEn ? 'Schedule' : '投放周期',
      actions: isEn ? 'Actions' : '操作',
      ctrTrend: isEn ? 'CTR Trend' : '点击率趋势',
      ctrTrendDesc: isEn ? 'Daily click-through rate derived from ad delivery data.' : '基于投放数据计算的每日点击率。',
      noCtr: isEn ? 'No CTR data yet.' : '暂时还没有点击率数据。',
      edit: isEn ? 'Edit' : '编辑',
      delete: isEn ? 'Delete' : '删除',
      cancel: isEn ? 'Cancel' : '取消',
      saveChanges: isEn ? 'Save Changes' : '保存修改',
      dialogCreate: isEn ? 'Create Ad Slot' : '新建广告位',
      dialogEdit: isEn ? 'Edit Ad Slot' : '编辑广告位',
      dialogDesc: isEn
        ? 'Manage slot metadata, delivery state, and scheduling.'
        : '维护广告位基础信息、投放状态与排期。',
      slotName: isEn ? 'Slot Name' : '广告位名称',
      position: isEn ? 'Position' : '位置',
      type: isEn ? 'Type' : '类型',
      startTime: isEn ? 'Start Time' : '开始时间',
      endTime: isEn ? 'End Time' : '结束时间',
      targetLink: isEn ? 'Target Link' : '跳转链接',
      content: isEn ? 'Content / Material Notes' : '广告内容 / 素材说明',
      active: isEn ? 'Active' : '投放中',
      paused: isEn ? 'Paused' : '暂停',
      archived: isEn ? 'Archived' : '已归档',
      draft: isEn ? 'Draft' : '草稿',
    }),
    [isEn, items.length],
  );

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
      setError(fetchError instanceof Error ? fetchError.message : copy.loadFailed);
      setStats(null);
      setTrend([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed]);

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
        return copy.notSet;
      }

      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(locale);
    },
    [copy.notSet, locale],
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
      setError(copy.requiredFields);
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
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
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
      setError(deleteError instanceof Error ? deleteError.message : copy.deleteFailed);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    const normalized = status?.toLowerCase?.() || 'draft';
    const variant: 'default' | 'secondary' | 'outline' =
      normalized === 'active' ? 'default' : normalized === 'archived' ? 'outline' : 'secondary';
    const labelMap: Record<string, string> = {
      active: copy.active,
      paused: copy.paused,
      archived: copy.archived,
      draft: copy.draft,
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
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {copy.refresh}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {copy.createSlot}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.impressions}</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalImpressions.toLocaleString(locale) || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.clicks}</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.revenue}</CardTitle>
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
            <CardTitle>{copy.deliveryTrend}</CardTitle>
            <CardDescription>{copy.deliveryTrendDesc}</CardDescription>
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
                  <Line
                    type="monotone"
                    dataKey="impressions"
                    stroke="#2563eb"
                    strokeWidth={2}
                    name={copy.impressions}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="#16a34a"
                    strokeWidth={2}
                    name={copy.clicks}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-16 text-center text-muted-foreground">{copy.noTrend}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.topSlots}</CardTitle>
            <CardDescription>{copy.topSlotsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topPerformers.length > 0 ? (
              topPerformers.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.position} / {item.type}
                      </div>
                    </div>
                    {statusBadge(item.status)}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">{copy.impressions}</div>
                      <div className="font-medium">{(item.impressions || 0).toLocaleString(locale)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{copy.clicks}</div>
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
              <div className="py-8 text-center text-muted-foreground">{copy.createToStart}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy.slotInventory}</CardTitle>
          <CardDescription>{copy.inventoryDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">{copy.noSlots}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.slot}</TableHead>
                  <TableHead>{copy.status}</TableHead>
                  <TableHead>{copy.performance}</TableHead>
                  <TableHead>{copy.schedule}</TableHead>
                  <TableHead className="text-right">{copy.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.position} / {item.type}
                        </div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {item.link || item.content || '-'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{copy.impressions}: {(item.impressions || 0).toLocaleString(locale)}</div>
                      <div>{copy.clicks}: {(item.clicks || 0).toLocaleString(locale)}</div>
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
                          {copy.edit}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void deleteAd(item)} disabled={saving}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          {copy.delete}
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
          <CardTitle>{copy.ctrTrend}</CardTitle>
          <CardDescription>{copy.ctrTrendDesc}</CardDescription>
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
            <div className="py-16 text-center text-muted-foreground">{copy.noCtr}</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? copy.dialogEdit : copy.dialogCreate}</DialogTitle>
            <DialogDescription>{copy.dialogDesc}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ad-name">{copy.slotName}</Label>
              <Input id="ad-name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-position">{copy.position}</Label>
              <Input id="ad-position" value={form.position} onChange={(event) => updateForm('position', event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{copy.type}</Label>
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
              <Label>{copy.status}</Label>
              <Select value={form.status} onValueChange={(value) => updateForm('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{copy.draft}</SelectItem>
                  <SelectItem value="active">{copy.active}</SelectItem>
                  <SelectItem value="paused">{copy.paused}</SelectItem>
                  <SelectItem value="archived">{copy.archived}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-start">{copy.startTime}</Label>
              <Input
                id="ad-start"
                value={form.start_date}
                onChange={(event) => updateForm('start_date', event.target.value)}
                placeholder="2026-03-30T09:00:00Z"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-end">{copy.endTime}</Label>
              <Input
                id="ad-end"
                value={form.end_date}
                onChange={(event) => updateForm('end_date', event.target.value)}
                placeholder="2026-04-30T23:59:59Z"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ad-link">{copy.targetLink}</Label>
            <Input
              id="ad-link"
              value={form.link}
              onChange={(event) => updateForm('link', event.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ad-content">{copy.content}</Label>
            <Textarea
              id="ad-content"
              value={form.content}
              onChange={(event) => updateForm('content', event.target.value)}
              rows={5}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {copy.cancel}
            </Button>
            <Button onClick={() => void saveAd()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? copy.saveChanges : copy.createSlot}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
