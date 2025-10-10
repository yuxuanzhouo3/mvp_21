"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, MoreVertical, Download, Eye, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const contracts = [
  {
    id: 1,
    title: "Service Agreement - TechBridge Inc.",
    status: "completed",
    date: "2025-01-05",
    parties: ["Sarah Chen", "Li Wei"],
    region: "US-CN",
  },
  {
    id: 2,
    title: "Non-Disclosure Agreement",
    status: "pending",
    date: "2025-01-08",
    parties: ["Michael Rodriguez", "Wang Fang"],
    region: "US-CN",
  },
  {
    id: 3,
    title: "Partnership Agreement",
    status: "draft",
    date: "2025-01-10",
    parties: ["Global Trade Co."],
    region: "US",
  },
  {
    id: 4,
    title: "供应商合同 (Supplier Contract)",
    status: "completed",
    date: "2025-01-03",
    parties: ["Dragon Enterprises", "Zhang Ming"],
    region: "CN",
  },
  {
    id: 5,
    title: "Employment Contract",
    status: "pending",
    date: "2025-01-09",
    parties: ["TechBridge Inc.", "John Smith"],
    region: "US",
  },
]

const statusColors = {
  completed: "bg-accent/10 text-accent border-accent/20",
  pending: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  draft: "bg-muted text-muted-foreground border-border",
}

export function ContractList() {
  const [filter, setFilter] = useState("all")

  const filteredContracts = filter === "all" ? contracts : contracts.filter((c) => c.status === filter)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contracts</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full" onValueChange={setFilter}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="space-y-4">
            {filteredContracts.map((contract) => (
              <div
                key={contract.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium mb-1 truncate">{contract.title}</h4>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{contract.date}</span>
                      <span>•</span>
                      <span>{contract.parties.join(", ")}</span>
                      <Badge variant="outline" className="ml-2">
                        {contract.region}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge className={statusColors[contract.status as keyof typeof statusColors]}>
                    {contract.status}
                  </Badge>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
