'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  FileText,
  CreditCard,
  TrendingUp,
  Eye,
  MousePointer,
  DollarSign,
  Activity,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

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

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      const result = await response.json();

      if (result.success) {
        setStats(result.data.stats);
        setRecentUsers(result.data.recentUsers);
      }
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const planLabel = (plan: string) => {
    if (plan === 'free') return isEn ? 'Free' : '免费';
    if (plan === 'pro') return isEn ? 'Pro' : '专业';
    return isEn ? 'Enterprise' : '企业';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">{isEn ? 'Failed to load. Please refresh.' : '加载失败，请刷新页面重试'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isEn ? 'Dashboard' : '仪表盘'}</h1>
        <p className="text-gray-500">{isEn ? 'Welcome back. Here is today\'s overview.' : '欢迎回来，这是今日数据概览'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Total Users' : '总用户数'}</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString(locale)}</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {isEn ? `+${stats.newUsersToday} today` : `今日新增 ${stats.newUsersToday}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Active Users' : '活跃用户'}</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500">
              {isEn
                ? `Active rate ${(stats.activeUsers / stats.totalUsers * 100).toFixed(1)}%`
                : `活跃率 ${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Paid Users' : '付费用户'}</CardTitle>
            <CreditCard className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.paidUsers.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500">
              {isEn
                ? `Conversion ${(stats.paidUsers / stats.totalUsers * 100).toFixed(1)}%`
                : `转化率 ${((stats.paidUsers / stats.totalUsers) * 100).toFixed(1)}%`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Monthly Revenue' : '本月收入'}</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isEn ? '$' : '¥'}{stats.revenue.toLocaleString(locale)}</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {isEn ? '+12.5% vs last month' : '较上月 +12.5%'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Ad Impressions' : '广告展示'}</CardTitle>
            <Eye className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.adImpressions.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500">{isEn ? 'Total this month' : '本月总展示'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Ad Clicks' : '广告点击'}</CardTitle>
            <MousePointer className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.adClicks.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500">
              {isEn
                ? `CTR ${((stats.adClicks / stats.adImpressions) * 100).toFixed(2)}%`
                : `点击率 ${((stats.adClicks / stats.adImpressions) * 100).toFixed(2)}%`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Ad Revenue' : '广告收入'}</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isEn ? '$' : '¥'}{stats.adRevenue.toLocaleString(locale)}</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {isEn ? '+8.3% vs last month' : '较上月 +8.3%'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Contract Metrics' : '合同统计'}</CardTitle>
            <CardDescription>{isEn ? 'Contract generation metrics' : '用户合同生成情况'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{isEn ? 'Total Contracts' : '总合同数'}</p>
                    <p className="text-sm text-gray-500">{isEn ? 'All time' : '累计生成'}</p>
                  </div>
                </div>
                <span className="text-xl font-bold">{stats.totalContracts.toLocaleString(locale)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{isEn ? 'Generated Today' : '今日生成'}</p>
                    <p className="text-sm text-gray-500">{isEn ? 'Real-time' : '实时统计'}</p>
                  </div>
                </div>
                <span className="text-xl font-bold">{stats.contractsToday.toLocaleString(locale)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">{isEn ? 'Contracts per User' : '人均合同'}</p>
                    <p className="text-sm text-gray-500">{isEn ? 'Average per user' : '平均每用户'}</p>
                  </div>
                </div>
                <span className="text-xl font-bold">
                  {(stats.totalContracts / stats.totalUsers).toFixed(1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Recent Users' : '最近注册用户'}</CardTitle>
            <CardDescription>{isEn ? 'Latest joined users' : '最新加入的用户'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUsers.length > 0 ? (
                recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {user.nickname?.[0] || user.email?.[0] || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.nickname || (isEn ? 'Unnamed' : '未命名')}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                          user.subscription_type === 'free'
                            ? 'bg-gray-100 text-gray-600'
                            : user.subscription_type === 'pro'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-purple-100 text-purple-600'
                        }`}
                      >
                        {planLabel(user.subscription_type)}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(user.created_at).toLocaleString(locale)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-400 py-4">{isEn ? 'No user data yet' : '暂无用户数据'}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
