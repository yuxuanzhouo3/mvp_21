"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
  MessageSquare,
  ArrowRight,
  Building2,
  Clock,
  Sparkles,
  History,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/header";
import { useUser } from "@/components/user-context";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "@/lib/i18n";

export default function NewContractPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const { language } = useLanguage();
  const t = useTranslations(language);
  const [hasCompanyInfo, setHasCompanyInfo] = useState(false);
  const [companyName, setCompanyName] = useState("");

  // 检查是否已配置企业信息
  useEffect(() => {
    async function checkCompanyInfo() {
      if (!user) return;

      try {
        const { tokenManager } =
          await import("@/lib/auth/frontend-token-manager");
        const headers = await tokenManager.getAuthHeaderAsync();
        if (!headers) {
          console.warn("⚠️ 无法获取认证信息");
          return;
        }

        const response = await fetch("/api/company-info", { headers });
        if (response.ok) {
          const data = await response.json();
          setHasCompanyInfo(data.hasCompanyInfo || false);
          if (data.hasCompanyInfo && data.company_name) {
            setCompanyName(data.company_name);
          }
        }
      } catch (error) {
        console.error("检查企业信息失败:", error);
      }
    }

    checkCompanyInfo();
  }, [user]);

  // 如果未登录，重定向到登录页
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth?redirect=/contracts/new");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {/* 首次使用 - 引导配置企业信息 */}
        {!hasCompanyInfo && (
          <div className="mb-8">
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">
                      {language === "zh"
                        ? "🎉 欢迎使用智能合同生成"
                        : "🎉 Welcome to Smart Contract Generator"}
                    </h3>
                    <p className="text-blue-700 mb-4">
                      {language === "zh"
                        ? "让我们先快速建立您的企业档案，仅需5秒！之后创建合同只要改改名字就行。"
                        : "Let's quickly set up your company profile in just 5 seconds! After that, creating contracts is as easy as changing a name."}
                    </p>
                    <Button
                      onClick={() => router.push("/contracts/company-setup")}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Building2 className="h-4 w-4 mr-2" />
                      {language === "zh"
                        ? "5秒建档（首次必填）"
                        : "Quick Setup (First Time)"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 当前企业信息 */}
        {hasCompanyInfo && companyName && (
          <div className="mb-8">
            <Card className="border-gray-200 bg-white/80 backdrop-blur">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        {language === "zh" ? "当前企业" : "Current Company"}
                      </p>
                      <p className="font-semibold text-gray-900">
                        {companyName}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/settings")}
                    className="text-gray-600 hover:text-primary"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    {language === "zh" ? "管理" : "Manage"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 页面标题 */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">
            {language === "zh" ? "创建新合同" : "Create New Contract"}
          </h1>
          <p className="text-gray-600 text-lg">
            {language === "zh"
              ? "选择您的创建方式，AI 会帮您快速完成"
              : "Choose your creation method, AI will help you complete it quickly"}
          </p>
        </div>

        {/* 创建方式选择 */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">
          {/* 方式1: 我有模板 */}
          <Card
            className="cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg group"
            onClick={() => router.push("/contracts/upload-template")}
          >
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl mb-2">
                📄 {language === "zh" ? "我有模板" : "I Have a Template"}
              </CardTitle>
              <Badge className="mx-auto bg-green-100 text-green-700 hover:bg-green-100">
                <Clock className="h-3 w-3 mr-1" />
                {language === "zh" ? "10秒完成" : "10 Seconds"}
              </Badge>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-base mb-4">
                {language === "zh"
                  ? "上传 PDF 模板，AI 自动识别，您只需修改关键信息"
                  : "Upload PDF template, AI auto-recognizes, you only need to modify key information"}
              </CardDescription>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  {language === "zh"
                    ? "上传您的合同模板 PDF"
                    : "Upload your contract template PDF"}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  {language === "zh"
                    ? "AI 自动识别可编辑字段"
                    : "AI auto-identifies editable fields"}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  {language === "zh"
                    ? "只改姓名、身份证等关键信息"
                    : "Only change name, ID, and key info"}
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* 方式2: AI生成 */}
          <Card
            className="cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg group border-2 border-primary/50"
            onClick={() => router.push("/contracts/ai-generate")}
          >
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="h-10 w-10 text-blue-600" />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <CardTitle className="text-2xl">
                  🤖 {language === "zh" ? "AI 智能生成" : "AI Smart Generation"}
                </CardTitle>
                <Badge className="bg-orange-500 text-white">
                  {language === "zh" ? "推荐" : "Recommended"}
                </Badge>
              </div>
              <Badge className="mx-auto bg-blue-100 text-blue-700 hover:bg-blue-100">
                <Clock className="h-3 w-3 mr-1" />
                {language === "zh" ? "30秒完成" : "30 Seconds"}
              </Badge>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-base mb-4">
                {language === "zh"
                  ? "像聊天一样回答几个问题，AI 为您生成专业合同"
                  : "Answer a few questions like chatting, AI generates professional contract for you"}
              </CardDescription>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  {language === "zh"
                    ? "对话式交互，像和朋友聊天"
                    : "Conversational interaction, like chatting with friends"}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  {language === "zh"
                    ? "AI 主动建议条款和注意事项"
                    : "AI proactively suggests terms and precautions"}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  {language === "zh"
                    ? "自动生成专业法律文本"
                    : "Auto-generates professional legal text"}
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* 最近使用的模板 */}
        {hasCompanyInfo && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-gray-500" />
              <h2 className="text-xl font-semibold">
                {language === "zh"
                  ? "⏱️ 最近使用（智能复用）"
                  : "⏱️ Recently Used (Smart Reuse)"}
              </h2>
            </div>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-amber-200 bg-amber-50/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">
                      {language === "zh"
                        ? "👤 前端工程师入职合同"
                        : "👤 Frontend Engineer Employment Contract"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {language === "zh"
                        ? "上次使用：3天前 · 上次填写：张三"
                        : "Last used: 3 days ago · Last filled: Zhang San"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-amber-300 hover:bg-amber-50"
                  >
                    {language === "zh" ? "复用此模板" : "Reuse This Template"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 温馨提示 */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">
              {language === "zh" ? "💡 温馨提示" : "💡 Tips"}
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                •{" "}
                {language === "zh"
                  ? "首次使用需配置企业信息，仅需一次，永久使用"
                  : "First-time setup requires company info, only once, permanent use"}
              </li>
              <li>
                •{" "}
                {language === "zh"
                  ? "AI 会根据岗位自动建议条款（如竞业限制、保密协议）"
                  : "AI auto-suggests clauses based on position (e.g., non-compete, NDA)"}
              </li>
              <li>
                •{" "}
                {language === "zh"
                  ? "生成的合同符合中国劳动法，请签署前仔细审核"
                  : "Generated contracts comply with Chinese labor law, please review carefully before signing"}
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
