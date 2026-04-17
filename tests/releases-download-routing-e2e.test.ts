import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

import type { AppRelease, CreateReleaseData } from "@/lib/admin/types";

let releaseSeq = 1;
let releasesStore: AppRelease[] = [];

const mockAdapter = {
  listReleases: jest.fn(async () => [...releasesStore].sort((a, b) => b.created_at.localeCompare(a.created_at))),
  createRelease: jest.fn(async (data: CreateReleaseData) => {
    const id = `release_${releaseSeq++}`;
    const createdAt = new Date(Date.UTC(2026, 3, 1, 0, releaseSeq)).toISOString();
    const release: AppRelease = {
      id,
      version: data.version,
      platform: data.platform,
      variant: data.variant,
      file_url: data.file_url,
      file_name: data.file_name,
      file_size: data.file_size,
      release_notes: data.release_notes,
      is_active: data.is_active,
      is_mandatory: data.is_mandatory,
      created_at: createdAt,
    };
    releasesStore.push(release);
    return release;
  }),
  updateRelease: jest.fn(async (id: string, data: Partial<CreateReleaseData>) => {
    const index = releasesStore.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error(`Release not found: ${id}`);
    }

    const current = releasesStore[index]!;
    const next: AppRelease = {
      ...current,
      ...(data.version !== undefined ? { version: data.version } : {}),
      ...(data.platform !== undefined ? { platform: data.platform } : {}),
      ...(data.variant !== undefined ? { variant: data.variant } : {}),
      ...(data.file_url !== undefined ? { file_url: data.file_url } : {}),
      ...(data.file_name !== undefined ? { file_name: data.file_name } : {}),
      ...(data.file_size !== undefined ? { file_size: data.file_size } : {}),
      ...(data.release_notes !== undefined ? { release_notes: data.release_notes } : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      ...(data.is_mandatory !== undefined ? { is_mandatory: data.is_mandatory } : {}),
    };
    releasesStore[index] = next;
    return next;
  }),
  toggleReleaseStatus: jest.fn(async (id: string, isActive: boolean) => {
    return mockAdapter.updateRelease(id, { is_active: isActive });
  }),
  deleteRelease: jest.fn(async (id: string) => {
    releasesStore = releasesStore.filter((item) => item.id !== id);
  }),
};

jest.mock("@/lib/admin/database", () => ({
  getDatabaseAdapter: () => mockAdapter,
}));

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => false,
}));

import { createRelease, listReleases } from "@/actions/admin-releases";
import { GET as downloadGet } from "@/app/api/downloads/route";

function buildReleaseFormData(input: {
  version: string;
  platform: string;
  variant?: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  releaseNotes?: string;
  isActive?: boolean;
  isMandatory?: boolean;
}) {
  const formData = new FormData();
  formData.append("version", input.version);
  formData.append("platform", input.platform);
  if (input.variant) {
    formData.append("variant", input.variant);
  }
  formData.append("fileUrl", input.fileUrl);
  formData.append("fileName", input.fileName);
  formData.append("fileSize", String(input.fileSize));
  formData.append("releaseNotes", input.releaseNotes || "");
  formData.append("isActive", String(input.isActive ?? true));
  formData.append("isMandatory", String(input.isMandatory ?? false));
  return formData;
}

describe("releases -> downloads routing e2e", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    releasesStore = [];
    releaseSeq = 1;
  });

  test("release management created variants are listed on catalog and routed by exact platform+variant", async () => {
    await createRelease(
      buildReleaseFormData({
        version: "3.2.1",
        platform: "windows",
        variant: "x64",
        fileUrl: "https://cdn.example.com/releases/windows-x64-3.2.1.exe",
        fileName: "windows-x64-3.2.1.exe",
        fileSize: 123456789,
        releaseNotes: "Windows x64 build",
      }),
    );

    await createRelease(
      buildReleaseFormData({
        version: "3.2.1",
        platform: "windows",
        variant: "x86",
        fileUrl: "https://cdn.example.com/releases/windows-x86-3.2.1.exe",
        fileName: "windows-x86-3.2.1.exe",
        fileSize: 120000000,
        releaseNotes: "Windows x86 build",
      }),
    );

    const catalogResponse = await downloadGet(
      new NextRequest("http://localhost/api/downloads?catalog=1", { method: "GET" }),
    );
    const catalogPayload = (await catalogResponse.json()) as {
      downloads: Array<{ platform: string; variant?: string; href: string }>;
    };

    expect(catalogResponse.status).toBe(200);
    expect(catalogPayload.downloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: "windows",
          variant: "x64",
          href: expect.stringContaining("platform=windows"),
        }),
        expect.objectContaining({
          platform: "windows",
          variant: "x86",
          href: expect.stringContaining("variant=x86"),
        }),
      ]),
    );

    const x64Response = await downloadGet(
      new NextRequest("http://localhost/api/downloads?platform=windows&variant=x64", {
        method: "GET",
      }),
    );
    expect(x64Response.status).toBe(302);
    expect(x64Response.headers.get("location")).toBe(
      "https://cdn.example.com/releases/windows-x64-3.2.1.exe",
    );

    const x86Response = await downloadGet(
      new NextRequest("http://localhost/api/downloads?platform=windows&variant=x86", {
        method: "GET",
      }),
    );
    expect(x86Response.status).toBe(302);
    expect(x86Response.headers.get("location")).toBe(
      "https://cdn.example.com/releases/windows-x86-3.2.1.exe",
    );
  });

  test("same platform+variant keeps only latest active release and download route hits latest one", async () => {
    await createRelease(
      buildReleaseFormData({
        version: "4.0.0",
        platform: "windows",
        variant: "x64",
        fileUrl: "https://cdn.example.com/releases/windows-x64-4.0.0.exe",
        fileName: "windows-x64-4.0.0.exe",
        fileSize: 200000000,
      }),
    );

    await createRelease(
      buildReleaseFormData({
        version: "4.0.1",
        platform: "windows",
        variant: "x64",
        fileUrl: "https://cdn.example.com/releases/windows-x64-4.0.1.exe",
        fileName: "windows-x64-4.0.1.exe",
        fileSize: 210000000,
      }),
    );

    const listResult = await listReleases();
    expect(listResult.success).toBe(true);
    const releases = listResult.success ? listResult.data || [] : [];
    const x64Active = releases.filter(
      (item) => item.platform === "windows" && item.variant === "x64" && item.is_active,
    );
    expect(x64Active).toHaveLength(1);
    expect(x64Active[0]?.version).toBe("4.0.1");

    const routeResponse = await downloadGet(
      new NextRequest("http://localhost/api/downloads?platform=windows&variant=x64", {
        method: "GET",
      }),
    );

    expect(routeResponse.status).toBe(302);
    expect(routeResponse.headers.get("location")).toBe(
      "https://cdn.example.com/releases/windows-x64-4.0.1.exe",
    );
  });

  test("invalid variant is rejected for platform mismatch", async () => {
    await createRelease(
      buildReleaseFormData({
        version: "1.0.0",
        platform: "android",
        fileUrl: "https://cdn.example.com/releases/android-1.0.0.apk",
        fileName: "android-1.0.0.apk",
        fileSize: 50000000,
      }),
    );

    const response = await downloadGet(
      new NextRequest("http://localhost/api/downloads?platform=android&variant=x64", {
        method: "GET",
      }),
    );
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Invalid variant for this platform.");
  });

  test("explicit variant does not fallback to generic platform download", async () => {
    const previousIntlWindowsUrl = process.env.INTL_WINDOWS_URL;
    process.env.INTL_WINDOWS_URL = "https://cdn.example.com/releases/windows-generic-latest.exe";

    try {
      await createRelease(
        buildReleaseFormData({
          version: "2.1.0",
          platform: "windows",
          variant: "x64",
          fileUrl: "https://cdn.example.com/releases/windows-x64-2.1.0.exe",
          fileName: "windows-x64-2.1.0.exe",
          fileSize: 180000000,
        }),
      );

      const response = await downloadGet(
        new NextRequest("http://localhost/api/downloads?platform=windows&variant=x86", {
          method: "GET",
        }),
      );
      const payload = (await response.json()) as { success: boolean; error: string };

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe("Requested variant is unavailable for this platform.");
    } finally {
      if (typeof previousIntlWindowsUrl === "string") {
        process.env.INTL_WINDOWS_URL = previousIntlWindowsUrl;
      } else {
        delete process.env.INTL_WINDOWS_URL;
      }
    }
  });

  test("variant lookup remains case-insensitive for managed release records", async () => {
    await createRelease(
      buildReleaseFormData({
        version: "6.0.0",
        platform: "windows",
        variant: "x64",
        fileUrl: "https://cdn.example.com/releases/windows-x64-6.0.0.exe",
        fileName: "windows-x64-6.0.0.exe",
        fileSize: 240000000,
      }),
    );

    releasesStore[0] = {
      ...releasesStore[0],
      variant: "X64" as unknown as Variant,
    };

    const response = await downloadGet(
      new NextRequest("http://localhost/api/downloads?platform=windows&variant=x64", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://cdn.example.com/releases/windows-x64-6.0.0.exe",
    );
  });

  test("downloads route avoids 500 when managed release query fails", async () => {
    mockAdapter.listReleases.mockImplementationOnce(async () => {
      throw new Error("DB_UNAVAILABLE");
    });

    const response = await downloadGet(
      new NextRequest("http://localhost/api/downloads?platform=windows&variant=x64", {
        method: "GET",
      }),
    );
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe("Requested variant is unavailable for this platform.");
  });

  test("default platform download selects variant by user agent preference", async () => {
    await createRelease(
      buildReleaseFormData({
        version: "5.0.0",
        platform: "windows",
        variant: "arm64",
        fileUrl: "https://cdn.example.com/releases/windows-arm64-5.0.0.exe",
        fileName: "windows-arm64-5.0.0.exe",
        fileSize: 210000000,
      }),
    );
    await createRelease(
      buildReleaseFormData({
        version: "5.0.1",
        platform: "windows",
        variant: "x86",
        fileUrl: "https://cdn.example.com/releases/windows-x86-5.0.1.exe",
        fileName: "windows-x86-5.0.1.exe",
        fileSize: 220000000,
      }),
    );
    await createRelease(
      buildReleaseFormData({
        version: "5.0.2",
        platform: "windows",
        variant: "x64",
        fileUrl: "https://cdn.example.com/releases/windows-x64-5.0.2.exe",
        fileName: "windows-x64-5.0.2.exe",
        fileSize: 230000000,
      }),
    );

    const x64Response = await downloadGet(
      new NextRequest("http://localhost/api/downloads?platform=windows", {
        method: "GET",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }),
    );
    expect(x64Response.status).toBe(302);
    expect(x64Response.headers.get("location")).toBe(
      "https://cdn.example.com/releases/windows-x64-5.0.2.exe",
    );

    const armResponse = await downloadGet(
      new NextRequest("http://localhost/api/downloads?platform=windows", {
        method: "GET",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; ARM64) AppleWebKit/537.36",
        },
      }),
    );
    expect(armResponse.status).toBe(302);
    expect(armResponse.headers.get("location")).toBe(
      "https://cdn.example.com/releases/windows-arm64-5.0.0.exe",
    );
  });
});
