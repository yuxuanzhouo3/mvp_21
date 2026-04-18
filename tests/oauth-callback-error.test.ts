import { describe, expect, test } from "@jest/globals";
import { readOAuthCallbackError } from "@/lib/auth/oauth-callback";

describe("oauth callback error parser", () => {
  test("returns decoded error description from hash fragment", () => {
    expect(
      readOAuthCallbackError(
        "#error=server_error&error_description=Provider%20is%20not%20enabled",
      ),
    ).toBe("Provider is not enabled");
  });

  test("falls back to error code when description is absent", () => {
    expect(readOAuthCallbackError("#error=access_denied")).toBe("access_denied");
  });

  test("returns undefined for empty fragments", () => {
    expect(readOAuthCallbackError("")).toBeUndefined();
    expect(readOAuthCallbackError("#")).toBeUndefined();
  });
});
