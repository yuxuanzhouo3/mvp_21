"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Activity, Clock3, RefreshCcw, ShieldCheck, UsersRound } from "lucide-react"
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
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DeploymentRegion = "CN" | "INTL"

function getRegion(): DeploymentRegion {
  const region =
    (process.env.NEXT_PUBLIC_DEPLOYMENT_REGION ||
      process.env.NEXT_PUBLIC_APP_REGION ||
      "CN")
      .trim()
      .toUpperCase()
  return region === "INTL" ? "INTL" : "CN"
}

const isIntlRegion = getRegion() === "INTL"
const tx = (zh: string, en: string) => (isIntlRegion ? en : zh)

type MarketAnalyticsData = {
  region: DeploymentRegion
  generatedAt: string
  rangeDays: number
  overview: {
    totalUsers: number
    newUsersInRange: number
    activeUsersInRange: number
    activeUsers7d: number
    activeUsers30d: number
    activeRate7d: number
    activeRate30d: number
    firstUseRate7dForNewUsers30d: number
    avgUsageEventsPerActiveUser30d: number
    medianFirstUseHours: number
    totalUsageEventsInRange: number
  }
  retention: {
    summary: {
      cohortUsers: number
      d1Rate: number
      d3Rate: number
      d7Rate: number
      d14Rate: number
      d30Rate: number
    }
    cohorts: Array<{
      cohortDate: string
      newUsers: number
      d1Users: number
      d3Users: number
      d7Users: number
      d14Users: number
      d30Users: number
      d1Rate: number
      d3Rate: number
      d7Rate: number
      d14Rate: number
      d30Rate: number
    }>
  }
  trends: Array<{
    date: string
    newUsers: number
    dau: number
    wau: number
    usageEvents: number
    firstUseUsers: number
  }>
  habits: {
    byWeekday: Array<{ label: string; events: number; activeUsers: number; share: number }>
    byHour: Array<{ label: string; events: number; activeUsers: number; share: number }>
    topTools: Array<{ toolId: string; toolName: string; events: number; activeUsers: number; share: number }>
  }
  firstUse: {
    topTools: Array<{ toolId: string; toolName: string; users: number; share: number }>
    latencyDistribution: Array<{ bucket: string; label: string; users: number; share: number }>
  }
  segmentation: {
    recency: Array<{ label: string; users: number; share: number }>
    frequency30d: Array<{ label: string; users: number; share: number }>
  }
}

type AnalyticsTabKey =
  | "overview"
  | "trends"
  | "retention"
  | "habits"
  | "tools"
  | "firstUse"
  | "segments"

const RANGE_OPTIONS = [14, 30, 60, 90] as const
const PIE_COLORS = ["#1d4ed8", "#0891b2", "#0d9488", "#65a30d", "#ca8a04", "#ea580c", "#dc2626", "#9333ea"]

const ANALYTICS_TABS: Array<{ key: AnalyticsTabKey; label: string }> = [
  { key: "overview", label: tx("核心指标", "Core Metrics") },
  { key: "trends", label: tx("活跃趋势", "Activity Trends") },
  { key: "retention", label: tx("Cohort 留存", "Cohort Retention") },
  { key: "habits", label: tx("使用习惯", "Usage Habits") },
  { key: "tools", label: tx("工具偏好", "Tool Preferences") },
  { key: "firstUse", label: tx("首次使用", "First Use") },
  { key: "segments", label: tx("用户分群", "User Segments") },
]

function pct(value: number) {
  return `${Number(value || 0).toFixed(2)}%`
}

function shortDate(value: string) {
  if (!value) return "-"
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${month}-${day}`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "-"
  return date.toLocaleString()
}

function StatCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function LoadingDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}

export function MarketAnalyticsDashboardClient() {
  const router = useRouter()
  const [tab, setTab] = useState<AnalyticsTabKey>("overview")
  const [days, setDays] = useState<number>(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [data, setData] = useState<MarketAnalyticsData | null>(null)

  const loadData = useCallback(
    async (nextDays: number) => {
      setLoading(true)
      setError("")

      try {
        const response = await fetch(`/api/market/admin/analytics?days=${nextDays}`, { cache: "no-store" })
        if (response.status === 401) {
          router.replace("/market/login")
          return
        }

        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result?.success || !result?.analytics) {
          throw new Error(result?.error || "Failed to load analytics")
        }

        setData(result.analytics as MarketAnalyticsData)
      } catch (err: any) {
        setError(err?.message || "Failed to load analytics")
      } finally {
        setLoading(false)
      }
    },
    [router],
  )

  useEffect(() => {
    void loadData(days)
  }, [days, loadData])

  const retentionCards = useMemo(() => {
    if (!data) return []
    return [
      { label: tx("D1 留存", "D1 Retention"), value: data.retention.summary.d1Rate },
      { label: tx("D3 留存", "D3 Retention"), value: data.retention.summary.d3Rate },
      { label: tx("D7 留存", "D7 Retention"), value: data.retention.summary.d7Rate },
      { label: tx("D14 留存", "D14 Retention"), value: data.retention.summary.d14Rate },
      { label: tx("D30 留存", "D30 Retention"), value: data.retention.summary.d30Rate },
    ]
  }, [data])

  const logout = async () => {
    await fetch("/api/market/auth/logout", { method: "POST" }).catch(() => null)
    router.replace("/market/login")
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="h-14 border-b bg-background px-6 flex items-center justify-between">
        <div className="font-semibold">{tx("1. 用户分析系统", "1. User Analytics System")}</div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            {tx("区域", "Region")}: {data?.region || tx("加载中", "Loading")}
          </Badge>
          <Button variant="outline" onClick={() => void loadData(days)} disabled={loading} className="gap-1.5">
            <RefreshCcw className="h-4 w-4" />
            {loading ? tx("刷新中...", "Refreshing...") : tx("刷新", "Refresh")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/market">{tx("返回系统导航", "Back to System Navigation")}</Link>
          </Button>
          <Button variant="destructive" onClick={logout}>
            {tx("退出登录", "Sign out")}
          </Button>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-56px)]">
        <aside className="w-56 border-r bg-background p-3 space-y-1">
          {ANALYTICS_TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                tab === item.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <main className="flex-1 p-6 space-y-4">
          <div className="text-sm text-muted-foreground">{tx("留存、活跃率、习惯分布、首次使用行为分析", "Retention, activity rate, behavior distribution, and first-use analysis")}</div>
          <Card>
            <CardHeader className="space-y-3 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{tx("时间范围", "Time range")}</span>
                {RANGE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={days === option ? "default" : "outline"}
                    onClick={() => setDays(option)}
                    disabled={loading}
                  >
                    {tx("近", "Last")} {option} {tx("天", "days")}
                  </Button>
                ))}
              </div>
              <CardDescription>{tx("数据生成时间", "Generated at")}: {data ? formatDateTime(data.generatedAt) : "-"}</CardDescription>
            </CardHeader>
          </Card>

          {error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          {loading && !data ? <LoadingDashboard /> : null}

          {data ? (
            <>
              {tab === "overview" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <UsersRound className="h-4 w-4" />
                      {tx("核心指标", "Core Metrics")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <StatCard title={tx("总用户数", "Total Users")} value={data.overview.totalUsers} hint={`${tx("近", "Last")} ${data.rangeDays} ${tx("天新增", "days new users")} ${data.overview.newUsersInRange}`} />
                    <StatCard title={tx("近7天活跃用户", "Active Users (7d)")} value={data.overview.activeUsers7d} hint={`${tx("活跃率", "Active rate")} ${pct(data.overview.activeRate7d)}`} />
                    <StatCard title={tx("近30天活跃用户", "Active Users (30d)")} value={data.overview.activeUsers30d} hint={`${tx("活跃率", "Active rate")} ${pct(data.overview.activeRate30d)}`} />
                    <StatCard title={tx("区间活跃用户", "Active Users (Range)")} value={data.overview.activeUsersInRange} hint={`${tx("区间事件", "Events in range")} ${data.overview.totalUsageEventsInRange}`} />
                    <StatCard title={tx("新用户7日首次使用率", "New User 7-Day First-Use Rate")} value={pct(data.overview.firstUseRate7dForNewUsers30d)} hint={tx("近30天新增用户口径", "Based on new users from the last 30 days")} />
                    <StatCard title={tx("首次使用中位时长", "Median Time to First Use")} value={`${data.overview.medianFirstUseHours}h`} hint={`30d ${tx("人均频次", "avg frequency")} ${data.overview.avgUsageEventsPerActiveUser30d}`} />
                  </CardContent>
                </Card>
              )}

              {tab === "trends" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4" />
                      {tx("活跃与新增趋势", "Activity and New User Trends")}
                    </CardTitle>
                    <CardDescription>{tx("DAU / WAU / 新增 / 首次使用 / 使用事件（日粒度）", "DAU / WAU / New Users / First Use / Usage Events (Daily)")}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={16} />
                        <YAxis />
                        <Tooltip labelFormatter={(value) => `${tx("日期", "Date")} ${value}`} />
                        <Legend />
                        <Line type="monotone" dataKey="dau" name="DAU" stroke="#2563eb" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="wau" name="WAU" stroke="#9333ea" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="newUsers" name={tx("新增用户", "New Users")} stroke="#16a34a" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="firstUseUsers" name={tx("首次使用用户", "First-use Users")} stroke="#ea580c" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="usageEvents" name={tx("使用事件", "Usage Events")} stroke="#0891b2" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {tab === "retention" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{tx("留存分析（Cohort）", "Retention Analysis (Cohort)")}</CardTitle>
                    <CardDescription>{tx("按注册日期分组，追踪 D1 / D3 / D7 / D14 / D30 留存", "Grouped by signup date, tracking D1 / D3 / D7 / D14 / D30 retention")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 md:grid-cols-5">
                      {retentionCards.map((item) => (
                        <div key={item.label} className="rounded-lg border bg-muted/20 p-3">
                          <div className="text-xs text-muted-foreground">{item.label}</div>
                          <div className="mt-1 text-xl font-semibold">{pct(item.value)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{tx("Cohort 日期", "Cohort Date")}</TableHead>
                            <TableHead>{tx("新增用户", "New Users")}</TableHead>
                            <TableHead>D1</TableHead>
                            <TableHead>D3</TableHead>
                            <TableHead>D7</TableHead>
                            <TableHead>D14</TableHead>
                            <TableHead>D30</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.retention.cohorts.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground">
                                {tx("暂无 Cohort 数据", "No cohort data")}
                              </TableCell>
                            </TableRow>
                          ) : (
                            data.retention.cohorts.slice(0, 20).map((row) => (
                              <TableRow key={row.cohortDate}>
                                <TableCell>{row.cohortDate}</TableCell>
                                <TableCell>{row.newUsers}</TableCell>
                                <TableCell>{pct(row.d1Rate)} ({row.d1Users})</TableCell>
                                <TableCell>{pct(row.d3Rate)} ({row.d3Users})</TableCell>
                                <TableCell>{pct(row.d7Rate)} ({row.d7Users})</TableCell>
                                <TableCell>{pct(row.d14Rate)} ({row.d14Users})</TableCell>
                                <TableCell>{pct(row.d30Rate)} ({row.d30Users})</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {tab === "habits" && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{tx("使用习惯：星期分布", "Usage Habits: Weekday Distribution")}</CardTitle>
                      <CardDescription>{tx("按事件量统计用户最活跃的星期", "Most active weekdays by event volume")}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.habits.byWeekday}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="events" name={tx("事件量", "Events")} fill="#2563eb" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="activeUsers" name={tx("活跃用户", "Active Users")} fill="#16a34a" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{tx("使用习惯：小时分布（UTC）", "Usage Habits: Hourly Distribution (UTC)")}</CardTitle>
                      <CardDescription>{tx("按小时观察使用高峰", "Observe usage peaks by hour")}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.habits.byHour}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" tickFormatter={(value) => (value.endsWith(":00") ? value.slice(0, 2) : value)} minTickGap={18} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="events" name={tx("事件量", "Events")} stroke="#ea580c" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="activeUsers" name={tx("活跃用户", "Active Users")} stroke="#0891b2" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {tab === "tools" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{tx("工具偏好 Top 12", "Top 12 Tool Preferences")}</CardTitle>
                    <CardDescription>{tx("按使用事件量和覆盖用户数统计", "Ranked by event volume and covered users")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tx("工具", "Tool")}</TableHead>
                          <TableHead>{tx("工具ID", "Tool ID")}</TableHead>
                          <TableHead>{tx("事件量", "Events")}</TableHead>
                          <TableHead>{tx("活跃用户", "Active Users")}</TableHead>
                          <TableHead>{tx("事件占比", "Event Share")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.habits.topTools.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              {tx("暂无工具使用数据", "No tool usage data")}
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.habits.topTools.map((row) => (
                            <TableRow key={row.toolId}>
                              <TableCell>{row.toolName}</TableCell>
                              <TableCell className="font-mono text-xs">{row.toolId}</TableCell>
                              <TableCell>{row.events}</TableCell>
                              <TableCell>{row.activeUsers}</TableCell>
                              <TableCell>{pct(row.share)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {tab === "firstUse" && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Clock3 className="h-4 w-4" />
                        {tx("首次使用工具分布", "First-use Tool Distribution")}
                      </CardTitle>
                      <CardDescription>{tx("新用户首次真正使用的入口工具", "Entry tool used by new users for first real usage")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data.firstUse.topTools}
                              dataKey="users"
                              nameKey="toolName"
                              cx="50%"
                              cy="50%"
                              outerRadius={95}
                              label={(entry) => `${entry.toolName} ${entry.share.toFixed(1)}%`}
                            >
                              {data.firstUse.topTools.map((entry, index) => (
                                <Cell key={`${entry.toolId}_${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: any, _name: any, payload: any) => [`${value}`, payload?.payload?.toolName || ""]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{tx("首次使用时延分布", "Time-to-First-Use Distribution")}</CardTitle>
                      <CardDescription>{tx("注册后到首次使用的时间延迟", "Delay from signup to first use")}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.firstUse.latencyDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="users" name={tx("用户数", "Users")} fill="#2563eb" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {tab === "segments" && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{tx("用户分群：最近活跃度", "User Segments: Recent Activity")}</CardTitle>
                      <CardDescription>{tx("按最近一次使用时间分层", "Segmented by most recent usage time")}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.segmentation.recency}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="users" name={tx("用户数", "Users")} fill="#16a34a" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{tx("用户分群：30天频次", "User Segments: 30-Day Frequency")}</CardTitle>
                      <CardDescription>{tx("按近30天使用次数分层", "Segmented by usage count in last 30 days")}</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.segmentation.frequency30d}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="users" name={tx("用户数", "Users")} fill="#9333ea" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}
