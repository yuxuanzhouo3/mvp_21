import { describe, expect, test } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";
import { csrfProtection } from "@/lib/security/csrf";

describe("csrfProtection server action compatibility", () => {
  test("allows Next.js server action posts without custom csrf token", async () => {
    const request = new NextRequest("https://example.com/admin/login", {
      method: "POST",
      headers: {
        "next-action": "test-action-id",
      },
    });
    const response = NextResponse.next();

    const result = await csrfProtection(request, response);

    expect(result.status).toBe(200);
  });

  test("still blocks normal non-api post without csrf token", async () => {
    const request = new NextRequest("https://example.com/admin/login", {
      method: "POST",
    });
    const response = NextResponse.next();

    const result = await csrfProtection(request, response);

    expect(result.status).toBe(403);
  });
});
