import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

import {
  normalizeCompanyProfileRecord,
  type UnifiedCompanyProfile,
} from "@/lib/data/unified-models";

export async function getCompanyProfile(
  userId: string,
): Promise<UnifiedCompanyProfile | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("company_profiles")
      .where({ user_id: userId })
      .limit(1)
      .get();

    if (!result.data?.length) {
      return null;
    }

    return normalizeCompanyProfileRecord(result.data[0]);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("company_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return normalizeCompanyProfileRecord(data as Record<string, any>);
}

export async function upsertCompanyProfile(
  userId: string,
  input: Omit<UnifiedCompanyProfile, "id" | "userId" | "createdAt" | "updatedAt">,
): Promise<UnifiedCompanyProfile> {
  const payload = {
    user_id: userId,
    company_name: input.companyName,
    credit_code: input.creditCode,
    legal_person: input.legalPerson,
    address: input.address,
    contact_person: input.contactPerson,
    contact_phone: input.contactPhone,
    contact_email: input.contactEmail,
    updated_at: new Date().toISOString(),
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    const collection = db.collection("company_profiles");
    const existing = await collection.where({ user_id: userId }).limit(1).get();

    if (existing.data?.length) {
      const existingRecord = existing.data[0];
      await collection.doc(existingRecord._id).update(payload);
      return (
        (await getCompanyProfile(userId)) || {
          id: existingRecord._id,
          userId,
          ...input,
          updatedAt: payload.updated_at,
        }
      );
    }

    const createdAt = new Date().toISOString();
    const createResult = await collection.add({
      ...payload,
      created_at: createdAt,
    });

    return {
      id: createResult.id,
      userId,
      ...input,
      createdAt,
      updatedAt: payload.updated_at,
    };
  }

  const { data: existing, error: existingError } = await getSupabaseAdmin()
    .from("company_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existing?.id) {
    const { error } = await getSupabaseAdmin()
      .from("company_profiles")
      .update(payload)
      .eq("id", existing.id);
    if (error) {
      throw error;
    }
  } else {
    const { error } = await getSupabaseAdmin()
      .from("company_profiles")
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      });
    if (error) {
      throw error;
    }
  }

  const profile = await getCompanyProfile(userId);
  if (!profile) {
    throw new Error("Failed to load company profile after save");
  }

  return profile;
}
