import { Card, CardContent } from "@/components/ui/card"
import { FileText, Clock, CheckCircle, Users } from "lucide-react"

const stats = [
  {
    title: "Total Contracts",
    value: "48",
    change: "+12%",
    icon: FileText,
    trend: "up",
  },
  {
    title: "Pending Signatures",
    value: "7",
    change: "-3",
    icon: Clock,
    trend: "down",
  },
  {
    title: "Completed",
    value: "41",
    change: "+8",
    icon: CheckCircle,
    trend: "up",
  },
  {
    title: "Active Parties",
    value: "23",
    change: "+5",
    icon: Users,
    trend: "up",
  },
]

export function DashboardStats() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <span className={`text-sm font-medium ${stat.trend === "up" ? "text-accent" : "text-muted-foreground"}`}>
                {stat.change}
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
