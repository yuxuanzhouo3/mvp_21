import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import {
  createCompanyProfile,
  deleteCompanyProfile,
  getCompanyProfile,
  listCompanyProfiles,
  updateCompanyProfile,
} from "@/lib/data/company-profile-store";
import { getDEPLOY_REGION } from "@/lib/config/region";

async function requireUserId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { token, error: tokenError } = extractTokenFromHeader(authHeader);

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

function normalizeBody(body: any) {
  return {
    companyName: typeof body?.companyName === "string" ? body.companyName : "",
    creditCode: typeof body?.creditCode === "string" ? body.creditCode : "",
    legalPerson: typeof body?.legalPerson === "string" ? body.legalPerson : "",
    address: typeof body?.address === "string" ? body.address : "",
    contactPerson: typeof body?.contactPerson === "string" ? body.contactPerson : "",
    contactPhone: typeof body?.contactPhone === "string" ? body.contactPhone : "",
    contactEmail: typeof body?.contactEmail === "string" ? body.contactEmail : "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserId(request);
    if (auth.error) {
      return auth.error;
    }

    const requestedId = request.nextUrl.searchParams.get("id") || undefined;
    const profiles = await listCompanyProfiles(auth.userId);
    const selectedProfile =
      (requestedId
        ? profiles.find((profile) => profile.id === requestedId)
        : profiles[0]) || null;

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

    if (!payload.companyName || !payload.creditCode || !payload.legalPerson || !payload.address) {
      return NextResponse.json(
        {
          success: false,
          error:
            "companyName, creditCode, legalPerson, and address are required",
        },
        { status: 400 },
      );
    }

    const profile = id
      ? await updateCompanyProfile(id, auth.userId, payload)
      : await createCompanyProfile(auth.userId, payload);

    const profiles = await listCompanyProfiles(auth.userId);

    return NextResponse.json({
      success: true,
      data: profile,
      profiles,
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

    return NextResponse.json({
      success: true,
      profiles: await listCompanyProfiles(auth.userId),
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
