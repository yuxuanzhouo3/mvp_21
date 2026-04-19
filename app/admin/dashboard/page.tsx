"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getUserStats, getUserTrends } from "@/actions/admin-users";
import { getPaymentStats, getPaymentTrends } from "@/actions/admin-payments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isValidPaymentStats } from "@/lib/utils/validation";
import { RegionConfig, isChinaRegion } from "@/lib/config/region";
import { Loader2, Users, DollarSign, TrendingUp, Activity } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

function getRegion(): "CN" | "INTL" {
  const region =
    (process.env.NEXT_PUBLIC_DEPLOYMENT_REGION ||
      process.env.NEXT_PUBLIC_APP_REGION ||
      "CN")
      .trim()
      .toUpperCase();

  return region === "INTL" ? "INTL" : "CN";
}

const isIntlRegion = getRegion() === "INTL";
const tx = (zh: string, en: string) => (isIntlRegion ? en : zh);

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange] = useState("30");

  const [userStats, setUserStats] = useState<any>(null);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const [userTrends, setUserTrends] = useState<any>(null);
  const [paymentTrends, setPaymentTrends] = useState<any>(null);

  const loadAllStats = useCallback(async () => {
    setError(null);
    try {
      const days = Number.parseInt(timeRange, 10);

      const users = await getUserStats();
      const payments = await getPaymentStats();
      const userTrendData = await getUserTrends(days);
      const paymentTrendData = await getPaymentTrends(days);

      if (!users.success) {
        throw new Error(tx("用户统计加载失败", "Failed to load user stats"));
      }
      if (!payments.success) {
        throw new Error(tx("支付统计加载失败", "Failed to load payment stats"));
      }
      if (!userTrendData.success) {
        throw new Error(tx("用户趋势加载失败", "Failed to load user trend data"));
      }
      if (!paymentTrendData.success) {
        throw new Error(tx("收入趋势加载失败", "Failed to load revenue trend data"));
      }

      setUserStats(users.data);
      setPaymentStats(payments.data);
      setUserTrends(userTrendData.data);
      setPaymentTrends(paymentTrendData.data);
      setLoading(false);
      setRefreshing(false);
    } catch (err: any) {
      setError(err?.message || tx("加载统计数据失败", "Failed to load dashboard metrics"));
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    setLoading(true);
    void loadAllStats();
  }, [loadAllStats]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !loading && !refreshing) {
        void loadAllStats();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loading, refreshing, loadAllStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    setUserStats(null);
    setPaymentStats(null);
    setUserTrends(null);
    setPaymentTrends(null);
    await loadAllStats();
  };

  const numberLocale = isIntlRegion ? "en-US" : "zh-CN";

  const formatAmount = useCallback(
    (amount: number) =>
      new Intl.NumberFormat(numberLocale, {
        style: "currency",
        currency: RegionConfig.payment.currency,
      }).format(amount),
    [numberLocale],
  );

  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(numberLocale).format(value),
    [numberLocale],
  );

  const subscriptionItems = useMemo(
    () => [
      { label: tx("免费用户", "Free users"), value: userStats?.free || 0, color: "bg-gray-500" },
      { label: tx("专业版", "Pro"), value: userStats?.pro || 0, color: "bg-green-500" },
      { label: tx("企业版", "Enterprise"), value: userStats?.enterprise || 0, color: "bg-purple-500" },
    ],
    [userStats],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tx("后台数据概览", "Admin Metrics Overview")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tx("查看用户、付费与趋势数据", "Track users, revenue, and engagement trends")}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <Loader2 className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {tx("刷新", "Refresh")}
        </Button>
      </div>

      {error ? (
        <Card className="border-red-600">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {loading || !userStats || !paymentStats || !isValidPaymentStats(paymentStats) ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{tx("总用户数", "Total users")}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatNumber(userStats?.total || 0)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tx("今日新增", "New today")}{" "}
                  <span className="font-semibold text-green-600">+{userStats?.newToday || 0}</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{tx("月活用户", "Monthly active users")}</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatNumber(userStats?.monthlyActive || 0)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tx("日活", "DAU")} <span className="font-medium">{userStats?.dailyActive || 0}</span> /{" "}
                  {tx("周活", "WAU")} <span className="font-medium">{userStats?.activeThisWeek || 0}</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{tx("总收入", "Total revenue")}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold leading-tight">
                  {formatAmount(paymentStats?.totalRevenue || 0)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tx("今日", "Today")}:{" "}
                  <span className="font-semibold text-green-600">
                    +{formatAmount(paymentTrends?.todayRevenue || 0)}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{tx("付费用户", "Paying users")}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatNumber(userStats?.paidUsers || 0)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tx("转化率", "Conversion")}{" "}
                  <span className="font-semibold text-primary">{userStats?.conversionRate || 0}%</span>
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {isChinaRegion() ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">{tx("国内版", "CN deployment")}</CardTitle>
                  <p className="text-xs text-muted-foreground">{tx("数据概览", "Summary")}</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-3xl font-bold">{formatNumber(userStats?.byRegion?.domestic || 0)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{tx("用户数", "Users")}</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">
                        {formatAmount((paymentStats?.byMethod?.wechat ?? 0) + (paymentStats?.byMethod?.alipay ?? 0))}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{tx("总收入", "Revenue")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">{tx("国际版", "INTL deployment")}</CardTitle>
                  <p className="text-xs text-muted-foreground">{tx("数据概览", "Summary")}</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-3xl font-bold">
                        {formatNumber(userStats?.byRegion?.international || 0)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{tx("用户数", "Users")}</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">
                        {formatAmount(paymentStats?.byMethod?.stripe ?? 0)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{tx("总收入", "Revenue")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Tabs defaultValue="users" className="space-y-4">
            <TabsList>
              <TabsTrigger value="users">{tx("用户趋势", "User trend")}</TabsTrigger>
              <TabsTrigger value="revenue">{tx("收入趋势", "Revenue trend")}</TabsTrigger>
              <TabsTrigger value="devices">{tx("设备分布", "Device mix")}</TabsTrigger>
              <TabsTrigger value="subscriptions">{tx("订阅分布", "Plan mix")}</TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>{tx("活跃用户趋势", "Active user trend")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={userTrends?.daily || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis width={40} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar
                          dataKey={isChinaRegion() ? "activeUsersDomestic" : "activeUsersInternational"}
                          fill="hsl(var(--primary))"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="revenue">
              <Card>
                <CardHeader>
                  <CardTitle>{tx("收入趋势", "Revenue trend")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={paymentTrends?.daily || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis width={50} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey={isChinaRegion() ? "revenueCNY" : "revenueUSD"}
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="devices">
              <Card>
                <CardHeader>
                  <CardTitle>{tx("设备分布", "Device mix")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    {tx("暂无设备数据", "No device data yet")}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscriptions">
              <Card>
                <CardHeader>
                  <CardTitle>{tx("订阅分布", "Plan mix")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {subscriptionItems.map((item) => {
                      const totalUsers = userStats?.total || 1;
                      const percentage = ((item.value / totalUsers) * 100).toFixed(1);

                      return (
                        <div key={item.label}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span>{item.label}</span>
                            <span className="text-muted-foreground">{percentage}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full ${item.color}`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <p className="text-center text-xs text-muted-foreground">
            {tx("数据更新时间", "Last updated")}:{" "}
            {(paymentTrends?.lastUpdated
              ? new Date(paymentTrends.lastUpdated)
              : new Date()
            ).toLocaleString(numberLocale)}
          </p>
        </>
      )}
    </div>
  );
}
