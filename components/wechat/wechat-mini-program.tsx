"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Clock, CheckCircle, Plus, MessageSquare } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

const contracts = [
  { id: 1, title: "服务协议", status: "pending", date: "2小时前" },
  { id: 2, title: "保密协议", status: "completed", date: "1天前" },
  { id: 3, title: "合作协议", status: "draft", date: "3天前" },
]

export function WeChatMiniProgram() {
  const { language } = useLanguage()
  const isEn = language === "en"

  const statusLabel = (status: string) => {
    if (status === "pending") return isEn ? "Pending" : "待签署"
    if (status === "completed") return isEn ? "Completed" : "已完成"
    return isEn ? "Draft" : "草稿"
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-primary text-primary-foreground px-4 py-6">
        <h1 className="text-xl font-bold mb-1">{isEn ? "Contract Management" : "合同管理"}</h1>
        <p className="text-sm opacity-90">{isEn ? "ContractHub WeChat Mini Program" : "ContractHub 微信小程序"}</p>
      </div>

      <div className="px-4 -mt-4 mb-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary mb-1">7</p>
                <p className="text-xs text-muted-foreground">{isEn ? "Pending" : "待签署"}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent mb-1">41</p>
                <p className="text-xs text-muted-foreground">{isEn ? "Completed" : "已完成"}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold mb-1">48</p>
                <p className="text-xs text-muted-foreground">{isEn ? "Total" : "总合同"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 mb-4">
        <div className="grid grid-cols-4 gap-3">
          <button className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs">{isEn ? "New" : "新建"}</span>
          </button>
          <button className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs">{isEn ? "Contracts" : "合同"}</span>
          </button>
          <button className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs">{isEn ? "Tasks" : "待办"}</span>
          </button>
          <button className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs">{isEn ? "Messages" : "消息"}</span>
          </button>
        </div>
      </div>

      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{isEn ? "Recent Contracts" : "最近合同"}</h2>
          <Button variant="ghost" size="sm" className="text-xs">
            {isEn ? "View All" : "查看全部"}
          </Button>
        </div>

        <div className="space-y-2">
          {contracts.map((contract) => (
            <Card key={contract.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm mb-1">{contract.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={contract.status === "completed" ? "default" : "secondary"}
                        className={
                          contract.status === "completed"
                            ? "bg-accent/10 text-accent border-accent/20 text-xs"
                            : contract.status === "pending"
                              ? "bg-chart-3/10 text-chart-3 border-chart-3/20 text-xs"
                              : "text-xs"
                        }
                      >
                        {statusLabel(contract.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{contract.date}</span>
                    </div>
                  </div>
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="grid grid-cols-4 h-14">
          <button className="flex flex-col items-center justify-center gap-1 text-primary">
            <FileText className="h-5 w-5" />
            <span className="text-xs">{isEn ? "Contracts" : "合同"}</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <span className="text-xs">{isEn ? "Tasks" : "待办"}</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <MessageSquare className="h-5 w-5" />
            <span className="text-xs">{isEn ? "Messages" : "消息"}</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <div className="w-5 h-5 rounded-full bg-muted" />
            <span className="text-xs">{isEn ? "Me" : "我的"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
