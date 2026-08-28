import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, passwordPolicyError } from "./auth-password";

describe("account password policy", () => {
  it("requires a 12-character mixed password", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(passwordPolicyError("Short1!a")).toBe("Use at least 12 characters.");
    expect(passwordPolicyError("lowercaseonly1!")).toBe("Add at least one uppercase letter.");
    expect(passwordPolicyError("UPPERCASEONLY1!")).toBe("Add at least one lowercase letter.");
    expect(passwordPolicyError("MixedCaseOnly!")).toBe("Add at least one number.");
    expect(passwordPolicyError("MixedCaseOnly1")).toBe("Add at least one symbol.");
    expect(passwordPolicyError("StrongPassword1!")).toBeNull();
  });
});
