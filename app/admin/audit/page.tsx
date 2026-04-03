'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/components/language-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminFetch, adminFetchJson } from '@/lib/admin/client';

type AuditStatus = 'success' | 'error' | 'denied';
type AuditSeverity = 'info' | 'warn' | 'error';

type AuditItem = {
  id: string;
  actorUserId: string;
  action: string;
  message: string;
  path: string;
  method: string;
  ip: string;
  userAgent: string;
  status: AuditStatus;
  severity: AuditSeverity;
  meta: Record<string, unknown>;
  createdAt: string;
};

type AuditAlert = {
  id: string;
  level: 'warn' | 'error';
  title: string;
  description: string;
  count: number;
};

type AuditSummary = {
  total: number;
  success: number;
  denied: number;
  error: number;
  severities: Record<AuditSeverity, number>;
  topActions: Array<{ action: string; count: number }>;
  alerts: AuditAlert[];
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

const EMPTY_SUMMARY: AuditSummary = {
  total: 0,
  success: 0,
  denied: 0,
  error: 0,
  severities: {
    info: 0,
    warn: 0,
    error: 0,
  },
  topActions: [],
  alerts: [],
};

export default function AdminAuditPage() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';

  const [items, setItems] = useState<AuditItem[]>([]);
  const [status, setStatus] = useState<string>('all');
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [summary, setSummary] = useState<AuditSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const [error, setError] = useState('');

  const copy = useMemo(
    () => ({
      title: isEn ? 'Admin Audit Log' : '后台审计日志',
      subtitle: isEn
        ? 'Review access events, export evidence, and trace exceptions from the live admin workflow.'
        : '查看后台访问事件、导出审计证据，并跟踪真实管理流程里的异常请求。',
      allStatus: isEn ? 'All Status' : '全部状态',
      refresh: isEn ? 'Refresh' : '刷新',
      exportCsv: isEn ? 'Export CSV' : '导出 CSV',
      exportJson: isEn ? 'Export JSON' : '导出 JSON',
      loadFailed: isEn ? 'Failed to load audit logs.' : '加载审计日志失败，请稍后重试。',
      exportFailed: isEn ? 'Failed to export audit logs.' : '导出审计日志失败，请稍后重试。',
      exportSuccess: (format: 'csv' | 'json') =>
        isEn ? `Audit logs exported as ${format.toUpperCase()}.` : `审计日志已导出为 ${format.toUpperCase()} 文件。`,
      activeAlerts: isEn ? 'Active Alerts' : '当前告警',
      activeAlertsDesc: isEn
        ? 'These alerts are derived from the current result set and can be exported as evidence.'
        : '以下告警由当前筛选结果自动汇总，可直接作为审计留痕依据。',
      currentPageEvents: isEn ? 'Current Page Events' : '当前页事件数',
      successEvents: isEn ? 'Successful Events' : '成功事件',
      deniedAccess: isEn ? 'Denied Access' : '拒绝访问',
      errorEvents: isEn ? 'Error Events' : '错误事件',
      warnSeverity: isEn ? 'Warn Severity' : '告警级别',
      criticalSeverity: isEn ? 'Critical Severity' : '严重级别',
      timeline: isEn ? 'Audit Timeline' : '审计时间线',
      noRecords: isEn ? 'No audit records available yet.' : '暂无可展示的审计记录。',
      time: isEn ? 'Time' : '时间',
      status: isEn ? 'Status' : '状态',
      severity: isEn ? 'Severity' : '级别',
      action: isEn ? 'Action' : '动作',
      path: isEn ? 'Path' : '路径',
      actor: isEn ? 'Actor' : '操作人',
      anonymous: isEn ? 'Anonymous' : '匿名',
      tableHint: isEn
        ? 'Includes successful access, denied requests, and backend API errors.'
        : '包含成功访问、拒绝请求以及后台 API 错误等事件。',
      previous: isEn ? 'Previous' : '上一页',
      next: isEn ? 'Next' : '下一页',
      topActions: isEn ? 'Top Actions' : '高频动作',
      topActionsDesc: isEn
        ? 'Use this to verify whether admin behavior matches the expected governance workflow.'
        : '用于快速核对后台操作是否符合预期治理流程。',
      noActionStats: isEn ? 'No action statistics yet.' : '暂无动作统计。',
      occurrences: isEn ? 'Occurrences' : '出现次数',
      unknown: isEn ? 'Unknown' : '未知',
      success: isEn ? 'Success' : '成功',
      denied: isEn ? 'Denied' : '拒绝',
      failed: isEn ? 'Error' : '错误',
      info: isEn ? 'Info' : '信息',
      warn: isEn ? 'Warn' : '告警',
      critical: isEn ? 'Critical' : '严重',
      currentPageLabel: isEn
        ? `Showing page ${pagination.page} of ${pagination.totalPages}, ${pagination.total} total records.`
        : `当前第 ${pagination.page} / ${pagination.totalPages} 页，共 ${pagination.total} 条记录。`,
      retry: isEn ? 'Retry' : '重新加载',
    }),
    [isEn, pagination.page, pagination.total, pagination.totalPages],
  );

  const fetchLogs = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: '20',
          status,
        });

        const result = await adminFetchJson<{
          success: true;
          data: {
            items: AuditItem[];
            summary: AuditSummary;
            pagination: Pagination;
          };
        }>(`/api/admin/audit?${params.toString()}`);

        setItems(result.data.items || []);
        setSummary(result.data.summary || EMPTY_SUMMARY);
        setPagination(result.data.pagination || EMPTY_PAGINATION);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : copy.loadFailed;
        setError(message);
        setItems([]);
        setSummary(EMPTY_SUMMARY);
        setPagination(EMPTY_PAGINATION);
        toast.error(copy.loadFailed);
      } finally {
        setLoading(false);
      }
    },
    [copy.loadFailed, status],
  );

  useEffect(() => {
    void fetchLogs(1);
  }, [fetchLogs]);

  const formatDate = useCallback(
    (value: string) => {
      if (!value) {
        return copy.unknown;
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }

      return parsed.toLocaleString(locale);
    },
    [copy.unknown, locale],
  );

  const statusBadge = useCallback(
    (value: AuditStatus) => {
      const variantMap: Record<AuditStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        success: 'default',
        denied: 'outline',
        error: 'destructive',
      };
      const labelMap: Record<AuditStatus, string> = {
        success: copy.success,
        denied: copy.denied,
        error: copy.failed,
      };

      return <Badge variant={variantMap[value]}>{labelMap[value]}</Badge>;
    },
    [copy.denied, copy.failed, copy.success],
  );

  const severityBadge = useCallback(
    (value: AuditSeverity) => {
      const variantMap: Record<AuditSeverity, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        info: 'secondary',
        warn: 'outline',
        error: 'destructive',
      };
      const labelMap: Record<AuditSeverity, string> = {
        info: copy.info,
        warn: copy.warn,
        error: copy.critical,
      };

      return <Badge variant={variantMap[value]}>{labelMap[value]}</Badge>;
    },
    [copy.critical, copy.info, copy.warn],
  );

  const exportLogs = useCallback(
    async (format: 'csv' | 'json') => {
      setExporting(format);
      setError('');

      try {
        const params = new URLSearchParams({
          status,
          format,
          limit: '5000',
        });

        const response = await adminFetch(`/api/admin/audit?${params.toString()}`);
        if (!response.ok) {
          throw new Error(copy.exportFailed);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `admin-audit-${status}.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast.success(copy.exportSuccess(format));
      } catch (exportError) {
        const message = exportError instanceof Error ? exportError.message : copy.exportFailed;
        setError(message);
        toast.error(copy.exportFailed);
      } finally {
        setExporting(null);
      }
    },
    [copy, status],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.allStatus}</SelectItem>
              <SelectItem value="success">{copy.success}</SelectItem>
              <SelectItem value="denied">{copy.denied}</SelectItem>
              <SelectItem value="error">{copy.failed}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void fetchLogs(1)} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {copy.refresh}
          </Button>
          <Button variant="outline" onClick={() => void exportLogs('csv')} disabled={exporting !== null}>
            {exporting === 'csv' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {copy.exportCsv}
          </Button>
          <Button variant="outline" onClick={() => void exportLogs('json')} disabled={exporting !== null}>
            {exporting === 'json' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {copy.exportJson}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {summary.alerts.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-950">
              <AlertTriangle className="h-4 w-4" />
              {copy.activeAlerts}
            </CardTitle>
            <CardDescription className="text-amber-900">{copy.activeAlertsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-amber-300 bg-white/80 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant={alert.level === 'error' ? 'destructive' : 'outline'}>
                    {alert.level === 'error' ? copy.critical : copy.warn}
                  </Badge>
                  <span className="font-medium text-amber-950">{alert.title}</span>
                  <span className="text-sm text-amber-900">x{alert.count}</span>
                </div>
                <p className="mt-1 text-sm text-amber-900">{alert.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.currentPageEvents}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.successEvents}</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.success}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.deniedAccess}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.denied}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.errorEvents}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.error}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.warnSeverity}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.severities.warn}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{copy.criticalSeverity}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.severities.error}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.timeline}</CardTitle>
            <CardDescription>{copy.currentPageLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <p className="font-medium">{copy.noRecords}</p>
                <Button variant="outline" className="mt-4" onClick={() => void fetchLogs(1)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {copy.retry}
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.time}</TableHead>
                    <TableHead>{copy.status}</TableHead>
                    <TableHead>{copy.severity}</TableHead>
                    <TableHead>{copy.action}</TableHead>
                    <TableHead>{copy.path}</TableHead>
                    <TableHead>{copy.actor}</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell>{severityBadge(item.severity)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.message}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.method || 'GET'} {item.action}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.path || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{item.actorUserId || copy.anonymous}</TableCell>
                      <TableCell className="font-mono text-xs">{item.ip || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">{copy.tableHint}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || pagination.page <= 1}
                  onClick={() => void fetchLogs(Math.max(1, pagination.page - 1))}
                >
                  {copy.previous}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || pagination.page >= pagination.totalPages}
                  onClick={() => void fetchLogs(Math.min(pagination.totalPages, pagination.page + 1))}
                >
                  {copy.next}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.topActions}</CardTitle>
            <CardDescription>{copy.topActionsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.topActions.length > 0 ? (
              summary.topActions.map((entry) => (
                <div key={entry.action} className="rounded-lg border p-3">
                  <div className="font-medium">{entry.action}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {copy.occurrences}: {entry.count}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                {copy.noActionStats}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
