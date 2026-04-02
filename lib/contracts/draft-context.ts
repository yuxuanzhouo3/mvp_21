import type { AIAnalysisResult } from "@/lib/ai/types";
import { tokenManager } from "@/lib/auth/frontend-token-manager";
import type { UnifiedCompanyProfile } from "@/lib/data/unified-models";

export interface ActiveCompanyProfileSnapshot {
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

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeActiveCompanyProfile(
  value: unknown,
): ActiveCompanyProfileSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const companyName = readString(record.companyName);
  if (!companyName) {
    return null;
  }

  return {
    id: readString(record.id),
    companyName,
    creditCode: readString(record.creditCode),
    legalPerson: readString(record.legalPerson),
    address: readString(record.address),
    contactPerson: readString(record.contactPerson),
    contactPhone: readString(record.contactPhone),
    contactEmail: readString(record.contactEmail),
    updatedAt: readString(record.updatedAt) || undefined,
  };
}

export function createActiveCompanyProfileSnapshot(
  profile: UnifiedCompanyProfile,
): ActiveCompanyProfileSnapshot | null {
  return normalizeActiveCompanyProfile(profile);
}

export function buildCompanyProfileContactSummary(
  profile: ActiveCompanyProfileSnapshot,
) {
  const segments = [
    profile.contactPerson ? `联系人: ${profile.contactPerson}` : "",
    profile.contactPhone ? `电话: ${profile.contactPhone}` : "",
    profile.contactEmail ? `邮箱: ${profile.contactEmail}` : "",
    profile.address ? `地址: ${profile.address}` : "",
    profile.legalPerson ? `法定代表人: ${profile.legalPerson}` : "",
    profile.creditCode ? `统一社会信用代码: ${profile.creditCode}` : "",
  ].filter(Boolean);

  return segments.join(" | ");
}

export function applyActiveCompanyProfileToAnalysis(
  analysis: AIAnalysisResult,
  profile: ActiveCompanyProfileSnapshot | null,
) {
  if (!profile) {
    return analysis;
  }

  const currentPartyA = analysis.partyA || {};
  const contactSummary = buildCompanyProfileContactSummary(profile);

  return {
    ...analysis,
    partyA: {
      ...currentPartyA,
      name: profile.companyName,
      role: currentPartyA.role || "甲方",
      company: profile.companyName,
      position: currentPartyA.position || profile.legalPerson || undefined,
      contact: contactSummary || currentPartyA.contact || undefined,
      identified: true,
    },
  };
}

export async function loadActiveCompanyProfileForCurrentUser() {
  const headers = await tokenManager.getAuthHeaderAsync();
  if (!headers) {
    return null;
  }

  const profileResponse = await fetch("/api/profile", {
    headers,
    cache: "no-store",
  });

  if (!profileResponse.ok) {
    return null;
  }

  const accountProfile = (await profileResponse.json()) as {
    activeCompanyProfileId?: string;
  };

  const activeCompanyProfileId = readString(accountProfile.activeCompanyProfileId);
  const companyInfoPath = activeCompanyProfileId
    ? `/api/company-info?id=${encodeURIComponent(activeCompanyProfileId)}`
    : "/api/company-info";

  const companyResponse = await fetch(companyInfoPath, {
    headers,
    cache: "no-store",
  });

  if (!companyResponse.ok) {
    return null;
  }

  const payload = (await companyResponse.json()) as {
    success?: boolean;
    data?: UnifiedCompanyProfile | null;
  };

  if (!payload.success || !payload.data) {
    return null;
  }

  return createActiveCompanyProfileSnapshot(payload.data);
}

export async function prepareDraftAnalysisForCurrentUser(
  analysis: AIAnalysisResult,
) {
  const activeCompanyProfile = await loadActiveCompanyProfileForCurrentUser();

  return {
    analysisResult: applyActiveCompanyProfileToAnalysis(
      analysis,
      activeCompanyProfile,
    ),
    activeCompanyProfile,
  };
}
