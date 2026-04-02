"use client";

import { useState, type ElementType } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Image,
  MessageSquare,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { CreateFlowShell } from "@/components/create/flow-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ImportMethod = "text" | "screenshot" | "wechat" | "ai-chat";
type CreateFlowContext = "standalone" | "dashboard";

interface CreateContractScreenProps {
  showSidebarTrigger?: boolean;
  flowContext?: CreateFlowContext;
}

export function CreateContractScreen({
  showSidebarTrigger = false,
  flowContext = "standalone",
}: CreateContractScreenProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const isEn = language === "en";
  const [selectedMethod, setSelectedMethod] = useState<ImportMethod>("text");

  const importMethods: Array<{
    id: ImportMethod;
    title: string;
    description: string;
    icon: ElementType;
    available: boolean;
    badge?: string;
  }> = [
    {
      id: "text",
      title: isEn ? "Paste Conversation Text" : "粘贴对话文本",
      description: isEn
        ? "Paste chat records from WeChat, Feishu, DingTalk, etc. This is the most stable option."
        : "直接粘贴微信、飞书、钉钉等聊天记录，这是当前最稳定的方式。",
      icon: FileText,
      available: true,
      badge: isEn ? "Recommended" : "推荐",
    },
    {
      id: "screenshot",
      title: isEn ? "Upload Screenshot" : "上传对话截图",
      description: isEn
        ? "Extract contract facts from chat screenshots with OCR and continue in the same flow."
        : "对聊天截图执行 OCR 提取，再继续进入同一条合同创建主线。",
      icon: Image,
      available: true,
      badge: "OCR",
    },
    {
      id: "wechat",
      title: isEn ? "Choose WeChat Chat" : "导入微信截图",
      description: isEn
        ? "Import a WeChat chat screenshot and continue in the standard contract creation flow."
        : "导入微信聊天截图，并进入标准合同创建流程。",
      icon: MessageSquare,
      available: true,
      badge: isEn ? "Beta" : "测试中",
    },
    {
      id: "ai-chat",
      title: isEn ? "AI Guided Intake" : "AI 对话引导",
      description: isEn
        ? "Let the assistant ask for missing facts, then continue into the same contract draft pipeline."
        : "由 AI 逐步追问缺失信息，再进入同一套合同草稿主线。",
      icon: MessageSquareText,
      available: true,
      badge: isEn ? "Guided" : "引导式",
    },
  ];

  const selectedMethodInfo = importMethods.find(
    (item) => item.id === selectedMethod,
  );

  const handleNext = () => {
    if (!selectedMethodInfo?.available) return;

    if (selectedMethod === "ai-chat") {
      const params = new URLSearchParams();
      if (flowContext === "dashboard") {
        params.set("ctx", "dashboard");
      }
      router.push(`/create/ai-chat${params.toString() ? `?${params.toString()}` : ""}`);
      return;
    }

    const params = new URLSearchParams({ method: selectedMethod });
    if (flowContext === "dashboard") {
      params.set("ctx", "dashboard");
    }
    router.push(`/create/import?${params.toString()}`);
  };

  return (
    <CreateFlowShell
      step={1}
      title={isEn ? "Create New Contract" : "创建新合同"}
      description={
        isEn
          ? "Choose how you want to start, then continue into one shared create flow."
          : "先选择启动方式，然后进入统一的合同创建主线。"
      }
      backHref={flowContext === "dashboard" ? "/dashboard/contracts" : "/"}
      backLabel={
        flowContext === "dashboard"
          ? isEn
            ? "Back to Contracts"
            : "返回合同列表"
          : isEn
            ? "Back to Home"
            : "返回首页"
      }
      showSidebarTrigger={showSidebarTrigger}
    >
      <div className="grid gap-6 xl:grid-cols-[2.2fr_1fr]">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {importMethods.map((method) => {
            const Icon = method.icon;
            const isSelected = selectedMethod === method.id;
            const isDisabled = !method.available;

            return (
              <Card
                key={method.id}
                role="button"
                tabIndex={isDisabled ? -1 : 0}
                aria-disabled={isDisabled}
                aria-pressed={isSelected}
                onClick={() => {
                  if (!isDisabled) setSelectedMethod(method.id);
                }}
                onKeyDown={(event) => {
                  if (isDisabled) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedMethod(method.id);
                  }
                }}
                className={cn(
                  "relative border-border/70 transition-all",
                  isDisabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                  isSelected && "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/15",
                )}
              >
                {method.badge && (
                  <span className="absolute right-3 top-3 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    {method.badge}
                  </span>
                )}
                <CardHeader>
                  <div
                    className={cn(
                      "mb-4 flex h-11 w-11 items-center justify-center rounded-lg",
                      isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{method.title}</CardTitle>
                  <CardDescription>{method.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {method.available
                    ? isEn
                      ? "Available now"
                      : "立即可用"
                    : isEn
                      ? "Unavailable"
                      : "当前不可用"}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <aside>
          <Card className="border-border/70 bg-card/95 xl:sticky xl:top-20">
            <CardHeader>
              <CardTitle className="text-base">{isEn ? "Current Selection" : "当前选择"}</CardTitle>
              <CardDescription>
                {isEn ? "Confirm and proceed to the next step." : "确认后进入下一步。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">
                  {selectedMethodInfo?.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedMethodInfo?.description}
                </p>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    {isEn
                      ? "AI extracts key terms such as dates, amounts, roles, and responsibilities."
                      : "AI 会自动提取时间、金额、角色、职责等关键条款。"}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    {isEn
                      ? "You can review all extracted fields before contract generation."
                      : "在生成合同前，你可以人工校对所有提取字段。"}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    {isEn
                      ? "You can still fully edit before final export for production use."
                      : "最终导出前仍可完整编辑，适合正式业务场景。"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 rounded-xl border border-border/70 bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {isEn ? "Selected:" : "已选择:"}
          <span className="ml-1 font-medium text-foreground">
            {selectedMethodInfo?.title}
          </span>
        </p>
        <Button
          size="lg"
          onClick={handleNext}
          disabled={!selectedMethodInfo?.available}
          className="sm:min-w-36"
        >
          {isEn ? "Next" : "下一步"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </CreateFlowShell>
  );
}
