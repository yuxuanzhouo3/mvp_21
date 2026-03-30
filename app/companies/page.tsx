"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ImagePlus,
  Loader2,
  RefreshCcw,
  Save,
  ScanSearch,
  Trash2,
} from "lucide-react";

import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CompanyProfile {
  id: string;
  companyName: string;
  creditCode: string;
  legalPerson: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  updatedAt?: string;
}

const emptyCompany = (): CompanyProfile => ({
  id: "",
  companyName: "",
  creditCode: "",
  legalPerson: "",
  address: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
});

const sourceOptions = [
  { value: "license", zh: "营业执照", en: "Business License" },
  { value: "wechat", zh: "微信截图", en: "WeChat Screenshot" },
  { value: "feishu", zh: "飞书截图", en: "Feishu Screenshot" },
] as const;

async function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File) {
  const dataUrl = await readAsDataUrl(file);

  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const maxWidth = 1600;
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("canvas_unavailable"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    image.onerror = () => reject(new Error("decode_failed"));
    image.src = dataUrl;
  });
}

export default function CompaniesPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user, loading: userLoading } = useUser();
  const isEn = language === "en";

  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [draft, setDraft] = useState<CompanyProfile>(emptyCompany());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrImage, setOcrImage] = useState("");
  const [ocrSource, setOcrSource] = useState<(typeof sourceOptions)[number]["value"]>("license");
  const [ocrAttempt, setOcrAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace("/auth?redirect=/companies");
    }
  }, [router, user, userLoading]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!user) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError("");
        const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
        const headers = await tokenManager.getAuthHeaderAsync();

        if (!headers) {
          router.replace("/auth");
          return;
        }

        const [companyResponse, profileResponse] = await Promise.all([
          fetch("/api/company-info", { headers, cache: "no-store" }),
          fetch("/api/profile", { headers, cache: "no-store" }),
        ]);

        const companyPayload = await companyResponse.json();
        const profilePayload = await profileResponse.json();

        if (!companyResponse.ok || !profileResponse.ok) {
          throw new Error("load_failed");
        }

        const nextProfiles = Array.isArray(companyPayload.profiles)
          ? companyPayload.profiles
          : [];
        const nextActiveId =
          typeof profilePayload.activeCompanyProfileId === "string"
            ? profilePayload.activeCompanyProfileId
            : nextProfiles[0]?.id || "";
        const selected =
          nextProfiles.find((profile: CompanyProfile) => profile.id === nextActiveId) ||
          nextProfiles[0] ||
          emptyCompany();

        if (!cancelled) {
          setProfiles(nextProfiles);
          setActiveCompanyId(nextActiveId);
          setDraft(selected);
        }
      } catch (loadError) {
        console.error("[CompaniesPage] Failed to load data:", loadError);
        if (!cancelled) {
          setError(isEn ? "Failed to load company profiles." : "加载企业资料失败。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [isEn, router, user]);

  const selectedSourceLabel = useMemo(() => {
    const source = sourceOptions.find((item) => item.value === ocrSource);
    return isEn ? source?.en : source?.zh;
  }, [isEn, ocrSource]);

  const updateDraft = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSelectCompany = async (profile: CompanyProfile) => {
    setActiveCompanyId(profile.id);
    setDraft(profile);
    setMessage("");
    setError("");

    try {
      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();
      if (!headers) {
        return;
      }

      await fetch("/api/profile", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activeCompanyProfileId: profile.id }),
      });
    } catch (persistError) {
      console.error("[CompaniesPage] Failed to persist active company:", persistError);
    }
  };

  const handleCreateNew = () => {
    setDraft(emptyCompany());
    setActiveCompanyId("");
    setMessage("");
    setError("");
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setError("");
      setOcrImage(await compressImage(file));
    } catch (uploadError) {
      console.error("[CompaniesPage] Failed to process OCR image:", uploadError);
      setError(isEn ? "Failed to process the uploaded image." : "处理上传图片失败。");
    } finally {
      event.target.value = "";
    }
  };

  const handleOCR = async () => {
    if (!ocrImage) {
      return;
    }

    try {
      setOcrLoading(true);
      setError("");
      setMessage("");

      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        throw new Error("auth_required");
      }

      const response = await fetch("/api/ocr/business-license", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: ocrImage,
          source: ocrSource,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "ocr_failed");
      }

      setDraft((current) => ({
        ...current,
        companyName: payload.data?.companyName || current.companyName,
        creditCode: payload.data?.creditCode || current.creditCode,
        legalPerson: payload.data?.legalPerson || current.legalPerson,
        address: payload.data?.address || current.address,
      }));
      setMessage(
        isEn
          ? `${selectedSourceLabel} OCR parsed successfully.`
          : `${selectedSourceLabel} 识别成功，可继续校对后保存。`,
      );
    } catch (ocrError) {
      console.error("[CompaniesPage] OCR failed:", ocrError);
      setOcrAttempt((count) => count + 1);
      setError(
        isEn
          ? "OCR failed. You can retry or complete the form manually."
          : "OCR 识别失败，你可以重试或手动补全表单。",
      );
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    if (!draft.companyName || !draft.creditCode || !draft.legalPerson || !draft.address) {
      setError(isEn ? "Please complete the required fields." : "请补全必填字段。");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        throw new Error("auth_required");
      }

      const response = await fetch("/api/company-info", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "save_failed");
      }

      const nextProfiles = Array.isArray(payload.profiles) ? payload.profiles : [];
      const nextSelected =
        nextProfiles.find((profile: CompanyProfile) => profile.id === payload.data?.id) ||
        payload.data;

      setProfiles(nextProfiles);
      setDraft(nextSelected);
      setActiveCompanyId(nextSelected.id);
      setMessage(isEn ? "Company profile saved." : "企业资料已保存。");

      await fetch("/api/profile", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activeCompanyProfileId: nextSelected.id }),
      });
    } catch (saveError) {
      console.error("[CompaniesPage] Save failed:", saveError);
      setError(isEn ? "Failed to save company profile." : "保存企业资料失败。");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft.id) {
      handleCreateNew();
      return;
    }

    try {
      setDeleting(true);
      setError("");
      setMessage("");

      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        throw new Error("auth_required");
      }

      const response = await fetch(`/api/company-info?id=${draft.id}`, {
        method: "DELETE",
        headers,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "delete_failed");
      }

      const nextProfiles = Array.isArray(payload.profiles) ? payload.profiles : [];
      setProfiles(nextProfiles);
      setDraft(nextProfiles[0] || emptyCompany());
      setActiveCompanyId(nextProfiles[0]?.id || "");
      setMessage(isEn ? "Company profile deleted." : "企业资料已删除。");
    } catch (deleteError) {
      console.error("[CompaniesPage] Delete failed:", deleteError);
      setError(isEn ? "Failed to delete company profile." : "删除企业资料失败。");
    } finally {
      setDeleting(false);
    }
  };

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {isEn ? "Company Profiles" : "企业资料管理"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isEn
                ? "Switch between multiple entities, retry OCR, and keep business credentials ready for contract creation."
                : "支持多主体公司切换、OCR 失败重试、上传压缩与截图识别，方便快速进入合同流程。"}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/contracts/company-setup")}>
            <Building2 className="mr-2 h-4 w-4" />
            {isEn ? "Open Guided Setup" : "打开向导建档"}
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert className="mb-6">
            <AlertDescription className="text-green-600">{message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>{isEn ? "Entity Switcher" : "主体切换"}</CardTitle>
              <CardDescription>
                {isEn ? "Manage multiple companies under one account." : "同一账户下维护多个公司主体。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline" onClick={handleCreateNew}>
                {isEn ? "Create New Company" : "新增公司主体"}
              </Button>

              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => void handleSelectCompany(profile)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    activeCompanyId === profile.id
                      ? "border-primary bg-primary/5"
                      : "border-border/70 bg-background hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{profile.companyName || (isEn ? "Untitled Company" : "未命名公司")}</div>
                    {activeCompanyId === profile.id ? (
                      <Badge>{isEn ? "Active" : "当前"}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {profile.creditCode || (isEn ? "No credit code" : "暂无统一社会信用代码")}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "OCR Intake" : "OCR 识别入口"}</CardTitle>
                <CardDescription>
                  {isEn
                    ? "Supports business licenses plus text-rich WeChat / Feishu screenshots. Images are compressed before upload."
                    : "支持营业执照、微信截图、飞书截图文字提取，上传前会自动压缩图片。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <div className="space-y-2">
                    <Label>{isEn ? "Source Type" : "识别来源"}</Label>
                    <Select value={ocrSource} onValueChange={(value) => setOcrSource(value as typeof ocrSource)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {isEn ? option.en : option.zh}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm text-muted-foreground">
                        {isEn
                          ? "Compression strategy: long edge <= 1600px, JPEG quality 0.88 for faster OCR retries."
                          : "压缩策略：长边不超过 1600px，JPEG 质量 0.88，便于 OCR 重试更快返回。"}
                      </div>
                      <Label
                        htmlFor="company-ocr-upload"
                        className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm"
                      >
                        <ImagePlus className="mr-2 h-4 w-4" />
                        {isEn ? "Upload Image" : "上传图片"}
                      </Label>
                    </div>
                    <input
                      id="company-ocr-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void handleOCR()} disabled={!ocrImage || ocrLoading}>
                    {ocrLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ScanSearch className="mr-2 h-4 w-4" />
                    )}
                    {isEn ? "Run OCR" : "开始识别"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleOCR()}
                    disabled={!ocrImage || ocrLoading}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {isEn ? `Retry${ocrAttempt ? ` (${ocrAttempt})` : ""}` : `失败重试${ocrAttempt ? ` (${ocrAttempt})` : ""}`}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "Company Profile" : "企业资料"}</CardTitle>
                <CardDescription>
                  {isEn ? "Edit the selected entity and save it as your active contract主体." : "编辑当前主体资料，并将其作为默认合同主体使用。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{isEn ? "Company Name" : "公司名称"}</Label>
                    <Input value={draft.companyName} onChange={(event) => updateDraft("companyName", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isEn ? "Credit Code" : "统一社会信用代码"}</Label>
                    <Input value={draft.creditCode} onChange={(event) => updateDraft("creditCode", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isEn ? "Legal Representative" : "法定代表人"}</Label>
                    <Input value={draft.legalPerson} onChange={(event) => updateDraft("legalPerson", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isEn ? "Contact Person" : "联系人"}</Label>
                    <Input value={draft.contactPerson} onChange={(event) => updateDraft("contactPerson", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isEn ? "Contact Phone" : "联系电话"}</Label>
                    <Input value={draft.contactPhone} onChange={(event) => updateDraft("contactPhone", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isEn ? "Contact Email" : "联系邮箱"}</Label>
                    <Input value={draft.contactEmail} onChange={(event) => updateDraft("contactEmail", event.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{isEn ? "Address" : "注册地址"}</Label>
                  <Input value={draft.address} onChange={(event) => updateDraft("address", event.target.value)} />
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button variant="outline" onClick={handleDelete} disabled={deleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deleting ? (isEn ? "Deleting..." : "删除中...") : isEn ? "Delete" : "删除"}
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? (isEn ? "Saving..." : "保存中...") : isEn ? "Save Company" : "保存企业资料"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
