"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Settings,
  Moon,
  Sun,
  Globe,
  Bell,
  Shield,
  Building2,
  Edit,
} from "lucide-react";
import { Header } from "@/components/header";
import { useApp } from "@/components/app-context";
import { useUser } from "@/components/user-context";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "@/lib/i18n";

interface CompanyInfo {
  company_name: string;
  credit_code: string;
  legal_person: string;
  address: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
}

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const { activeView, setActiveView } = useApp();
  const { user } = useUser(); // 移除 refreshUser，因为不再需要
  const { language, setLanguage } = useLanguage();
  const t = useTranslations(language);

  const router = useRouter();

  // 加载企业信息
  useEffect(() => {
    async function loadCompanyInfo() {
      if (!user) return;

      try {
        const { tokenManager } =
          await import("@/lib/auth/frontend-token-manager");
        const headers = await tokenManager.getAuthHeaderAsync();
        if (!headers) return;

        const response = await fetch("/api/company-info", { headers });
        if (response.ok) {
          const data = await response.json();
          if (data.hasCompanyInfo) {
            setCompanyInfo(data);
          }
        }
      } catch (error) {
        console.error("加载企业信息失败:", error);
      } finally {
        setLoadingCompany(false);
      }
    }

    loadCompanyInfo();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setSuccess("");

    // 这里可以保存设置到后端
    // 暂时只是模拟保存过程
    setTimeout(() => {
      setSuccess(t.settings.saved);
      setSaving(false);
    }, 1000);
  };

  const handleViewChange = (view: string) => {
    setActiveView(view);
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activeView={activeView} setActiveView={handleViewChange} />

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.common.back}</span>
          </Button>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>{t.settings.general}</span>
              </CardTitle>
              <CardDescription>
                {t.settings.customizeExperience}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 语言设置 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center space-x-2">
                    <Globe className="w-4 h-4" />
                    <span>{t.settings.interfaceLanguage}</span>
                  </Label>
                  <p className="text-sm text-gray-600">
                    {t.settings.selectPreferredLanguage}
                  </p>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 深色模式 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center space-x-2">
                    {darkMode ? (
                      <Moon className="w-4 h-4" />
                    ) : (
                      <Sun className="w-4 h-4" />
                    )}
                    <span>{t.settings.darkMode}</span>
                  </Label>
                  <p className="text-sm text-gray-600">
                    {t.settings.toggleTheme}
                  </p>
                </div>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>

              {/* 自动保存 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t.settings.autoSave}</Label>
                  <p className="text-sm text-gray-600">
                    {t.settings.autoSaveDesc}
                  </p>
                </div>
                <Switch checked={autoSave} onCheckedChange={setAutoSave} />
              </div>
            </CardContent>
          </Card>

          {/* 企业信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="w-5 h-5" />
                <span>
                  {language === "zh" ? "企业信息" : "Company Information"}
                </span>
              </CardTitle>
              <CardDescription>
                {language === "zh"
                  ? "查看和管理您的企业认证信息"
                  : "View and manage your company certification information"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCompany ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : companyInfo ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">
                        {language === "zh" ? "公司名称" : "Company Name"}
                      </Label>
                      <p className="mt-1 font-medium">
                        {companyInfo.company_name}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">
                        {language === "zh" ? "统一社会信用代码" : "Credit Code"}
                      </Label>
                      <p className="mt-1 font-medium">
                        {companyInfo.credit_code}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">
                        {language === "zh" ? "法定代表人" : "Legal Person"}
                      </Label>
                      <p className="mt-1 font-medium">
                        {companyInfo.legal_person}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">
                        {language === "zh" ? "注册地址" : "Registered Address"}
                      </Label>
                      <p className="mt-1 font-medium">{companyInfo.address}</p>
                    </div>
                    {companyInfo.contact_person && (
                      <div>
                        <Label className="text-sm text-gray-600">
                          {language === "zh" ? "联系人" : "Contact Person"}
                        </Label>
                        <p className="mt-1 font-medium">
                          {companyInfo.contact_person}
                        </p>
                      </div>
                    )}
                    {companyInfo.contact_phone && (
                      <div>
                        <Label className="text-sm text-gray-600">
                          {language === "zh" ? "联系电话" : "Contact Phone"}
                        </Label>
                        <p className="mt-1 font-medium">
                          {companyInfo.contact_phone}
                        </p>
                      </div>
                    )}
                    {companyInfo.contact_email && (
                      <div>
                        <Label className="text-sm text-gray-600">
                          {language === "zh" ? "联系邮箱" : "Contact Email"}
                        </Label>
                        <p className="mt-1 font-medium">
                          {companyInfo.contact_email}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => router.push("/contracts/company-setup")}
                      className="flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      {language === "zh" ? "编辑信息" : "Edit Information"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600 mb-4">
                    {language === "zh"
                      ? "您还没有配置企业信息"
                      : "You haven't set up company information yet"}
                  </p>
                  <Button
                    onClick={() => router.push("/contracts/company-setup")}
                  >
                    {language === "zh" ? "立即配置" : "Set Up Now"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>{t.settings.notifications}</span>
              </CardTitle>
              <CardDescription>
                {t.settings.manageNotificationPreferences}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 推送通知 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t.settings.pushNotifications}</Label>
                  <p className="text-sm text-gray-600">
                    {t.settings.receivePushNotifications}
                  </p>
                </div>
                <Switch
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>

              {/* 邮件更新 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t.settings.emailUpdates}</Label>
                  <p className="text-sm text-gray-600">
                    {t.settings.receiveProductUpdates}
                  </p>
                </div>
                <Switch
                  checked={emailUpdates}
                  onCheckedChange={setEmailUpdates}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>{t.settings.privacySecurity}</span>
              </CardTitle>
              <CardDescription>
                {t.settings.managePrivacySettings}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="justify-start">
                  {t.settings.changePassword}
                </Button>
                <Button variant="outline" className="justify-start">
                  {t.settings.twoFactorAuth}
                </Button>
                <Button variant="outline" className="justify-start">
                  {t.settings.downloadData}
                </Button>
                <Button
                  variant="outline"
                  className="justify-start text-red-600 hover:text-red-700"
                >
                  {t.settings.deleteAccount}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t.settings.saving}
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  {t.settings.save}
                </>
              )}
            </Button>
          </div>

          {/* 成功消息 */}
          {success && (
            <Alert>
              <AlertDescription className="text-green-600">
                {success}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
