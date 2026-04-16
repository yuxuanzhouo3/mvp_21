import { describe, expect, test } from "@jest/globals";
import { POST } from "@/app/api/auth/wechat/mini/route";

describe("wechat mini auth route", () => {
  test("returns decommissioned response", async () => {
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBe("WECHAT_AUTH_DECOMMISSIONED");
  });
});
