"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useTranslations, type Language } from "@/lib/i18n";

interface CompanyInfo {
  id?: string;
  companyName: string;
  creditCode: string;
  legalPerson: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
}

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

function buildEmptyCompanyInfo(
  user?: { name?: string; email?: string } | null,
): CompanyInfo {
  return {
    companyName: "",
    creditCode: "",
    legalPerson: "",
    address: "",
    contactPerson: user?.name || "",
    contactPhone: "",
    contactEmail: user?.email || "",
  };
}

function mergeCompanyInfo(
  current: CompanyInfo,
  incoming?: Partial<CompanyInfo> | null,
): CompanyInfo {
  return {
    id: incoming?.id ?? current.id,
    companyName: incoming?.companyName ?? current.companyName,
    creditCode: incoming?.creditCode ?? current.creditCode,
    legalPerson: incoming?.legalPerson ?? current.legalPerson,
    address: incoming?.address ?? current.address,
    contactPerson: incoming?.contactPerson ?? current.contactPerson,
    contactPhone: incoming?.contactPhone ?? current.contactPhone,
    contactEmail: incoming?.contactEmail ?? current.contactEmail,
  };
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const maxWidth = 1600;
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas is not available"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    image.onerror = () => reject(new Error("Failed to decode image"));
    image.src = dataUrl;
  });
}

async function fileToPreviewUrl(file: File): Promise<string> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("invalid_type");
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error("file_too_large");
  }

  return compressImage(file);
}

export default function CompanySetupPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user } = useUser();
  const t = useTranslations(language as Language);
  const content = t.companySetup;

  const [step, setStep] = useState<"upload" | "edit">("upload");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(
    buildEmptyCompanyInfo(user),
  );

  useEffect(() => {
    setCompanyInfo((current) =>
      mergeCompanyInfo(current, {
        contactPerson: current.contactPerson || user?.name || "",
        contactEmail: current.contactEmail || user?.email || "",
      }),
    );
  }, [user?.email, user?.name]);

  useEffect(() => {
    let cancelled = false;

    const loadCompanyProfile = async () => {
      try {
        const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
        const headers = await tokenManager.getAuthHeaderAsync();

        if (!headers) {
          setLoadingProfile(false);
          return;
        }

        const response = await fetch("/api/company-info", { headers });
        if (!response.ok) {
          throw new Error(`Failed to load company profile: ${response.status}`);
        }

        const result = await response.json();
        const existing =
          result?.data ||
          (result?.hasCompanyInfo
            ? {
                companyName: result.companyName,
                creditCode: result.creditCode,
                legalPerson: result.legalPerson,
                address: result.address,
                contactPerson: result.contactPerson,
                contactPhone: result.contactPhone,
                contactEmail: result.contactEmail,
              }
            : null);

        if (cancelled || !existing) {
          return;
        }

        setCompanyInfo((current) => mergeCompanyInfo(current, existing));

        if (
          existing.companyName ||
          existing.creditCode ||
          existing.legalPerson ||
          existing.address
        ) {
          setStep("edit");
        }
      } catch (error) {
        console.error("[company-setup] Failed to load company profile:", error);
        if (!cancelled) {
          toast.error(content.loadFailed);
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    };

    loadCompanyProfile();

    return () => {
      cancelled = true;
    };
  }, [content.loadFailed]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);

    try {
      const preview = await fileToPreviewUrl(file);
      setPreviewImage(preview);
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_type") {
        toast.error(content.uploadInvalidType);
      } else if (error instanceof Error && error.message === "file_too_large") {
        toast.error(content.uploadTooLarge);
      } else {
        toast.error(content.uploadInvalidType);
      }
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleStartOCR = async () => {
    if (!previewImage) {
      return;
    }

    setAnalyzing(true);

    try {
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
        body: JSON.stringify({ imageBase64: previewImage }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "ocr_failed");
      }

      setCompanyInfo((current) =>
        mergeCompanyInfo(current, {
          companyName: result.data?.companyName || "",
          creditCode: result.data?.creditCode || "",
          legalPerson: result.data?.legalPerson || "",
          address: result.data?.address || "",
        }),
      );
      setStep("edit");
    } catch (error) {
      console.error("[company-setup] OCR failed:", error);
      toast.error(
        error instanceof Error && error.message === "auth_required"
          ? content.authRequired
          : content.ocrFailed,
      );
      setStep("edit");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (
      !companyInfo.companyName ||
      !companyInfo.creditCode ||
      !companyInfo.legalPerson ||
      !companyInfo.address
    ) {
      toast.error(content.requiredFields);
      return;
    }

    setSaving(true);

    try {
      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        toast.error(content.authRequired);
        return;
      }

      const response = await fetch("/api/company-info", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyInfo),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "save_failed");
      }

      toast.success(content.saveSuccess);
      router.push("/create");
    } catch (error) {
      console.error("[company-setup] Save failed:", error);
      toast.error(content.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setStep("edit");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step === "upload"
                  ? "bg-primary text-white"
                  : "bg-green-500 text-white"
              }`}
            >
              {step === "edit" ? <Check className="h-5 w-5" /> : "1"}
            </div>
            <span className={step === "upload" ? "font-medium" : "text-gray-500"}>
              {content.stepUpload}
            </span>
          </div>
          <div className="h-0.5 w-16 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step === "edit"
                  ? "bg-primary text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              2
            </div>
            <span className={step === "edit" ? "font-medium" : "text-gray-500"}>
              {content.stepConfirm}
            </span>
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-bold">{content.title}</h1>
          <p className="text-gray-600">{content.subtitle}</p>
        </div>

        {loadingProfile ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-12 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{content.loadingProfile}</span>
            </CardContent>
          </Card>
        ) : step === "upload" ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>{content.uploadTitle}</CardTitle>
              <CardDescription>{content.uploadDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-primary">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="license-upload"
                />

                {uploading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <span className="text-sm text-gray-600">
                      {content.uploading}
                    </span>
                  </div>
                ) : previewImage ? (
                  <div className="space-y-4">
                    <div className="relative mx-auto w-full max-w-md">
                      <Image
                        src={previewImage}
                        alt={content.previewAlt}
                        width={400}
                        height={300}
                        className="rounded-lg border"
                      />
                    </div>

                    {analyzing ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <Sparkles className="h-5 w-5 animate-pulse" />
                        <span className="font-medium">{content.analyzing}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Button
                          onClick={handleStartOCR}
                          size="lg"
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Sparkles className="mr-2 h-5 w-5" />
                          {content.startRecognition}
                        </Button>
                        <label
                          htmlFor="license-upload"
                          className="cursor-pointer text-sm text-gray-500 hover:text-primary"
                        >
                          {content.reupload}
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                      <Upload className="h-8 w-8 text-blue-600" />
                    </div>
                    <label
                      htmlFor="license-upload"
                      className="cursor-pointer font-medium text-primary hover:underline"
                    >
                      {content.clickToUpload}
                    </label>
                    <p className="mt-2 text-sm text-gray-500">{content.dragHint}</p>
                  </>
                )}
              </div>

              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription>{content.tip}</AlertDescription>
              </Alert>

              <div className="pt-4 text-center">
                <Button variant="ghost" onClick={handleSkip}>
                  {content.skipManual}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{content.editTitle}</CardTitle>
                <CardDescription>{content.editDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">{content.companyName}</Label>
                    <Input
                      id="companyName"
                      value={companyInfo.companyName}
                      onChange={(event) =>
                        setCompanyInfo((current) => ({
                          ...current,
                          companyName: event.target.value,
                        }))
                      }
                      placeholder={content.companyNamePlaceholder}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="creditCode">{content.creditCode}</Label>
                    <Input
                      id="creditCode"
                      value={companyInfo.creditCode}
                      onChange={(event) =>
                        setCompanyInfo((current) => ({
                          ...current,
                          creditCode: event.target.value,
                        }))
                      }
                      placeholder={content.creditCodePlaceholder}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legalPerson">{content.legalPerson}</Label>
                    <Input
                      id="legalPerson"
                      value={companyInfo.legalPerson}
                      onChange={(event) =>
                        setCompanyInfo((current) => ({
                          ...current,
                          legalPerson: event.target.value,
                        }))
                      }
                      placeholder={content.legalPersonPlaceholder}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">{content.contactPerson}</Label>
                    <Input
                      id="contactPerson"
                      value={companyInfo.contactPerson}
                      onChange={(event) =>
                        setCompanyInfo((current) => ({
                          ...current,
                          contactPerson: event.target.value,
                        }))
                      }
                      placeholder={content.contactPersonPlaceholder}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">{content.contactPhone}</Label>
                    <Input
                      id="contactPhone"
                      value={companyInfo.contactPhone}
                      onChange={(event) =>
                        setCompanyInfo((current) => ({
                          ...current,
                          contactPhone: event.target.value,
                        }))
                      }
                      placeholder={content.contactPhonePlaceholder}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">{content.contactEmail}</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={companyInfo.contactEmail}
                      onChange={(event) =>
                        setCompanyInfo((current) => ({
                          ...current,
                          contactEmail: event.target.value,
                        }))
                      }
                      placeholder={content.contactEmailPlaceholder}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{content.address}</Label>
                  <Input
                    id="address"
                    value={companyInfo.address}
                    onChange={(event) =>
                      setCompanyInfo((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    placeholder={content.addressPlaceholder}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>
                {content.back}
              </Button>
              <Button onClick={handleSave} disabled={saving} size="lg">
                {saving ? content.saving : content.saveAndContinue}
                {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
