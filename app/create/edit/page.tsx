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
  Printer,
  Save,
  ShieldAlert,
  Underline,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/language-provider";
import { CreateFlowShell } from "@/components/create/flow-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractContent } from "@/lib/ai/types";
import { CONTRACT_TYPE_NAMES } from "@/lib/ai/prompts/generate";

type EditorTab = "edit" | "preview";

function EditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const isEn = language === "en";
  const editorRef = useRef<HTMLDivElement>(null);
  const [contract, setContract] = useState<ContractContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("edit");
  const [contractTitle, setContractTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const flowContext = searchParams.get("ctx") === "dashboard" ? "dashboard" : "standalone";
  const fallbackHref = flowContext === "dashboard" ? "/dashboard/contracts/new" : "/create";
  const analyzeHref = flowContext === "dashboard" ? "/create/analyze?ctx=dashboard" : "/create/analyze";

  useEffect(() => {
    const stored = sessionStorage.getItem("generatedContract");
    if (!stored) {
      toast.error(isEn ? "Please generate a contract first" : "请先生成合同");
      router.push(fallbackHref);
      return;
    }

    try {
      const data = JSON.parse(stored) as ContractContent;
      setContract(data);
      setContractTitle(data.title);
      setEditedContent(formatContractToHtml(data));
    } catch {
      toast.error(isEn ? "Failed to load contract" : "加载合同失败");
      router.push(fallbackHref);
    } finally {
      setIsLoading(false);
    }
  }, [router, fallbackHref, isEn]);

  const formatContractToHtml = (data: ContractContent): string => {
    let html = `<h1 style="text-align:center;margin-bottom:24px;">${data.title}</h1>\n\n`;

    data.sections.forEach((section) => {
      html += `<h2 style="margin-top:20px;margin-bottom:12px;">${section.title}</h2>\n`;
      html += `<p style="text-indent:2em;line-height:1.8;">${section.content}</p>\n\n`;
    });

    if (data.disclaimer) {
      html += `<div style="margin-top:32px;padding:16px;background:#f5f5f5;border-radius:8px;">
        <p style="color:#666;font-size:14px;"><strong>${isEn ? "Disclaimer" : "声明"}：</strong>${data.disclaimer}</p>
      </div>\n\n`;
    }

    html += `<div style="margin-top:48px;">
      <div style="display:flex;justify-content:space-between;">
        <div style="width:45%;">
          <p><strong>${isEn ? "Party A (Signature)" : "甲方（签章）"}：</strong></p>
          <p style="margin-top:40px;border-bottom:1px solid #000;width:200px;"></p>
          <p style="margin-top:16px;"><strong>${isEn ? "Date" : "日期"}：</strong>${isEn ? "_______ / _____ / _____" : "_______年_____月_____日"}</p>
        </div>
        <div style="width:45%;">
          <p><strong>${isEn ? "Party B (Signature)" : "乙方（签章）"}：</strong></p>
          <p style="margin-top:40px;border-bottom:1px solid #000;width:200px;"></p>
          <p style="margin-top:16px;"><strong>${isEn ? "Date" : "日期"}：</strong>${isEn ? "_______ / _____ / _____" : "_______年_____月_____日"}</p>
        </div>
      </div>
    </div>`;

    return html;
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleSave = async () => {
    if (!contract) return;
    setIsSaving(true);

    try {
      const updatedContract = {
        ...contract,
        title: contractTitle,
      };
      sessionStorage.setItem("generatedContract", JSON.stringify(updatedContract));
      sessionStorage.setItem("contractHtml", editorRef.current?.innerHTML || editedContent);
      toast.success(isEn ? "Contract saved" : "合同已保存");
    } catch (error) {
      console.error("保存失败:", error);
      toast.error(isEn ? "Save failed, please retry." : "保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const printContent = editorRef.current?.innerHTML || editedContent;
      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        throw new Error(isEn ? "Unable to open print window" : "无法打开打印窗口");
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${contractTitle}</title>
          <style>
            body {
              font-family: "SimSun", "Songti SC", serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              line-height: 1.8;
            }
            h1 { font-size: 24px; text-align: center; margin-bottom: 32px; }
            h2 { font-size: 16px; margin-top: 24px; margin-bottom: 12px; }
            p { text-indent: 2em; margin: 8px 0; }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>${printContent}</body>
        </html>
      `);

      printWindow.document.close();
      printWindow.print();
      toast.success(isEn ? "Print window opened" : "已打开打印窗口");
    } catch (error) {
      console.error("导出失败:", error);
      toast.error(isEn ? "Export failed, please retry." : "导出失败，请重试");
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

  const contractTypeLabel =
    CONTRACT_TYPE_NAMES[contract.contractType || "custom"] || contract.contractType || (isEn ? "Contract" : "合同");

  return (
    <CreateFlowShell
      step={4}
      title={isEn ? "Edit and Export Contract" : "编辑并导出合同"}
      description={
        isEn
          ? "Complete final review and save. Verify amounts, dates, and party names before export."
          : "请完成最终审阅后保存。建议在导出前再次核对金额、时间和签署主体名称。"
      }
      backHref={analyzeHref}
      backLabel={isEn ? "Back to Analysis" : "返回分析"}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{isEn ? "Contract Draft Generated" : "合同草稿已生成"}</CardTitle>
                <Badge variant="secondary">{contractTypeLabel}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-2 h-4 w-4" />
                  {isEn ? "Copy Text" : "复制文本"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isEn ? "Save" : "保存"}
                </Button>
                <Button size="sm" onClick={handleExportPdf} disabled={isExporting}>
                  {isExporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {isEn ? "Export PDF" : "导出 PDF"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="contract-title">
              {isEn ? "Contract Title" : "合同标题"}
            </label>
            <Input
              id="contract-title"
              value={contractTitle}
              onChange={(event) => setContractTitle(event.target.value)}
              placeholder={isEn ? "Enter contract title" : "请输入合同标题"}
              className="text-base"
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EditorTab)}>
            <CardHeader className="border-b pb-3">
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

                {activeTab === "edit" && (
                  <div className="flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border border-border/70 bg-muted/20 p-1 pb-2 sm:flex-wrap sm:overflow-visible sm:pb-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => execCommand("bold")}
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => execCommand("italic")}
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => execCommand("underline")}
                    >
                      <Underline className="h-4 w-4" />
                    </Button>
                    <div className="mx-1 h-5 w-px shrink-0 bg-border" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => execCommand("justifyLeft")}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => execCommand("justifyCenter")}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => execCommand("justifyRight")}
                    >
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
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <TabsContent value="edit" className="m-0">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-[460px] overflow-x-auto p-4 focus:outline-none sm:min-h-[520px] sm:p-6 lg:min-h-[620px] lg:p-8"
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
                  className="min-h-[460px] overflow-x-auto bg-background p-4 sm:min-h-[520px] sm:p-6 lg:min-h-[620px] lg:p-8"
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

        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/80 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-primary" />
            <span>
              {isEn
                ? "Production tip: have legal counsel review critical contracts before signing."
                : "生产使用建议: 重要合同签署前仍需法务或律师复核。"}
            </span>
          </div>
          <Button onClick={handleExportPdf} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEn ? "Exporting..." : "导出中..."}
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                {isEn ? "Print / Export" : "打印/导出"}
              </>
            )}
          </Button>
        </div>
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
