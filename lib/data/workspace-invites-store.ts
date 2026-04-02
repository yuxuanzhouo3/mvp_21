import { randomBytes } from "node:crypto";

import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import type { DashboardTeamInvite } from "@/lib/dashboard/types";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildWorkspaceInviteUrl(origin: string | undefined, token: string) {
  const base =
    origin ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invite/workspace/${token}`;
}

export function isWorkspaceInviteExpired(
  invite?: Pick<DashboardTeamInvite, "expiresAt" | "status"> | null,
) {
  if (!invite || invite.status === "accepted" || invite.status === "revoked") {
    return false;
  }

  if (!invite.expiresAt) {
    return false;
  }

  const expiresAt = new Date(invite.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

export function normalizeWorkspaceInviteRecord(
  record: Record<string, any>,
  origin?: string,
): DashboardTeamInvite {
  const invite: DashboardTeamInvite = {
    id: String(record.id || record._id || ""),
    memberId: readString(record.member_id || record.memberId) || undefined,
    workspaceOwnerId: String(record.workspace_owner_id || record.workspaceOwnerId || ""),
    email: readString(record.email),
    name: readString(record.name) || undefined,
    role:
      record.role === "owner" || record.role === "admin" || record.role === "member"
        ? record.role
        : "member",
    status:
      record.status === "accepted" ||
      record.status === "revoked" ||
      record.status === "expired"
        ? record.status
        : "pending",
    inviteUrl:
      readString(record.token) && record.status !== "revoked"
        ? buildWorkspaceInviteUrl(origin, readString(record.token))
        : undefined,
    expiresAt: readString(record.expires_at || record.expiresAt) || undefined,
    accessCount:
      typeof record.access_count === "number"
        ? record.access_count
        : typeof record.accessCount === "number"
          ? record.accessCount
          : Number(record.access_count || record.accessCount || 0) || 0,
    invitedBy: readString(record.invited_by || record.invitedBy) || undefined,
    acceptedByUserId:
      readString(record.accepted_by_user_id || record.acceptedByUserId) || undefined,
    acceptedAt: readString(record.accepted_at || record.acceptedAt) || undefined,
    revokedAt: readString(record.revoked_at || record.revokedAt) || undefined,
    lastAccessedAt:
      readString(record.last_accessed_at || record.lastAccessedAt) || undefined,
    createdAt: readString(record.created_at || record.createdAt) || undefined,
    updatedAt: readString(record.updated_at || record.updatedAt) || undefined,
  };

  if (isWorkspaceInviteExpired(invite)) {
    return {
      ...invite,
      status: "expired",
    };
  }

  return invite;
}

function createInviteToken() {
  return randomBytes(18).toString("hex");
}

export async function listWorkspaceInvitesByOwner(
  workspaceOwnerId: string,
  origin?: string,
): Promise<DashboardTeamInvite[]> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("workspace_invites")
      .where({ workspace_owner_id: workspaceOwnerId })
      .orderBy("created_at", "desc")
      .limit(200)
      .get();

    return (Array.isArray(result.data) ? result.data : []).map((record: Record<string, any>) =>
      normalizeWorkspaceInviteRecord(record, origin),
    );
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("workspace_invites")
    .select("*")
    .eq("workspace_owner_id", workspaceOwnerId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  return (data || []).map((record: Record<string, any>) =>
    normalizeWorkspaceInviteRecord(record, origin),
  );
}

export async function getWorkspaceInviteByToken(
  token: string,
  origin?: string,
): Promise<DashboardTeamInvite | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("workspace_invites")
      .where({ token })
      .limit(1)
      .get();
    const row = result.data?.[0] as Record<string, any> | undefined;
    return row ? normalizeWorkspaceInviteRecord(row, origin) : null;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("workspace_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeWorkspaceInviteRecord(data as Record<string, any>, origin);
}

export async function createWorkspaceInvite(input: {
  workspaceOwnerId: string;
  memberId?: string;
  email: string;
  name?: string;
  role: DashboardTeamInvite["role"];
  invitedBy: string;
  expiresAt?: string | null;
  origin?: string;
}) {
  const now = new Date().toISOString();
  const payload = {
    workspace_owner_id: input.workspaceOwnerId,
    member_id: input.memberId || null,
    email: input.email.trim().toLowerCase(),
    name: input.name?.trim() || "",
    role: input.role,
    invited_by: input.invitedBy,
    token: createInviteToken(),
    status: "pending",
    expires_at: input.expiresAt || null,
    accepted_at: null,
    accepted_by_user_id: null,
    revoked_at: null,
    access_count: 0,
    last_accessed_at: null,
    created_at: now,
    updated_at: now,
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("workspace_invites").add(payload);
    return normalizeWorkspaceInviteRecord(
      {
        ...payload,
        _id: result.id,
      },
      input.origin,
    );
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("workspace_invites")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create workspace invite");
  }

  return normalizeWorkspaceInviteRecord(data as Record<string, any>, input.origin);
}

export async function updateWorkspaceInvite(
  inviteId: string,
  payload: Record<string, unknown>,
  origin?: string,
) {
  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("workspace_invites").doc(inviteId).update(payload);
    const result = await db.collection("workspace_invites").doc(inviteId).get();
    const row = result.data?.[0] as Record<string, any> | undefined;
    return row ? normalizeWorkspaceInviteRecord(row, origin) : null;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("workspace_invites")
    .update(payload)
    .eq("id", inviteId)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to update workspace invite");
  }

  return normalizeWorkspaceInviteRecord(data as Record<string, any>, origin);
}

export async function incrementWorkspaceInviteAccess(
  invite: DashboardTeamInvite,
  origin?: string,
) {
  return updateWorkspaceInvite(
    invite.id,
    {
      access_count: invite.accessCount + 1,
      last_accessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    origin,
  );
}

export async function revokeWorkspaceInvitesForMember(input: {
  workspaceOwnerId: string;
  memberId?: string;
  email?: string;
}) {
  const invites = await listWorkspaceInvitesByOwner(input.workspaceOwnerId);
  const matched = invites.filter((invite) => {
    if (invite.status !== "pending") {
      return false;
    }

    if (input.memberId && invite.memberId === input.memberId) {
      return true;
    }

    return Boolean(
      input.email &&
        invite.email.toLowerCase() === input.email.trim().toLowerCase(),
    );
  });

  await Promise.all(
    matched.map((invite) =>
      updateWorkspaceInvite(invite.id, {
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    ),
  );
}
