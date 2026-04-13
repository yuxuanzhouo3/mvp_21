"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquareText,
  Sparkles,
  User,
} from "lucide-react";

import { Header } from "@/components/header";
import { MobileActionBar } from "@/components/create/mobile-action-bar";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFocusScrollIntoView } from "@/hooks/use-mobile-keyboard";
import { createContractForCurrentUser } from "@/lib/contracts/client";
import {
  DEFAULT_ANALYSIS_MAX_CHARS,
  prepareAnalysisInput,
} from "@/lib/contracts/analysis-input";
import { prepareDraftAnalysisForCurrentUser } from "@/lib/contracts/draft-context";
import {
  buildContractParties,
  createVersionEntry,
  deriveDraftTitle,
} from "@/lib/contracts/format";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatResult {
  reply: string;
  ready: boolean;
  completionScore: number;
  summary: string;
  missingFields: string[];
  suggestedTitle: string;
  collectedData: Record<string, string>;
  draftSourceContent: string;
}

export function AIContractIntakeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useUser();
  const { language } = useLanguage();
  const isEn = language === "en";
  const flowContext = searchParams.get("ctx") === "dashboard" ? "dashboard" : "standalone";
  const templateId = searchParams.get("templateId") || "";
  const canonicalPath =
    flowContext === "dashboard"
      ? `/create/ai-chat?ctx=dashboard${templateId ? `&templateId=${encodeURIComponent(templateId)}` : ""}`
      : `/create/ai-chat${templateId ? `?templateId=${encodeURIComponent(templateId)}` : ""}`;
  const backToCreateHref =
    flowContext === "dashboard" ? "/dashboard/contracts/new" : "/create";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [chatResult, setChatResult] = useState<ChatResult | null>(null);
  const handleFocusCapture = useFocusScrollIntoView();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace(`/auth?redirect=${encodeURIComponent(canonicalPath)}`);
    }
  }, [canonicalPath, router, user, userLoading]);

  useEffect(() => {
    if (!user || messages.length > 0) {
      return;
    }

    setMessages([
      {
        role: "assistant",
        content: isEn
          ? "Describe the contract you want to create. For example: hire a frontend engineer, monthly salary 20k, Shanghai office."
          : "告诉我你想生成什么合同。例如：签一份软件开发服务合同，预算 20 万，项目地点上海。",
      },
    ]);
  }, [isEn, messages.length, user]);

  const completionPercent = useMemo(
    () => Math.round((chatResult?.completionScore || 0) * 100),
    [chatResult?.completionScore],
  );

  const handleSend = async () => {
    if (!input.trim() || chatLoading || draftLoading) {
      return;
    }

    const nextUserMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
    };

    const nextMessages = [...messages, nextUserMessage];
    setMessages(nextMessages);
    setInput("");
    setChatLoading(true);

    try {
      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();
      if (!headers) {
        throw new Error("UNAUTHORIZED");
      }

      const response = await fetch("/api/contracts/ai-chat", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || (isEn ? "AI chat failed." : "AI 对话失败。"));
      }

      const data = result.data as ChatResult;
      setChatResult(data);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (error) {
      console.error("[AIContractIntakeScreen] AI chat failed:", error);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error && error.message === "UNAUTHORIZED"
              ? isEn
                ? "Please sign in first, then continue the AI conversation."
                : "请先登录，再继续 AI 对话生成。"
              : isEn
                ? "Something went wrong. Please try again."
                : "出了点问题，请稍后重试。",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const createDraftFromChat = async () => {
    if (!chatResult?.draftSourceContent || draftLoading) {
      return;
    }

    try {
      setDraftLoading(true);
      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();
      if (!headers) {
        throw new Error("UNAUTHORIZED");
      }

      const preparedInput = prepareAnalysisInput(chatResult.draftSourceContent, {
        maxChars: DEFAULT_ANALYSIS_MAX_CHARS,
      });
      if (preparedInput.analyzedChars < 20) {
        throw new Error(
          isEn
            ? "The extracted conversation is too short. Please add more details."
            : "提取后的对话过短，请补充更多细节后再分析。",
        );
      }

      const analysisResponse = await fetch("/api/contracts/analyze", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: preparedInput.content,
          sourceType: "text",
        }),
      });

      const analysisResult = await analysisResponse.json();
      if (preparedInput.truncated || analysisResult?.meta?.input?.truncated) {
        console.info("[AIContractIntakeScreen] Analysis input compacted:", {
          clientInputChars: preparedInput.analyzedChars,
          serverInputChars: analysisResult?.meta?.input?.analyzedChars,
        });
      }
      if (!analysisResult.success) {
        throw new Error(
          analysisResult.error?.message || (isEn ? "Analysis failed." : "分析失败。"),
        );
      }

      const { analysisResult: enrichedAnalysis, activeCompanyProfile } =
        await prepareDraftAnalysisForCurrentUser(analysisResult.data);
      const draftTitle = deriveDraftTitle(enrichedAnalysis);
      const draft = await createContractForCurrentUser({
        title: chatResult.suggestedTitle || draftTitle,
        type: enrichedAnalysis.contractType || "custom",
        status: "draft",
        content: {},
        sourceType: "text",
        sourceContent: chatResult.draftSourceContent,
        analysisResult: enrichedAnalysis,
        parties: buildContractParties(enrichedAnalysis),
        metadata: {
          flowVersion: "create-v2",
          draftStage: "analysis",
          flowContext,
          sourceMethod: "ai-chat",
          templateId: templateId || undefined,
          activeCompanyProfile: activeCompanyProfile || undefined,
          partyAProfileSource: activeCompanyProfile ? "active-company-profile" : undefined,
          aiIntake: {
            summary: chatResult.summary,
            missingFields: chatResult.missingFields,
            completionScore: chatResult.completionScore,
            collectedData: chatResult.collectedData,
          },
          versionHistory: [
            createVersionEntry({
              action: "draft_created",
              title: chatResult.suggestedTitle || draftTitle,
              summary: isEn
                ? "Created from AI chat intake and routed into the standard create flow."
                : "已根据 AI 对话采集结果创建草稿，并进入标准创建主线。",
            }),
          ],
        },
      });

      router.push(
        flowContext === "dashboard"
          ? `/create/analyze?id=${draft.id}&ctx=dashboard${templateId ? `&templateId=${encodeURIComponent(templateId)}` : ""}`
          : `/create/analyze?id=${draft.id}${templateId ? `&templateId=${encodeURIComponent(templateId)}` : ""}`,
      );
    } catch (error) {
      console.error("[AIContractIntakeScreen] Failed to create draft:", error);
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        router.push(`/auth?redirect=${encodeURIComponent(canonicalPath)}`);
        return;
      }

      window.alert(
        error instanceof Error
          ? error.message
          : isEn
            ? "Failed to create draft."
            : "创建草稿失败。",
      );
    } finally {
      setDraftLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50">
      <Header />

      <main className="container mx-auto max-w-6xl px-3 py-6 min-[390px]:px-4 min-[390px]:py-8 min-[430px]:py-10" onFocusCapture={handleFocusCapture}>
        <div className="mb-6 flex flex-col gap-3 min-[430px]:mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {isEn ? "Canonical Create Flow" : "统一创建主线"}
            </p>
            <h1 className="text-2xl font-bold tracking-tight min-[430px]:text-3xl">
              {isEn ? "AI Contract Intake" : "AI 对话生成入口"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {isEn
                ? "Use conversation to collect contract facts, then create a standard draft and continue through analyze and edit."
                : "通过对话采集合同行为事实，生成标准草稿后继续进入 analyze 和 edit 主流程。"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push(backToCreateHref)}>
              {isEn ? "Back to Create" : "返回创建入口"}
            </Button>
            <Button onClick={() => router.push("/contracts")}>
              {isEn ? "My Contracts" : "我的合同"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <Card className="min-h-[560px] border-border/70 bg-card/95 md:min-h-[680px]">
            <CardHeader className="p-4 min-[390px]:p-5 min-[430px]:p-6">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquareText className="h-5 w-5 text-primary" />
                {isEn ? "Conversation" : "对话采集"}
              </CardTitle>
              <CardDescription>
                {isEn
                  ? "Tell the assistant the business background first. It will ask for the missing facts step by step."
                  : "先描述业务背景，助手会逐步追问缺失信息。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-[calc(100svh-18rem)] min-h-[400px] max-h-[640px] flex-col px-3 pb-3 pt-0 min-[390px]:px-4 min-[390px]:pb-4 md:h-[600px] md:max-h-none md:px-6 md:pb-6">
              <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-muted/15 p-3 min-[390px]:space-y-4 min-[390px]:p-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div
                      className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-[13px] leading-6 min-[390px]:px-4 min-[390px]:py-3 min-[390px]:text-sm sm:max-w-[80%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground shadow-sm"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {chatLoading ? (
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      {isEn ? "Thinking..." : "正在思考..."}
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>

              <div className="mt-4 flex gap-3">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={
                    isEn
                      ? "For example: we want to hire a product designer in Hangzhou, salary 18k..."
                      : "例如：我们要签一份产品设计服务合同，项目地点杭州，预算 18 万..."
                  }
                  disabled={chatLoading || draftLoading}
                  className="h-10 text-[13px] min-[390px]:text-sm"
                />
                <Button
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || chatLoading || draftLoading}
                  className="h-10 min-w-10 px-3 text-xs min-[390px]:text-sm"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5 min-[430px]:space-y-6">
            <Card className="border-border/70 bg-card/95">
              <CardHeader className="p-4 min-[390px]:p-5 min-[430px]:p-6">
                <CardTitle className="text-lg">{isEn ? "Intake Status" : "采集状态"}</CardTitle>
                <CardDescription>
                  {isEn
                    ? "The AI keeps a running summary and tells you when the draft is ready."
                    : "AI 会持续汇总当前信息，并在达到可生成草稿时提示你。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{isEn ? "Completion" : "完成度"}</span>
                    <span className="text-sm font-medium">{completionPercent}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">{isEn ? "Current Summary" : "当前摘要"}</p>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    {chatResult?.summary ||
                      (isEn ? "The summary will appear here after the conversation starts." : "开始对话后，摘要会显示在这里。")}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">{isEn ? "Still Missing" : "仍缺信息"}</p>
                  <div className="flex flex-wrap gap-2">
                    {(chatResult?.missingFields || []).length > 0 ? (
                      chatResult?.missingFields.map((item) => (
                        <span key={item} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {isEn ? "No critical blockers yet." : "暂无关键阻塞项。"}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={chatResult?.ready ? "border-primary/30 bg-primary/5" : "border-border/70 bg-card/95"}>
              <CardHeader className="p-4 min-[390px]:p-5 min-[430px]:p-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className={`h-5 w-5 ${chatResult?.ready ? "text-primary" : "text-muted-foreground"}`} />
                  {isEn ? "Create Draft" : "创建草稿"}
                </CardTitle>
                <CardDescription>
                  {chatResult?.ready
                    ? isEn
                      ? "The collected facts are enough for a meaningful first draft."
                      : "当前采集信息已经足够生成一版有意义的合同草稿。"
                    : isEn
                      ? "Keep chatting until the AI says the draft is ready."
                      : "继续补充对话信息，直到 AI 判断可以生成草稿。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {chatResult?.suggestedTitle || (isEn ? "Draft title will appear here" : "草稿标题会显示在这里")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap leading-6">
                    {chatResult?.draftSourceContent ||
                      (isEn ? "The normalized draft source summary will appear here." : "标准化后的草稿来源摘要会显示在这里。")}
                  </p>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={!chatResult?.ready || draftLoading}
                  onClick={() => void createDraftFromChat()}
                >
                  {draftLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEn ? "Creating Draft..." : "正在创建草稿..."}
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      {isEn ? "Create Draft and Enter Analysis" : "创建草稿并进入分析"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <MobileActionBar>
          <Button variant="outline" onClick={() => router.push(backToCreateHref)} className="h-10 flex-1 text-xs min-[390px]:text-sm">
            {isEn ? "Back" : "返回"}
          </Button>
          <Button
            disabled={!chatResult?.ready || draftLoading}
            onClick={() => void createDraftFromChat()}
            className="h-10 flex-[1.2] text-xs min-[390px]:text-sm"
          >
            {draftLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEn ? "Creating..." : "创建中..."}
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {isEn ? "Create Draft" : "创建草稿"}
              </>
            )}
          </Button>
        </MobileActionBar>
      </main>
    </div>
  );
}
