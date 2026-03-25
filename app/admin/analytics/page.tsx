'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  Loader2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '@/components/language-provider';

interface AnalyticsData {
  userTrend: Array<{ date: string; count: number }>;
  contractTrend: Array<{ date: string; count: number }>;
  revenueTrend: Array<{ date: string; amount: number }>;
  subscriptionChart: Array<{ name: string; value: number }>;
  contractTypeChart: Array<{ name: string; value: number }>;
  paymentMethodChart: Array<{ name: string; value: number }>;
  stats: {
    activeUsers7d: number;
    totalUsers: number;
    activeRate: string;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?days=${days}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalContracts = data.contractTrend.reduce((sum, item) => sum + item.count, 0);
  const totalRevenue = data.revenueTrend.reduce((sum, item) => sum + item.amount, 0);
  const totalNewUsers = data.userTrend.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'Analytics' : '数据分析'}</h1>
          <p className="text-gray-500">{isEn ? 'Detailed platform metrics and trend analysis' : '查看平台详细数据统计和趋势分析'}</p>
        </div>
        <div className="flex gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{isEn ? 'Last 7 days' : '最近7天'}</SelectItem>
              <SelectItem value="30">{isEn ? 'Last 30 days' : '最近30天'}</SelectItem>
              <SelectItem value="90">{isEn ? 'Last 90 days' : '最近90天'}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {isEn ? 'Export Report' : '导出报告'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'New Users' : '新增用户'}</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalNewUsers.toLocaleString(locale)}</div>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              {isEn ? `Last ${days} days` : `最近 ${days} 天`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Contracts Generated' : '合同生成'}</CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContracts.toLocaleString(locale)}</div>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              {isEn ? `Last ${days} days` : `最近 ${days} 天`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Revenue' : '总收入'}</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isEn ? '$' : '¥'}{totalRevenue.toLocaleString(locale)}</div>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              {isEn ? `Last ${days} days` : `最近 ${days} 天`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{isEn ? 'Active Rate' : '活跃率'}</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.activeRate}%</div>
            <div className="flex items-center text-xs text-gray-500 mt-1">
              {isEn ? '7-day active users / total users' : '7天内活跃 / 总用户'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends">
        <TabsList>
          <TabsTrigger value="trends">{isEn ? 'Trends' : '趋势分析'}</TabsTrigger>
          <TabsTrigger value="distribution">{isEn ? 'Distribution' : '分布统计'}</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{isEn ? 'User Growth Trend' : '用户增长趋势'}</CardTitle>
                <CardDescription>{isEn ? 'Daily new users' : '每日新增用户数量'}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.userTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#0088FE"
                      name={isEn ? 'New Users' : '新增用户'}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? 'Contract Generation Trend' : '合同生成趋势'}</CardTitle>
                <CardDescription>{isEn ? 'Daily generated contracts' : '每日合同生成数量'}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.contractTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#00C49F" name={isEn ? 'Contracts' : '合同数量'} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {data.revenueTrend.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{isEn ? 'Revenue Trend' : '收入趋势'}</CardTitle>
                  <CardDescription>{isEn ? 'Daily revenue amount' : '每日收入金额'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#FFBB28"
                        name={isEn ? 'Revenue' : '收入金额 (¥)'}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.subscriptionChart.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{isEn ? 'Subscription Distribution' : '订阅类型分布'}</CardTitle>
                  <CardDescription>{isEn ? 'User share by subscription plan' : '用户订阅方案占比'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.subscriptionChart}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {data.subscriptionChart.map((entry, index) => (
                          <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {data.contractTypeChart.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{isEn ? 'Contract Type Distribution' : '合同类型分布'}</CardTitle>
                  <CardDescription>{isEn ? 'Share by contract type' : '各类型合同数量占比'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.contractTypeChart}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {data.contractTypeChart.map((entry, index) => (
                          <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {data.paymentMethodChart.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{isEn ? 'Payment Method Distribution' : '支付方式分布'}</CardTitle>
                  <CardDescription>{isEn ? 'Usage by payment method' : '各支付方式使用占比'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.paymentMethodChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#8884D8" name={isEn ? 'Orders' : '订单数量'} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? 'User Activity' : '用户活跃度'}</CardTitle>
                <CardDescription>{isEn ? '7-day active user stats' : '7天内活跃用户统计'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{isEn ? 'Total Users' : '总用户数'}</span>
                    <span className="text-2xl font-bold">{data.stats.totalUsers.toLocaleString(locale)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{isEn ? 'Active in 7 days' : '7天活跃用户'}</span>
                    <span className="text-2xl font-bold text-green-600">
                      {data.stats.activeUsers7d.toLocaleString(locale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-sm font-medium">{isEn ? 'Active Rate' : '活跃率'}</span>
                    <span className="text-3xl font-bold text-primary">{data.stats.activeRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
