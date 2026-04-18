import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

export type AdTrackType = "impression" | "click";

export interface PublicAd {
  id: string;
  position: string;
  type: string;
  content: string;
  link: string;
}

export class AdNotFoundError extends Error {
  constructor(message = "Ad not found") {
    super(message);
    this.name = "AdNotFoundError";
  }
}

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value || 0);
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeAdId(record: Record<string, unknown>): string {
  return toStringValue(record._id) || toStringValue(record.id);
}

function isActiveWithinDateWindow(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: string,
) {
  if (endDate && endDate < today) {
    return false;
  }
  if (startDate && startDate > today) {
    return false;
  }
  return true;
}

export async function listPublicActiveAds(position?: string): Promise<PublicAd[]> {
  const today = new Date().toISOString().slice(0, 10);

  if (isChinaRegion()) {
    const db = getDatabase();
    const query = db.collection("ads").where({
      status: "active",
      ...(position ? { position } : {}),
    });
    const result = await query.get();
    const rows = (result.data || []) as Array<Record<string, unknown>>;

    return rows
      .filter((row) =>
        isActiveWithinDateWindow(
          toStringValue(row.start_date) || null,
          toStringValue(row.end_date) || null,
          today,
        ),
      )
      .map((row) => ({
        id: normalizeAdId(row),
        position: toStringValue(row.position),
        type: toStringValue(row.type),
        content: toStringValue(row.content),
        link: toStringValue(row.link),
      }));
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("ads")
    .select("id, position, type, content, link, status, start_date, end_date")
    .eq("status", "active");

  if (position) {
    query = query.eq("position", position);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const rows = (data || []) as Array<Record<string, unknown>>;
  return rows
    .filter((row) =>
      isActiveWithinDateWindow(
        toStringValue(row.start_date) || null,
        toStringValue(row.end_date) || null,
        today,
      ),
    )
    .map((row) => ({
      id: normalizeAdId(row),
      position: toStringValue(row.position),
      type: toStringValue(row.type),
      content: toStringValue(row.content),
      link: toStringValue(row.link),
    }));
}

async function findChinaAdById(adId: string) {
  const db = getDatabase();

  try {
    const byDoc = await db.collection("ads").doc(adId).get();
    const docRecord = byDoc?.data?.[0] as Record<string, unknown> | undefined;
    if (docRecord) {
      return {
        docId: normalizeAdId(docRecord) || adId,
        record: docRecord,
      };
    }
  } catch {
    // Fallback to where query when adId is not a native _id
  }

  const byField = await db
    .collection("ads")
    .where({
      id: adId,
    })
    .limit(1)
    .get();
  const matched = byField?.data?.[0] as Record<string, unknown> | undefined;
  if (!matched) {
    throw new AdNotFoundError();
  }

  return {
    docId: normalizeAdId(matched),
    record: matched,
  };
}

export async function trackAdEvent(input: {
  adId: string;
  type: AdTrackType;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { adId, type, ipAddress, userAgent } = input;
  if (type !== "impression" && type !== "click") {
    throw new Error("Unsupported ad track type");
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  if (isChinaRegion()) {
    const db = getDatabase();
    const { docId, record } = await findChinaAdById(adId);
    const nextImpressions =
      type === "impression" ? toNumber(record.impressions) + 1 : toNumber(record.impressions);
    const nextClicks =
      type === "click" ? toNumber(record.clicks) + 1 : toNumber(record.clicks);
    const nextRevenue =
      type === "click" ? toNumber(record.revenue) + 0.5 : toNumber(record.revenue);

    await db.collection("ads").doc(docId).update({
      impressions: nextImpressions,
      clicks: nextClicks,
      revenue: nextRevenue,
      updated_at: nowIso,
    });

    try {
      await db.collection("ad_stats").add({
        ad_id: docId,
        type,
        action: type === "click" ? "ad_click" : "ad_impression",
        date: today,
        impressions: type === "impression" ? 1 : 0,
        clicks: type === "click" ? 1 : 0,
        revenue: type === "click" ? 0.5 : 0,
        ip_address: ipAddress || "unknown",
        user_agent: userAgent || "unknown",
        created_at: nowIso,
        updated_at: nowIso,
      });
    } catch {
      // Best effort only.
    }

    return;
  }

  const supabase = getSupabaseAdmin();
  const adsTable = supabase.from("ads" as any) as any;
  const adStatsTable = supabase.from("ad_stats" as any) as any;

  const { data: adRaw, error: adError } = await adsTable
    .select("id, impressions, clicks, revenue")
    .eq("id", adId)
    .maybeSingle();
  const ad = (adRaw || null) as Record<string, unknown> | null;

  if (adError) {
    throw adError;
  }
  if (!ad) {
    throw new AdNotFoundError();
  }

  const nextImpressions = type === "impression" ? toNumber(ad.impressions) + 1 : toNumber(ad.impressions);
  const nextClicks = type === "click" ? toNumber(ad.clicks) + 1 : toNumber(ad.clicks);
  const nextRevenue = type === "click" ? toNumber(ad.revenue) + 0.5 : toNumber(ad.revenue);

  const { error: updateError } = await adsTable
    .update({
      impressions: nextImpressions,
      clicks: nextClicks,
      revenue: nextRevenue,
      updated_at: nowIso,
    })
    .eq("id", adId);

  if (updateError) {
    throw updateError;
  }

  try {
    await adStatsTable.insert({
      ad_id: adId,
      date: today,
      impressions: type === "impression" ? 1 : 0,
      clicks: type === "click" ? 1 : 0,
      revenue: type === "click" ? 0.5 : 0,
    });
  } catch {
    // Best effort only.
  }
}
