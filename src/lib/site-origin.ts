import "server-only";
import { normalizePublicSiteOrigin, resolvePublicRequestOrigin } from "@/lib/public-origin";

export function publicSiteOrigin() {
  return normalizePublicSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
}

export function publicRequestOrigin(request: Request) {
  return resolvePublicRequestOrigin(
    process.env.NEXT_PUBLIC_SITE_URL,
    new URL(request.url).origin,
    process.env.VERCEL_URL,
  );
}
