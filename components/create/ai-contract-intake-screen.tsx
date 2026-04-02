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
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createContractForCurrentUser } from "@/lib/contracts/client";
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
  const canonicalPath =
    flowContext === "dashboard" ? "/create/ai-chat?ctx=dashboard" : "/create/ai-chat";
  const backToCreateHref =
    flowContext === "dashboard" ? "/dashboard/contracts/new" : "/create";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [chatResult, setChatResult] = useState<ChatResult | null>(null);

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
          : "告诉我你想生成什么合同。例如：招聘前端工程师，月薪 20k，工作地点上海。",
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
      const analysisResponse = await fetch("/api/contracts/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: chatResult.draftSourceContent,
          sourceType: "text",
        }),
      });

      const analysisResult = await analysisResponse.json();
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
          ? `/create/analyze?id=${draft.id}&ctx=dashboard`
          : `/create/analyze?id=${draft.id}`,
      );
    } catch (error) {
      console.error("[AIContractIntakeScreen] Failed to create draft:", error);
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

      <main className="container mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {isEn ? "Canonical Create Flow" : "统一创建主线"}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEn ? "AI Contract Intake" : "AI 对话生成入口"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {isEn
                ? "Use conversation to collect contract facts, then create a standard draft and continue through analyze and edit."
                : "通过对话采集合同比要，生成标准草稿后继续进入 analyze 和 edit 主流程。"}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push(backToCreateHref)}>
              {isEn ? "Back to Create" : "返回创建入口"}
            </Button>
            <Button onClick={() => router.push("/contracts")}>
              {isEn ? "My Contracts" : "我的合同"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <Card className="min-h-[680px] border-border/70 bg-card/95">
            <CardHeader>
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
            <CardContent className="flex h-[600px] flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-border/70 bg-muted/15 p-4">
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
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
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
                      : "例如：我们要招聘产品设计师，工作地点杭州，月薪 18k..."
                  }
                  disabled={chatLoading || draftLoading}
                />
                <Button onClick={() => void handleSend()} disabled={!input.trim() || chatLoading || draftLoading}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/95">
              <CardHeader>
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
              <CardHeader>
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
      </main>
    </div>
  );
}
