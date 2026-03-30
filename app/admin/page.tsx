'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  Loader2,
  MousePointer,
  TrendingUp,
  Users,
} from 'lucide-react';

import { adminFetchJson } from '@/lib/admin/client';
import { useLanguage } from '@/components/language-provider';
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';
  const currencyPrefix = isEn ? '$' : '¥';

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await adminFetchJson<{
          success: true;
          data: {
            stats: Stats;
            recentUsers?: RecentUser[];
          };
        }>('/api/admin/stats');

        setStats(result.data.stats);
        setRecentUsers(result.data.recentUsers || []);
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, []);

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
      return isEn ? 'Free' : '免费';
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

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">
          {isEn ? 'Failed to load dashboard data. Please refresh.' : '加载仪表盘数据失败，请刷新后重试。'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isEn ? 'Dashboard' : '仪表盘'}</h1>
        <p className="text-gray-500">
          {isEn ? "Welcome back. Here's today's platform overview." : '欢迎回来，这里是今天的平台总览。'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Total Users' : '总用户数'}
            </CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString(locale)}</div>
            <p className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="h-3 w-3" />
              {isEn ? `+${stats.newUsersToday} today` : `今日新增 ${stats.newUsersToday}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Active Users' : '活跃用户'}
            </CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500">
              {isEn ? `Active rate ${activeRate}%` : `活跃率 ${activeRate}%`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Paid Users' : '付费用户'}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.paidUsers.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500">
              {isEn ? `Conversion ${paidRate}%` : `转化率 ${paidRate}%`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Monthly Revenue' : '本月收入'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencyPrefix}
              {stats.revenue.toLocaleString(locale)}
            </div>
            <p className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="h-3 w-3" />
              {isEn ? 'Revenue trend vs last month' : '对比上月的收入趋势'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Ad Impressions' : '广告展示'}
            </CardTitle>
            <Eye className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.adImpressions.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500">
              {isEn ? 'Total this month' : '本月累计'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Ad Clicks' : '广告点击'}
            </CardTitle>
            <MousePointer className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.adClicks.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500">
              {isEn ? `CTR ${adCtr}%` : `点击率 ${adCtr}%`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Ad Revenue' : '广告收入'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencyPrefix}
              {stats.adRevenue.toLocaleString(locale)}
            </div>
            <p className="text-xs text-green-600">
              {isEn ? 'Estimated revenue from ad clicks' : '基于点击估算的广告收入'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Contract Metrics' : '合同数据'}</CardTitle>
            <CardDescription>
              {isEn ? 'Core metrics for generated contracts.' : '已生成合同的核心指标。'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{isEn ? 'Total Contracts' : '累计合同数'}</p>
                    <p className="text-sm text-gray-500">{isEn ? 'All time' : '历史累计'}</p>
                  </div>
                </div>
                <span className="text-xl font-bold">{stats.totalContracts.toLocaleString(locale)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{isEn ? 'Generated Today' : '今日生成'}</p>
                    <p className="text-sm text-gray-500">{isEn ? 'Real-time metric' : '实时统计'}</p>
                  </div>
                </div>
                <span className="text-xl font-bold">{stats.contractsToday.toLocaleString(locale)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">{isEn ? 'Contracts per User' : '人均合同数'}</p>
                    <p className="text-sm text-gray-500">
                      {isEn ? 'Average generated contracts' : '平均每位用户生成的合同数'}
                    </p>
                  </div>
                </div>
                <span className="text-xl font-bold">{contractsPerUser}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Recent Users' : '最近注册用户'}</CardTitle>
            <CardDescription>
              {isEn ? 'Newest users who joined the platform.' : '最近加入平台的新用户。'}
            </CardDescription>
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
                          {user.nickname || (isEn ? 'Unnamed' : '未命名用户')}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                          user.subscription_type === 'free'
                            ? 'bg-gray-100 text-gray-600'
                            : user.subscription_type === 'pro'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-purple-100 text-purple-600'
                        }`}
                      >
                        {planLabel(user.subscription_type)}
                      </span>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(user.created_at).toLocaleString(locale)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-gray-400">
                  {isEn ? 'No recent user data yet.' : '暂时还没有最近用户数据。'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
