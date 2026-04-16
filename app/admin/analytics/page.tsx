'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, DollarSign, FileText, Loader2, RefreshCw, TrendingUp, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminFetchJson } from '@/lib/admin/client';

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
  const { language } = useLanguage();
  const isEn = language === 'en';
  const locale = isEn ? 'en-US' : 'zh-CN';

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [error, setError] = useState('');

  const copy = useMemo(
    () => ({
      title: isEn ? 'Analytics' : '数据分析',
      description: isEn ? 'Inspect growth, contract usage, revenue, and payment structure.' : '查看增长、合同使用、收入与支付结构等关键数据。',
      retry: isEn ? 'Retry' : '重新加载',
      export: isEn ? 'Export Report' : '导出报表',
      loadFailed: isEn ? 'Failed to load analytics data.' : '加载分析数据失败。',
      noChartData: isEn ? 'No chart data available for this range.' : '当前时间范围内暂无可展示的数据。',
      lastDays: isEn ? `Last ${days} days` : `最近 ${days} 天`,
      newUsers: isEn ? 'New Users' : '新增用户',
      contractsGenerated: isEn ? 'Contracts Generated' : '生成合同数',
      revenue: isEn ? 'Revenue' : '收入',
      activeRate: isEn ? 'Active Rate' : '活跃率',
      trends: isEn ? 'Trends' : '趋势分析',
      distribution: isEn ? 'Distribution' : '结构分布',
      userTrend: isEn ? 'User Growth Trend' : '用户增长趋势',
      userTrendDesc: isEn ? 'Daily new user acquisition.' : '按天查看新增用户数量。',
      contractTrend: isEn ? 'Contract Generation Trend' : '合同生成趋势',
      contractTrendDesc: isEn ? 'Daily generated contracts.' : '按天查看合同生成数量。',
      revenueTrend: isEn ? 'Revenue Trend' : '收入趋势',
      revenueTrendDesc: isEn ? 'Daily revenue changes.' : '按天查看收入变化。',
      subscriptionDistribution: isEn ? 'Subscription Distribution' : '订阅套餐分布',
      subscriptionDistributionDesc: isEn ? 'Share by subscription plan.' : '不同订阅套餐的占比分布。',
      contractTypeDistribution: isEn ? 'Contract Type Distribution' : '合同类型分布',
      contractTypeDistributionDesc: isEn ? 'Share by contract type.' : '不同合同类型的占比分布。',
      paymentDistribution: isEn ? 'Payment Method Distribution' : '支付方式分布',
      paymentDistributionDesc: isEn ? 'Usage split by payment method.' : '不同支付方式的使用占比。',
      userActivity: isEn ? 'User Activity' : '用户活跃',
      userActivityDesc: isEn ? '7-day active user metrics.' : '最近 7 天的活跃用户情况。',
      totalUsers: isEn ? 'Total Users' : '总用户数',
      activeUsers7d: isEn ? 'Active in 7 days' : '7 天内活跃用户',
      last7: isEn ? 'Last 7 days' : '最近 7 天',
      last30: isEn ? 'Last 30 days' : '最近 30 天',
      last90: isEn ? 'Last 90 days' : '最近 90 天',
      contractTypeCustom: isEn ? 'Custom' : '自定义',
      contractTypeLabor: isEn ? 'Labor' : '劳动合同',
      contractTypeService: isEn ? 'Service' : '服务合同',
      contractTypeCooperation: isEn ? 'Cooperation' : '合作协议',
      contractTypeNda: isEn ? 'NDA' : '保密协议',
      paymentCard: isEn ? 'Card' : '银行卡',
      paymentManual: isEn ? 'Manual' : '人工处理',
      paymentWechat: isEn ? 'WeChat Pay' : '微信支付',
      free: isEn ? 'Free' : '免费版',
      enterprise: isEn ? 'Enterprise' : '企业版',
      activityHint: isEn ? '7-day active users / total users' : '7 天活跃用户 / 总用户数',
    }),
    [days, isEn],
  );

  const mapSubscriptionName = useCallback(
    (value: string) => {
      if (value === 'free') {
        return copy.free;
      }
      if (value === 'pro') {
        return 'Pro';
      }
      if (value === 'enterprise') {
        return copy.enterprise;
      }
      return value;
    },
    [copy.enterprise, copy.free],
  );

  const mapContractTypeName = useCallback(
    (value: string) => {
      const labels: Record<string, string> = {
        labor: copy.contractTypeLabor,
        service: copy.contractTypeService,
        cooperation: copy.contractTypeCooperation,
        nda: copy.contractTypeNda,
        custom: copy.contractTypeCustom,
      };
      return labels[value] || value;
    },
    [
      copy.contractTypeCooperation,
      copy.contractTypeCustom,
      copy.contractTypeLabor,
      copy.contractTypeNda,
      copy.contractTypeService,
    ],
  );

  const mapPaymentMethodName = useCallback(
    (value: string) => {
      const labels: Record<string, string> = {
        stripe: 'Stripe',
        alipay: 'Alipay',
        wechat: copy.paymentWechat,
        card: copy.paymentCard,
        manual: copy.paymentManual,
      };
      return labels[value] || value;
    },
    [copy.paymentCard, copy.paymentManual, copy.paymentWechat],
  );

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await adminFetchJson<{ success: true; data: AnalyticsData }>(`/api/admin/analytics?days=${days}`);
      setData(result.data);
    } catch (fetchError) {
      console.error('[AdminAnalytics] Failed to fetch analytics:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed, days]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const totalContracts = useMemo(() => data?.contractTrend.reduce((sum, item) => sum + item.count, 0) || 0, [data]);
  const totalRevenue = useMemo(() => data?.revenueTrend.reduce((sum, item) => sum + item.amount, 0) || 0, [data]);
  const totalNewUsers = useMemo(() => data?.userTrend.reduce((sum, item) => sum + item.count, 0) || 0, [data]);
  const localizedSubscriptionChart = useMemo(
    () => data?.subscriptionChart.map((item) => ({ ...item, name: mapSubscriptionName(item.name) })) || [],
    [data, mapSubscriptionName],
  );
  const localizedContractTypeChart = useMemo(
    () => data?.contractTypeChart.map((item) => ({ ...item, name: mapContractTypeName(item.name) })) || [],
    [data, mapContractTypeName],
  );
  const localizedPaymentMethodChart = useMemo(
    () => data?.paymentMethodChart.map((item) => ({ ...item, name: mapPaymentMethodName(item.name) })) || [],
    [data, mapPaymentMethodName],
  );

  const exportReport = () => {
    const payload = JSON.stringify({ days, data }, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-analytics-${days}d.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex min-h-[300px] flex-col items-center justify-center gap-4 py-12 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{error || copy.loadFailed}</p>
          <Button onClick={() => void fetchAnalytics()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {copy.retry}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.description}</p>
        </div>
        <div className="flex gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{copy.last7}</SelectItem>
              <SelectItem value="30">{copy.last30}</SelectItem>
              <SelectItem value="90">{copy.last90}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            {copy.export}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric title={copy.newUsers} value={totalNewUsers.toLocaleString(locale)} hint={copy.lastDays} icon={<Users className="h-4 w-4 text-gray-400" />} />
        <Metric title={copy.contractsGenerated} value={totalContracts.toLocaleString(locale)} hint={copy.lastDays} icon={<FileText className="h-4 w-4 text-gray-400" />} />
        <Metric title={copy.revenue} value={new Intl.NumberFormat(locale, { style: 'currency', currency: isEn ? 'USD' : 'CNY', maximumFractionDigits: 0 }).format(totalRevenue)} hint={copy.lastDays} icon={<DollarSign className="h-4 w-4 text-gray-400" />} />
        <Metric title={copy.activeRate} value={`${data.stats.activeRate}%`} hint={copy.activityHint} icon={<TrendingUp className="h-4 w-4 text-gray-400" />} />
      </div>

      <Tabs defaultValue="trends">
        <TabsList>
          <TabsTrigger value="trends">{copy.trends}</TabsTrigger>
          <TabsTrigger value="distribution">{copy.distribution}</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-6">
          <ChartCard title={copy.userTrend} description={copy.userTrendDesc} hasData={data.userTrend.length > 0} emptyText={copy.noChartData}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.userTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#0088FE" name={copy.newUsers} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={copy.contractTrend} description={copy.contractTrendDesc} hasData={data.contractTrend.length > 0} emptyText={copy.noChartData}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.contractTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#00C49F" name={copy.contractsGenerated} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={copy.revenueTrend} description={copy.revenueTrendDesc} hasData={data.revenueTrend.length > 0} emptyText={copy.noChartData}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#FFBB28" name={copy.revenue} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title={copy.subscriptionDistribution} description={copy.subscriptionDistributionDesc} hasData={localizedSubscriptionChart.length > 0} emptyText={copy.noChartData}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={localizedSubscriptionChart}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {localizedSubscriptionChart.map((entry, index) => (
                      <Cell key={`subscription-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={copy.contractTypeDistribution} description={copy.contractTypeDistributionDesc} hasData={localizedContractTypeChart.length > 0} emptyText={copy.noChartData}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={localizedContractTypeChart}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {localizedContractTypeChart.map((entry, index) => (
                      <Cell key={`contract-type-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={copy.paymentDistribution} description={copy.paymentDistributionDesc} hasData={localizedPaymentMethodChart.length > 0} emptyText={copy.noChartData}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={localizedPaymentMethodChart}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {localizedPaymentMethodChart.map((entry, index) => (
                      <Cell key={`payment-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader>
                <CardTitle>{copy.userActivity}</CardTitle>
                <CardDescription>{copy.userActivityDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Metric title={copy.totalUsers} value={data.stats.totalUsers.toLocaleString(locale)} hint={copy.lastDays} icon={<Users className="h-4 w-4 text-gray-400" />} />
                <Metric title={copy.activeUsers7d} value={data.stats.activeUsers7d.toLocaleString(locale)} hint={copy.last7} icon={<TrendingUp className="h-4 w-4 text-gray-400" />} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-gray-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  hasData,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  hasData: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{hasData ? children : <div className="py-16 text-center text-muted-foreground">{emptyText}</div>}</CardContent>
    </Card>
  );
}
