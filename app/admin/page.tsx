'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  Loader2,
  MousePointer,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';

import { adminFetchJson } from '@/lib/admin/client';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Stats {
  totalUsers: number;
  newUsersToday: number;
  activeUsers: number;
  totalContracts: number;
  contractsToday: number;
  paidUsers: number;
  revenue: number;
  adImpressions: number;
  adClicks: number;
  adRevenue: number;
}

interface RecentUser {
  id: string;
  email: string;
  nickname: string;
  subscription_type: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';
  const currency = isEn ? 'USD' : 'CNY';

  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const copy = {
    title: isEn ? 'Dashboard' : '后台总览',
    description: isEn ? "Welcome back. Here's today's platform overview." : '查看今天的核心经营与使用情况。',
    loadFailed: isEn ? 'Failed to load admin overview.' : '加载后台总览失败。',
    retry: isEn ? 'Retry' : '重新加载',
    totalUsers: isEn ? 'Total Users' : '总用户数',
    activeUsers: isEn ? 'Active Users' : '活跃用户',
    paidUsers: isEn ? 'Paid Users' : '付费用户',
    monthlyRevenue: isEn ? 'Monthly Revenue' : '本月收入',
    adImpressions: isEn ? 'Ad Impressions' : '广告展示',
    adClicks: isEn ? 'Ad Clicks' : '广告点击',
    adRevenue: isEn ? 'Ad Revenue' : '广告收入',
    contractMetrics: isEn ? 'Contract Metrics' : '合同数据',
    contractMetricsDesc: isEn ? 'Core metrics for contract creation.' : '查看合同生成与使用效率的关键指标。',
    recentUsers: isEn ? 'Recent Users' : '最近注册用户',
    recentUsersDesc: isEn ? 'Latest users created on the platform.' : '最近进入平台的新用户。',
    noRecentUsers: isEn ? 'No recent user data yet.' : '暂时还没有最近注册用户。',
    allTime: isEn ? 'All time' : '历史累计',
    todayCreated: isEn ? 'Created today' : '今日新增',
    contractsPerUser: isEn ? 'Contracts per user' : '人均合同数',
    avgContracts: isEn ? 'Average contracts generated per user' : '平均每位用户生成的合同数量',
    unnamedUser: isEn ? 'Unnamed user' : '未命名用户',
    activeRate: isEn ? 'Active rate' : '活跃率',
    conversionRate: isEn ? 'Conversion' : '付费转化率',
    ctr: isEn ? 'CTR' : '点击率',
    attributedRevenue: isEn ? 'Estimated revenue attributed to clicks' : '基于点击归因的预估收入',
    monthAccumulated: isEn ? 'Accumulated this month' : '本月累计',
    revenueTrend: isEn ? 'Revenue trend versus last month' : '相较上月的收入走势',
  };

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const result = await adminFetchJson<{
        success: true;
        data: {
          stats: Stats;
          recentUsers?: RecentUser[];
        };
      }>('/api/admin/stats');

      setStats(result.data.stats);
      setRecentUsers(result.data.recentUsers || []);
    } catch (fetchError) {
      console.error('Failed to fetch admin stats:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const formatCurrency = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }),
    [currency, locale],
  );

  const paidRate = useMemo(() => {
    if (!stats?.totalUsers) {
      return '0.0';
    }
    return ((stats.paidUsers / stats.totalUsers) * 100).toFixed(1);
  }, [stats]);

  const activeRate = useMemo(() => {
    if (!stats?.totalUsers) {
      return '0.0';
    }
    return ((stats.activeUsers / stats.totalUsers) * 100).toFixed(1);
  }, [stats]);

  const adCtr = useMemo(() => {
    if (!stats?.adImpressions) {
      return '0.00';
    }
    return ((stats.adClicks / stats.adImpressions) * 100).toFixed(2);
  }, [stats]);

  const contractsPerUser = useMemo(() => {
    if (!stats?.totalUsers) {
      return '0.0';
    }
    return (stats.totalContracts / stats.totalUsers).toFixed(1);
  }, [stats]);

  const planLabel = (plan: string) => {
    if (plan === 'free') {
      return isEn ? 'Free' : '免费版';
    }
    if (plan === 'pro') {
      return 'Pro';
    }
    return isEn ? 'Enterprise' : '企业版';
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats || error) {
    return (
      <Card>
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 py-12 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{error || copy.loadFailed}</p>
          <Button onClick={() => void fetchStats()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {copy.retry}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={copy.totalUsers}
          value={stats.totalUsers.toLocaleString(locale)}
          hint={`${isEn ? '+' : ''}${stats.newUsersToday} ${isEn ? 'today' : '今日新增'}`}
          icon={<Users className="h-4 w-4 text-gray-400" />}
          positive
        />
        <MetricCard
          title={copy.activeUsers}
          value={stats.activeUsers.toLocaleString(locale)}
          hint={`${copy.activeRate} ${activeRate}%`}
          icon={<Activity className="h-4 w-4 text-gray-400" />}
        />
        <MetricCard
          title={copy.paidUsers}
          value={stats.paidUsers.toLocaleString(locale)}
          hint={`${copy.conversionRate} ${paidRate}%`}
          icon={<CreditCard className="h-4 w-4 text-gray-400" />}
        />
        <MetricCard
          title={copy.monthlyRevenue}
          value={formatCurrency.format(stats.revenue)}
          hint={copy.revenueTrend}
          icon={<DollarSign className="h-4 w-4 text-gray-400" />}
          positive
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          title={copy.adImpressions}
          value={stats.adImpressions.toLocaleString(locale)}
          hint={copy.monthAccumulated}
          icon={<Eye className="h-4 w-4 text-gray-400" />}
        />
        <MetricCard
          title={copy.adClicks}
          value={stats.adClicks.toLocaleString(locale)}
          hint={`${copy.ctr} ${adCtr}%`}
          icon={<MousePointer className="h-4 w-4 text-gray-400" />}
        />
        <MetricCard
          title={copy.adRevenue}
          value={formatCurrency.format(stats.adRevenue)}
          hint={copy.attributedRevenue}
          icon={<DollarSign className="h-4 w-4 text-gray-400" />}
          positive
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{copy.contractMetrics}</CardTitle>
            <CardDescription>{copy.contractMetricsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryRow
              label={isEn ? 'Total Contracts' : '累计合同数'}
              hint={copy.allTime}
              value={stats.totalContracts.toLocaleString(locale)}
              icon={<FileText className="h-5 w-5 text-blue-600" />}
              tone="blue"
            />
            <SummaryRow
              label={copy.todayCreated}
              hint={isEn ? 'Real-time metric' : '实时统计'}
              value={stats.contractsToday.toLocaleString(locale)}
              icon={<TrendingUp className="h-5 w-5 text-green-600" />}
              tone="green"
            />
            <SummaryRow
              label={copy.contractsPerUser}
              hint={copy.avgContracts}
              value={contractsPerUser}
              icon={<Users className="h-5 w-5 text-purple-600" />}
              tone="purple"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.recentUsers}</CardTitle>
            <CardDescription>{copy.recentUsersDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUsers.length > 0 ? (
                recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between border-b py-2 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                        <span className="text-sm font-medium text-gray-600">
                          {user.nickname?.[0] || user.email?.[0] || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {user.nickname || copy.unnamedUser}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {planLabel(user.subscription_type)}
                      </span>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(user.created_at).toLocaleString(locale)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {copy.noRecentUsers}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon,
  positive = false,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
  positive?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={`text-xs ${positive ? 'text-green-600' : 'text-gray-500'}`}>{hint}</p>
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  label,
  hint,
  value,
  icon,
  tone,
}: {
  label: string;
  hint: string;
  value: string;
  icon: ReactNode;
  tone: 'blue' | 'green' | 'purple';
}) {
  const tones = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    purple: 'bg-purple-100',
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
          {icon}
        </div>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-gray-500">{hint}</p>
        </div>
      </div>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}
