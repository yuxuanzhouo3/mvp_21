"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building,
  CheckCircle2,
  Edit,
  Loader2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { CreateFlowShell } from "@/components/create/flow-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AIAnalysisResult } from "@/lib/ai/types";
import { CONTRACT_TYPE_NAMES } from "@/lib/ai/prompts/generate";
import { cn } from "@/lib/utils";

function AnalyzePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const isEn = language === "en";
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingTerm, setEditingTerm] = useState<string | null>(null);
  const flowContext = searchParams.get("ctx") === "dashboard" ? "dashboard" : "standalone";
  const fallbackHref = flowContext === "dashboard" ? "/dashboard/contracts/new" : "/create";
  const importHref =
    flowContext === "dashboard" ? "/create/import?method=text&ctx=dashboard" : "/create/import?method=text";

  const termTypeConfig: Record<string, { label: string; colorClass: string }> = {
    salary: { label: isEn ? "Compensation" : "薪资报酬", colorClass: "bg-primary/10 text-primary" },
    duration: { label: isEn ? "Duration" : "工作期限", colorClass: "bg-chart-2/10 text-chart-2" },
    payment: { label: isEn ? "Payment Method" : "付款方式", colorClass: "bg-chart-3/10 text-chart-3" },
    workContent: { label: isEn ? "Work Scope" : "工作内容", colorClass: "bg-chart-4/10 text-chart-4" },
    benefit: { label: isEn ? "Benefits" : "福利待遇", colorClass: "bg-chart-5/10 text-chart-5" },
    probation: { label: isEn ? "Probation" : "试用期", colorClass: "bg-accent/10 text-accent" },
    other: { label: isEn ? "Other" : "其他", colorClass: "bg-muted text-muted-foreground" },
  };

  useEffect(() => {
    const stored = sessionStorage.getItem("contractAnalysis");
    if (!stored) {
      toast.error(isEn ? "Please import conversation content first" : "请先导入对话内容");
      router.push(fallbackHref);
      return;
    }

    try {
      setAnalysis(JSON.parse(stored));
    } catch {
      toast.error(isEn ? "Failed to load analysis result" : "加载分析结果失败");
      router.push(fallbackHref);
    }
  }, [router, fallbackHref, isEn]);

  const updateKeyTerm = (index: number, value: string) => {
    if (!analysis) return;
    const nextTerms = [...analysis.keyTerms];
    nextTerms[index] = { ...nextTerms[index], value };
    setAnalysis({ ...analysis, keyTerms: nextTerms });
  };

  const handleGenerate = async () => {
    if (!analysis) return;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisResult: analysis }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || (isEn ? "Generation failed" : "生成失败"));
      }

      sessionStorage.setItem("generatedContract", JSON.stringify(result.data));
      sessionStorage.setItem("contractAnalysis", JSON.stringify(analysis));
      router.push(flowContext === "dashboard" ? "/create/edit?ctx=dashboard" : "/create/edit");
    } catch (error) {
      console.error("生成失败:", error);
      toast.error(error instanceof Error ? error.message : isEn ? "Generation failed, please retry." : "生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!analysis) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const confidencePercent = Math.max(0, Math.min(100, Math.round(analysis.confidence * 100)));

  return (
    <CreateFlowShell
      step={3}
      title={isEn ? "Confirm AI Analysis" : "AI 分析确认"}
      description={
        isEn
          ? "Review each extracted field, especially amount, duration, role, and breach clauses."
          : "请逐项确认识别结果，尤其是金额、期限、岗位和违约条款。确认后进入生成阶段。"
      }
      backHref={importHref}
      backLabel={isEn ? "Back to Import" : "返回导入"}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{isEn ? "Extraction Overview" : "识别结果概览"}</CardTitle>
                <CardDescription>
                  {isEn ? "The model extracted contract type and key fields." : "模型已提取合同类型和关键字段。"}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="px-3 py-1 text-sm">
                {CONTRACT_TYPE_NAMES[analysis.contractType] || analysis.contractType}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{isEn ? "Confidence Score" : "识别置信度"}</span>
                <span className="font-medium">{confidencePercent}%</span>
              </div>
              <Progress value={confidencePercent} className="h-2" />
            </div>
          </CardHeader>
          {analysis.summary && (
            <CardContent>
              <p className="text-sm text-muted-foreground">{analysis.summary}</p>
            </CardContent>
          )}
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="h-4 w-4 text-primary" />
                {isEn ? "Party A" : "甲方信息"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <Label className="text-muted-foreground">{isEn ? "Name" : "名称"}</Label>
                <p className="font-medium">{analysis.partyA.name || (isEn ? "Not detected" : "未识别")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{isEn ? "Role" : "角色"}</Label>
                <p>{analysis.partyA.role || (isEn ? "Party A" : "甲方")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{isEn ? "Company" : "公司"}</Label>
                <p>{analysis.partyA.company || (isEn ? "Not detected" : "未识别")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                {isEn ? "Party B" : "乙方信息"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <Label className="text-muted-foreground">{isEn ? "Name" : "名称"}</Label>
                <p className="font-medium">{analysis.partyB.name || (isEn ? "Not detected" : "未识别")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{isEn ? "Role" : "角色"}</Label>
                <p>{analysis.partyB.role || (isEn ? "Party B" : "乙方")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{isEn ? "Company" : "公司"}</Label>
                <p>{analysis.partyB.company || (isEn ? "Not detected" : "未识别")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-primary" />
              {isEn ? "Review Key Terms" : "关键条款校对"}
            </CardTitle>
            <CardDescription>
              {isEn
                ? "Click any term value to edit. Low-confidence fields should be reviewed first."
                : "点击条款值可直接编辑，低置信字段建议优先人工复核。"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.keyTerms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {isEn
                  ? "No clear terms extracted. Return to previous step and provide a fuller conversation."
                  : "未提取到明确条款，请返回上一步补充更完整对话。"}
              </div>
            ) : (
              <div className="space-y-3">
                {analysis.keyTerms.map((term, index) => {
                  const config = termTypeConfig[term.type] || termTypeConfig.other;
                  const isEditing = editingTerm === `${index}`;
                  const isLowConfidence = term.confidence < 0.7;

                  return (
                    <div
                      key={`${term.label}-${index}`}
                      className="rounded-lg border border-border/70 bg-muted/20 p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={cn("text-xs", config.colorClass)}>
                          {config.label}
                        </Badge>
                        <span className="text-sm font-medium">{term.label}</span>
                        {isLowConfidence && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            <AlertCircle className="h-3 w-3" />
                            {isEn ? "Low confidence" : "低置信度"}
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={term.value}
                            onChange={(event) => updateKeyTerm(index, event.target.value)}
                            className="flex-1"
                          />
                          <Button size="sm" onClick={() => setEditingTerm(null)}>
                            {isEn ? "Confirm" : "确认"}
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-left text-sm text-foreground transition-colors hover:text-primary"
                          onClick={() => setEditingTerm(`${index}`)}
                        >
                          {term.value || (isEn ? "Not extracted" : "未提取")}
                          <Edit className="h-3 w-3 opacity-60" />
                        </button>
                      )}

                      {term.source && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {isEn ? "Source" : "来源"}: "{term.source}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 rounded-xl border border-border/70 bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {isEn ? "Generate the final contract after confirmation" : "确认无误后可生成正式合同"}
          </div>
          <Button size="lg" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEn ? "Generating contract..." : "生成合同中..."}
              </>
            ) : (
              <>
                {isEn ? "Generate Contract" : "生成合同"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </CreateFlowShell>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AnalyzePageContent />
    </Suspense>
  );
}
