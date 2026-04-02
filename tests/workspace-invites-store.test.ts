import { describe, expect, test } from "@jest/globals";

import {
  buildWorkspaceInviteUrl,
  isWorkspaceInviteExpired,
  normalizeWorkspaceInviteRecord,
} from "@/lib/data/workspace-invites-store";

describe("workspace invite store helpers", () => {
  test("buildWorkspaceInviteUrl trims trailing slash and appends the invite route", () => {
    expect(buildWorkspaceInviteUrl("https://example.com/", "invite-token")).toBe(
      "https://example.com/invite/workspace/invite-token",
    );
  });

  test("isWorkspaceInviteExpired only expires pending invites whose deadline has passed", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();

    expect(isWorkspaceInviteExpired({ status: "pending", expiresAt: past })).toBe(true);
    expect(isWorkspaceInviteExpired({ status: "pending", expiresAt: future })).toBe(false);
    expect(isWorkspaceInviteExpired({ status: "accepted", expiresAt: past })).toBe(false);
    expect(isWorkspaceInviteExpired({ status: "revoked", expiresAt: past })).toBe(false);
  });

  test("normalizeWorkspaceInviteRecord exposes invite url and converts expired records", () => {
    const record = normalizeWorkspaceInviteRecord(
      {
        id: "invite-1",
        workspace_owner_id: "owner-1",
        member_id: "member-1",
        email: "Member@Example.com",
        name: "Member Example",
        role: "admin",
        status: "pending",
        token: "token-123",
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        access_count: 3,
        last_accessed_at: "2026-04-01T10:00:00.000Z",
        created_at: "2026-04-01T09:00:00.000Z",
        updated_at: "2026-04-01T10:00:00.000Z",
      },
      "https://app.example.com",
    );

    expect(record.id).toBe("invite-1");
    expect(record.memberId).toBe("member-1");
    expect(record.email).toBe("Member@Example.com");
    expect(record.role).toBe("admin");
    expect(record.status).toBe("expired");
    expect(record.accessCount).toBe(3);
    expect(record.inviteUrl).toBe("https://app.example.com/invite/workspace/token-123");
  });
});
