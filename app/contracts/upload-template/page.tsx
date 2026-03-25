"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Download,
  Sparkles,
  Loader2,
  CheckCircle2,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/header";
import { useUser } from "@/components/user-context";
import { useLanguage } from "@/components/language-provider";

export default function UploadTemplatePage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { language } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({
    employeeName: "",
    employeeId: "",
    position: "",
    startDate: "",
    salary: "",
  });

  // 重定向未登录用户
  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth?redirect=/contracts/upload-template");
    }
  }, [user, userLoading, router]);

  // 处理文件上传
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setAnalyzed(false);
    } else {
      alert(language === "zh" ? "请选择 PDF 文件" : "Please select a PDF file");
    }
  };

  // 分析 PDF
  const handleAnalyze = async () => {
    if (!file) return;

    setUploading(true);
    setAnalyzing(true);

    try {
      // 模拟上传和分析过程
      // 实际应该调用 API 上传 PDF 并使用 AI 识别字段
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 模拟识别结果
      setAnalyzed(true);
      alert(
        language === "zh"
          ? "PDF 分析完成！请填写识别到的字段"
          : "PDF analysis complete! Please fill in the identified fields",
      );
    } catch (error) {
      console.error("分析失败:", error);
      alert(
        language === "zh"
          ? "分析失败，请重试"
          : "Analysis failed, please try again",
      );
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  // 处理字段变化
  const handleFieldChange = (field: string, value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  // 生成合同
  const handleGenerate = async () => {
    try {
      // 这里应该调用 API 生成合同
      console.log("生成合同:", fields);

      alert(
        language === "zh"
          ? "合同生成成功！"
          : "Contract generated successfully!",
      );

      router.push("/contracts");
    } catch (error) {
      console.error("生成失败:", error);
      alert(
        language === "zh"
          ? "生成失败，请重试"
          : "Generation failed, please try again",
      );
    }
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
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* 页面标题 */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">
            {language === "zh" ? "上传 PDF 模板" : "Upload PDF Template"}
          </h1>
          <p className="text-gray-600 text-lg">
            {language === "zh"
              ? "上传现有合同模板，AI 自动识别可编辑字段，10秒完成"
              : "Upload existing contract template, AI automatically identifies editable fields, completed in 10 seconds"}
          </p>
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                file ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              {file ? <CheckCircle2 className="h-5 w-5" /> : "1"}
            </div>
            <span className="text-sm font-medium">
              {language === "zh" ? "上传文件" : "Upload File"}
            </span>
          </div>

          <div className="w-12 h-0.5 bg-gray-300" />

          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                analyzed
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {analyzed ? <CheckCircle2 className="h-5 w-5" /> : "2"}
            </div>
            <span className="text-sm font-medium">
              {language === "zh" ? "编辑字段" : "Edit Fields"}
            </span>
          </div>

          <div className="w-12 h-0.5 bg-gray-300" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
              3
            </div>
            <span className="text-sm font-medium">
              {language === "zh" ? "生成合同" : "Generate"}
            </span>
          </div>
        </div>

        {/* 上传区域 */}
        {!analyzed && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {language === "zh" ? "上传 PDF 模板" : "Upload PDF Template"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                {file ? (
                  <div className="space-y-4">
                    <FileText className="h-16 w-16 mx-auto text-green-600" />
                    <div>
                      <p className="font-semibold text-lg">{file.name}</p>
                      <p className="text-sm text-gray-600">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <Button variant="outline" onClick={() => setFile(null)}>
                        {language === "zh" ? "重新选择" : "Re-select"}
                      </Button>
                      <Button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {analyzing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {language === "zh" ? "分析中..." : "Analyzing..."}
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {language === "zh" ? "AI 分析" : "AI Analyze"}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <label
                      htmlFor="pdf-upload"
                      className="cursor-pointer text-primary font-medium hover:underline text-lg"
                    >
                      {language === "zh"
                        ? "点击上传 PDF 文件"
                        : "Click to upload PDF file"}
                    </label>
                    <p className="text-sm text-gray-600 mt-2">
                      {language === "zh"
                        ? "支持 PDF 格式，文件大小不超过 10MB"
                        : "Supports PDF format, file size up to 10MB"}
                    </p>
                    <input
                      id="pdf-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 编辑字段 */}
        {analyzed && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                {language === "zh"
                  ? "编辑合同信息"
                  : "Edit Contract Information"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>
                    {language === "zh" ? "员工姓名" : "Employee Name"}
                  </Label>
                  <Input
                    value={fields.employeeName}
                    onChange={(e) =>
                      handleFieldChange("employeeName", e.target.value)
                    }
                    placeholder={
                      language === "zh"
                        ? "请输入员工姓名"
                        : "Enter employee name"
                    }
                  />
                </div>

                <div>
                  <Label>{language === "zh" ? "身份证号" : "ID Number"}</Label>
                  <Input
                    value={fields.employeeId}
                    onChange={(e) =>
                      handleFieldChange("employeeId", e.target.value)
                    }
                    placeholder={
                      language === "zh" ? "请输入身份证号" : "Enter ID number"
                    }
                  />
                </div>

                <div>
                  <Label>{language === "zh" ? "岗位" : "Position"}</Label>
                  <Input
                    value={fields.position}
                    onChange={(e) =>
                      handleFieldChange("position", e.target.value)
                    }
                    placeholder={
                      language === "zh" ? "请输入岗位名称" : "Enter position"
                    }
                  />
                </div>

                <div>
                  <Label>{language === "zh" ? "入职日期" : "Start Date"}</Label>
                  <Input
                    type="date"
                    value={fields.startDate}
                    onChange={(e) =>
                      handleFieldChange("startDate", e.target.value)
                    }
                  />
                </div>

                <div>
                  <Label>
                    {language === "zh" ? "月薪（元）" : "Monthly Salary"}
                  </Label>
                  <Input
                    type="number"
                    value={fields.salary}
                    onChange={(e) =>
                      handleFieldChange("salary", e.target.value)
                    }
                    placeholder={
                      language === "zh" ? "请输入月薪" : "Enter monthly salary"
                    }
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setAnalyzed(false);
                    }}
                  >
                    {language === "zh" ? "返回" : "Back"}
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {language === "zh" ? "生成合同" : "Generate Contract"}
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
