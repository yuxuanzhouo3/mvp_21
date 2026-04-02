"use client";

import { CheckCircle, Clock, HardDrive, Shield } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardDocumentStats } from "@/lib/dashboard/types";

interface StorageStatsProps {
  stats: DashboardDocumentStats;
}

export function StorageStats({ stats }: StorageStatsProps) {
  const { language } = useLanguage();
  const isEn = language === "en";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-lg bg-primary/10 p-2">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.totalStorageLabel}</p>
            <p className="text-sm text-muted-foreground">
              {isEn ? "Total document storage" : "当前文档占用空间"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-lg bg-primary/10 p-2">
              <Shield className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.verifiedDocuments}</p>
            <p className="text-sm text-muted-foreground">
              {isEn ? "Verified Documents" : "已验真文档"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-lg bg-primary/10 p-2">
              <Clock className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.averageProcessingLabel}</p>
            <p className="text-sm text-muted-foreground">
              {isEn ? "Avg. Signing Completion Time" : "平均签署完成时长"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-lg bg-primary/10 p-2">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.complianceRate}%</p>
            <p className="text-sm text-muted-foreground">
              {isEn ? "Verification Completion Rate" : "验真完成率"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
