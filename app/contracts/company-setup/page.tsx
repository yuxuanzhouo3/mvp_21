"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Upload,
  Sparkles,
  Building2,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import Image from "next/image";

interface CompanyInfo {
  companyName: string;
  creditCode: string;
  legalPerson: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
}

export default function CompanySetupPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user } = useUser();
  const [step, setStep] = useState<"upload" | "edit">("upload");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    companyName: "",
    creditCode: "",
    legalPerson: "",
    address: "",
    contactPerson: user?.name || "",
    contactPhone: "",
    contactEmail: user?.email || "",
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    // 预览图片
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleStartOCR = async () => {
    if (!previewImage) return;

    setAnalyzing(true);

    try {
      // 调用 OCR API 识别营业执照
      const { tokenManager } =
        await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        throw new Error("无法获取认证信息");
      }

      const response = await fetch("/api/ocr/business-license", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: previewImage }),
      });

      if (!response.ok) {
        throw new Error("OCR 识别失败");
      }

      const result = await response.json();

      if (result.success && result.data) {
        // 使用识别结果填充表单
        setCompanyInfo({
          ...companyInfo,
          companyName: result.data.companyName || "",
          creditCode: result.data.creditCode || "",
          legalPerson: result.data.legalPerson || "",
          address: result.data.address || "",
        });
        setStep("edit");
      } else {
        throw new Error("OCR 识别失败");
      }
    } catch (error) {
      console.error("OCR 识别失败:", error);
      alert("识别失败，请手动填写或重新上传清晰的营业执照照片");
      // 识别失败，仍然进入编辑步骤，但不填充数据
      setStep("edit");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // 获取认证 token
      const { tokenManager } =
        await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        alert(language === "zh" ? "无法获取认证信息" : "Cannot get auth info");
        return;
      }

      // 保存企业信息到数据库
      const response = await fetch("/api/company-info", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyInfo),
      });

      if (response.ok) {
        // 保存成功，跳转到合同创建页面
        router.push("/contracts/new");
      } else {
        const errorData = await response.json();
        console.error("保存失败:", errorData);
        alert(
          language === "zh"
            ? "保存失败，请重试"
            : "Save failed, please try again",
        );
      }
    } catch (error) {
      console.error("保存失败:", error);
      alert(
        language === "zh"
          ? "保存失败，请重试"
          : "Save failed, please try again",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setStep("edit");
    setCompanyInfo({
      ...companyInfo,
      companyName: "",
      creditCode: "",
      legalPerson: "",
      address: "",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === "upload"
                  ? "bg-primary text-white"
                  : "bg-green-500 text-white"
              }`}
            >
              {step === "edit" ? <Check className="h-5 w-5" /> : "1"}
            </div>
            <span
              className={step === "upload" ? "font-medium" : "text-gray-500"}
            >
              {language === "zh" ? "上传营业执照" : "Upload License"}
            </span>
          </div>
          <div className="w-16 h-0.5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === "edit"
                  ? "bg-primary text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              2
            </div>
            <span className={step === "edit" ? "font-medium" : "text-gray-500"}>
              {language === "zh" ? "确认信息" : "Confirm Info"}
            </span>
          </div>
        </div>

        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-3">
            {language === "zh" ? "📸 企业信息建档" : "📸 Company Profile Setup"}
          </h1>
          <p className="text-gray-600">
            {language === "zh"
              ? "拍摄或上传营业执照，AI 自动识别，仅需 5 秒！"
              : "Take a photo or upload business license, AI auto-recognizes in 5 seconds!"}
          </p>
        </div>

        {step === "upload" ? (
          /* 上传步骤 */
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center">
                <CardTitle>
                  {language === "zh"
                    ? "上传营业执照"
                    : "Upload Business License"}
                </CardTitle>
                <CardDescription>
                  {language === "zh"
                    ? "AI 将自动识别公司名称、统一社会信用代码、法定代表人等信息"
                    : "AI will auto-recognize company name, credit code, legal person, etc."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 上传区域 */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="license-upload"
                  />

                  {uploading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                      <span className="text-sm text-gray-600">
                        {language === "zh" ? "上传中..." : "Uploading..."}
                      </span>
                    </div>
                  ) : previewImage ? (
                    <div className="space-y-4">
                      <div className="relative w-full max-w-md mx-auto">
                        <Image
                          src={previewImage}
                          alt="营业执照预览"
                          width={400}
                          height={300}
                          className="rounded-lg border"
                        />
                      </div>
                      {analyzing ? (
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <Sparkles className="h-5 w-5 animate-pulse" />
                          <span className="font-medium">
                            {language === "zh"
                              ? "AI 识别中..."
                              : "AI Analyzing..."}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <Button
                            onClick={handleStartOCR}
                            size="lg"
                            className="bg-primary hover:bg-primary/90"
                          >
                            <Sparkles className="h-5 w-5 mr-2" />
                            {language === "zh"
                              ? "开始识别"
                              : "Start Recognition"}
                          </Button>
                          <label
                            htmlFor="license-upload"
                            className="text-sm text-gray-500 cursor-pointer hover:text-primary"
                          >
                            {language === "zh" ? "重新上传" : "Re-upload"}
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                        <Upload className="h-8 w-8 text-blue-600" />
                      </div>
                      <label
                        htmlFor="license-upload"
                        className="cursor-pointer text-primary font-medium hover:underline"
                      >
                        {language === "zh" ? "点击上传" : "Click to Upload"}
                      </label>
                      <p className="text-sm text-gray-500 mt-2">
                        {language === "zh"
                          ? "或拖拽文件到此处（支持 JPG、PNG）"
                          : "or drag and drop (JPG, PNG supported)"}
                      </p>
                    </>
                  )}
                </div>

                {/* 示例图片 */}
                <Alert>
                  <Building2 className="h-4 w-4" />
                  <AlertDescription>
                    {language === "zh"
                      ? "💡 提示：请确保营业执照文字清晰可见，光线充足，避免反光"
                      : "💡 Tip: Ensure the license text is clear, well-lit, and avoid glare"}
                  </AlertDescription>
                </Alert>

                {/* 跳过按钮 */}
                <div className="text-center pt-4">
                  <Button variant="ghost" onClick={handleSkip}>
                    {language === "zh"
                      ? "跳过，手动填写"
                      : "Skip, Manual Input"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* 编辑步骤 */
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {language === "zh"
                    ? "✅ AI 识别完成，请确认信息"
                    : "✅ AI Recognition Complete, Please Confirm"}
                </CardTitle>
                <CardDescription>
                  {language === "zh"
                    ? "已自动填充识别结果，您可以手动修改"
                    : "Auto-filled with recognition results, you can edit manually"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">
                      {language === "zh" ? "公司名称 *" : "Company Name *"}
                    </Label>
                    <Input
                      id="companyName"
                      value={companyInfo.companyName}
                      onChange={(e) =>
                        setCompanyInfo({
                          ...companyInfo,
                          companyName: e.target.value,
                        })
                      }
                      placeholder={
                        language === "zh"
                          ? "请输入公司名称"
                          : "Enter company name"
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="creditCode">
                      {language === "zh"
                        ? "统一社会信用代码 *"
                        : "Credit Code *"}
                    </Label>
                    <Input
                      id="creditCode"
                      value={companyInfo.creditCode}
                      onChange={(e) =>
                        setCompanyInfo({
                          ...companyInfo,
                          creditCode: e.target.value,
                        })
                      }
                      placeholder={
                        language === "zh"
                          ? "18位统一社会信用代码"
                          : "18-digit credit code"
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legalPerson">
                      {language === "zh" ? "法定代表人 *" : "Legal Person *"}
                    </Label>
                    <Input
                      id="legalPerson"
                      value={companyInfo.legalPerson}
                      onChange={(e) =>
                        setCompanyInfo({
                          ...companyInfo,
                          legalPerson: e.target.value,
                        })
                      }
                      placeholder={
                        language === "zh"
                          ? "请输入法定代表人姓名"
                          : "Enter legal person name"
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">
                      {language === "zh" ? "联系人" : "Contact Person"}
                    </Label>
                    <Input
                      id="contactPerson"
                      value={companyInfo.contactPerson}
                      onChange={(e) =>
                        setCompanyInfo({
                          ...companyInfo,
                          contactPerson: e.target.value,
                        })
                      }
                      placeholder={
                        language === "zh"
                          ? "请输入联系人姓名"
                          : "Enter contact person"
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">
                      {language === "zh" ? "联系电话" : "Contact Phone"}
                    </Label>
                    <Input
                      id="contactPhone"
                      value={companyInfo.contactPhone}
                      onChange={(e) =>
                        setCompanyInfo({
                          ...companyInfo,
                          contactPhone: e.target.value,
                        })
                      }
                      placeholder={
                        language === "zh"
                          ? "请输入联系电话"
                          : "Enter contact phone"
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">
                      {language === "zh" ? "联系邮箱" : "Contact Email"}
                    </Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={companyInfo.contactEmail}
                      onChange={(e) =>
                        setCompanyInfo({
                          ...companyInfo,
                          contactEmail: e.target.value,
                        })
                      }
                      placeholder={
                        language === "zh"
                          ? "请输入联系邮箱"
                          : "Enter contact email"
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">
                    {language === "zh" ? "注册地址 *" : "Registered Address *"}
                  </Label>
                  <Input
                    id="address"
                    value={companyInfo.address}
                    onChange={(e) =>
                      setCompanyInfo({
                        ...companyInfo,
                        address: e.target.value,
                      })
                    }
                    placeholder={
                      language === "zh"
                        ? "请输入公司注册地址"
                        : "Enter registered address"
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* 操作按钮 */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                {language === "zh" ? "返回" : "Back"}
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !companyInfo.companyName || !companyInfo.creditCode || saving
                }
                size="lg"
              >
                {saving ? (
                  language === "zh" ? (
                    "保存中..."
                  ) : (
                    "Saving..."
                  )
                ) : (
                  <>
                    {language === "zh" ? "保存并继续" : "Save & Continue"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
