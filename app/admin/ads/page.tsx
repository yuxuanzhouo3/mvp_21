'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Eye,
  MousePointer,
  DollarSign,
  TrendingUp,
  Loader2,
} from 'lucide-react';
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
        setTrend(result.data.trend);
      }
    } catch (error) {
      console.error('Failed to fetch ad metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'Ad Management' : '广告管理'}</h1>
          <p className="text-gray-500">{isEn ? 'Manage ad slots and monitor campaign performance' : '管理平台广告位和监控广告效果'}</p>
        </div>
        <Button>{isEn ? 'Create Slot' : '创建广告位'}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Impressions' : '总展示次数'}</CardTitle>
            <Eye className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalImpressions.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500 mt-1">{isEn ? 'Total ad exposure' : '广告总曝光量'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Clicks' : '总点击次数'}</CardTitle>
            <MousePointer className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClicks.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500 mt-1">{isEn ? 'User click count' : '用户点击量'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'CTR' : '点击率 (CTR)'}</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ctr}%</div>
            <p className="text-xs text-gray-500 mt-1">{isEn ? 'Click to impression ratio' : '点击/展示比率'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Ad Revenue' : '广告收入'}</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isEn ? '$' : '¥'}{stats.revenue.toLocaleString(locale)}</div>
            <p className="text-xs text-gray-500 mt-1">{isEn ? 'Estimated total revenue' : '预估总收入'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {trend.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{isEn ? 'Impression & Click Trend' : '广告展示与点击趋势'}</CardTitle>
                <CardDescription>{isEn ? 'Ad metrics over the past 7 days' : '最近7天的广告数据变化'}</CardDescription>
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
                <CardDescription>{isEn ? 'Daily CTR trend' : '每日CTR变化情况'}</CardDescription>
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
        )}

        {trend.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              {isEn ? 'No ad data yet. Launch a campaign first.' : '暂无广告数据，请先投放广告'}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEn ? 'Ad Slot Guidelines' : '广告位配置说明'}</CardTitle>
          <CardDescription>{isEn ? 'Recommended placement setup in product surfaces' : '如何在应用中集成广告位'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">{isEn ? 'Banner Ads' : '横幅广告'}</h4>
              <p className="text-sm text-blue-700">
                {isEn ? 'Recommended size: 728x90 or 320x50 (mobile)' : '推荐尺寸: 728x90 或 320x50 (移动端)'}
                <br />
                {isEn ? 'Best positions: top or bottom area' : '适用位置: 页面顶部、底部'}
              </p>
            </div>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">{isEn ? 'Sidebar Ads' : '侧边栏广告'}</h4>
              <p className="text-sm text-green-700">
                {isEn ? 'Recommended size: 300x250 or 160x600' : '推荐尺寸: 300x250 或 160x600'}
                <br />
                {isEn ? 'Best positions: page sidebars' : '适用位置: 页面侧边栏'}
              </p>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-2">{isEn ? 'Inline Ads' : '内嵌广告'}</h4>
              <p className="text-sm text-purple-700">
                {isEn ? 'Recommended size: 300x250' : '推荐尺寸: 300x250'}
                <br />
                {isEn ? 'Best positions: inside content feeds' : '适用位置: 内容流中'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
