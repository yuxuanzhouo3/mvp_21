'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, MousePointer, DollarSign, TrendingUp, Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '@/components/language-provider';

interface AdStats {
  totalImpressions: number;
  totalClicks: number;
  ctr: string;
  revenue: number;
}

interface AdTrend {
  date: string;
  impressions: number;
  clicks: number;
  ctr: string;
}

export default function AdsPage() {
  const [stats, setStats] = useState<AdStats | null>(null);
  const [trend, setTrend] = useState<AdTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';
  const currencyPrefix = isEn ? '$' : '¥';

  useEffect(() => {
    fetchAdStats();
  }, []);

  const fetchAdStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/ads');
      const result = await response.json();

      if (result.success) {
        setStats(result.data.stats);
        setTrend(result.data.trend || []);
      }
    } catch (error) {
      console.error('Failed to fetch ad metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'Ad Management' : '广告管理'}</h1>
          <p className="text-gray-500">
            {isEn
              ? 'Monitor ad slots and campaign performance.'
              : '查看广告位与投放效果表现。'}
          </p>
        </div>
        <Button>{isEn ? 'Create Slot' : '创建广告位'}</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Impressions' : '展示次数'}
            </CardTitle>
            <Eye className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalImpressions.toLocaleString(locale)}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {isEn ? 'Total ad exposure' : '广告累计曝光量'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isEn ? 'Clicks' : '点击次数'}
            </CardTitle>
            <MousePointer className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalClicks.toLocaleString(locale)}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {isEn ? 'User click count' : '用户点击量'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">CTR</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ctr}%</div>
            <p className="mt-1 text-xs text-gray-500">
              {isEn ? 'Click-through rate' : '点击率'}
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
              {stats.revenue.toLocaleString(locale)}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {isEn ? 'Estimated total revenue' : '预估累计收入'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {trend.length > 0 ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>
                  {isEn ? 'Impression & Click Trend' : '展示与点击趋势'}
                </CardTitle>
                <CardDescription>
                  {isEn ? 'Ad performance over the last 7 days.' : '最近 7 天广告数据变化。'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="impressions"
                      stroke="#0088FE"
                      name={isEn ? 'Impressions' : '展示次数'}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="clicks"
                      stroke="#00C49F"
                      name={isEn ? 'Clicks' : '点击次数'}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? 'CTR Trend' : '点击率趋势'}</CardTitle>
                <CardDescription>
                  {isEn ? 'Daily CTR change.' : '每日点击率变化。'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ctr" fill="#FFBB28" name={isEn ? 'CTR (%)' : '点击率 (%)'} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              {isEn
                ? 'No ad data yet. Launch a campaign first.'
                : '暂时还没有广告数据，请先创建并投放广告。'}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEn ? 'Ad Slot Guidelines' : '广告位建议'}</CardTitle>
          <CardDescription>
            {isEn
              ? 'Recommended placements across product surfaces.'
              : '适合在产品不同位置使用的广告位建议。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h4 className="mb-2 font-semibold text-blue-900">
                {isEn ? 'Banner Ads' : '横幅广告'}
              </h4>
              <p className="text-sm text-blue-700">
                {isEn
                  ? 'Recommended size: 728x90 or 320x50 on mobile.'
                  : '推荐尺寸：728x90，移动端可使用 320x50。'}
                <br />
                {isEn
                  ? 'Best positions: page top and page bottom.'
                  : '适合位置：页面顶部和底部。'}
              </p>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <h4 className="mb-2 font-semibold text-green-900">
                {isEn ? 'Sidebar Ads' : '侧边栏广告'}
              </h4>
              <p className="text-sm text-green-700">
                {isEn
                  ? 'Recommended size: 300x250 or 160x600.'
                  : '推荐尺寸：300x250 或 160x600。'}
                <br />
                {isEn
                  ? 'Best positions: persistent sidebars in dashboard pages.'
                  : '适合位置：后台或内容页的侧边栏。'}
              </p>
            </div>

            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <h4 className="mb-2 font-semibold text-purple-900">
                {isEn ? 'Inline Ads' : '内容流广告'}
              </h4>
              <p className="text-sm text-purple-700">
                {isEn
                  ? 'Recommended size: 300x250.'
                  : '推荐尺寸：300x250。'}
                <br />
                {isEn
                  ? 'Best positions: between feed items or document cards.'
                  : '适合位置：内容流、列表项或卡片之间。'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
