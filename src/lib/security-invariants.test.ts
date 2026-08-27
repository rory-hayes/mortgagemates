import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260826190000_production_readiness.sql", import.meta.url),
  "utf8",
);
const functionLockdown = readFileSync(
  new URL("../../supabase/migrations/20260827090000_function_execution_lockdown.sql", import.meta.url),
  "utf8",
);
const reviewWorkflow = readFileSync(
  new URL("../../supabase/migrations/20260827103000_review_workflow_lockdown.sql", import.meta.url),
  "utf8",
);
const rootLayout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const checkoutRoute = readFileSync(new URL("../app/api/stripe/checkout/route.ts", import.meta.url), "utf8");
const adminWorkspace = readFileSync(new URL("../components/admin/match-workspace.tsx", import.meta.url), "utf8");
const playwrightConfig = readFileSync(new URL("../../playwright.config.ts", import.meta.url), "utf8");
const publicE2e = readFileSync(new URL("../../e2e/public-production.spec.ts", import.meta.url), "utf8");

describe("production security invariants", () => {
  it("requires current consent and readiness throughout the match lifecycle", () => {
    expect(migration).toContain("public.profile_has_current_acceptance(p.id)");
    expect(migration).toContain("profile_submitted_at is not null");
    expect(migration).toContain("profile_submission_invalidation");
    expect(migration).toContain("preferences_submission_invalidation");
    expect(migration).toContain("public.match_participants_eligible(new.match_id)");
    expect(migration).toContain("update public.introductions set status = 'closed'");
    expect(migration).toContain("and public.match_participants_are_ready(match_id)");
  });

  it("keeps accepted document metadata and bytes immutable to buyers", () => {
    expect(migration).toContain("status <> 'accepted' or (reviewed_by is not null and reviewed_at is not null)");
    expect(migration).toMatch(/grant insert \([\s\S]*?user_id,[\s\S]*?requirement_id,[\s\S]*?storage_path,[\s\S]*?original_filename,[\s\S]*?mime_type,[\s\S]*?size_bytes[\s\S]*?\) on public\.buyer_documents to authenticated;/);
    expect(migration).toContain("and status <> 'accepted'");
    expect(migration).toContain("public.buyer_document_object_is_removable(name)");
    expect(migration).toContain("drop policy if exists buyer_document_objects_update on storage.objects;");
    expect(migration).not.toContain("create policy buyer_document_objects_update");
    expect(migration).toContain("public.prepare_document_removal");
    expect(migration).toContain("document_owner_profile_lock");
  });

  it("keeps provider session identifiers server-only", () => {
    const participantGrant = migration.match(/grant select \(([\s\S]*?)\) on public\.introductions to authenticated;/)?.[1] ?? "";
    expect(participantGrant).not.toContain("session_a_id");
    expect(participantGrant).not.toContain("session_b_id");
    expect(migration).toContain("grant execute on function public.register_stripe_gate_attempt");
  });

  it("revokes contact access when an introduction is closed for safety", () => {
    expect(migration).toMatch(/submit_safety_report[\s\S]+update public\.introductions set status = 'closed'/);
    expect(migration).toMatch(/get_unlocked_contact[\s\S]+m\.status = 'unlocked'[\s\S]+public\.match_participants_eligible\(m\.id\)/);
    expect(migration).toContain("if new.status <> 'closed'");
  });

  it("locks internal and Stripe RPCs to the minimum required database roles", () => {
    expect(functionLockdown).toContain(
      "revoke execute on all functions in schema public from public, anon, authenticated;",
    );
    expect(functionLockdown).toContain("if (select auth.role()) is distinct from 'service_role'");
    expect(functionLockdown).toContain(
      "grant execute on function public.register_stripe_gate_attempt(uuid, uuid, text, text) to service_role;",
    );
    expect(functionLockdown).toContain(
      "grant execute on function public.apply_stripe_event(text, text, text, uuid, uuid) to service_role;",
    );
    expect(functionLockdown).not.toMatch(/grant execute on function public\.apply_stripe_event\([^;]+to (?:anon|authenticated)/);
    expect(functionLockdown).not.toMatch(/grant execute on function public\.register_stripe_gate_attempt\([^;]+to (?:anon|authenticated)/);
    expect(functionLockdown).not.toMatch(/grant execute on function public\.(?:handle_new_user|enforce_[a-z_]+|refresh_member_matching_status|match_participants_eligible)\([^;]+to (?:anon|authenticated)/);
  });

  it("keeps Stripe Checkout card-only and explicitly disables Link", () => {
    expect(checkoutRoute).toContain('payment_method_types: ["card"]');
    expect(checkoutRoute).toContain('wallet_options: { link: { display: "never" } }');
    expect(checkoutRoute).toContain('const CHECKOUT_CONFIG_VERSION = "v2-card-no-link"');
    expect(checkoutRoute).toContain("mortgagemates:checkout:${CHECKOUT_CONFIG_VERSION}");
  });

  it("requires admins to lock document bytes before accepting an upload", () => {
    expect(adminWorkspace).toContain('document.status === "uploaded"');
    expect(adminWorkspace).toContain('p_status: "under_review"');
    expect(adminWorkspace).toContain('p_status: "accepted"');
    expect(adminWorkspace).toContain("the uploaded file is now locked");
  });

  it("requires a recorded profile review before approval", () => {
    expect(reviewWorkflow).toContain("if current_status <> 'under_review'");
    expect(reviewWorkflow).toContain("Start review before approving this profile");
    expect(adminWorkspace).toContain('const canApprove = member.onboarding_status === "under_review"');
  });

  it("uses one fail-closed public HTTPS origin validator in the app and hosted test runner", () => {
    expect(rootLayout).toContain("normalizePublicSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL)");
    expect(rootLayout).not.toContain("NEXT_PUBLIC_SITE_URL ??");
    expect(playwrightConfig).toContain("normalizePublicSiteOrigin(baseURL)");
    expect(playwrightConfig).toContain("normalizePublicSiteOrigin(new URL(accessUrl).origin)");
    expect(publicE2e).toContain("new URL(response.url()).origin");
    expect(publicE2e).toContain("toBe(expectedOrigin)");
  });
});
