const PORTAL_PATH = /^\/portal(?:\/|\?|#|$)/;

export function safePortalRedirect(value: string | null | undefined) {
  if (!value || !PORTAL_PATH.test(value) || value.startsWith("//") || value.includes("\\")) {
    return "/portal";
  }
  try {
    const parsed = new URL(value, "https://mortgagemates.invalid");
    if (
      parsed.origin !== "https://mortgagemates.invalid"
      || !PORTAL_PATH.test(parsed.pathname)
      || parsed.pathname.startsWith("//")
      || parsed.pathname.includes("\\")
    ) return "/portal";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/portal";
  }
}
