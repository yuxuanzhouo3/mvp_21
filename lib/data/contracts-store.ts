import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

import {
  buildSupabaseContractPayload,
  normalizeContractRecord,
  type ContractStatus,
  type UnifiedContractRecord,
} from "@/lib/data/unified-models";

interface ListContractOptions {
  userId: string;
  status?: string;
  isAdmin?: boolean;
  limit?: number;
  offset?: number;
}

export async function listContracts({
  userId,
  status,
  isAdmin,
  limit = 20,
  offset = 0,
}: ListContractOptions): Promise<{ contracts: UnifiedContractRecord[]; total: number }> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const queryFilter: Record<string, any> = {};
    if (!isAdmin) {
      queryFilter.user_id = userId;
    }
    if (status && status !== "all") {
      queryFilter.status = status;
    }

    const collection = db.collection("contracts");
    let query = Object.keys(queryFilter).length
      ? collection.where(queryFilter)
      : collection;

    const countResult = await query.count();
    query = query.orderBy("created_at", "desc").skip(offset).limit(limit);
    const result = await query.get();

    return {
      contracts: (result.data || []).map((record: Record<string, any>) =>
        normalizeContractRecord(record),
      ),
      total: countResult.total || 0,
    };
  }

  let listQuery = getSupabaseAdmin()
    .from("contracts")
    .select("id,user_id,title,content,status,region,created_at,updated_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (!isAdmin) {
    listQuery = listQuery.eq("user_id", userId);
  }
  if (status && status !== "all") {
    listQuery = listQuery.eq("status", status);
  }

  const { data, count, error } = await listQuery;
  if (error) {
    throw error;
  }

  return {
    contracts: (data || []).map((record) =>
      normalizeContractRecord(record as Record<string, any>),
    ),
    total: count || 0,
  };
}

export async function getContractById(
  id: string,
): Promise<UnifiedContractRecord | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("contracts").doc(id).get();
    const record = result?.data?.[0] as Record<string, any> | undefined;
    return record ? normalizeContractRecord(record) : null;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("contracts")
    .select("id,user_id,title,content,status,region,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return normalizeContractRecord(data as Record<string, any>);
}

export async function createContractRecord(
  input: Partial<UnifiedContractRecord> & { userId: string; title: string },
): Promise<UnifiedContractRecord> {
  const now = new Date().toISOString();

  if (isChinaRegion()) {
    const db = getDatabase();
    const payload = {
      user_id: input.userId,
      title: input.title,
      type: input.type || "custom",
      status: (input.status || "draft") as ContractStatus,
      content: input.content || {},
      source_type: input.sourceType || "text",
      source_content: input.sourceContent || "",
      analysis_result: input.analysisResult || null,
      parties: input.parties || [],
      signatures: input.signatures || [],
      metadata: input.metadata || {},
      region: input.region || null,
      created_at: now,
      updated_at: now,
    };

    const result = await db.collection("contracts").add(payload);
    return {
      ...normalizeContractRecord(payload),
      id: result.id,
    };
  }

  const insertPayload = {
    user_id: input.userId,
    title: input.title,
    status: input.status || "draft",
    region: input.region || null,
    content: buildSupabaseContractPayload(input),
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await getSupabaseAdmin()
    .from("contracts")
    .insert(insertPayload)
    .select("id,user_id,title,content,status,region,created_at,updated_at")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create contract");
  }

  return normalizeContractRecord(data as Record<string, any>);
}

export async function updateContractRecord(
  id: string,
  input: Partial<UnifiedContractRecord>,
): Promise<UnifiedContractRecord> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) payload.title = input.title;
    if (input.type !== undefined) payload.type = input.type;
    if (input.status !== undefined) payload.status = input.status;
    if (input.content !== undefined) payload.content = input.content;
    if (input.sourceType !== undefined) payload.source_type = input.sourceType;
    if (input.sourceContent !== undefined) payload.source_content = input.sourceContent;
    if (input.analysisResult !== undefined) payload.analysis_result = input.analysisResult;
    if (input.parties !== undefined) payload.parties = input.parties;
    if (input.signatures !== undefined) payload.signatures = input.signatures;
    if (input.metadata !== undefined) payload.metadata = input.metadata;
    if (input.region !== undefined) payload.region = input.region;

    await db.collection("contracts").doc(id).update(payload);
    const record = await getContractById(id);
    if (!record) {
      throw new Error("Contract not found after update");
    }
    return record;
  }

  const existing = await getContractById(id);
  if (!existing) {
    throw new Error("Contract not found");
  }

  const merged: UnifiedContractRecord = {
    ...existing,
    ...input,
    content: input.content ?? existing.content,
    parties: input.parties ?? existing.parties,
    signatures: input.signatures ?? existing.signatures,
    metadata: input.metadata ?? existing.metadata,
    analysisResult:
      input.analysisResult === undefined
        ? existing.analysisResult
        : input.analysisResult,
  };

  const updatePayload = {
    title: merged.title,
    status: merged.status,
    region: merged.region || null,
    content: buildSupabaseContractPayload(merged),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await getSupabaseAdmin()
    .from("contracts")
    .update(updatePayload)
    .eq("id", id)
    .select("id,user_id,title,content,status,region,created_at,updated_at")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to update contract");
  }

  return normalizeContractRecord(data as Record<string, any>);
}

export async function deleteContractRecord(id: string): Promise<void> {
  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("contracts").doc(id).remove();
    return;
  }

  const { error } = await getSupabaseAdmin().from("contracts").delete().eq("id", id);
  if (error) {
    throw error;
  }
}
