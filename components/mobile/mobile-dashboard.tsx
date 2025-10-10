"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Clock, CheckCircle, TrendingUp, Search, Filter, MoreVertical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

const stats = [
  { label: "Active", value: "7", icon: Clock, color: "text-chart-3" },
  { label: "Completed", value: "41", icon: CheckCircle, color: "text-accent" },
  { label: "This Month", value: "+12", icon: TrendingUp, color: "text-primary" },
]

const recentContracts = [
  {
    id: 1,
    title: "Service Agreement",
    party: "TechBridge Inc.",
    status: "pending",
    date: "2 hours ago",
  },
  {
    id: 2,
    title: "NDA",
    party: "Dragon Enterprises",
    status: "completed",
    date: "1 day ago",
  },
  {
    id: 3,
    title: "Partnership Agreement",
    party: "Global Trade Co.",
    status: "draft",
    date: "3 days ago",
  },
]

export function MobileDashboard() {
  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back, Sarah</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">SC</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search contracts..." className="pl-9 pr-10" />
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-6">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col items-center text-center">
                  <stat.icon className={`h-5 w-5 mb-2 ${stat.color}`} />
                  <p className="text-2xl font-bold mb-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Contracts */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Contracts</h2>
          <Button variant="ghost" size="sm">
            View All
          </Button>
        </div>

        <div className="space-y-3">
          {recentContracts.map((contract) => (
            <Card key={contract.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-medium truncate">{contract.title}</h3>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{contract.party}</p>
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={contract.status === "completed" ? "default" : "secondary"}
                        className={
                          contract.status === "completed"
                            ? "bg-accent/10 text-accent border-accent/20"
                            : contract.status === "pending"
                              ? "bg-chart-3/10 text-chart-3 border-chart-3/20"
                              : ""
                        }
                      >
                        {contract.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{contract.date}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">New Contract</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Sign Document</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
