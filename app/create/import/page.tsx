"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { CreateFlowShell } from "@/components/create/flow-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createContractForCurrentUser } from "@/lib/contracts/client";
import {
  buildContractParties,
  createVersionEntry,
  deriveDraftTitle,
} from "@/lib/contracts/format";

function ImportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const isEn = language === "en";
  const method = searchParams.get("method") || "text";
  const flowContext = searchParams.get("ctx") === "dashboard" ? "dashboard" : "standalone";
  const [content, setContent] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const isUnsupportedMethod = method !== "text";
  const trimmedLength = content.trim().length;
  const backHref = flowContext === "dashboard" ? "/dashboard/contracts/new" : "/create";

  const inputQualityHint = useMemo(() => {
    if (!trimmedLength) {
      return isEn ? "Recommended length: 100 - 5000 chars" : "建议输入 100 - 5000 个字符";
    }
    if (trimmedLength < 20) {
      return isEn ? "Content is too short for accurate extraction" : "内容过短，可能无法准确提取合同要点";
    }
    if (trimmedLength < 100) {
      return isEn ? "Add more details for better results" : "建议补充更多细节，分析结果会更稳定";
    }
    return isEn ? "Content length looks good. Ready to analyze." : "内容长度合适，可以开始分析";
  }, [trimmedLength, isEn]);

  const handleAnalyze = async () => {
    if (!content.trim()) {
      toast.error(isEn ? "Please enter conversation content" : "请输入对话内容");
      return;
    }

    if (content.trim().length < 20) {
      toast.error(
        isEn
          ? "Conversation is too short. Please provide more details."
          : "对话内容太短，请提供更详细的上下文",
      );
      return;
    }

    setIsAnalyzing(true);

    try {
      const analysisResponse = await fetch("/api/contracts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          sourceType: "text",
        }),
      });

      const analysisResult = await analysisResponse.json();
      if (!analysisResult.success) {
        throw new Error(
          analysisResult.error?.message || (isEn ? "Analysis failed" : "分析失败"),
        );
      }

      const draftTitle = deriveDraftTitle(analysisResult.data);
      const draft = await createContractForCurrentUser({
        title: draftTitle,
        type: analysisResult.data.contractType || "custom",
        status: "draft",
        content: {},
        sourceType: "text",
        sourceContent: content.trim(),
        analysisResult: analysisResult.data,
        parties: buildContractParties(analysisResult.data),
        metadata: {
          flowVersion: "create-v2",
          draftStage: "analysis",
          flowContext,
          sourceMethod: method,
          versionHistory: [
            createVersionEntry({
              action: "draft_created",
              title: draftTitle,
              summary: isEn ? "Created from imported conversation text." : "已根据导入的对话文本创建草稿。",
            }),
          ],
        },
      });

      router.push(
        flowContext === "dashboard"
          ? `/create/analyze?id=${draft.id}&ctx=dashboard`
          : `/create/analyze?id=${draft.id}`,
      );
    } catch (error) {
      console.error("[CreateImportPage] Failed to analyze and create draft:", error);

      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        toast.error(isEn ? "Please sign in before creating a draft." : "请先登录后再创建合同草稿");
        router.push(
          `/auth?redirect=${encodeURIComponent(
            flowContext === "dashboard"
              ? "/create/import?method=text&ctx=dashboard"
              : "/create/import?method=text",
          )}`,
        );
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : isEn
            ? "Analysis failed, please try again."
            : "分析失败，请重试",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <CreateFlowShell
      step={2}
      title={
        isUnsupportedMethod
          ? isEn
            ? "This import method is unavailable"
            : "该导入方式暂不可用"
          : isEn
            ? "Import Conversation Content"
            : "导入对话内容"
      }
      description={
        isUnsupportedMethod
          ? isEn
            ? "To ensure production readiness, only text import is available in this version."
            : "为了保证生产可用性，当前版本仅开放文本导入。"
          : isEn
            ? "Paste the full conversation. The system extracts parties, amount, term, duties, and key clauses."
            : "请粘贴完整对话，系统会提取主体、金额、期限、职责和关键条款。"
      }
      backHref={backHref}
      backLabel={
        flowContext === "dashboard"
          ? isEn
            ? "Back to Contract Creation"
            : "返回合同创建"
          : isEn
            ? "Back"
            : "返回"
      }
    >
      {isUnsupportedMethod ? (
        <Card className="mx-auto max-w-3xl border-amber-200 bg-amber-50/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              {isEn ? "OCR / Mini Program Import Not Available" : "OCR / 小程序导入暂不可用"}
            </CardTitle>
            <CardDescription className="text-amber-800">
              {isEn
                ? "Available flow: text import -> AI analysis -> edit & export."
                : "当前可用流程：文本导入 -> AI 分析 -> 编辑与导出。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              {isEn
                ? "Please copy chat records as text first. OCR and mini-program integrations are coming."
                : "请先复制聊天记录文本。OCR 和小程序直连能力将在后续版本开放。"}
            </p>
            <Button
              onClick={() =>
                router.replace(
                  flowContext === "dashboard"
                    ? "/create/import?method=text&ctx=dashboard"
                    : "/create/import?method=text",
                )
              }
            >
              {isEn ? "Switch to Text Import" : "切换到文本导入"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mx-auto max-w-4xl space-y-6">
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-lg">{isEn ? "Conversation Text" : "对话原文"}</CardTitle>
              <CardDescription>
                {isEn
                  ? "Supports WeChat, Feishu, DingTalk, and more. Keep complete context for better analysis."
                  : "支持微信、飞书、钉钉等来源。尽量保留完整上下文，分析结果会更准确。"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={
                  isEn
                    ? `Example:
Alice: Hi, we'd like to hire you as Frontend Engineer with salary $3000/month. Can you start next Monday?
Bob: Sure. Is this before or after tax?
Alice: Before tax. Probation is 3 months with 80% salary.
Bob: Got it. What are the working hours?
Alice: 9-5, weekends off, occasional overtime.

Paste your original conversation here...`
                    : `示例：
张总：小王，面试通过了，薪资 15K，五险一金，下周一入职可以吗？
小王：好的张总，15K 是税前还是税后？
张总：税前 15K，试用期 3 个月，试用期工资 80%。
小王：好的，工作时间是怎样的？
张总：朝九晚五，周末双休，偶尔需要加班。

请将原始对话粘贴到这里...`
                }
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="min-h-[340px] resize-y leading-relaxed"
              />
              <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{isEn ? `${content.length} chars` : `当前 ${content.length} 个字符`}</span>
                <span>{inputQualityHint}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-muted/20">
            <CardContent className="p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                {isEn ? "Tips for Better Analysis Quality" : "提高分析质量的小建议"}
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {isEn ? (
                  <>
                    <li>• Include identities and roles (name, company, position)</li>
                    <li>• Include key terms (amount, duration, payment method)</li>
                    <li>• Include timelines (start date, delivery date, contract term)</li>
                    <li>• Include additional clauses (confidentiality, breach, benefits, overtime)</li>
                  </>
                ) : (
                  <>
                    <li>• 尽量包含双方身份与角色信息，例如姓名、公司、岗位</li>
                    <li>• 尽量包含金额、期限、付款方式等关键条款</li>
                    <li>• 尽量包含入职日期、交付时间、合同周期等时间节点</li>
                    <li>• 尽量包含保密、违约、福利、加班等补充约定</li>
                  </>
                )}
              </ul>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-3 rounded-xl border border-border/70 bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => router.push(backHref)}>
              {isEn ? "Back" : "返回上一步"}
            </Button>
            <Button size="lg" onClick={handleAnalyze} disabled={!content.trim() || isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEn ? "Analyzing..." : "分析中..."}
                </>
              ) : (
                <>
                  {isEn ? "Start Analysis" : "开始分析"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </CreateFlowShell>
  );
}

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ImportContent />
    </Suspense>
  );
}
