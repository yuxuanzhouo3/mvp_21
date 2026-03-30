import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

import {
  normalizeCompanyProfileRecord,
  type UnifiedCompanyProfile,
} from "@/lib/data/unified-models";

type CompanyProfileInput = Omit<
  UnifiedCompanyProfile,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

function buildPayload(userId: string, input: CompanyProfileInput) {
  return {
    user_id: userId,
    profile_name: input.profileName,
    company_name: input.companyName,
    credit_code: input.creditCode,
    legal_person: input.legalPerson,
    address: input.address,
    contact_person: input.contactPerson,
    contact_phone: input.contactPhone,
    contact_email: input.contactEmail,
    status: input.status || "active",
    is_default: Boolean(input.isDefault),
    source: input.source,
    ocr_status: input.ocrStatus,
    license_file_url: input.licenseFileUrl,
    metadata: input.metadata || {},
    last_verified_at: input.lastVerifiedAt,
    updated_at: new Date().toISOString(),
  };
}

export async function listCompanyProfiles(
  userId: string,
): Promise<UnifiedCompanyProfile[]> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("company_profiles")
      .where({ user_id: userId })
      .orderBy("updated_at", "desc")
      .get();

    return (result.data || []).map((record: Record<string, any>) =>
      normalizeCompanyProfileRecord(record),
    );
  }

  const supabaseAdmin = getSupabaseAdmin() as any;
  const { data, error } = await supabaseAdmin
    .from("company_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((record: Record<string, any>) =>
    normalizeCompanyProfileRecord(record as Record<string, any>),
  );
}

export async function getCompanyProfile(
  userId: string,
  companyId?: string,
): Promise<UnifiedCompanyProfile | null> {
  const profiles = await listCompanyProfiles(userId);

  if (!profiles.length) {
    return null;
  }

  if (companyId) {
    return profiles.find((profile) => profile.id === companyId) || null;
  }

  return profiles[0];
}

export async function createCompanyProfile(
  userId: string,
  input: CompanyProfileInput,
): Promise<UnifiedCompanyProfile> {
  const payload = buildPayload(userId, input);

  if (isChinaRegion()) {
    const db = getDatabase();
    const createdAt = new Date().toISOString();
    const result = await db.collection("company_profiles").add({
      ...payload,
      created_at: createdAt,
    });

    return {
      id: result.id,
      userId,
      ...input,
      createdAt,
      updatedAt: payload.updated_at,
    };
  }

  const supabaseAdmin = getSupabaseAdmin() as any;
  const { data, error } = await supabaseAdmin
    .from("company_profiles")
    .insert({
      ...payload,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create company profile");
  }

  return normalizeCompanyProfileRecord(data as Record<string, any>);
}

export async function updateCompanyProfile(
  id: string,
  userId: string,
  input: CompanyProfileInput,
): Promise<UnifiedCompanyProfile> {
  const payload = buildPayload(userId, input);

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("company_profiles").doc(id).update(payload);
    const profile = await getCompanyProfile(userId, id);

    if (!profile) {
      throw new Error("Failed to load company profile after update");
    }

    return profile;
  }

  const supabaseAdmin = getSupabaseAdmin() as any;
  const { data, error } = await supabaseAdmin
    .from("company_profiles")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to update company profile");
  }

  return normalizeCompanyProfileRecord(data as Record<string, any>);
}

export async function deleteCompanyProfile(
  id: string,
  userId: string,
): Promise<void> {
  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("company_profiles").doc(id).remove();
    return;
  }

  const supabaseAdmin = getSupabaseAdmin() as any;
  const { error } = await supabaseAdmin
    .from("company_profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function upsertCompanyProfile(
  userId: string,
  input: CompanyProfileInput & { id?: string },
): Promise<UnifiedCompanyProfile> {
  if (input.id) {
    return updateCompanyProfile(input.id, userId, input);
  }

  const existing = await getCompanyProfile(userId);
  if (!existing) {
    return createCompanyProfile(userId, input);
  }

  return updateCompanyProfile(existing.id, userId, input);
}
