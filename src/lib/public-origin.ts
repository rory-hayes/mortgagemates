export function normalizePublicSiteOrigin(configured: string | undefined) {
  if (!configured) throw new Error("NEXT_PUBLIC_SITE_URL is required.");
  const url = new URL(configured);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isIpLiteral = hostname.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const isNonPublicHost = hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".")
    || isIpLiteral;
  if (
    url.protocol !== "https:"
    || isNonPublicHost
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a public HTTPS origin.");
  }
  return url.origin;
}

export function resolvePublicRequestOrigin(
  configured: string | undefined,
  requestOrigin: string,
  vercelDeploymentHost: string | undefined,
) {
  const configuredOrigin = normalizePublicSiteOrigin(configured);
  const normalizedRequestOrigin = normalizePublicSiteOrigin(requestOrigin);
  if (normalizedRequestOrigin === configuredOrigin) return configuredOrigin;

  if (!vercelDeploymentHost) {
    throw new Error("The request origin is not an approved deployment origin.");
  }
  const deploymentOrigin = normalizePublicSiteOrigin(`https://${vercelDeploymentHost}`);
  if (normalizedRequestOrigin !== deploymentOrigin) {
    throw new Error("The request origin is not an approved deployment origin.");
  }
  return deploymentOrigin;
}
