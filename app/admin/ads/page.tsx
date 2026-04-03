'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { toast } from 'sonner';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { adminFetchJson } from '@/lib/admin/client';

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
        ? 'Maintain slot inventory, monitor delivery data, and keep campaign settings tidy.'
        : '统一维护广告位库存、投放数据和排期配置，方便上线前后持续运营。',
      refresh: isEn ? 'Refresh' : '刷新',
      create: isEn ? 'Create Slot' : '新建广告位',
      retry: isEn ? 'Retry' : '重新加载',
      loadFailed: isEn ? 'Failed to load ad data.' : '加载广告位数据失败，请稍后重试。',
      saveFailed: isEn ? 'Failed to save the ad slot.' : '保存广告位失败，请检查后重试。',
      saveSuccessCreate: isEn ? 'Ad slot created.' : '广告位已创建。',
      saveSuccessUpdate: isEn ? 'Ad slot updated.' : '广告位已更新。',
      deleteFailed: isEn ? 'Failed to delete the ad slot.' : '删除广告位失败，请稍后重试。',
      deleteSuccess: isEn ? 'Ad slot deleted.' : '广告位已删除。',
      requiredFields: isEn
        ? 'Name, position, and type are required.'
        : '请先填写广告位名称、位置和类型。',
      metricsImpressions: isEn ? 'Impressions' : '展示量',
      metricsClicks: isEn ? 'Clicks' : '点击量',
      metricsCtr: isEn ? 'CTR' : '点击率',
      metricsRevenue: isEn ? 'Estimated Revenue' : '预计收入',
      trendTitle: isEn ? 'Delivery Trend' : '投放趋势',
      trendDescription: isEn
        ? 'Recent impressions and clicks from the current reporting window.'
        : '展示最近一段时间的展示量与点击量变化。',
      ctrTitle: isEn ? 'CTR Trend' : '点击率趋势',
      ctrDescription: isEn
        ? 'Daily click-through rate helps spot creative fatigue quickly.'
        : '通过每日点击率快速识别素材表现和疲劳度。',
      topTitle: isEn ? 'Top Performing Slots' : '高表现广告位',
      topDescription: isEn
        ? 'Quickly review the best-performing slots by click volume.'
        : '按点击量查看当前表现较好的广告位。',
      tableTitle: isEn ? 'Slot Inventory' : '广告位清单',
      tableDescription: isEn
        ? `There are ${items.length} managed slots in the current data source.`
        : `当前数据源共收录 ${items.length} 个可管理广告位。`,
      noTrend: isEn ? 'No trend data available yet.' : '暂无趋势数据。',
      noCtr: isEn ? 'No CTR data available yet.' : '暂无点击率趋势数据。',
      noTop: isEn ? 'Create the first slot to start tracking performance.' : '先创建广告位，再开始跟踪投放表现。',
      noItems: isEn ? 'No ad slots found.' : '暂无广告位数据。',
      slot: isEn ? 'Slot' : '广告位',
      status: isEn ? 'Status' : '状态',
      performance: isEn ? 'Performance' : '表现',
      schedule: isEn ? 'Schedule' : '投放周期',
      actions: isEn ? 'Actions' : '操作',
      edit: isEn ? 'Edit' : '编辑',
      delete: isEn ? 'Delete' : '删除',
      dialogCreateTitle: isEn ? 'Create Ad Slot' : '新建广告位',
      dialogEditTitle: isEn ? 'Edit Ad Slot' : '编辑广告位',
      dialogDescription: isEn
        ? 'Update slot metadata, creative notes, and delivery schedule.'
        : '维护广告位基础信息、投放状态、素材说明和排期。',
      name: isEn ? 'Slot Name' : '广告位名称',
      position: isEn ? 'Position' : '位置',
      type: isEn ? 'Type' : '类型',
      link: isEn ? 'Target Link' : '跳转链接',
      content: isEn ? 'Creative Notes' : '素材说明',
      startDate: isEn ? 'Start Time' : '开始时间',
      endDate: isEn ? 'End Time' : '结束时间',
      cancel: isEn ? 'Cancel' : '取消',
      submitCreate: isEn ? 'Create Slot' : '创建广告位',
      submitUpdate: isEn ? 'Save Changes' : '保存修改',
      placeholderName: isEn ? 'Homepage banner - Spring campaign' : '例如：首页 Banner - 春季活动',
      placeholderLink: isEn ? 'https://example.com/landing' : '请输入跳转链接',
      placeholderContent: isEn
        ? 'Describe the material, audience, or delivery notes...'
        : '填写素材说明、投放目标或备注信息...',
      dateNotSet: isEn ? 'Not set' : '未设置',
      dateOpenEnded: isEn ? 'Long-running' : '长期投放',
      deleteConfirm: (name: string) =>
        isEn ? `Delete ad slot "${name}"?` : `确认删除广告位“${name}”吗？此操作不可撤销。`,
      active: isEn ? 'Active' : '投放中',
      paused: isEn ? 'Paused' : '已暂停',
      archived: isEn ? 'Archived' : '已归档',
      draft: isEn ? 'Draft' : '草稿',
    }),
    [isEn, items.length],
  );

  const positionOptions = useMemo(
    () => [
      { value: 'dashboard_top', label: isEn ? 'Dashboard Top' : '控制台顶部' },
      { value: 'dashboard_sidebar', label: isEn ? 'Dashboard Sidebar' : '控制台侧边栏' },
      { value: 'create_page', label: isEn ? 'Create Page' : '创建页' },
      { value: 'contract_detail', label: isEn ? 'Contract Detail' : '合同详情页' },
      { value: 'marketing_home', label: isEn ? 'Marketing Homepage' : '营销首页' },
    ],
    [isEn],
  );

  const typeOptions = useMemo(
    () => [
      { value: 'banner', label: isEn ? 'Banner' : '横幅' },
      { value: 'card', label: isEn ? 'Card' : '卡片' },
      { value: 'popup', label: isEn ? 'Popup' : '弹窗' },
      { value: 'native', label: isEn ? 'Native' : '原生位' },
    ],
    [isEn],
  );

  const statusOptions = useMemo(
    () => [
      { value: 'draft', label: copy.draft },
      { value: 'active', label: copy.active },
      { value: 'paused', label: copy.paused },
      { value: 'archived', label: copy.archived },
    ],
    [copy.active, copy.archived, copy.draft, copy.paused],
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
      const message = fetchError instanceof Error ? fetchError.message : copy.loadFailed;
      setError(message);
      setStats(null);
      setTrend([]);
      setItems([]);
      toast.error(copy.loadFailed);
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
        return copy.dateNotSet;
      }

      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(locale);
    },
    [copy.dateNotSet, locale],
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
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveAd = async () => {
    if (!form.name.trim() || !form.position.trim() || !form.type.trim()) {
      setError(copy.requiredFields);
      toast.error(copy.requiredFields);
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
      toast.success(form.id ? copy.saveSuccessUpdate : copy.saveSuccessCreate);
      await fetchData();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : copy.saveFailed;
      setError(message);
      toast.error(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const deleteAd = async (item: AdRecord) => {
    const confirmed = window.confirm(copy.deleteConfirm(item.name));
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await adminFetchJson(`/api/admin/ads/${item.id}`, {
        method: 'DELETE',
      });
      toast.success(copy.deleteSuccess);
      await fetchData();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : copy.deleteFailed;
      setError(message);
      toast.error(copy.deleteFailed);
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = useCallback(
    (value: string) => {
      const normalized = value?.toLowerCase?.() || 'draft';
      const variant: 'default' | 'secondary' | 'outline' =
        normalized === 'active' ? 'default' : normalized === 'archived' ? 'outline' : 'secondary';
      const labelMap: Record<string, string> = {
        active: copy.active,
        paused: copy.paused,
        archived: copy.archived,
        draft: copy.draft,
      };

      return <Badge variant={variant}>{labelMap[normalized] || normalized}</Badge>;
    },
    [copy.active, copy.archived, copy.draft, copy.paused],
  );

  const topPerformers = useMemo(
    () => [...items].sort((left, right) => (right.clicks || 0) - (left.clicks || 0)).slice(0, 3),
    [items],
  );

  if (loading && !stats) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void fetchData()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {copy.refresh}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {copy.create}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.metricsImpressions}</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.totalImpressions || 0).toLocaleString(locale)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.metricsClicks}</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.totalClicks || 0).toLocaleString(locale)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.metricsCtr}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.ctr || '0'}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.metricsRevenue}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.revenue || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1.2fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.trendTitle}</CardTitle>
            <CardDescription>{copy.trendDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                {copy.noTrend}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="impressions" stroke="#2563eb" strokeWidth={2} name={copy.metricsImpressions} />
                  <Line type="monotone" dataKey="clicks" stroke="#16a34a" strokeWidth={2} name={copy.metricsClicks} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.ctrTitle}</CardTitle>
            <CardDescription>{copy.ctrDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                {copy.noCtr}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ctr" fill="#f59e0b" name={copy.metricsCtr} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.topTitle}</CardTitle>
            <CardDescription>{copy.topDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPerformers.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
                {copy.noTop}
              </div>
            ) : (
              topPerformers.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.position} / {item.type}
                      </div>
                    </div>
                    {statusBadge(item.status)}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">{copy.metricsImpressions}</div>
                      <div className="font-medium">{(item.impressions || 0).toLocaleString(locale)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{copy.metricsClicks}</div>
                      <div className="font-medium">{(item.clicks || 0).toLocaleString(locale)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{copy.metricsRevenue}</div>
                      <div className="font-medium">{formatCurrency(item.revenue || 0)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy.tableTitle}</CardTitle>
          <CardDescription>{copy.tableDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              {copy.noItems}
            </div>
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
                        {item.link ? (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                            className="line-clamp-1 text-xs text-primary hover:underline"
                          >
                            {item.link}
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>{copy.metricsImpressions}: {(item.impressions || 0).toLocaleString(locale)}</div>
                        <div>{copy.metricsClicks}: {(item.clicks || 0).toLocaleString(locale)}</div>
                        <div>{copy.metricsRevenue}: {formatCurrency(item.revenue || 0)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{formatDate(item.start_date)}</div>
                      <div>{item.end_date ? formatDate(item.end_date) : copy.dateOpenEnded}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {copy.edit}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void deleteAd(item)}
                          disabled={saving}
                        >
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? copy.dialogEditTitle : copy.dialogCreateTitle}</DialogTitle>
            <DialogDescription>{copy.dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ad-name">{copy.name}</Label>
              <Input
                id="ad-name"
                value={form.name}
                placeholder={copy.placeholderName}
                onChange={(event) => updateForm('name', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad-position">{copy.position}</Label>
              <Select value={form.position} onValueChange={(value) => updateForm('position', value)}>
                <SelectTrigger id="ad-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {positionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad-type">{copy.type}</Label>
              <Select value={form.type} onValueChange={(value) => updateForm('type', value)}>
                <SelectTrigger id="ad-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad-status">{copy.status}</Label>
              <Select value={form.status} onValueChange={(value) => updateForm('status', value)}>
                <SelectTrigger id="ad-status">
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

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ad-link">{copy.link}</Label>
              <Input
                id="ad-link"
                value={form.link}
                placeholder={copy.placeholderLink}
                onChange={(event) => updateForm('link', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad-start">{copy.startDate}</Label>
              <Input
                id="ad-start"
                type="datetime-local"
                value={form.start_date}
                onChange={(event) => updateForm('start_date', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad-end">{copy.endDate}</Label>
              <Input
                id="ad-end"
                type="datetime-local"
                value={form.end_date}
                onChange={(event) => updateForm('end_date', event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ad-content">{copy.content}</Label>
              <Textarea
                id="ad-content"
                rows={5}
                value={form.content}
                placeholder={copy.placeholderContent}
                onChange={(event) => updateForm('content', event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {copy.cancel}
            </Button>
            <Button onClick={() => void saveAd()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.id ? copy.submitUpdate : copy.submitCreate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
