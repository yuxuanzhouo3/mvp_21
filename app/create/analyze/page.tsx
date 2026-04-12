"use client";

/* eslint-disable react/no-unescaped-entities */

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
import { MobileActionBar } from "@/components/create/mobile-action-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useFocusScrollIntoView } from "@/hooks/use-mobile-keyboard";
import { getContractTypeDisplayName } from "@/lib/ai/prompts/generate";
import { AIAnalysisResult } from "@/lib/ai/types";
import { tokenManager } from "@/lib/auth/frontend-token-manager";
import {
  type ContractDetail,
  getContractForCurrentUser,
} from "@/lib/contracts/client";
import type { ActiveCompanyProfileSnapshot } from "@/lib/contracts/draft-context";
import { cn } from "@/lib/utils";

function normalizeActiveCompanyProfile(
  value: unknown,
): ActiveCompanyProfileSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const companyName =
    typeof record.companyName === "string" ? record.companyName.trim() : "";

  if (!companyName) {
    return null;
  }

  return {
    id: typeof record.id === "string" ? record.id : "",
    companyName,
    creditCode: typeof record.creditCode === "string" ? record.creditCode : "",
    legalPerson: typeof record.legalPerson === "string" ? record.legalPerson : "",
    address: typeof record.address === "string" ? record.address : "",
    contactPerson:
      typeof record.contactPerson === "string" ? record.contactPerson : "",
    contactPhone:
      typeof record.contactPhone === "string" ? record.contactPhone : "",
    contactEmail:
      typeof record.contactEmail === "string" ? record.contactEmail : "",
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

async function readGenerateErrorMessage(
  response: Response,
  isEn: boolean,
): Promise<string | null> {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");

  if (isJson) {
    const payload = (await response.json().catch(() => null)) as
      | Record<string, any>
      | null;
    const message = payload?.error?.message;
    return typeof message === "string" && message.trim() ? message.trim() : null;
  }

  const rawText = (await response.text().catch(() => "")) || "";
  const normalized = rawText.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("<")) {
    return isEn
      ? `Request failed (${response.status}). The server returned a non-JSON error page.`
      : `请求失败（${response.status}）。服务器返回了非 JSON 错误页。`;
  }

  return normalized.slice(0, 240);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function AnalyzePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const isEn = language === "en";
  const draftId = searchParams.get("id") || "";
  const flowContext =
    searchParams.get("ctx") === "dashboard" ? "dashboard" : "standalone";

  const [contractRecord, setContractRecord] =
    useState<ContractDetail | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<
    "submitting" | "queued" | "running" | null
  >(null);
  const [editingTerm, setEditingTerm] = useState<string | null>(null);
  const handleFocusCapture = useFocusScrollIntoView();

  const fallbackHref =
    flowContext === "dashboard" ? "/dashboard/contracts/new" : "/create";
  const importSourceMethod = contractRecord?.metadata?.sourceMethod;
  const importTemplateId = contractRecord?.metadata?.templateId;
  const importMethod =
    typeof importSourceMethod === "string" && importSourceMethod !== "ai-chat"
      ? importSourceMethod
      : "text";
  const importHref =
    flowContext === "dashboard"
      ? `/create/import?method=${importMethod}&ctx=dashboard${
          typeof importTemplateId === "string"
            ? `&templateId=${encodeURIComponent(importTemplateId)}`
            : ""
        }`
      : `/create/import?method=${importMethod}${
          typeof importTemplateId === "string"
            ? `&templateId=${encodeURIComponent(importTemplateId)}`
            : ""
        }`;

  useEffect(() => {
    let cancelled = false;

    async function loadDraft() {
      if (!draftId) {
        toast.error(isEn ? "Draft ID is missing." : "缺少草稿 ID。");
        router.replace(fallbackHref);
        return;
      }

      try {
        setIsLoading(true);
        const contract = await getContractForCurrentUser(draftId);
        const nextAnalysis = contract.analysisResult as AIAnalysisResult | null;

        if (!nextAnalysis) {
          throw new Error(
            isEn ? "Draft analysis not found." : "未找到草稿分析结果。",
          );
        }

        if (!cancelled) {
          setContractRecord(contract);
          setAnalysis(nextAnalysis);
        }
      } catch (error) {
        console.error("[CreateAnalyzePage] Failed to load draft:", error);

        if (!cancelled) {
          if (error instanceof Error && error.message === "UNAUTHORIZED") {
            router.replace(`/auth?redirect=${encodeURIComponent(importHref)}`);
            return;
          }

          toast.error(
            error instanceof Error
              ? error.message
              : isEn
                ? "Failed to load draft."
                : "加载草稿失败。",
          );
          router.replace(fallbackHref);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [draftId, fallbackHref, importHref, isEn, router]);

  const updateKeyTerm = (index: number, value: string) => {
    if (!analysis) return;
    const nextTerms = [...analysis.keyTerms];
    nextTerms[index] = { ...nextTerms[index], value };
    setAnalysis({ ...analysis, keyTerms: nextTerms });
  };

  const handleGenerate = async () => {
    if (!analysis || !contractRecord) return;
    setIsGenerating(true);
    setGenerationStatus("submitting");

    try {
      const headers = (await tokenManager.getAuthHeaderAsync()) || {};
      const templateId =
        typeof contractRecord.metadata?.templateId === "string"
          ? contractRecord.metadata.templateId
          : undefined;
      const createJobResponse = await fetch("/api/contracts/generate/jobs", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractId: contractRecord.id,
          analysisResult: analysis,
          templateId,
        }),
      });

      if (!createJobResponse.ok) {
        if (createJobResponse.status === 401) {
          throw new Error("UNAUTHORIZED");
        }
        const message = await readGenerateErrorMessage(createJobResponse, isEn);
        throw new Error(
          message ||
            (isEn
              ? `Failed to create generation task (${createJobResponse.status})`
              : `创建生成任务失败（${createJobResponse.status}）`),
        );
      }

      const createJobResult = (await createJobResponse.json().catch(() => null)) as
        | Record<string, any>
        | null;
      if (!createJobResult?.success) {
        throw new Error(
          typeof createJobResult?.error?.message === "string"
            ? createJobResult.error.message
            : isEn
              ? "Failed to create generation task"
              : "创建生成任务失败",
        );
      }

      const jobId =
        typeof createJobResult?.data?.job?.id === "string"
          ? createJobResult.data.job.id
          : "";

      if (!jobId) {
        throw new Error(
          isEn
            ? "Generation task started but no job ID was returned."
            : "生成任务已创建，但未返回任务 ID。",
        );
      }

      const initialJobStatus =
        createJobResult?.data?.job?.status === "running" ? "running" : "queued";
      setGenerationStatus(initialJobStatus);

      const pollStartedAt = Date.now();
      const pollDeadlineMs = 10 * 60_000;
      let pollAfterMs =
        typeof createJobResult?.data?.pollAfterMs === "number" &&
        Number.isFinite(createJobResult.data.pollAfterMs)
          ? Math.max(1_000, Math.min(5_000, createJobResult.data.pollAfterMs))
          : 1_800;

      while (Date.now() - pollStartedAt <= pollDeadlineMs) {
        await sleep(pollAfterMs);

        const pollResponse = await fetch(
          `/api/contracts/generate/jobs/${encodeURIComponent(jobId)}`,
          {
            headers,
            cache: "no-store",
          },
        );

        if (!pollResponse.ok) {
          if (pollResponse.status === 401) {
            throw new Error("UNAUTHORIZED");
          }

          const message = await readGenerateErrorMessage(pollResponse, isEn);
          throw new Error(
            message ||
              (isEn
                ? `Failed to query task status (${pollResponse.status})`
                : `查询任务状态失败（${pollResponse.status}）`),
          );
        }

        const pollPayload = (await pollResponse.json().catch(() => null)) as
          | Record<string, any>
          | null;

        if (!pollPayload?.success) {
          throw new Error(
            typeof pollPayload?.error?.message === "string"
              ? pollPayload.error.message
              : isEn
                ? "Failed to query task status"
                : "查询任务状态失败",
          );
        }

        const job = pollPayload?.data?.job as Record<string, any> | undefined;
        const status =
          job?.status === "queued" ||
          job?.status === "running" ||
          job?.status === "succeeded" ||
          job?.status === "failed"
            ? job.status
            : "running";

        if (status === "queued" || status === "running") {
          setGenerationStatus(status);
          pollAfterMs =
            typeof pollPayload?.data?.pollAfterMs === "number" &&
            Number.isFinite(pollPayload.data.pollAfterMs)
              ? Math.max(1_000, Math.min(5_000, pollPayload.data.pollAfterMs))
              : 1_800;
          continue;
        }

        if (status === "failed") {
          throw new Error(
            typeof job?.error?.message === "string" && job.error.message.trim()
              ? job.error.message.trim()
              : isEn
                ? "Generation failed. Please retry."
                : "生成失败，请重试。",
          );
        }

        router.push(
          flowContext === "dashboard"
            ? `/create/edit?id=${contractRecord.id}&ctx=dashboard`
            : `/create/edit?id=${contractRecord.id}`,
        );
        return;
      }

      throw new Error(
        isEn
          ? "Generation is taking too long. Please retry from the analysis page."
          : "生成耗时过长，请返回分析页后重试。",
      );
    } catch (error) {
      console.error("[CreateAnalyzePage] Failed to generate contract:", error);

      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        router.replace(`/auth?redirect=${encodeURIComponent(importHref)}`);
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : isEn
            ? "Generation failed, please retry."
            : "生成失败，请重试。",
      );
    } finally {
      setGenerationStatus(null);
      setIsGenerating(false);
    }
  };

  if (isLoading || !analysis) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const confidencePercent = Math.max(
    0,
    Math.min(100, Math.round(analysis.confidence * 100)),
  );
  const activeCompanyProfile = normalizeActiveCompanyProfile(
    contractRecord?.metadata?.activeCompanyProfile,
  );
  const termTypeConfig: Record<string, { label: string; colorClass: string }> = {
    salary: {
      label: isEn ? "Compensation" : "薪酬",
      colorClass: "bg-primary/10 text-primary",
    },
    duration: {
      label: isEn ? "Duration" : "期限",
      colorClass: "bg-chart-2/10 text-chart-2",
    },
    payment: {
      label: isEn ? "Payment Method" : "付款方式",
      colorClass: "bg-chart-3/10 text-chart-3",
    },
    workContent: {
      label: isEn ? "Work Scope" : "工作内容",
      colorClass: "bg-chart-4/10 text-chart-4",
    },
    benefit: {
      label: isEn ? "Benefits" : "福利待遇",
      colorClass: "bg-chart-5/10 text-chart-5",
    },
    probation: {
      label: isEn ? "Probation" : "试用期",
      colorClass: "bg-accent/10 text-accent",
    },
    other: {
      label: isEn ? "Other" : "其他",
      colorClass: "bg-muted text-muted-foreground",
    },
  };

  const generatingCtaText =
    generationStatus === "queued"
      ? isEn
        ? "Task queued..."
        : "任务排队中..."
      : generationStatus === "running"
        ? isEn
          ? "Generating contract..."
          : "正在生成合同..."
        : isEn
          ? "Submitting task..."
          : "正在提交任务...";

  const generatingHintText =
    generationStatus === "queued"
      ? isEn
        ? "Task queued. Generation starts soon."
        : "任务已入队，马上开始生成。"
      : generationStatus === "running"
        ? isEn
          ? "Generating in background. This can take 2-3 minutes."
          : "后台生成中，可能需要 2-3 分钟。"
        : isEn
          ? "Creating generation task..."
          : "正在创建生成任务...";

  return (
    <CreateFlowShell
      step={3}
      title={isEn ? "Confirm AI Analysis" : "确认 AI 分析结果"}
      description={
        isEn
          ? "Review each extracted field before generating the draft contract."
          : "请逐项确认提取结果，确认无误后再生成合同草稿。"
      }
      backHref={importHref}
      backLabel={isEn ? "Back to Import" : "返回导入"}
    >
      <div
        className="mx-auto max-w-5xl space-y-5 min-[430px]:space-y-6"
        onFocusCapture={handleFocusCapture}
      >
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="space-y-4 p-4 min-[390px]:p-5 min-[430px]:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base min-[390px]:text-lg">
                  {isEn ? "Extraction Overview" : "识别结果概览"}
                </CardTitle>
                <CardDescription className="text-xs min-[390px]:text-sm">
                  {isEn
                    ? "The model extracted contract type and key fields."
                    : "模型已提取合同类型与关键字段。"}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="px-3 py-1 text-sm">
                {getContractTypeDisplayName(analysis.contractType, isEn ? "en" : "zh")}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isEn ? "Confidence Score" : "识别置信度"}
                </span>
                <span className="font-medium">{confidencePercent}%</span>
              </div>
              <Progress value={confidencePercent} className="h-2" />
            </div>
          </CardHeader>
          {analysis.summary ? (
            <CardContent className="px-4 pb-4 pt-0 min-[390px]:px-5 min-[390px]:pb-5 min-[430px]:px-6 min-[430px]:pb-6">
              <p className="text-sm text-muted-foreground">{analysis.summary}</p>
            </CardContent>
          ) : null}
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="border-border/70 bg-card/95">
            <CardHeader className="p-4 pb-3 min-[390px]:p-5 min-[390px]:pb-4 min-[430px]:p-6">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="h-4 w-4 text-primary" />
                {isEn ? "Party A" : "甲方"}
              </CardTitle>
              {activeCompanyProfile ? (
                <CardDescription className="text-xs min-[390px]:text-sm">
                  {isEn
                    ? "Auto-filled from the active company profile."
                    : "已自动带入当前激活的企业主体信息。"}
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0 text-sm min-[390px]:px-5 min-[390px]:pb-5 min-[430px]:px-6 min-[430px]:pb-6">
              <div>
                <Label className="text-muted-foreground">
                  {isEn ? "Name" : "姓名"}
                </Label>
                <p className="font-medium">
                  {analysis.partyA.name || (isEn ? "Not detected" : "未识别")}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  {isEn ? "Role" : "角色"}
                </Label>
                <p>{analysis.partyA.role || (isEn ? "Party A" : "甲方")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  {isEn ? "Company" : "公司"}
                </Label>
                <p>{analysis.partyA.company || (isEn ? "Not detected" : "未识别")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  {isEn ? "Contact" : "联系方式"}
                </Label>
                <p>{analysis.partyA.contact || (isEn ? "Not detected" : "未识别")}</p>
              </div>
              {activeCompanyProfile ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <p>
                    {isEn ? "Credit Code" : "统一社会信用代码"}:
                    <span className="ml-1 font-medium text-foreground">
                      {activeCompanyProfile.creditCode || (isEn ? "N/A" : "暂无")}
                    </span>
                  </p>
                  <p className="mt-1">
                    {isEn ? "Legal Representative" : "法定代表人"}:
                    <span className="ml-1 font-medium text-foreground">
                      {activeCompanyProfile.legalPerson || (isEn ? "N/A" : "暂无")}
                    </span>
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95">
            <CardHeader className="p-4 pb-3 min-[390px]:p-5 min-[390px]:pb-4 min-[430px]:p-6">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                {isEn ? "Party B" : "乙方"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0 text-sm min-[390px]:px-5 min-[390px]:pb-5 min-[430px]:px-6 min-[430px]:pb-6">
              <div>
                <Label className="text-muted-foreground">
                  {isEn ? "Name" : "姓名"}
                </Label>
                <p className="font-medium">
                  {analysis.partyB.name || (isEn ? "Not detected" : "未识别")}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  {isEn ? "Role" : "角色"}
                </Label>
                <p>{analysis.partyB.role || (isEn ? "Party B" : "乙方")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  {isEn ? "Company" : "公司"}
                </Label>
                <p>{analysis.partyB.company || (isEn ? "Not detected" : "未识别")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-card/95">
          <CardHeader className="p-4 pb-3 min-[390px]:p-5 min-[390px]:pb-4 min-[430px]:p-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-primary" />
              {isEn ? "Review Key Terms" : "核对关键条款"}
            </CardTitle>
            <CardDescription className="text-xs min-[390px]:text-sm">
              {isEn
                ? "Click any term value to edit before generating the contract."
                : "点击任一条款值即可编辑，确认后再生成合同。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 min-[390px]:px-5 min-[390px]:pb-5 min-[430px]:px-6 min-[430px]:pb-6">
            {analysis.keyTerms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {isEn
                  ? "No clear terms extracted. Please go back and provide a fuller conversation."
                  : "未提取到明确条款，请返回上一步补充更完整的对话内容。"}
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
                        {isLowConfidence ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            <AlertCircle className="h-3 w-3" />
                            {isEn ? "Low confidence" : "低置信度"}
                          </span>
                        ) : null}
                      </div>

                      {isEditing ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={term.value}
                            onChange={(event) => updateKeyTerm(index, event.target.value)}
                            className="flex-1 text-[13px] min-[390px]:text-sm min-[430px]:text-[15px]"
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

                      {term.source ? (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {isEn ? "Source" : "来源"}: "{term.source}"
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="hidden flex-col-reverse gap-3 rounded-xl border border-border/70 bg-card/80 p-4 md:flex md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {isGenerating
              ? generatingHintText
              : isEn
                ? "Generate the contract draft after confirmation"
                : "确认无误后生成合同草稿"}
          </div>
          <Button size="lg" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {generatingCtaText}
              </>
            ) : (
              <>
                {isEn ? "Generate Contract" : "生成合同"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <MobileActionBar>
          <div className="min-w-0 flex-1 text-[11px] text-muted-foreground min-[390px]:text-xs min-[430px]:text-sm">
            {isGenerating
              ? generatingHintText
              : isEn
                ? "Ready to generate draft"
                : "已准备好生成草稿"}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="h-10 flex-[1.2] text-xs min-[390px]:text-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {generatingCtaText}
              </>
            ) : (
              <>
                {isEn ? "Generate Contract" : "生成合同"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </MobileActionBar>
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
