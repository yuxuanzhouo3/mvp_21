"use client";

import { Card, CardContent } from "@/components/ui/card"
import { HardDrive, Shield, Clock, CheckCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useLanguage } from "@/components/language-provider"

export function StorageStats() {
  const { language } = useLanguage()
  const isEn = language === "en"

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">2.4 GB</p>
            <p className="text-sm text-muted-foreground mb-2">
              {isEn ? "of 10 GB used" : "已用 10 GB 中的 2.4 GB"}
            </p>
            <Progress value={24} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">48</p>
            <p className="text-sm text-muted-foreground">{isEn ? "Verified Documents" : "已验证文档"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">{isEn ? "7 days" : "7 天"}</p>
            <p className="text-sm text-muted-foreground">{isEn ? "Avg. Processing Time" : "平均处理时长"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">100%</p>
            <p className="text-sm text-muted-foreground">{isEn ? "Compliance Rate" : "合规率"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
