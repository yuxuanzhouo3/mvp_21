import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import { type UnifiedContractRecord } from "@/lib/data/unified-models";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import {
  type DashboardActivity,
  type DashboardBillingRecord,
  type DashboardBillingSummary,
  type DashboardOverviewData,
  type DashboardTeamMember,
  type DashboardTeamPermissions,
  type DashboardTemplate,
  type DashboardTemplatePermissions,
} from "@/lib/dashboard/types";
import { type DashboardCurrentUser } from "@/lib/dashboard/server-auth";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

import { getLatestSubscriptionByUser, listPaymentsByUser } from "@/lib/data/billing-store";
import { listContracts } from "@/lib/data/contracts-store";

const DEFAULT_TEMPLATE_SEED = [
  {
    name: "Service Agreement",
    description: "Standard service agreement for B2B transactions",
    category: "Business",
    content: "Service Agreement template content here...",
    is_public: true,
  },
  {
    name: "Non-Disclosure Agreement",
    description: "NDA for protecting confidential information",
    category: "Legal",
    content: "NDA template content here...",
    is_public: true,
  },
  {
    name: "Employment Contract",
    description: "Standard employment agreement template",
    category: "HR",
    content: "Employment Contract template content here...",
    is_public: true,
  },
  {
    name: "Partnership Agreement",
    description: "Template for business partnership agreements",
    category: "Business",
    content: "Partnership Agreement template content here...",
    is_public: true,
  },
] as const;

function toTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function extractPartyLabel(party: Record<string, unknown>) {
  const candidates = [
    party.name,
    party.fullName,
    party.company,
    party.companyName,
    party.company_name,
    party.email,
    party.role,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function calculatePeriodDelta(
  dates: string[],
  currentDays: number,
  previousDays: number = currentDays,
) {
  const now = Date.now();
  const currentStart = now - currentDays * 24 * 60 * 60 * 1000;
  const previousStart = currentStart - previousDays * 24 * 60 * 60 * 1000;

  let currentCount = 0;
  let previousCount = 0;

  for (const value of dates) {
    const time = toTimestamp(value);
    if (!time) {
      continue;
    }

    if (time >= currentStart) {
      currentCount += 1;
    } else if (time >= previousStart && time < currentStart) {
      previousCount += 1;
    }
  }

  return currentCount - previousCount;
}

function calculateSetDelta(
  values: Array<{ label: string; createdAt?: string }>,
  currentDays: number,
  previousDays: number = currentDays,
) {
  const now = Date.now();
  const currentStart = now - currentDays * 24 * 60 * 60 * 1000;
  const previousStart = currentStart - previousDays * 24 * 60 * 60 * 1000;

  const currentSet = new Set<string>();
  const previousSet = new Set<string>();

  for (const value of values) {
    const time = toTimestamp(value.createdAt);
    if (!time) {
      continue;
    }

    if (time >= currentStart) {
      currentSet.add(value.label);
    } else if (time >= previousStart && time < currentStart) {
      previousSet.add(value.label);
    }
  }

  return currentSet.size - previousSet.size;
}

function normalizeTemplateRecord(record: Record<string, any>): DashboardTemplate {
  const status =
    record.status === "draft" || record.status === "archived" || record.status === "active"
      ? record.status
      : record.is_public === false
        ? "archived"
        : "active";
  const version =
    typeof record.version === "number"
      ? record.version
      : Number(record.version || 1) || 1;
  const usageCount =
    typeof record.usage_count === "number"
      ? record.usage_count
      : typeof record.usageCount === "number"
        ? record.usageCount
        : Number(record.usage_count || record.usageCount || 0) || 0;

  return {
    id: String(record.id || record._id || ""),
    name: String(record.name || "Untitled Template"),
    description: String(record.description || ""),
    category: String(record.category || "General"),
    content: typeof record.content === "string" ? record.content : undefined,
    isPublic:
      typeof record.is_public === "boolean"
        ? record.is_public
        : typeof record.isPublic === "boolean"
          ? record.isPublic
          : true,
    userId:
      typeof record.user_id === "string"
        ? record.user_id
        : typeof record.userId === "string"
          ? record.userId
          : undefined,
    status,
    version: version > 0 ? version : 1,
    sourceTemplateId:
      typeof record.source_template_id === "string"
        ? record.source_template_id
        : typeof record.sourceTemplateId === "string"
          ? record.sourceTemplateId
          : undefined,
    usageCount,
    lastUsedAt:
      typeof record.last_used_at === "string"
        ? record.last_used_at
        : typeof record.lastUsedAt === "string"
          ? record.lastUsedAt
          : undefined,
    createdAt: record.created_at || record.createdAt,
    updatedAt: record.updated_at || record.updatedAt,
  };
}

function compareTemplates(left: DashboardTemplate, right: DashboardTemplate) {
  const statusOrder = { active: 0, draft: 1, archived: 2 };
  const statusCompare = statusOrder[left.status] - statusOrder[right.status];
  if (statusCompare !== 0) {
    return statusCompare;
  }

  const categoryCompare = left.category.localeCompare(right.category);
  if (categoryCompare !== 0) {
    return categoryCompare;
  }

  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  return right.version - left.version;
}

export function buildDashboardTemplatePermissions(): DashboardTemplatePermissions {
  return {
    canCreate: true,
    canEditOwned: true,
    canCreateVersion: true,
    canCopy: true,
  };
}

function sortTemplates(templates: DashboardTemplate[]) {
  return [...templates].sort(compareTemplates);
}

function getTemplateLineageRootId(template: DashboardTemplate) {
  return template.sourceTemplateId || template.id;
}

function buildInitials(name: string, email: string) {
  const source = (name || email || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function normalizeWorkspaceMember(record: Record<string, any>): DashboardTeamMember {
  const name =
    String(record.name || record.full_name || record.display_name || record.email || "Member");
  const email = String(record.email || "");
  const role =
    record.role === "owner" || record.role === "admin" || record.role === "member"
      ? record.role
      : "member";
  const status =
    record.status === "invited" || record.status === "suspended" ? record.status : "active";

  return {
    id: String(record.id || record._id || record.user_id || record.userId || email || name),
    userId:
      typeof record.user_id === "string"
        ? record.user_id
        : typeof record.userId === "string"
          ? record.userId
          : undefined,
    workspaceOwnerId:
      typeof record.workspace_owner_id === "string"
        ? record.workspace_owner_id
        : typeof record.workspaceOwnerId === "string"
          ? record.workspaceOwnerId
          : undefined,
    name,
    email,
    role,
    status,
    avatar:
      typeof record.avatar === "string"
        ? record.avatar
        : typeof record.avatar_url === "string"
          ? record.avatar_url
          : undefined,
    initials: buildInitials(name, email),
    joinedAt: record.joined_at || record.created_at || record.createdAt,
    lastActiveAt: record.last_active_at || record.lastActiveAt,
  };
}

async function listAllContractsForUser(userId: string): Promise<UnifiedContractRecord[]> {
  const batchSize = 200;
  const contracts: UnifiedContractRecord[] = [];
  let total = 0;
  let offset = 0;

  do {
    const result = await listContracts({
      userId,
      limit: batchSize,
      offset,
    });

    total = result.total;
    contracts.push(...result.contracts);
    offset += batchSize;
  } while (contracts.length < total);

  return contracts;
}

export async function getDashboardOverviewData(
  userId: string,
): Promise<DashboardOverviewData> {
  const contracts = await listAllContractsForUser(userId);
  const recentActivity: DashboardActivity[] = [];
  const createdDates: string[] = [];
  const pendingDates: string[] = [];
  const completedDates: string[] = [];
  const partyDates: Array<{ label: string; createdAt?: string }> = [];
  const currentParties = new Set<string>();

  for (const contract of contracts) {
    if (contract.createdAt) {
      createdDates.push(contract.createdAt);
      recentActivity.push({
        id: `${contract.id}-created`,
        type: "created",
        title: contract.title || "Untitled Contract",
        description: `Draft created for ${contract.title || "untitled contract"}`,
        createdAt: contract.createdAt,
        contractId: contract.id,
      });
    }

    for (const party of contract.parties) {
      const label = extractPartyLabel(party);
      if (!label) {
        continue;
      }

      currentParties.add(label);
      partyDates.push({
        label,
        createdAt: contract.updatedAt || contract.createdAt,
      });
    }

    const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
    if (
      contract.status === "pending" ||
      enhancement.signFlow.status === "awaiting_sender" ||
      enhancement.signFlow.status === "awaiting_counterparty"
    ) {
      pendingDates.push(contract.updatedAt || contract.createdAt || new Date().toISOString());
    }

    if (contract.status === "signed" || contract.status === "completed") {
      completedDates.push(
        enhancement.signFlow.completedAt ||
          contract.updatedAt ||
          contract.createdAt ||
          new Date().toISOString(),
      );
    }

    for (const log of enhancement.operationLogs) {
      const activityType =
        log.action === "sender_confirmed" ||
        log.action === "counterparty_confirmed" ||
        log.action === "final_copy_ready"
          ? "signed"
          : log.action === "signing_started" || log.action === "reminder_sent"
            ? "pending"
            : log.action === "archived" || log.action === "unarchived"
              ? "archived"
              : "updated";

      recentActivity.push({
        id: `${contract.id}-${log.id}`,
        type: activityType,
        title: contract.title || "Untitled Contract",
        description: log.description || log.label || "Contract updated",
        createdAt: log.createdAt,
        contractId: contract.id,
      });
    }
  }

  recentActivity.sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

  return {
    stats: {
      totalContracts: contracts.length,
      totalContractsDelta: calculatePeriodDelta(createdDates, 30),
      pendingSignatures: pendingDates.length,
      pendingSignaturesDelta: calculatePeriodDelta(pendingDates, 7),
      completedContracts: completedDates.length,
      completedContractsDelta: calculatePeriodDelta(completedDates, 30),
      activeParties: currentParties.size,
      activePartiesDelta: calculateSetDelta(partyDates, 30),
      lastUpdated: new Date().toISOString(),
    },
    recentActivity: recentActivity.slice(0, 10),
  };
}

async function seedDefaultTemplatesIfNeeded(userId: string) {
  if (isChinaRegion()) {
    const db = getDatabase();
    const collection = db.collection("contract_templates");

    try {
      const existing = await collection.limit(1).get();
      if (Array.isArray(existing.data) && existing.data.length > 0) {
        return;
      }
    } catch {
      // If the collection does not exist yet, fall through to seed it.
    }

    for (const template of DEFAULT_TEMPLATE_SEED) {
      await collection.add({
        ...template,
        user_id: userId,
        status: "active",
        version: 1,
        usage_count: 0,
        source_template_id: null,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("contract_templates")
    .select("id")
    .limit(1);

  if (error) {
    throw error;
  }

  if (Array.isArray(data) && data.length > 0) {
    return;
  }

  const { error: insertError } = await admin.from("contract_templates").insert(
    DEFAULT_TEMPLATE_SEED.map((template) => ({
      name: template.name,
      description: template.description,
      category: template.category,
      content: template.content,
      is_public: true,
      user_id: null,
      status: "active",
      version: 1,
      usage_count: 0,
      source_template_id: null,
      last_used_at: null,
    })),
  );

  if (insertError) {
    throw insertError;
  }
}

export async function listDashboardTemplates(userId: string): Promise<DashboardTemplate[]> {
  await seedDefaultTemplatesIfNeeded(userId);

  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("contract_templates").limit(200).get();
    const rows = Array.isArray(result.data) ? result.data : [];

    return sortTemplates(
      rows
      .map((row: Record<string, any>) => normalizeTemplateRecord(row))
      .filter((row: DashboardTemplate) => row.isPublic || row.userId === userId)
    );
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("contract_templates")
    .select("*")
    .or(`is_public.eq.true,user_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return sortTemplates(
    (data || []).map((row: Record<string, any>) => normalizeTemplateRecord(row)),
  );
}

export async function getDashboardTemplateById(
  userId: string,
  templateId: string,
): Promise<DashboardTemplate | null> {
  const templates = await listDashboardTemplates(userId);
  return templates.find((template) => template.id === templateId) || null;
}

interface DashboardTemplateInput {
  name: string;
  description?: string;
  category?: string;
  content: string;
  status?: DashboardTemplate["status"];
}

export async function createDashboardTemplate(
  userId: string,
  input: DashboardTemplateInput,
): Promise<DashboardTemplate> {
  const now = new Date().toISOString();
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || "",
    category: input.category?.trim() || "General",
    content: input.content,
    is_public: false,
    user_id: userId,
    status: input.status || "active",
    version: 1,
    usage_count: 0,
    source_template_id: null,
    last_used_at: null,
    created_at: now,
    updated_at: now,
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("contract_templates").add(payload);
    return normalizeTemplateRecord({
      ...payload,
      _id: result.id,
    });
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("contract_templates")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create template");
  }

  return normalizeTemplateRecord(data as Record<string, any>);
}

export async function updateDashboardTemplate(
  userId: string,
  templateId: string,
  input: Partial<DashboardTemplateInput> & {
    status?: DashboardTemplate["status"];
    usageCount?: number;
    lastUsedAt?: string | null;
  },
): Promise<DashboardTemplate> {
  const template = await getDashboardTemplateById(userId, templateId);
  if (!template) {
    throw new Error("Template not found");
  }

  if (template.userId !== userId) {
    throw new Error("TEMPLATE_WRITE_FORBIDDEN");
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof input.name === "string") payload.name = input.name.trim();
  if (typeof input.description === "string") payload.description = input.description.trim();
  if (typeof input.category === "string") payload.category = input.category.trim() || "General";
  if (typeof input.content === "string") payload.content = input.content;
  if (input.status) payload.status = input.status;
  if (typeof input.usageCount === "number") payload.usage_count = input.usageCount;
  if (input.lastUsedAt !== undefined) payload.last_used_at = input.lastUsedAt;

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("contract_templates").doc(templateId).update(payload);
    const updated = await getDashboardTemplateById(userId, templateId);
    if (!updated) {
      throw new Error("Template not found after update");
    }
    return updated;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("contract_templates")
    .update(payload)
    .eq("id", templateId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to update template");
  }

  return normalizeTemplateRecord(data as Record<string, any>);
}

export async function duplicateDashboardTemplate(
  userId: string,
  templateId: string,
): Promise<DashboardTemplate> {
  const source = await getDashboardTemplateById(userId, templateId);
  if (!source) {
    throw new Error("Template not found");
  }

  return createDashboardTemplate(userId, {
    name: `${source.name} Copy`,
    description: source.description,
    category: source.category,
    content: source.content || "",
    status: "draft",
  });
}

export async function createDashboardTemplateVersion(
  userId: string,
  templateId: string,
): Promise<DashboardTemplate> {
  const source = await getDashboardTemplateById(userId, templateId);
  if (!source) {
    throw new Error("Template not found");
  }

  if (source.userId !== userId) {
    throw new Error("TEMPLATE_WRITE_FORBIDDEN");
  }

  const templates = await listDashboardTemplates(userId);
  const lineageRootId = getTemplateLineageRootId(source);
  const nextVersion =
    templates
      .filter((template) => {
        const templateRootId = getTemplateLineageRootId(template);
        return template.id === lineageRootId || templateRootId === lineageRootId;
      })
      .reduce((maxVersion, template) => Math.max(maxVersion, template.version), 0) + 1;

  const now = new Date().toISOString();
  const payload = {
    name: source.name,
    description: source.description,
    category: source.category,
    content: source.content || "",
    is_public: false,
    user_id: userId,
    status: "draft" as const,
    version: nextVersion,
    usage_count: source.usageCount,
    source_template_id: lineageRootId,
    last_used_at: null,
    created_at: now,
    updated_at: now,
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("contract_templates").add(payload);
    return normalizeTemplateRecord({
      ...payload,
      _id: result.id,
    });
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("contract_templates")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create template version");
  }

  return normalizeTemplateRecord(data as Record<string, any>);
}

interface WorkspaceContext {
  workspaceOwnerId: string;
  currentRole: DashboardTeamMember["role"];
}

async function resolveWorkspaceContext(userId: string): Promise<WorkspaceContext> {
  if (isChinaRegion()) {
    const db = getDatabase();
    try {
      const membership = await db
        .collection("workspace_members")
        .where({ user_id: userId })
        .limit(1)
        .get();
      const row = membership.data?.[0] as Record<string, any> | undefined;
      if (row && typeof row.workspace_owner_id === "string" && row.workspace_owner_id.trim()) {
        return {
          workspaceOwnerId: row.workspace_owner_id,
          currentRole:
            row.role === "owner" || row.role === "admin" || row.role === "member"
              ? row.role
              : "member",
        };
      }
    } catch {
      return {
        workspaceOwnerId: userId,
        currentRole: "owner",
      };
    }

    return {
      workspaceOwnerId: userId,
      currentRole: "owner",
    };
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("workspace_members")
    .select("workspace_owner_id,role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.workspace_owner_id) {
    return {
      workspaceOwnerId: userId,
      currentRole: "owner",
    };
  }

  return {
    workspaceOwnerId: String(data.workspace_owner_id),
    currentRole:
      data.role === "owner" || data.role === "admin" || data.role === "member"
        ? data.role
        : "member",
  };
}

export function buildDashboardTeamPermissions(
  currentRole: DashboardTeamMember["role"],
): DashboardTeamPermissions {
  return {
    currentRole,
    canInvite: currentRole === "owner" || currentRole === "admin",
    canManageRoles: currentRole === "owner",
    canRemoveMembers: currentRole === "owner" || currentRole === "admin",
    canChangeStatus: currentRole === "owner" || currentRole === "admin",
  };
}

export async function listDashboardTeamMembers(
  currentUser: DashboardCurrentUser,
): Promise<{
  members: DashboardTeamMember[];
  permissions: DashboardTeamPermissions;
  workspaceOwnerId: string;
}> {
  const context = await resolveWorkspaceContext(currentUser.id);
  const { workspaceOwnerId, currentRole } = context;

  if (isChinaRegion()) {
    const db = getDatabase();

    try {
      const result = await db
        .collection("workspace_members")
        .where({ workspace_owner_id: workspaceOwnerId })
        .limit(200)
        .get();

      const rows = Array.isArray(result.data) ? result.data : [];
      if (rows.length > 0) {
        return {
          members: rows
          .map((row: Record<string, any>) => normalizeWorkspaceMember(row))
          .sort((left: DashboardTeamMember, right: DashboardTeamMember) => {
            const roleOrder = { owner: 0, admin: 1, member: 2 };
            return roleOrder[left.role] - roleOrder[right.role];
          }),
          permissions: buildDashboardTeamPermissions(currentRole),
          workspaceOwnerId,
        };
      }
    } catch {
      // Fall back to the current authenticated user below.
    }
  } else {
    const admin = getSupabaseAdmin() as any;
    const { data, error } = await admin
      .from("workspace_members")
      .select(
        "id,user_id,workspace_owner_id,name,email,role,status,avatar,joined_at,last_active_at,created_at",
      )
      .eq("workspace_owner_id", workspaceOwnerId)
      .order("created_at", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return {
        members: data
        .map((row: Record<string, any>) => normalizeWorkspaceMember(row))
        .sort((left: DashboardTeamMember, right: DashboardTeamMember) => {
          const roleOrder = { owner: 0, admin: 1, member: 2 };
          return roleOrder[left.role] - roleOrder[right.role];
        }),
        permissions: buildDashboardTeamPermissions(currentRole),
        workspaceOwnerId,
      };
    }
  }

  return {
    members: [
      {
        id: currentUser.id,
        userId: currentUser.id,
        workspaceOwnerId: currentUser.id,
        name: currentUser.name || currentUser.email,
        email: currentUser.email,
        role: "owner",
        status: "active",
        avatar: currentUser.avatar,
        initials: buildInitials(currentUser.name, currentUser.email),
        joinedAt: undefined,
        lastActiveAt: new Date().toISOString(),
      },
    ],
    permissions: buildDashboardTeamPermissions(currentRole),
    workspaceOwnerId,
  };
}

async function getWorkspaceMemberById(
  workspaceOwnerId: string,
  memberId: string,
): Promise<DashboardTeamMember | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("workspace_members")
      .where({
        workspace_owner_id: workspaceOwnerId,
        _id: memberId,
      })
      .limit(1)
      .get();
    const row = result.data?.[0] as Record<string, any> | undefined;
    return row ? normalizeWorkspaceMember(row) : null;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("workspace_members")
    .select("*")
    .eq("workspace_owner_id", workspaceOwnerId)
    .eq("id", memberId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeWorkspaceMember(data as Record<string, any>);
}

export async function inviteDashboardTeamMember(
  currentUser: DashboardCurrentUser,
  input: {
    email: string;
    name?: string;
    role?: DashboardTeamMember["role"];
  },
) {
  const context = await resolveWorkspaceContext(currentUser.id);
  const permissions = buildDashboardTeamPermissions(context.currentRole);
  if (!permissions.canInvite) {
    throw new Error("TEAM_INVITE_FORBIDDEN");
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error("TEAM_EMAIL_REQUIRED");
  }

  const role = input.role === "admin" || input.role === "member" ? input.role : "member";
  const now = new Date().toISOString();
  const payload = {
    workspace_owner_id: context.workspaceOwnerId,
    email,
    name: input.name?.trim() || email,
    role,
    status: "invited" as const,
    invited_by: currentUser.id,
    joined_at: now,
    updated_at: now,
    created_at: now,
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    const existing = await db
      .collection("workspace_members")
      .where({
        workspace_owner_id: context.workspaceOwnerId,
        email,
      })
      .limit(1)
      .get();

    const row = existing.data?.[0] as Record<string, any> | undefined;
    if (row?._id) {
      await db.collection("workspace_members").doc(String(row._id)).update({
        name: payload.name,
        role: payload.role,
        status: payload.status,
        invited_by: payload.invited_by,
        updated_at: payload.updated_at,
      });
    } else {
      await db.collection("workspace_members").add(payload);
    }
  } else {
    const admin = getSupabaseAdmin() as any;
    const { data: existing } = await admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_owner_id", context.workspaceOwnerId)
      .eq("email", email)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await admin
        .from("workspace_members")
        .update({
          name: payload.name,
          role: payload.role,
          status: payload.status,
          invited_by: payload.invited_by,
          updated_at: payload.updated_at,
        })
        .eq("id", existing.id);
      if (error) {
        throw error;
      }
    } else {
      const { error } = await admin.from("workspace_members").insert(payload);
      if (error) {
        throw error;
      }
    }
  }

  return listDashboardTeamMembers(currentUser);
}

export async function updateDashboardTeamMember(
  currentUser: DashboardCurrentUser,
  memberId: string,
  input: Partial<{
    role: DashboardTeamMember["role"];
    status: DashboardTeamMember["status"];
    name: string;
  }>,
) {
  const context = await resolveWorkspaceContext(currentUser.id);
  const permissions = buildDashboardTeamPermissions(context.currentRole);
  const member = await getWorkspaceMemberById(context.workspaceOwnerId, memberId);
  if (!member) {
    throw new Error("TEAM_MEMBER_NOT_FOUND");
  }

  if (member.role === "owner") {
    throw new Error("TEAM_OWNER_IMMUTABLE");
  }

  if (input.role && !permissions.canManageRoles) {
    throw new Error("TEAM_ROLE_FORBIDDEN");
  }

  if (input.status && !permissions.canChangeStatus) {
    throw new Error("TEAM_STATUS_FORBIDDEN");
  }

  if (context.currentRole === "admin" && member.role !== "member") {
    throw new Error("TEAM_MEMBER_PROTECTED");
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof input.name === "string") payload.name = input.name.trim();
  if (input.role) payload.role = input.role;
  if (input.status) payload.status = input.status;

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("workspace_members").doc(memberId).update(payload);
  } else {
    const admin = getSupabaseAdmin() as any;
    const { error } = await admin
      .from("workspace_members")
      .update(payload)
      .eq("id", memberId)
      .eq("workspace_owner_id", context.workspaceOwnerId);
    if (error) {
      throw error;
    }
  }

  return listDashboardTeamMembers(currentUser);
}

export async function removeDashboardTeamMember(
  currentUser: DashboardCurrentUser,
  memberId: string,
) {
  const context = await resolveWorkspaceContext(currentUser.id);
  const permissions = buildDashboardTeamPermissions(context.currentRole);
  if (!permissions.canRemoveMembers) {
    throw new Error("TEAM_REMOVE_FORBIDDEN");
  }

  const member = await getWorkspaceMemberById(context.workspaceOwnerId, memberId);
  if (!member) {
    throw new Error("TEAM_MEMBER_NOT_FOUND");
  }

  if (member.role === "owner") {
    throw new Error("TEAM_OWNER_IMMUTABLE");
  }

  if (context.currentRole === "admin" && member.role !== "member") {
    throw new Error("TEAM_MEMBER_PROTECTED");
  }

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("workspace_members").doc(memberId).remove();
  } else {
    const admin = getSupabaseAdmin() as any;
    const { error } = await admin
      .from("workspace_members")
      .delete()
      .eq("id", memberId)
      .eq("workspace_owner_id", context.workspaceOwnerId);
    if (error) {
      throw error;
    }
  }

  return listDashboardTeamMembers(currentUser);
}

function normalizePaymentMethodLabel(method: string) {
  switch (method.toLowerCase()) {
    case "stripe":
      return "Stripe";
    case "paypal":
      return "PayPal";
    case "wechat":
      return "WeChat Pay";
    case "alipay":
      return "Alipay";
    case "manual":
      return "Manual";
    default:
      return method || "Unknown";
  }
}

export async function getDashboardBillingSummary(
  currentUser: DashboardCurrentUser,
): Promise<DashboardBillingSummary> {
  const [subscription, paymentResult] = await Promise.all([
    getLatestSubscriptionByUser(currentUser.id),
    listPaymentsByUser({ userId: currentUser.id, limit: 10, offset: 0 }),
  ]);

  const recentPayments: DashboardBillingRecord[] = paymentResult.payments.map((payment) => ({
    id: payment.id,
    date: payment.createdAt,
    amount: payment.amount,
    currency: payment.currency || "USD",
    status:
      payment.status === "completed"
        ? "paid"
        : payment.status === "refunded"
          ? "refunded"
          : payment.status === "failed"
            ? "failed"
            : "pending",
    description:
      typeof payment.metadata?.description === "string"
        ? payment.metadata.description
        : "Subscription payment",
    paymentMethod: normalizePaymentMethodLabel(payment.paymentMethod),
    invoiceUrl: null,
  }));

  return {
    plan: subscription?.plan || currentUser.subscriptionPlan || "free",
    status: subscription?.status || currentUser.subscriptionStatus || "inactive",
    price: subscription?.price,
    currency: subscription?.currency || recentPayments[0]?.currency || "USD",
    billingCycle: subscription?.billingCycle,
    paymentMethod: subscription?.paymentMethod,
    membershipExpiresAt:
      subscription?.currentPeriodEnd || currentUser.membershipExpiresAt,
    totalPayments: paymentResult.total,
    totalSpent: paymentResult.payments.reduce((sum, payment) => {
      return payment.status === "completed" ? sum + payment.amount : sum;
    }, 0),
    lastPaymentAt: recentPayments[0]?.date,
    recentPayments,
  };
}
