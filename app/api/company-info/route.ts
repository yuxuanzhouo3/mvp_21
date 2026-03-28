import { NextRequest, NextResponse } from "next/server";

import { extractTokenFromHeader, verifyAuthToken } from "@/lib/auth/auth-utils";
import {
  getCompanyProfile,
  upsertCompanyProfile,
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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserId(request);
    if (auth.error) {
      return auth.error;
    }

    const body = await request.json();
    const {
      companyName,
      creditCode,
      legalPerson,
      address,
      contactPerson = "",
      contactPhone = "",
      contactEmail = "",
    } = body ?? {};

    if (!companyName || !creditCode || !legalPerson || !address) {
      return NextResponse.json(
        {
          success: false,
          error:
            "companyName, creditCode, legalPerson, and address are required",
        },
        { status: 400 },
      );
    }

    const profile = await upsertCompanyProfile(auth.userId, {
      companyName,
      creditCode,
      legalPerson,
      address,
      contactPerson,
      contactPhone,
      contactEmail,
    });

    return NextResponse.json({
      success: true,
      data: profile,
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserId(request);
    if (auth.error) {
      return auth.error;
    }

    const profile = await getCompanyProfile(auth.userId);
    if (!profile) {
      return NextResponse.json({
        success: true,
        hasCompanyInfo: false,
        data: null,
        region: getDEPLOY_REGION(),
      });
    }

    return NextResponse.json({
      success: true,
      hasCompanyInfo: true,
      data: profile,
      region: getDEPLOY_REGION(),
      ...profile,
      company_name: profile.companyName,
      credit_code: profile.creditCode,
      legal_person: profile.legalPerson,
      contact_person: profile.contactPerson,
      contact_phone: profile.contactPhone,
      contact_email: profile.contactEmail,
      user_id: profile.userId,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt,
    });
  } catch (error) {
    console.error("[/api/company-info GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load company profile" },
      { status: 500 },
    );
  }
}

