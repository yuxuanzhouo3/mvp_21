"use client";

import Image from "next/image";
import { Suspense, useMemo, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  FileImage,
  Loader2,
  RefreshCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { CreateFlowShell } from "@/components/create/flow-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { tokenManager } from "@/lib/auth/frontend-token-manager";
import { createContractForCurrentUser } from "@/lib/contracts/client";
import { prepareDraftAnalysisForCurrentUser } from "@/lib/contracts/draft-context";
import {
  buildContractParties,
  createVersionEntry,
  deriveDraftTitle,
} from "@/lib/contracts/format";

type SupportedImportMethod = "text" | "screenshot" | "wechat";
type OcrSourceType = "screenshot" | "wechat" | "feishu";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

function ImportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const isEn = language === "en";
  const method = (searchParams.get("method") || "text") as SupportedImportMethod;
  const flowContext = searchParams.get("ctx") === "dashboard" ? "dashboard" : "standalone";
  const templateId = searchParams.get("templateId") || "";
  const [content, setContent] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrImageName, setOcrImageName] = useState("");
  const [ocrImageDataUrl, setOcrImageDataUrl] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrSummary, setOcrSummary] = useState("");
  const [ocrProvider, setOcrProvider] = useState("");
  const [ocrSourceType, setOcrSourceType] = useState<OcrSourceType | "">("");
  const [ocrLoading, setOcrLoading] = useState(false);

  const supportsOcr = method === "screenshot" || method === "wechat";
  const isKnownMethod = method === "text" || supportsOcr;
  const activeContent = supportsOcr ? ocrText : content;
  const trimmedLength = activeContent.trim().length;
  const backHref = flowContext === "dashboard" ? "/dashboard/contracts/new" : "/create";
  const importHref =
    flowContext === "dashboard"
      ? `/create/import?method=${method}&ctx=dashboard${templateId ? `&templateId=${encodeURIComponent(templateId)}` : ""}`
      : `/create/import?method=${method}${templateId ? `&templateId=${encodeURIComponent(templateId)}` : ""}`;

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

  async function createDraftFromContent(
    nextContent: string,
    sourceType: SupportedImportMethod | OcrSourceType,
  ) {
    const analysisResponse = await fetch("/api/contracts/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: nextContent,
        sourceType,
      }),
    });

    const analysisResult = await analysisResponse.json();
    if (!analysisResult.success) {
      throw new Error(
        analysisResult.error?.message || (isEn ? "Analysis failed" : "分析失败"),
      );
    }

    const { analysisResult: enrichedAnalysis, activeCompanyProfile } =
      await prepareDraftAnalysisForCurrentUser(analysisResult.data);
    const draftTitle = deriveDraftTitle(enrichedAnalysis);
    const draft = await createContractForCurrentUser({
      title: draftTitle,
      type: enrichedAnalysis.contractType || "custom",
      status: "draft",
      content: {},
      sourceType,
      sourceContent: nextContent,
      analysisResult: enrichedAnalysis,
      parties: buildContractParties(enrichedAnalysis),
        metadata: {
          flowVersion: "create-v2",
          draftStage: "analysis",
          flowContext,
          sourceMethod: method,
          templateId: templateId || undefined,
          activeCompanyProfile: activeCompanyProfile || undefined,
          partyAProfileSource: activeCompanyProfile ? "active-company-profile" : undefined,
        importMeta: supportsOcr
          ? {
              provider: ocrProvider || undefined,
              detectedSourceType: ocrSourceType || sourceType,
              imageName: ocrImageName || undefined,
              summary: ocrSummary || undefined,
            }
          : undefined,
        versionHistory: [
          createVersionEntry({
            action: "draft_created",
            title: draftTitle,
            summary: isEn
              ? `Created from imported ${supportsOcr ? "screenshot OCR" : "conversation text"}.`
              : `已根据导入的${supportsOcr ? "截图 OCR 内容" : "对话文本"}创建草稿。`,
          }),
        ],
      },
    });

    router.push(
      flowContext === "dashboard"
        ? `/create/analyze?id=${draft.id}&ctx=dashboard${templateId ? `&templateId=${encodeURIComponent(templateId)}` : ""}`
        : `/create/analyze?id=${draft.id}${templateId ? `&templateId=${encodeURIComponent(templateId)}` : ""}`,
    );
  }

  const handleAnalyze = async () => {
    const nextContent = activeContent.trim();
    if (!nextContent) {
      toast.error(
        supportsOcr
          ? isEn
            ? "Please extract or enter screenshot text first"
            : "请先识别或输入截图文字"
          : isEn
            ? "Please enter conversation content"
            : "请输入对话内容",
      );
      return;
    }

    if (nextContent.length < 20) {
      toast.error(
        isEn
          ? "Conversation is too short. Please provide more details."
          : "对话内容太短，请提供更详细的上下文。",
      );
      return;
    }

    setIsAnalyzing(true);

    try {
      await createDraftFromContent(
        nextContent,
        supportsOcr
          ? ocrSourceType || (method === "wechat" ? "wechat" : "screenshot")
          : "text",
      );
    } catch (error) {
      console.error("[CreateImportPage] Failed to analyze and create draft:", error);

      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        toast.error(isEn ? "Please sign in before creating a draft." : "请先登录后再创建合同草稿");
        router.push(`/auth?redirect=${encodeURIComponent(importHref)}`);
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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setOcrImageName(file.name);
      setOcrImageDataUrl(dataUrl);
      setOcrText("");
      setOcrSummary("");
      setOcrProvider("");
      setOcrSourceType("");
    } catch (error) {
      console.error("[CreateImportPage] Failed to read OCR image:", error);
      toast.error(isEn ? "Failed to read the selected image." : "读取所选图片失败");
    } finally {
      event.target.value = "";
    }
  };

  const runOcr = async () => {
    if (!ocrImageDataUrl) {
      toast.error(isEn ? "Please upload a screenshot first." : "请先上传截图");
      return;
    }

    try {
      setOcrLoading(true);
      const headers = await tokenManager.getAuthHeaderAsync();
      if (!headers) {
        throw new Error("UNAUTHORIZED");
      }

      const response = await fetch("/api/contracts/import-screenshot", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: ocrImageDataUrl,
          sourceHint: method === "wechat" ? "wechat" : "screenshot",
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || (isEn ? "OCR failed" : "OCR 识别失败"));
      }

      setOcrText(result.data?.conversationText || "");
      setOcrSummary(result.data?.summary || "");
      setOcrProvider(result.meta?.provider || "");
      setOcrSourceType(result.data?.sourceType || (method === "wechat" ? "wechat" : "screenshot"));
      toast.success(isEn ? "Screenshot text extracted successfully." : "截图文字识别成功");
    } catch (error) {
      console.error("[CreateImportPage] OCR failed:", error);

      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        toast.error(isEn ? "Please sign in before using OCR import." : "请先登录后再使用 OCR 导入");
        router.push(`/auth?redirect=${encodeURIComponent(importHref)}`);
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : isEn
            ? "OCR failed, please try again."
            : "OCR 识别失败，请重试",
      );
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <CreateFlowShell
      step={2}
      title={
        !isKnownMethod
          ? isEn
            ? "This import method is unavailable"
            : "该导入方式暂不可用"
          : supportsOcr
            ? isEn
              ? "Import Screenshot"
              : "导入截图"
            : isEn
              ? "Import Conversation Content"
              : "导入对话内容"
      }
      description={
        !isKnownMethod
          ? isEn
            ? "This route is not mapped to the current contract creation flow."
            : "当前路由未映射到现有合同创建流程。"
          : supportsOcr
            ? isEn
              ? "Upload a chat screenshot, run OCR, then review the extracted text before analysis."
              : "上传聊天截图后执行 OCR，人工确认识别结果，再进入分析。"
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
      {!isKnownMethod ? (
        <Card className="mx-auto max-w-3xl border-amber-200 bg-amber-50/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              {isEn ? "Unsupported Import Method" : "不支持的导入方式"}
            </CardTitle>
            <CardDescription className="text-amber-800">
              {isEn
                ? "Please return and select text import or screenshot OCR import."
                : "请返回并选择文本导入或截图 OCR 导入。"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.replace(backHref)}>
              {isEn ? "Back to Import Selection" : "返回导入方式选择"}
            </Button>
          </CardContent>
        </Card>
      ) : supportsOcr ? (
        <div className="mx-auto max-w-5xl space-y-6">
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-lg">{isEn ? "Upload Screenshot" : "上传截图"}</CardTitle>
              <CardDescription>
                {isEn
                  ? "Supports WeChat and other chat screenshots. OCR output remains editable before analysis."
                  : "支持微信等聊天截图。OCR 结果在进入分析前仍可手动编辑。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center transition hover:border-primary/50">
                <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {isEn ? "Select screenshot image" : "选择截图图片"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isEn ? "PNG, JPG, JPEG and other common formats are supported." : "支持 PNG、JPG、JPEG 等常见格式。"}
                </p>
                <input className="hidden" type="file" accept="image/*" onChange={handleFileChange} />
              </label>

              {ocrImageDataUrl ? (
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
                    <div className="border-b border-border/70 px-4 py-3 text-sm text-muted-foreground">
                      {isEn ? "Uploaded Screenshot" : "已上传截图"}
                      {ocrImageName ? <span className="ml-2 text-foreground">{ocrImageName}</span> : null}
                    </div>
                    <div className="relative aspect-[4/5] bg-muted/20">
                      <Image
                        src={ocrImageDataUrl}
                        alt={isEn ? "Uploaded screenshot preview" : "上传截图预览"}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  </div>

                  <Card className="border-border/70 bg-muted/20">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <FileImage className="mt-0.5 h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {isEn ? "OCR Import Flow" : "OCR 导入流程"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {isEn
                              ? "Upload screenshot -> OCR extraction -> manual review -> AI analysis."
                              : "上传截图 -> OCR 提取 -> 人工校对 -> AI 分析。"}
                          </p>
                        </div>
                      </div>
                      <Button onClick={() => void runOcr()} disabled={ocrLoading} className="w-full">
                        {ocrLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {isEn ? "Running OCR..." : "OCR 识别中..."}
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            {ocrText
                              ? isEn
                                ? "Re-run OCR"
                                : "重新识别"
                              : isEn
                                ? "Run OCR"
                                : "开始识别"}
                          </>
                        )}
                      </Button>
                      {(ocrProvider || ocrSourceType || ocrSummary) ? (
                        <div className="rounded-lg border border-border/70 bg-background p-3 text-xs text-muted-foreground">
                          {ocrSourceType ? (
                            <p>
                              {isEn ? "Detected Source" : "识别来源"}:
                              <span className="ml-1 font-medium text-foreground">{ocrSourceType}</span>
                            </p>
                          ) : null}
                          {ocrProvider ? (
                            <p className="mt-1">
                              {isEn ? "OCR Provider" : "OCR 服务"}:
                              <span className="ml-1 font-medium text-foreground">{ocrProvider}</span>
                            </p>
                          ) : null}
                          {ocrSummary ? (
                            <p className="mt-2 leading-6">
                              {isEn ? "Summary" : "摘要"}:
                              <span className="ml-1 text-foreground">{ocrSummary}</span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-lg">{isEn ? "Extracted Conversation Text" : "识别后的对话文本"}</CardTitle>
              <CardDescription>
                {isEn
                  ? "Review and correct the OCR result before sending it to the contract analyzer."
                  : "请先校对并修正 OCR 结果，再提交给合同分析器。"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={
                  isEn
                    ? "Run OCR first, then review the extracted chat text here."
                    : "请先执行 OCR，然后在这里检查提取出的聊天文本。"
                }
                value={ocrText}
                onChange={(event) => setOcrText(event.target.value)}
                className="min-h-[320px] resize-y leading-relaxed"
              />
              <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{isEn ? `${ocrText.length} chars` : `当前 ${ocrText.length} 个字符`}</span>
                <span>{inputQualityHint}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-muted/20">
            <CardContent className="p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <RefreshCcw className="h-4 w-4 text-primary" />
                {isEn ? "OCR Review Tips" : "OCR 校对建议"}
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>{isEn ? "Check speaker names, dates, amounts, and key promises." : "重点核对说话人、日期、金额和关键承诺。"}</li>
                <li>{isEn ? "Delete unrelated chit-chat and keep contract-relevant parts." : "删除无关寒暄，只保留与合同相关的内容。"}</li>
                <li>{isEn ? "If OCR misses lines, you can paste or add the missing text manually here." : "如果 OCR 漏识别，可直接在此手动补充文本。"}</li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-3 rounded-xl border border-border/70 bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => router.push(backHref)}>
              {isEn ? "Back" : "返回上一步"}
            </Button>
            <Button size="lg" onClick={handleAnalyze} disabled={!ocrText.trim() || isAnalyzing}>
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
                <li>{isEn ? "Include identities and roles (name, company, position)." : "尽量包含双方身份与角色信息，例如姓名、公司、岗位。"}</li>
                <li>{isEn ? "Include key terms (amount, duration, payment method)." : "尽量包含金额、期限、付款方式等关键条款。"}</li>
                <li>{isEn ? "Include timelines (start date, delivery date, contract term)." : "尽量包含入职日期、交付时间、合同周期等时间节点。"}</li>
                <li>{isEn ? "Include extra clauses (confidentiality, breach, benefits, overtime)." : "尽量包含保密、违约、福利、加班等补充约定。"}</li>
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
