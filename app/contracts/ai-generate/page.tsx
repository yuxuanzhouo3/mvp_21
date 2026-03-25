"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Sparkles,
  FileText,
  Download,
  User,
  Bot,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { useUser } from "@/components/user-context";
import { useLanguage } from "@/components/language-provider";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AIGenerateContractPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [contractGenerated, setContractGenerated] = useState(false);
  const [contractContent, setContractContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 重定向未登录用户
  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth?redirect=/contracts/ai-generate");
    }
  }, [user, userLoading, router]);

  // 初始化对话
  useEffect(() => {
    if (user && messages.length === 0) {
      const welcomeMessage: Message = {
        role: "assistant",
        content:
          language === "zh"
            ? "你好！我是 AI 合同助手 ✨\n\n我会通过几个简单的问题，帮你快速生成一份专业的劳动合同。\n\n首先，请告诉我：**这份合同是给什么岗位的员工？**（例如：前端工程师、销售经理、行政助理等）"
            : "Hello! I'm the AI Contract Assistant ✨\n\nI'll help you quickly generate a professional employment contract through a few simple questions.\n\nFirst, please tell me: **What position is this contract for?** (e.g., Frontend Engineer, Sales Manager, Administrative Assistant, etc.)",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [user, messages.length, language]);

  // 处理发送消息
  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsGenerating(true);

    try {
      // 调用 AI API 生成回复
      const { tokenManager } =
        await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        throw new Error("无法获取认证信息");
      }

      const response = await fetch("/api/contracts/ai-chat", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("AI 服务调用失败");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 检查是否生成了合同
      if (data.contractGenerated && data.contractContent) {
        setContractGenerated(true);
        setContractContent(data.contractContent);
      }
    } catch (error) {
      console.error("发送消息失败:", error);
      const errorMessage: Message = {
        role: "assistant",
        content:
          language === "zh"
            ? "抱歉，出现了一些问题。请重试。"
            : "Sorry, something went wrong. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  // 处理回车键发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 下载合同
  const handleDownload = () => {
    const blob = new Blob([contractContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contract-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {language === "zh" ? "加载中..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 页面标题 */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">
            {language === "zh" ? "AI 智能生成合同" : "AI Contract Generator"}
          </h1>
          <p className="text-gray-600">
            {language === "zh"
              ? "通过对话生成专业劳动合同，30秒完成"
              : "Generate professional employment contracts through conversation, completed in 30 seconds"}
          </p>
        </div>

        {/* 聊天界面 */}
        <Card className="mb-6">
          <CardContent className="p-0">
            {/* 消息列表 */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* 头像 */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === "user"
                        ? "bg-primary text-white"
                        : "bg-gradient-to-br from-purple-500 to-pink-500 text-white"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </div>

                  {/* 消息内容 */}
                  <div
                    className={`flex-1 max-w-[80%] ${
                      message.role === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    <div
                      className={`inline-block p-4 rounded-2xl ${
                        message.role === "user"
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {message.timestamp.toLocaleTimeString(
                        language === "zh" ? "zh-CN" : "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                </div>
              ))}

              {/* 加载中提示 */}
              {isGenerating && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="bg-gray-100 p-4 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-gray-600">
                        {language === "zh"
                          ? "AI 正在思考..."
                          : "AI is thinking..."}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 输入框 */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    language === "zh"
                      ? "输入你的回答..."
                      : "Type your answer..."
                  }
                  disabled={isGenerating || contractGenerated}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isGenerating || contractGenerated}
                  size="icon"
                >
                  {isGenerating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 合同生成成功 */}
        {contractGenerated && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-900">
                      {language === "zh"
                        ? "合同生成成功！"
                        : "Contract Generated Successfully!"}
                    </h3>
                    <p className="text-sm text-green-700">
                      {language === "zh"
                        ? "您的合同已经准备好了"
                        : "Your contract is ready"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDownload}
                    className="border-green-600 text-green-600 hover:bg-green-100"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {language === "zh" ? "下载合同" : "Download"}
                  </Button>
                  <Button
                    onClick={() => router.push("/contracts")}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {language === "zh" ? "查看详情" : "View Details"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
