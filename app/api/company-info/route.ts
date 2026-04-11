import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";
import {
  createCompanyProfile,
  ensureCompanyDefaultProfile,
  deleteCompanyProfile,
  getCompanyProfile,
  listCompanyProfiles,
  setDefaultCompanyProfile,
  updateCompanyProfile,
} from "@/lib/data/company-profile-store";
import { getDEPLOY_REGION } from "@/lib/config/region";

const MAX_COMPANY_PROFILES = 20;
const CREDIT_CODE_REGEX = /^[A-Z0-9-]{8,32}$/;
const CONTACT_PHONE_REGEX = /^[0-9+\-()\s]{6,24}$/;
const CONTACT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireUserId(request: NextRequest) {
  const { token, error: tokenError } = extractTokenFromRequest(request);

  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        { success: false, error: tokenError || "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const authResult = await verifyAuthToken(token);
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        { success: false, error: authResult.error || "Invalid token" },
        { status: 401 },
      ),
    };
  }

  return { userId: authResult.userId };
}

function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  return normalized.slice(0, maxLength);
}

function normalizeBody(body: any): {
  profileName: string;
  companyName: string;
  creditCode: string;
  legalPerson: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  status: "active" | "archived";
  isDefault: boolean;
} {
  return {
    profileName: normalizeText(body?.profileName, 64),
    companyName: normalizeText(body?.companyName, 120),
    creditCode: normalizeText(body?.creditCode, 32).toUpperCase(),
    legalPerson: normalizeText(body?.legalPerson, 64),
    address: normalizeText(body?.address, 240),
    contactPerson: normalizeText(body?.contactPerson, 64),
    contactPhone: normalizeText(body?.contactPhone, 32),
    contactEmail: normalizeText(body?.contactEmail, 120).toLowerCase(),
    status: body?.status === "archived" ? "archived" : "active",
    isDefault: Boolean(body?.isDefault),
  };
}

function validatePayload(payload: ReturnType<typeof normalizeBody>): string | null {
  if (!payload.companyName || !payload.creditCode || !payload.legalPerson || !payload.address) {
    return "companyName, creditCode, legalPerson, and address are required";
  }

  if (!CREDIT_CODE_REGEX.test(payload.creditCode)) {
    return "creditCode format is invalid";
  }

  if (payload.contactEmail && !CONTACT_EMAIL_REGEX.test(payload.contactEmail)) {
    return "contactEmail format is invalid";
  }

  if (payload.contactPhone && !CONTACT_PHONE_REGEX.test(payload.contactPhone)) {
    return "contactPhone format is invalid";
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserId(request);
    if (auth.error) {
      return auth.error;
    }

    const requestedId = request.nextUrl.searchParams.get("id") || undefined;
    let profiles = await listCompanyProfiles(auth.userId);
    let defaultProfile =
      profiles.find((profile) => profile.isDefault) || null;

    if (!defaultProfile && profiles.length > 0) {
      const ensuredDefault = await ensureCompanyDefaultProfile(auth.userId);
      profiles = await listCompanyProfiles(auth.userId);
      defaultProfile =
        profiles.find((profile) => profile.id === ensuredDefault?.id) ||
        profiles[0] ||
        null;
    }

    const selectedProfile =
      (requestedId
        ? profiles.find((profile) => profile.id === requestedId)
        : defaultProfile) ||
      defaultProfile ||
      profiles[0] ||
      null;

    if (!selectedProfile) {
      return NextResponse.json({
        success: true,
        hasCompanyInfo: false,
        data: null,
        profiles: [],
        region: getDEPLOY_REGION(),
      });
    }

    return NextResponse.json({
      success: true,
      hasCompanyInfo: true,
      data: selectedProfile,
      profiles,
      defaultCompanyProfileId: defaultProfile?.id || "",
      region: getDEPLOY_REGION(),
      ...selectedProfile,
      company_name: selectedProfile.companyName,
      credit_code: selectedProfile.creditCode,
      legal_person: selectedProfile.legalPerson,
      contact_person: selectedProfile.contactPerson,
      contact_phone: selectedProfile.contactPhone,
      contact_email: selectedProfile.contactEmail,
      user_id: selectedProfile.userId,
      created_at: selectedProfile.createdAt,
      updated_at: selectedProfile.updatedAt,
    });
  } catch (error) {
    console.error("[/api/company-info GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load company profile" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserId(request);
    if (auth.error) {
      return auth.error;
    }

    const body = await request.json();
    const payload = normalizeBody(body);
    const id = typeof body?.id === "string" ? body.id : "";

    const validationError = validatePayload(payload);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError, code: "INVALID_COMPANY_PROFILE" },
        { status: 400 },
      );
    }

    const existingProfiles = await listCompanyProfiles(auth.userId);
    const duplicate = existingProfiles.find(
      (profile) =>
        profile.creditCode.trim().toUpperCase() === payload.creditCode &&
        profile.id !== id,
    );
    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: "A company profile with the same creditCode already exists",
          code: "DUPLICATE_CREDIT_CODE",
        },
        { status: 409 },
      );
    }

    if (!id && existingProfiles.length >= MAX_COMPANY_PROFILES) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum company profile count is ${MAX_COMPANY_PROFILES}`,
          code: "COMPANY_PROFILE_LIMIT_REACHED",
        },
        { status: 400 },
      );
    }

    const shouldSetDefault =
      payload.isDefault || (!id && existingProfiles.length === 0);

    const profile = id
      ? await updateCompanyProfile(id, auth.userId, payload)
      : await createCompanyProfile(auth.userId, payload);

    if (shouldSetDefault) {
      await setDefaultCompanyProfile(auth.userId, profile.id);
    }

    const defaultProfile = await ensureCompanyDefaultProfile(auth.userId);
    const profiles = await listCompanyProfiles(auth.userId);

    return NextResponse.json({
      success: true,
      data: profile,
      profiles,
      defaultCompanyProfileId: defaultProfile?.id || "",
      region: getDEPLOY_REGION(),
    });
  } catch (error) {
    console.error("[/api/company-info POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save company profile" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUserId(request);
    if (auth.error) {
      return auth.error;
    }

    const id = request.nextUrl.searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing company profile id" },
        { status: 400 },
      );
    }

    const existing = await getCompanyProfile(auth.userId, id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Company profile not found" },
        { status: 404 },
      );
    }

    await deleteCompanyProfile(id, auth.userId);

    const defaultProfile = await ensureCompanyDefaultProfile(auth.userId);
    const profiles = await listCompanyProfiles(auth.userId);

    return NextResponse.json({
      success: true,
      profiles,
      nextDefaultId: defaultProfile?.id || "",
      region: getDEPLOY_REGION(),
    });
  } catch (error) {
    console.error("[/api/company-info DELETE] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete company profile" },
      { status: 500 },
    );
  }
}
