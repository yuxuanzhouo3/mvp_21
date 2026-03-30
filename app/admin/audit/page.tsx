'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

import { adminFetchJson } from '@/lib/admin/client';
import { useLanguage } from '@/components/language-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

type AuditStatus = 'success' | 'error' | 'denied';

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
  severity: 'info' | 'warn' | 'error';
  meta: Record<string, unknown>;
  createdAt: string;
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

export default function AdminAuditPage() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';

  const [items, setItems] = useState<AuditItem[]>([]);
  const [status, setStatus] = useState<string>('all');
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(
    async (page = pagination.page) => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '20',
          status,
        });

        const result = await adminFetchJson<{
          success: true;
          data: {
            items: AuditItem[];
            pagination: Pagination;
          };
        }>(`/api/admin/audit?${params.toString()}`);

        setItems(result.data.items || []);
        setPagination(result.data.pagination || EMPTY_PAGINATION);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : isEn
              ? 'Failed to load audit logs.'
              : '加载后台审计日志失败。',
        );
        setItems([]);
        setPagination(EMPTY_PAGINATION);
      } finally {
        setLoading(false);
      }
    },
    [isEn, pagination.page, status],
  );

  useEffect(() => {
    void fetchLogs(1);
  }, [fetchLogs, status]);

  const stats = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        accumulator.total += 1;
        if (item.status === 'success') {
          accumulator.success += 1;
        }
        if (item.status === 'denied') {
          accumulator.denied += 1;
        }
        if (item.status === 'error') {
          accumulator.error += 1;
        }
        return accumulator;
      },
      { total: 0, success: 0, denied: 0, error: 0 },
    );
  }, [items]);

  const formatDate = useCallback(
    (value: string) => {
      if (!value) {
        return isEn ? 'Unknown' : '未知';
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }

      return parsed.toLocaleString(locale);
    },
    [isEn, locale],
  );

  const getStatusBadge = (value: AuditStatus) => {
    const variantMap: Record<
      AuditStatus,
      'default' | 'secondary' | 'destructive' | 'outline'
    > = {
      success: 'default',
      denied: 'outline',
      error: 'destructive',
    };
    const labelMap: Record<AuditStatus, string> = {
      success: isEn ? 'Success' : '成功',
      denied: isEn ? 'Denied' : '拒绝',
      error: isEn ? 'Error' : '错误',
    };

    return <Badge variant={variantMap[value]}>{labelMap[value]}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'Admin Audit Log' : '后台操作审计'}</h1>
          <p className="text-muted-foreground">
            {isEn
              ? 'Track administrator access, blocked requests, and management actions.'
              : '统一查看后台访问、拒绝事件和关键管理操作。'}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? 'All Status' : '全部状态'}</SelectItem>
              <SelectItem value="success">{isEn ? 'Success' : '成功'}</SelectItem>
              <SelectItem value="denied">{isEn ? 'Denied' : '拒绝'}</SelectItem>
              <SelectItem value="error">{isEn ? 'Error' : '错误'}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void fetchLogs()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {isEn ? 'Refresh' : '刷新'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Current Page Events' : '当前页事件数'}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Successful Events' : '成功事件'}
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.success}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Denied Access' : '拒绝访问'}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.denied}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isEn ? 'Error Events' : '错误事件'}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.error}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEn ? 'Audit Timeline' : '审计时间线'}</CardTitle>
          <CardDescription>
            {isEn
              ? `Showing page ${pagination.page} of ${pagination.totalPages}, ${pagination.total} total records.`
              : `当前第 ${pagination.page} / ${pagination.totalPages} 页，共 ${pagination.total} 条记录。`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {isEn ? 'No audit records available yet.' : '暂时还没有可展示的审计记录。'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isEn ? 'Time' : '时间'}</TableHead>
                  <TableHead>{isEn ? 'Status' : '状态'}</TableHead>
                  <TableHead>{isEn ? 'Action' : '动作'}</TableHead>
                  <TableHead>{isEn ? 'Path' : '路径'}</TableHead>
                  <TableHead>{isEn ? 'Actor' : '操作者'}</TableHead>
                  <TableHead>{isEn ? 'IP' : 'IP'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{item.message}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.method || 'GET'} {item.action}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.path || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.actorUserId || (isEn ? 'Anonymous' : '匿名')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.ip || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isEn
                ? 'Includes successful access, denied requests, and API errors.'
                : '包含成功访问、拒绝请求与后台 API 错误。'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || pagination.page <= 1}
                onClick={() => void fetchLogs(Math.max(1, pagination.page - 1))}
              >
                {isEn ? 'Previous' : '上一页'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || pagination.page >= pagination.totalPages}
                onClick={() =>
                  void fetchLogs(Math.min(pagination.totalPages, pagination.page + 1))
                }
              >
                {isEn ? 'Next' : '下一页'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
