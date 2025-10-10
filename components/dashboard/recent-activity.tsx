import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Clock, FileText, UserPlus } from "lucide-react"

const activities = [
  {
    type: "signed",
    title: "Contract signed",
    description: "Li Wei signed Service Agreement",
    time: "2 hours ago",
    icon: CheckCircle,
    iconColor: "text-accent",
  },
  {
    type: "pending",
    title: "Signature requested",
    description: "NDA sent to Wang Fang",
    time: "5 hours ago",
    icon: Clock,
    iconColor: "text-chart-3",
  },
  {
    type: "created",
    title: "Contract created",
    description: "Partnership Agreement drafted",
    time: "1 day ago",
    icon: FileText,
    iconColor: "text-primary",
  },
  {
    type: "invited",
    title: "Party added",
    description: "John Smith added to Employment Contract",
    time: "2 days ago",
    icon: UserPlus,
    iconColor: "text-muted-foreground",
  },
]

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={index} className="flex gap-3">
              <div className={`p-2 rounded-lg bg-muted h-fit`}>
                <activity.icon className={`h-4 w-4 ${activity.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1">{activity.title}</p>
                <p className="text-xs text-muted-foreground mb-1">{activity.description}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
