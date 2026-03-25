"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FileText, Search, Filter, ArrowLeft, Download, Eye, Share2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { useLanguage } from "@/components/language-provider"

const contracts = [
  {
    id: 1,
    title: "Service Agreement - TechBridge Inc.",
    status: "completed",
    date: "Jan 5, 2025",
    parties: 2,
  },
  {
    id: 2,
    title: "Non-Disclosure Agreement",
    status: "pending",
    date: "Jan 8, 2025",
    parties: 2,
  },
  {
    id: 3,
    title: "Partnership Agreement",
    status: "draft",
    date: "Jan 10, 2025",
    parties: 1,
  },
  {
    id: 4,
    title: "供应商合同 (Supplier Contract)",
    status: "completed",
    date: "Jan 3, 2025",
    parties: 2,
  },
  {
    id: 5,
    title: "Employment Contract",
    status: "pending",
    date: "Jan 9, 2025",
    parties: 2,
  },
]

export function MobileContractList() {
  const [filter, setFilter] = useState("all")
  const { language } = useLanguage()
  const isEn = language === "en"

  const filteredContracts = filter === "all" ? contracts : contracts.filter((c) => c.status === filter)

  const statusLabel = (status: string) => {
    if (status === "completed") return isEn ? "Completed" : "已完成"
    if (status === "pending") return isEn ? "Pending" : "待签署"
    return isEn ? "Draft" : "草稿"
  }

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/mobile">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">{isEn ? "Contracts" : "合同"}</h1>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={isEn ? "Search contracts..." : "搜索合同..."} className="pl-9 pr-10" />
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={filter} onValueChange={setFilter} className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="all" className="text-xs">
                {isEn ? "All" : "全部"}
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">
                {isEn ? "Pending" : "待签"}
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">
                {isEn ? "Done" : "完成"}
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs">
                {isEn ? "Drafts" : "草稿"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {filteredContracts.map((contract) => (
          <Card key={contract.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium mb-1 line-clamp-2">{contract.title}</h3>
                  <div className="flex items-center gap-2 mb-3">
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
                      {statusLabel(contract.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{contract.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                      <Eye className="h-4 w-4 mr-1" />
                      {isEn ? "View" : "查看"}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
