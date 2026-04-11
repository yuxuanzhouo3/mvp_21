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
  Search,
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
import { Switch } from "@/components/ui/switch";

type CompanyStatus = "active" | "archived";

interface CompanyProfile {
  id: string;
  profileName: string;
  companyName: string;
  creditCode: string;
  legalPerson: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  status: CompanyStatus;
  isDefault: boolean;
  updatedAt?: string;
}

const copy = {
  zh: {
    title: "企业资料管理",
    subtitle:
      "支持多主体公司切换、OCR 识别重试、默认主体管理和资料校验，确保合同创建使用正确企业信息。",
    setup: "打开向导建档",
    loadFailed: "加载企业资料失败。",
    createNew: "新增公司主体",
    searchPlaceholder: "搜索公司名称 / 信用代码 / 联系人",
    noProfiles: "暂无企业资料，先创建一个主体。",
    noMatched: "没有匹配的主体。",
    active: "当前",
    default: "默认",
    archived: "已归档",
    noCreditCode: "暂无统一社会信用代码",
    sourceType: "识别来源",
    uploadImage: "上传图片",
    ocrRule: "压缩策略：长边不超过 1600px，JPEG 质量 0.88，提升 OCR 成功率与重试速度。",
    runOcr: "开始识别",
    retry: "失败重试",
    ocrFailed: "OCR 识别失败，你可以重试或手动补全。",
    ocrImageFailed: "处理上传图片失败。",
    ocrSuccess: "OCR 识别成功，请核对后保存。",
    profileCardTitle: "企业资料",
    profileCardDesc: "编辑当前主体资料，保存后可在合同流程中作为默认主体使用。",
    profileName: "主体名称",
    profileNamePlaceholder: "例如：总部 / 华东分公司",
    companyName: "公司名称",
    creditCode: "统一社会信用代码",
    legalPerson: "法定代表人",
    contactPerson: "联系人",
    contactPhone: "联系电话",
    contactEmail: "联系邮箱",
    address: "注册地址",
    status: "状态",
    statusActive: "启用中",
    statusArchived: "归档",
    setDefault: "设为默认主体",
    requiredHint: "公司名称、统一社会信用代码、法定代表人、注册地址为必填。",
    updatedAt: "最近更新",
    requiredFields: "请先填写必填字段。",
    invalidEmail: "联系邮箱格式不正确。",
    invalidPhone: "联系电话格式不正确。",
    duplicateCreditCode: "该信用代码已存在于其他主体。",
    profileLimit: "企业主体数量已达上限。",
    saveFailed: "保存企业资料失败。",
    saveSuccess: "企业资料已保存。",
    delete: "删除",
    deleting: "删除中...",
    deleteFailed: "删除企业资料失败。",
    deleteSuccess: "企业资料已删除。",
    save: "保存企业资料",
    saving: "保存中...",
  },
  en: {
    title: "Company Profiles",
    subtitle:
      "Manage multiple entities with OCR retries, default-profile controls, and stronger validation for contract readiness.",
    setup: "Open Guided Setup",
    loadFailed: "Failed to load company profiles.",
    createNew: "Create New Company",
    searchPlaceholder: "Search by company, credit code, or contact",
    noProfiles: "No company profiles yet. Create your first one.",
    noMatched: "No matched profiles.",
    active: "Active",
    default: "Default",
    archived: "Archived",
    noCreditCode: "No credit code",
    sourceType: "Source Type",
    uploadImage: "Upload Image",
    ocrRule:
      "Compression strategy: long edge <= 1600px, JPEG quality 0.88 for better OCR success and faster retries.",
    runOcr: "Run OCR",
    retry: "Retry",
    ocrFailed: "OCR failed. You can retry or complete fields manually.",
    ocrImageFailed: "Failed to process the uploaded image.",
    ocrSuccess: "OCR parsed successfully. Please verify and save.",
    profileCardTitle: "Company Profile",
    profileCardDesc: "Edit the selected entity and keep it ready for contract generation.",
    profileName: "Profile Name",
    profileNamePlaceholder: "e.g. HQ / East Branch",
    companyName: "Company Name",
    creditCode: "Credit Code",
    legalPerson: "Legal Representative",
    contactPerson: "Contact Person",
    contactPhone: "Contact Phone",
    contactEmail: "Contact Email",
    address: "Address",
    status: "Status",
    statusActive: "Active",
    statusArchived: "Archived",
    setDefault: "Set as default profile",
    requiredHint:
      "Company name, credit code, legal representative, and address are required.",
    updatedAt: "Last Updated",
    requiredFields: "Please complete the required fields.",
    invalidEmail: "Invalid contact email format.",
    invalidPhone: "Invalid contact phone format.",
    duplicateCreditCode: "Another profile already uses this credit code.",
    profileLimit: "Profile count reached the limit.",
    saveFailed: "Failed to save company profile.",
    saveSuccess: "Company profile saved.",
    delete: "Delete",
    deleting: "Deleting...",
    deleteFailed: "Failed to delete company profile.",
    deleteSuccess: "Company profile deleted.",
    save: "Save Company",
    saving: "Saving...",
  },
} as const;

const sourceOptions = [
  { value: "license", zh: "营业执照", en: "Business License" },
  { value: "wechat", zh: "微信截图", en: "WeChat Screenshot" },
  { value: "feishu", zh: "飞书截图", en: "Feishu Screenshot" },
] as const;

function emptyCompany(isDefault = false): CompanyProfile {
  return {
    id: "",
    profileName: "",
    companyName: "",
    creditCode: "",
    legalPerson: "",
    address: "",
    contactPerson: "",
    contactPhone: "",
    contactEmail: "",
    status: "active",
    isDefault,
  };
}

function normalizeProfile(raw: Record<string, unknown>): CompanyProfile {
  const status = raw.status === "archived" ? "archived" : "active";
  return {
    id: String(raw.id || raw._id || ""),
    profileName: String(raw.profileName || raw.profile_name || ""),
    companyName: String(raw.companyName || raw.company_name || ""),
    creditCode: String(raw.creditCode || raw.credit_code || "").toUpperCase(),
    legalPerson: String(raw.legalPerson || raw.legal_person || ""),
    address: String(raw.address || ""),
    contactPerson: String(raw.contactPerson || raw.contact_person || ""),
    contactPhone: String(raw.contactPhone || raw.contact_phone || ""),
    contactEmail: String(raw.contactEmail || raw.contact_email || ""),
    status,
    isDefault:
      typeof raw.isDefault === "boolean"
        ? raw.isDefault
        : typeof raw.is_default === "boolean"
          ? raw.is_default
          : false,
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : typeof raw.updated_at === "string"
          ? raw.updated_at
          : undefined,
  };
}

function normalizeProfileList(value: unknown): CompanyProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    )
    .map((item) => normalizeProfile(item));
}

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

function formatDate(value: string | undefined, language: "zh" | "en") {
  if (!value) {
    return language === "en" ? "N/A" : "暂无";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function persistableDraft(draft: CompanyProfile): CompanyProfile {
  return {
    ...draft,
    profileName: draft.profileName.trim(),
    companyName: draft.companyName.trim(),
    creditCode: draft.creditCode.trim().toUpperCase(),
    legalPerson: draft.legalPerson.trim(),
    address: draft.address.trim(),
    contactPerson: draft.contactPerson.trim(),
    contactPhone: draft.contactPhone.trim(),
    contactEmail: draft.contactEmail.trim().toLowerCase(),
  };
}

export default function CompaniesPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user, loading: userLoading } = useUser();
  const isEn = language === "en";
  const text = isEn ? copy.en : copy.zh;

  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [draft, setDraft] = useState<CompanyProfile>(emptyCompany(true));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrImage, setOcrImage] = useState("");
  const [ocrSource, setOcrSource] =
    useState<(typeof sourceOptions)[number]["value"]>("license");
  const [ocrAttempt, setOcrAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace("/auth?redirect=/companies");
    }
  }, [router, user, userLoading]);

  const persistActiveCompany = async (companyId: string) => {
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
      body: JSON.stringify({ activeCompanyProfileId: companyId || "" }),
    });
  };

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

        const nextProfiles = normalizeProfileList(companyPayload.profiles);
        const activeIdFromProfile =
          typeof profilePayload.activeCompanyProfileId === "string"
            ? profilePayload.activeCompanyProfileId
            : "";
        const defaultIdFromApi =
          typeof companyPayload.defaultCompanyProfileId === "string"
            ? companyPayload.defaultCompanyProfileId
            : "";
        const fallbackId =
          nextProfiles.find((profile) => profile.isDefault)?.id ||
          nextProfiles[0]?.id ||
          "";
        const nextActiveId = activeIdFromProfile || defaultIdFromApi || fallbackId;
        const selected =
          nextProfiles.find((profile) => profile.id === nextActiveId) ||
          nextProfiles.find((profile) => profile.isDefault) ||
          nextProfiles[0] ||
          emptyCompany(true);

        if (!cancelled) {
          setProfiles(nextProfiles);
          setActiveCompanyId(selected.id || "");
          setDraft(selected);
        }
      } catch (loadError) {
        console.error("[CompaniesPage] Failed to load data:", loadError);
        if (!cancelled) {
          setError(text.loadFailed);
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
  }, [router, text.loadFailed, user]);

  const selectedSourceLabel = useMemo(() => {
    const source = sourceOptions.find((item) => item.value === ocrSource);
    return isEn ? source?.en : source?.zh;
  }, [isEn, ocrSource]);

  const filteredProfiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const sorted = [...profiles].sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }

      const leftTime = new Date(left.updatedAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || 0).getTime();
      return rightTime - leftTime;
    });

    if (!keyword) {
      return sorted;
    }

    return sorted.filter((profile) =>
      [profile.profileName, profile.companyName, profile.creditCode, profile.contactPerson]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [profiles, search]);

  const updateDraft = <K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSelectCompany = async (profile: CompanyProfile) => {
    setActiveCompanyId(profile.id);
    setDraft(profile);
    setMessage("");
    setError("");

    try {
      await persistActiveCompany(profile.id);
    } catch (persistError) {
      console.error("[CompaniesPage] Failed to persist active company:", persistError);
    }
  };

  const handleCreateNew = () => {
    setDraft(emptyCompany(profiles.length === 0));
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
      setError(text.ocrImageFailed);
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
        creditCode: (payload.data?.creditCode || current.creditCode || "").toUpperCase(),
        legalPerson: payload.data?.legalPerson || current.legalPerson,
        address: payload.data?.address || current.address,
      }));
      setMessage(`${selectedSourceLabel || ""} ${text.ocrSuccess}`.trim());
    } catch (ocrError) {
      console.error("[CompaniesPage] OCR failed:", ocrError);
      setOcrAttempt((count) => count + 1);
      setError(text.ocrFailed);
    } finally {
      setOcrLoading(false);
    }
  };

  const validateDraft = (value: CompanyProfile): string | null => {
    const prepared = persistableDraft(value);
    if (
      !prepared.companyName ||
      !prepared.creditCode ||
      !prepared.legalPerson ||
      !prepared.address
    ) {
      return text.requiredFields;
    }

    if (prepared.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prepared.contactEmail)) {
      return text.invalidEmail;
    }

    if (prepared.contactPhone && !/^[0-9+\-()\s]{6,24}$/.test(prepared.contactPhone)) {
      return text.invalidPhone;
    }

    return null;
  };

  const handleSave = async () => {
    const prepared = persistableDraft(draft);
    const validationError = validateDraft(prepared);
    if (validationError) {
      setError(validationError);
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
        body: JSON.stringify(prepared),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        if (payload?.code === "DUPLICATE_CREDIT_CODE") {
          throw new Error(text.duplicateCreditCode);
        }
        if (payload?.code === "COMPANY_PROFILE_LIMIT_REACHED") {
          throw new Error(text.profileLimit);
        }
        throw new Error(payload.error || text.saveFailed);
      }

      const nextProfiles = normalizeProfileList(payload.profiles);
      const preferredId =
        (payload.data && typeof payload.data.id === "string" ? payload.data.id : "") ||
        (typeof payload.defaultCompanyProfileId === "string"
          ? payload.defaultCompanyProfileId
          : "") ||
        nextProfiles.find((profile) => profile.isDefault)?.id ||
        nextProfiles[0]?.id ||
        "";
      const nextSelected =
        nextProfiles.find((profile) => profile.id === preferredId) ||
        nextProfiles[0] ||
        emptyCompany(true);

      setProfiles(nextProfiles);
      setDraft(nextSelected);
      setActiveCompanyId(nextSelected.id);
      setMessage(text.saveSuccess);

      await persistActiveCompany(nextSelected.id || "");
    } catch (saveError) {
      console.error("[CompaniesPage] Save failed:", saveError);
      setError(saveError instanceof Error ? saveError.message : text.saveFailed);
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
        throw new Error(payload.error || text.deleteFailed);
      }

      const nextProfiles = normalizeProfileList(payload.profiles);
      const nextActiveId =
        (typeof payload.nextDefaultId === "string" ? payload.nextDefaultId : "") ||
        nextProfiles.find((profile) => profile.isDefault)?.id ||
        nextProfiles[0]?.id ||
        "";
      const nextDraft =
        nextProfiles.find((profile) => profile.id === nextActiveId) ||
        nextProfiles[0] ||
        emptyCompany(nextProfiles.length === 0);

      setProfiles(nextProfiles);
      setDraft(nextDraft);
      setActiveCompanyId(nextDraft.id || "");
      setMessage(text.deleteSuccess);

      await persistActiveCompany(nextActiveId);
    } catch (deleteError) {
      console.error("[CompaniesPage] Delete failed:", deleteError);
      setError(
        deleteError instanceof Error ? deleteError.message : text.deleteFailed,
      );
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
            <h1 className="text-3xl font-semibold tracking-tight">{text.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{text.subtitle}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/contracts/company-setup")}>
            <Building2 className="mr-2 h-4 w-4" />
            {text.setup}
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

        <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>{isEn ? "Entity Switcher" : "主体切换"}</CardTitle>
              <CardDescription>
                {isEn ? "Manage multiple legal entities in one account." : "同一账号下维护多个企业主体。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline" onClick={handleCreateNew}>
                {text.createNew}
              </Button>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={text.searchPlaceholder}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              {profiles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  {text.noProfiles}
                </div>
              ) : null}

              {profiles.length > 0 && filteredProfiles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  {text.noMatched}
                </div>
              ) : null}

              {filteredProfiles.map((profile) => (
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
                    <div className="font-medium">
                      {profile.companyName || (isEn ? "Untitled Company" : "未命名公司")}
                    </div>
                    <div className="flex items-center gap-1">
                      {profile.isDefault ? <Badge variant="secondary">{text.default}</Badge> : null}
                      {activeCompanyId === profile.id ? <Badge>{text.active}</Badge> : null}
                    </div>
                  </div>
                  {profile.profileName ? (
                    <div className="mt-2 text-xs text-muted-foreground">{profile.profileName}</div>
                  ) : null}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {profile.creditCode || text.noCreditCode}
                  </div>
                  {profile.status === "archived" ? (
                    <div className="mt-2 text-xs text-amber-600">{text.archived}</div>
                  ) : null}
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "OCR Intake" : "OCR 识别入口"}</CardTitle>
                <CardDescription>{text.ocrRule}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <div className="space-y-2">
                    <Label>{text.sourceType}</Label>
                    <Select
                      value={ocrSource}
                      onValueChange={(value) =>
                        setOcrSource(value as (typeof sourceOptions)[number]["value"])
                      }
                    >
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
                      <div className="text-sm text-muted-foreground">{text.ocrRule}</div>
                      <Label
                        htmlFor="company-ocr-upload"
                        className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm"
                      >
                        <ImagePlus className="mr-2 h-4 w-4" />
                        {text.uploadImage}
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
                    {text.runOcr}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleOCR()}
                    disabled={!ocrImage || ocrLoading}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {`${text.retry}${ocrAttempt ? ` (${ocrAttempt})` : ""}`}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle>{text.profileCardTitle}</CardTitle>
                <CardDescription>{text.profileCardDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="profile-name">{text.profileName}</Label>
                    <Input
                      id="profile-name"
                      placeholder={text.profileNamePlaceholder}
                      value={draft.profileName}
                      onChange={(event) => updateDraft("profileName", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company-name">{text.companyName}</Label>
                    <Input
                      id="company-name"
                      value={draft.companyName}
                      onChange={(event) => updateDraft("companyName", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="credit-code">{text.creditCode}</Label>
                    <Input
                      id="credit-code"
                      value={draft.creditCode}
                      onChange={(event) =>
                        updateDraft("creditCode", event.target.value.toUpperCase())
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legal-person">{text.legalPerson}</Label>
                    <Input
                      id="legal-person"
                      value={draft.legalPerson}
                      onChange={(event) => updateDraft("legalPerson", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-person">{text.contactPerson}</Label>
                    <Input
                      id="contact-person"
                      value={draft.contactPerson}
                      onChange={(event) => updateDraft("contactPerson", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">{text.contactPhone}</Label>
                    <Input
                      id="contact-phone"
                      value={draft.contactPhone}
                      onChange={(event) => updateDraft("contactPhone", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-email">{text.contactEmail}</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={draft.contactEmail}
                      onChange={(event) =>
                        updateDraft("contactEmail", event.target.value.toLowerCase())
                      }
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">{text.address}</Label>
                    <Input
                      id="address"
                      value={draft.address}
                      onChange={(event) => updateDraft("address", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{text.status}</Label>
                    <Select
                      value={draft.status}
                      onValueChange={(value) => updateDraft("status", value as CompanyStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{text.statusActive}</SelectItem>
                        <SelectItem value="archived">{text.statusArchived}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="is-default">{text.setDefault}</Label>
                    <div className="flex h-10 items-center rounded-md border border-input px-3">
                      <Switch
                        id="is-default"
                        checked={draft.isDefault}
                        onCheckedChange={(checked) => updateDraft("isDefault", checked)}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                  {text.requiredHint}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {text.updatedAt}: {formatDate(draft.updatedAt, isEn ? "en" : "zh")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleDelete()}
                      disabled={deleting || saving || !draft.id}
                    >
                      {deleting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      {deleting ? text.deleting : text.delete}
                    </Button>
                    <Button onClick={() => void handleSave()} disabled={saving || deleting}>
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {saving ? text.saving : text.save}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
