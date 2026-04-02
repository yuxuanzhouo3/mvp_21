"use client";

import { tokenManager } from "@/lib/auth/frontend-token-manager";
import type {
  DashboardBillingSummary,
  DashboardDocumentVerificationData,
  DashboardDocumentsData,
  DashboardOverviewData,
  DashboardTeamData,
  DashboardTeamInviteAcceptResult,
  DashboardTeamInvitePreview,
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

async function readResponseError(
  response: Response,
  fallback: string,
): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      const message = payload?.error?.message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    } catch {
      // Ignore malformed payloads and fall back to the default message.
    }
  }

  return fallback;
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
    throw new Error(await readResponseError(response, `DASHBOARD_FETCH_FAILED_${response.status}`));
  }

  const payload = await response.json();
  return payload.data as T;
}

async function downloadAuthenticatedFile(path: string, fallback: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(path, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readResponseError(response, `DASHBOARD_FETCH_FAILED_${response.status}`));
  }

  const blob = await response.blob();
  const fileName = getDownloadFileName(response.headers.get("content-disposition"), fallback);
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

async function downloadPublicFile(path: string, fallback: string) {
  const response = await fetch(path, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readResponseError(response, `DASHBOARD_FETCH_FAILED_${response.status}`));
  }

  const blob = await response.blob();
  const fileName = getDownloadFileName(response.headers.get("content-disposition"), fallback);
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

function getDownloadFileName(disposition: string | null, fallback: string) {
  if (!disposition) {
    return fallback;
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = disposition.match(/filename="([^"]+)"/i);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }

  return fallback;
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

export function getDashboardDocuments() {
  return fetchDashboardJson<DashboardDocumentsData>("/api/dashboard/documents");
}

export function getDashboardDocumentVerification(documentId: string) {
  return fetchDashboardJson<DashboardDocumentVerificationData>(
    `/api/dashboard/documents/${documentId}/verify`,
  );
}

export async function downloadDashboardDocumentCertificate(documentId: string): Promise<void> {
  await downloadAuthenticatedFile(
    `/api/dashboard/documents/${documentId}/certificate`,
    `document-certificate-${documentId}.md`,
  );
}

export async function uploadDashboardDocument(payload: {
  file: File;
  title?: string;
  category?: string;
  groupName?: string;
  tags?: string;
}) {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.set("file", payload.file);

  if (payload.title) {
    formData.set("title", payload.title);
  }

  if (payload.category) {
    formData.set("category", payload.category);
  }

  if (payload.groupName) {
    formData.set("groupName", payload.groupName);
  }

  if (payload.tags) {
    formData.set("tags", payload.tags);
  }

  const response = await fetch("/api/dashboard/documents", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readResponseError(response, `DASHBOARD_FETCH_FAILED_${response.status}`));
  }

  const result = await response.json();
  return result.data as { document: Record<string, unknown> };
}

export async function downloadDashboardDocument(documentId: string): Promise<void> {
  await downloadAuthenticatedFile(
    `/api/dashboard/documents/${documentId}/download`,
    `document-${documentId.replace(/[:/\\]/g, "-")}`,
  );
}

export async function createDashboardDocumentShare(
  documentId: string,
  payload?: {
    expiresAt?: string | null;
    expiresInDays?: number | null;
  },
) {
  return dashboardRequest<{ shareUrl: string; expiresAt?: string; accessCount: number }>(
    `/api/dashboard/documents/${documentId}/share`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    },
  );
}

export async function revokeDashboardDocumentShare(documentId: string) {
  return dashboardRequest<{ revoked: boolean }>(`/api/dashboard/documents/${documentId}/share`, {
    method: "DELETE",
  });
}

export async function updateDashboardDocument(
  documentId: string,
  payload: {
    title?: string;
    category?: string;
    groupName?: string;
    tags?: string[];
  },
) {
  return dashboardRequest<{ document: Record<string, unknown> }>(
    `/api/dashboard/documents/${documentId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteDashboardDocument(documentId: string) {
  return dashboardRequest<{ id: string }>(`/api/dashboard/documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function batchUpdateDashboardDocumentTags(payload: {
  documentIds: string[];
  tags: string[];
  mode: "add" | "replace" | "remove";
}) {
  return dashboardRequest<{ documents: Record<string, unknown>[] }>("/api/dashboard/documents", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "batch_tags",
      documentIds: payload.documentIds,
      tags: payload.tags,
      mode: payload.mode,
    }),
  });
}

export async function batchOrganizeDashboardDocuments(payload: {
  documentIds: string[];
  category?: string;
  groupName?: string;
}) {
  return dashboardRequest<{ documents: Record<string, unknown>[] }>("/api/dashboard/documents", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "batch_organize",
      documentIds: payload.documentIds,
      category: payload.category,
      groupName: payload.groupName,
    }),
  });
}

export async function getPublicDashboardDocumentVerification(token: string) {
  const response = await fetch(`/api/public/documents/${token}/verify`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readResponseError(response, `DASHBOARD_FETCH_FAILED_${response.status}`));
  }

  const payload = await response.json();
  return payload.data as DashboardDocumentVerificationData;
}

export async function downloadPublicDashboardDocumentCertificate(token: string): Promise<void> {
  await downloadPublicFile(
    `/api/public/documents/${token}/certificate`,
    `shared-document-certificate-${token}.md`,
  );
}

export async function getPublicDashboardTeamInvite(token: string) {
  const response = await fetch(`/api/public/team-invites/${token}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readResponseError(response, `DASHBOARD_FETCH_FAILED_${response.status}`));
  }

  const payload = await response.json();
  return payload.data as DashboardTeamInvitePreview;
}

export function acceptDashboardTeamInvite(token: string) {
  return dashboardRequest<DashboardTeamInviteAcceptResult>(`/api/team-invites/${token}/accept`, {
    method: "POST",
  });
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
