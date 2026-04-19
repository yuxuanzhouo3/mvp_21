import Link from "next/link";
import { ArrowRight, BellRing, Megaphone, UserPlus2, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketAdminSession } from "./require-market-session";
import { resolveDeploymentRegion } from "@/lib/config/deployment-region";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isIntlRegion = resolveDeploymentRegion() === "INTL";

const pageCopy = {
  title: isIntlRegion ? "Choose a Subsystem" : "选择要进入的子系统",
  subtitle: isIntlRegion
    ? "All four modules are available. Choose by your current business goal."
    : "当前已开放四个子系统入口，你可以按业务目标自由进入对应系统。",
  enter: isIntlRegion ? "Open Module" : "进入系统",
  statusDone: isIntlRegion ? "Available" : "已完成",
  statusPlanning: isIntlRegion ? "Planned" : "规划中",
};

const MARKET_SUBSYSTEMS = [
  {
    id: "1",
    title: isIntlRegion ? "User Analytics" : "用户分析系统",
    description: isIntlRegion
      ? "Retention, activity, behavior profiling, and first-use analysis."
      : "留存、活跃率、用户习惯与首次使用行为分析",
    href: "/market/analytics",
    status: pageCopy.statusDone,
    icon: UsersRound,
  },
  {
    id: "2",
    title: isIntlRegion ? "Acquisition" : "产品获客系统",
    description: isIntlRegion
      ? "Creator partnerships and enterprise lead pipeline management."
      : "对接博主合作与企业采购线索管理",
    href: "/market/acquisition",
    status: pageCopy.statusDone,
    icon: Megaphone,
  },
  {
    id: "3",
    title: isIntlRegion ? "Notifications" : "产品通知系统",
    description: isIntlRegion
      ? "Campaign messaging, cold-recall, and surprise content workflows."
      : "冷召回与惊喜文章推送策略中心",
    href: "/market/notifications",
    status: pageCopy.statusPlanning,
    icon: BellRing,
  },
  {
    id: "4",
    title: isIntlRegion ? "Marketing Hub" : "营销中台",
    description: isIntlRegion
      ? "Unified wallet, referral tasks, ad incentives, and risk controls."
      : "统一钱包、裂变任务、广告激励与风控",
    href: "/market/fission",
    status: pageCopy.statusDone,
    icon: UserPlus2,
  },
] as const;

export default async function MarketAdminPage() {
  await requireMarketAdminSession();

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border bg-background px-6 py-7 md:px-8 md:py-10">
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{pageCopy.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">{pageCopy.subtitle}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {MARKET_SUBSYSTEMS.map((system) => (
            <Card key={system.id} className="border border-border/80 shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/40">
                    <system.icon className="h-5 w-5" />
                  </div>
                  <Badge variant={system.status === pageCopy.statusDone ? "default" : "secondary"}>
                    {system.status}
                  </Badge>
                </div>
                <CardTitle className="text-xl">
                  {system.id}. {system.title}
                </CardTitle>
                <CardDescription>{system.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full justify-between">
                  <Link href={system.href}>
                    {pageCopy.enter}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
