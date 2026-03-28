import { NextRequest, NextResponse } from "next/server";

import {
  getCompanyProfile,
  upsertCompanyProfile,
} from "@/lib/data/company-profile-store";
import { verifyAuthToken, extractTokenFromHeader } from "@/lib/auth/auth-utils";

async function requireUserId(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { token, error: tokenError } = extractTokenFromHeader(authHeader);

  if (tokenError || !token) {
    return {
      error: NextResponse.json(
        { error: tokenError || "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const authResult = await verifyAuthToken(token);
  if (!authResult.success || !authResult.userId) {
    return {
      error: NextResponse.json(
        { error: authResult.error || "Invalid token" },
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
    } = body;

    if (!companyName || !creditCode || !legalPerson || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
    });
  } catch (error) {
    console.error("[/api/company-info POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to save company profile" },
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
      return NextResponse.json({ hasCompanyInfo: false });
    }

    return NextResponse.json({
      hasCompanyInfo: true,
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
      { error: "Failed to load company profile" },
      { status: 500 },
    );
  }
}
