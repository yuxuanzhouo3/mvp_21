"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Eye,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Save,
  ShieldAlert,
  Underline,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { CreateFlowShell } from "@/components/create/flow-shell";
import { MobileActionBar } from "@/components/create/mobile-action-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFocusScrollIntoView } from "@/hooks/use-mobile-keyboard";
import { getContractTypeDisplayName } from "@/lib/ai/prompts/generate";
import { ContractContent } from "@/lib/ai/types";
import {
  downloadContractForCurrentUser,
  type ContractDetail,
  getContractForCurrentUser,
  updateContractForCurrentUser,
} from "@/lib/contracts/client";
import {
  appendContractVersionHistory,
  buildContractHtml,
  createVersionEntry,
  normalizeContractContent,
} from "@/lib/contracts/format";

type EditorTab = "edit" | "preview";

function EditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const isEn = language === "en";
  const editorRef = useRef<HTMLDivElement>(null);
  const draftId = searchParams.get("id") || "";
  const flowContext =
    searchParams.get("ctx") === "dashboard" ? "dashboard" : "standalone";

  const [contractRecord, setContractRecord] =
    useState<ContractDetail | null>(null);
  const [contract, setContract] = useState<ContractContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("edit");
  const [contractTitle, setContractTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const handleFocusCapture = useFocusScrollIntoView();

  const fallbackHref =
    flowContext === "dashboard" ? "/dashboard/contracts/new" : "/create";
  const analyzeHref =
    flowContext === "dashboard"
      ? `/create/analyze?id=${draftId}&ctx=dashboard`
      : `/create/analyze?id=${draftId}`;

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
        const record = await getContractForCurrentUser(draftId);
        const content = normalizeContractContent(record.content);

        if (!content) {
          toast.error(
            isEn ? "Please generate the contract first." : "请先生成合同内容。",
          );
          router.replace(analyzeHref);
          return;
        }

        const renderedHtml =
          typeof record.metadata?.editorHtml === "string"
            ? record.metadata.editorHtml
            : null;
        const html = buildContractHtml(content, {
          language: isEn ? "en" : "zh",
          renderedHtml,
        });

        if (!cancelled) {
          setContractRecord(record);
          setContract(content);
          setContractTitle(content.title);
          setEditedContent(html);
        }
      } catch (error) {
        console.error("[CreateEditPage] Failed to load draft:", error);

        if (!cancelled) {
          if (error instanceof Error && error.message === "UNAUTHORIZED") {
            router.replace(`/auth?redirect=${encodeURIComponent(analyzeHref)}`);
            return;
          }

          toast.error(
            error instanceof Error
              ? error.message
              : isEn
                ? "Failed to load contract"
                : "加载合同失败。",
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
  }, [analyzeHref, draftId, fallbackHref, isEn, router]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const persistDraft = async (silent = false) => {
    if (!contract || !contractRecord) return null;

    const currentHtml = editorRef.current?.innerHTML || editedContent;
    const updatedContract: ContractContent = {
      ...contract,
      title: contractTitle,
    };
    const previousHtml =
      typeof contractRecord.metadata?.editorHtml === "string"
        ? contractRecord.metadata.editorHtml
        : "";
    const hasMeaningfulChange =
      previousHtml.trim() !== currentHtml.trim() ||
      (contractRecord.title || "").trim() !== contractTitle.trim();
    const nextMetadata = hasMeaningfulChange
      ? appendContractVersionHistory(
          contractRecord.metadata,
          createVersionEntry({
            action: "draft_saved",
            title: contractTitle,
            summary: isEn
              ? "Saved edits in the contract editor."
              : "已保存本次编辑内容。",
          }),
        )
      : { ...(contractRecord.metadata || {}) };

    const savedRecord = await updateContractForCurrentUser(contractRecord.id, {
      title: contractTitle,
      type: updatedContract.contractType || contractRecord.type,
      status: contractRecord.status || "draft",
      content: updatedContract,
      analysisResult: contractRecord.analysisResult,
      parties: contractRecord.parties,
      signatures: contractRecord.signatures,
      metadata: {
        ...nextMetadata,
        editorHtml: currentHtml,
        draftStage: "edited",
        flowVersion: "create-v2",
      },
      sourceType: contractRecord.sourceType,
      sourceContent: contractRecord.sourceContent,
      region: contractRecord.region,
    });

    setContractRecord(savedRecord);
    setContract(updatedContract);
    setEditedContent(currentHtml);

    if (!silent) {
      toast.success(isEn ? "Contract saved" : "合同已保存");
    }

    return savedRecord;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await persistDraft();
    } catch (error) {
      console.error("[CreateEditPage] Failed to save draft:", error);
      toast.error(isEn ? "Save failed, please retry." : "保存失败，请重试。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (!contractRecord) return;

    setIsExporting(true);
    try {
      await persistDraft(true);
      await downloadContractForCurrentUser(contractRecord.id);
      toast.success(isEn ? "Contract exported" : "合同已导出");
    } catch (error) {
      console.error("[CreateEditPage] Failed to export contract:", error);
      toast.error(isEn ? "Export failed, please retry." : "导出失败，请重试。");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    try {
      const plainText = editorRef.current?.innerText || "";
      await navigator.clipboard.writeText(plainText);
      toast.success(isEn ? "Copied to clipboard" : "已复制到剪贴板");
    } catch {
      toast.error(isEn ? "Copy failed" : "复制失败");
    }
  };

  if (isLoading || !contract) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const contractTypeLabel = getContractTypeDisplayName(
    contract.contractType || "custom",
    isEn ? "en" : "zh",
  );

  return (
    <CreateFlowShell
      step={4}
      title={isEn ? "Edit and Export Contract" : "编辑并导出合同"}
      description={
        isEn
          ? "Complete the final review and save the real contract record."
          : "完成最终审核，并将编辑后的内容保存为正式合同记录。"
      }
      backHref={analyzeHref}
      backLabel={isEn ? "Back to Analysis" : "返回分析"}
    >
      <div
        className="mx-auto max-w-6xl space-y-5 min-[430px]:space-y-6"
        onFocusCapture={handleFocusCapture}
      >
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="p-4 pb-4 min-[390px]:p-5 min-[430px]:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base min-[390px]:text-lg">
                  {isEn ? "Contract Draft Ready" : "合同草稿已生成"}
                </CardTitle>
                <Badge variant="secondary">{contractTypeLabel}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-2 h-4 w-4" />
                  {isEn ? "Copy Text" : "复制文本"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isEn ? "Save" : "保存"}
                </Button>
                <Button size="sm" onClick={handleExport} disabled={isExporting}>
                  {isExporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {isEn ? "Download HTML" : "下载 HTML"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <label
              className="text-sm font-medium text-muted-foreground"
              htmlFor="contract-title"
            >
              {isEn ? "Contract Title" : "合同标题"}
            </label>
            <Input
              id="contract-title"
              value={contractTitle}
              onChange={(event) => setContractTitle(event.target.value)}
              placeholder={isEn ? "Enter contract title" : "请输入合同标题"}
              className="text-[13px] min-[390px]:text-sm min-[430px]:text-[15px] md:text-base"
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EditorTab)}>
            <CardHeader className="border-b p-3 pb-3 min-[390px]:p-4 min-[430px]:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="edit" className="gap-2">
                    <Edit3 className="h-4 w-4" />
                    {isEn ? "Edit" : "编辑"}
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <Eye className="h-4 w-4" />
                    {isEn ? "Preview" : "预览"}
                  </TabsTrigger>
                </TabsList>

                {activeTab === "edit" ? (
                  <div className="flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border border-border/70 bg-muted/20 p-1 pb-2 min-[390px]:gap-1.5 min-[390px]:p-1.5 sm:flex-wrap sm:overflow-visible sm:pb-1">
                    <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => execCommand("bold")}>
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => execCommand("italic")}>
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => execCommand("underline")}>
                      <Underline className="h-4 w-4" />
                    </Button>
                    <div className="mx-1 h-5 w-px shrink-0 bg-border" />
                    <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => execCommand("justifyLeft")}>
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => execCommand("justifyCenter")}>
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => execCommand("justifyRight")}>
                      <AlignRight className="h-4 w-4" />
                    </Button>
                    <div className="mx-1 h-5 w-px shrink-0 bg-border" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => execCommand("insertUnorderedList")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => execCommand("insertOrderedList")}
                    >
                      <ListOrdered className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <TabsContent value="edit" className="m-0">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-[48svh] max-h-[72svh] overflow-auto p-3 text-[13px] leading-7 focus:outline-none min-[390px]:p-4 min-[390px]:text-sm min-[430px]:text-[15px] sm:min-h-[520px] sm:max-h-none sm:p-6 sm:text-base lg:min-h-[620px] lg:p-8"
                  style={{
                    fontFamily: '"SimSun", "Songti SC", serif',
                    lineHeight: 1.8,
                  }}
                  dangerouslySetInnerHTML={{ __html: editedContent }}
                  onInput={(event) =>
                    setEditedContent((event.target as HTMLDivElement).innerHTML)
                  }
                />
              </TabsContent>

              <TabsContent value="preview" className="m-0 border-t border-border/60">
                <div
                  className="min-h-[48svh] max-h-[72svh] overflow-auto bg-background p-3 text-[13px] leading-7 min-[390px]:p-4 min-[390px]:text-sm min-[430px]:text-[15px] sm:min-h-[520px] sm:max-h-none sm:p-6 sm:text-base lg:min-h-[620px] lg:p-8"
                  style={{
                    fontFamily: '"SimSun", "Songti SC", serif',
                    lineHeight: 1.8,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: editorRef.current?.innerHTML || editedContent,
                  }}
                />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <div className="hidden flex-col gap-3 rounded-xl border border-border/70 bg-card/80 p-4 md:flex md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-primary" />
            <span>
              {isEn
                ? "Important contracts should still be reviewed by legal counsel before signing."
                : "重要合同在签署前，仍建议由法务或律师进行复核。"}
            </span>
          </div>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEn ? "Exporting..." : "导出中..."}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {isEn ? "Save and Download" : "保存并下载"}
              </>
            )}
          </Button>
        </div>

        <MobileActionBar>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving || isExporting}
            className="h-10 flex-1 text-xs min-[390px]:text-sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="ml-2">{isEn ? "Save" : "保存"}</span>
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="h-10 flex-[1.2] text-xs min-[390px]:text-sm"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEn ? "Exporting..." : "导出中..."}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {isEn ? "Save and Download" : "保存并下载"}
              </>
            )}
          </Button>
        </MobileActionBar>
      </div>
    </CreateFlowShell>
  );
}

export default function EditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <EditPageContent />
    </Suspense>
  );
}
