"use client";

import { tokenManager } from "@/lib/auth/frontend-token-manager";
import type {
  DashboardBillingSummary,
  DashboardOverviewData,
  DashboardTeamData,
  DashboardTeamMember,
  DashboardTemplatePermissions,
  DashboardTemplatesData,
  DashboardTemplate,
} from "@/lib/dashboard/types";

async function getAuthHeaders() {
  const headers = await tokenManager.getAuthHeaderAsync();
  if (!headers) {
    throw new Error("UNAUTHORIZED");
  }
  return headers;
}

async function fetchDashboardJson<T>(path: string): Promise<T> {
  return dashboardRequest<T>(path);
}

async function dashboardRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`DASHBOARD_FETCH_FAILED_${response.status}`);
  }

  const payload = await response.json();
  return payload.data as T;
}

export function getDashboardOverview() {
  return fetchDashboardJson<DashboardOverviewData>("/api/dashboard/overview");
}

export function getDashboardTemplates() {
  return fetchDashboardJson<DashboardTemplatesData>("/api/dashboard/templates");
}

export function getDashboardTeamMembers() {
  return fetchDashboardJson<DashboardTeamData>("/api/dashboard/team");
}

export function getDashboardBillingSummary() {
  return fetchDashboardJson<{ summary: DashboardBillingSummary }>("/api/dashboard/billing");
}

export function createDashboardTemplate(payload: {
  name: string;
  description?: string;
  category?: string;
  content: string;
}) {
  return dashboardRequest<{ template: DashboardTemplate; permissions: DashboardTemplatePermissions }>(
    "/api/dashboard/templates",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

export function updateDashboardTemplate(
  templateId: string,
  payload: Partial<{
    name: string;
    description: string;
    category: string;
    content: string;
    status: DashboardTemplate["status"];
    action: "duplicate" | "create_version" | "mark_used";
    usageCount: number;
    lastUsedAt: string | null;
  }>,
) {
  return dashboardRequest<{ template: DashboardTemplate }>(
    `/api/dashboard/templates/${templateId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

export function inviteDashboardTeamMember(payload: {
  email: string;
  name?: string;
  role?: DashboardTeamMember["role"];
}) {
  return dashboardRequest<DashboardTeamData>("/api/dashboard/team", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function updateDashboardTeamMember(
  memberId: string,
  payload: Partial<{
    role: DashboardTeamMember["role"];
    status: DashboardTeamMember["status"];
    name: string;
  }>,
) {
  return dashboardRequest<DashboardTeamData>(`/api/dashboard/team/${memberId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function removeDashboardTeamMember(memberId: string) {
  return dashboardRequest<DashboardTeamData>(`/api/dashboard/team/${memberId}`, {
    method: "DELETE",
  });
}
