export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_REQUIREMENTS = [
  "at least 12 characters",
  "an uppercase letter",
  "a lowercase letter",
  "a number",
  "a symbol",
] as const;

export function passwordPolicyError(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return "Use at least 12 characters.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter.";
  if (!/\d/.test(password)) return "Add at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add at least one symbol.";
  return null;
}
