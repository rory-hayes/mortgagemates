import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
const supabaseUrl = process.env.E2E_SUPABASE_URL;
const publishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;
const adminKey = process.env.E2E_SUPABASE_ADMIN_KEY;
const buyerEmail = process.env.E2E_BUYER_EMAIL;
const enabled = Boolean(baseUrl && supabaseUrl && publishableKey && adminKey && buyerEmail);

type ControlledUser = { id: string; email: string; firstName: string };

test.describe("controlled Production buyer lifecycle", () => {
  test.skip(!enabled, "Controlled Supabase E2E credentials are required.");

  test("AI proposal, mutual opt-in, mock gates, and contact unlock", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "The mutating lifecycle runs once on desktop.");
    test.setTimeout(120_000);

    const service = createClient(supabaseUrl!, adminKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const runToken = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const atIndex = buyerEmail!.lastIndexOf("@");
    const localPart = buyerEmail!.slice(0, atIndex);
    const domain = buyerEmail!.slice(atIndex + 1);
    const password = `MortgageMates-${randomUUID()}-aA1!`;
    const controlledUsers: ControlledUser[] = [];
    const documentIds: string[] = [];
    const storagePaths: string[] = [];
    const matchIds: string[] = [];
    const contexts: BrowserContext[] = [];

    try {
      const buyerA = await createControlledUser(
        service,
        `${localPart}+lifecycle-a-${runToken}@${domain}`,
        "Lifecycle A",
        password,
      );
      controlledUsers.push(buyerA);
      const buyerB = await createControlledUser(
        service,
        `${localPart}+lifecycle-b-${runToken}@${domain}`,
        "Lifecycle B",
        password,
      );
      controlledUsers.push(buyerB);
      const reviewer = await createControlledUser(
        service,
        `${localPart}+lifecycle-reviewer-${runToken}@${domain}`,
        "E2E Reviewer",
        password,
      );
      controlledUsers.push(reviewer);

      const { error: reviewerRoleError } = await service
        .from("profiles")
        .update({ role: "admin", first_name: reviewer.firstName })
        .eq("id", reviewer.id);
      if (reviewerRoleError) throw reviewerRoleError;

      const uniqueLocation = `MortgageMates E2E District ${runToken}`;
      for (const buyer of [buyerA, buyerB]) {
        await prepareBuyerProfile(service, buyer, uniqueLocation);
        const buyerClient = await signedInClient(buyer.email, password);
        const { error: submitError } = await buyerClient.rpc("submit_profile_for_review", {
          p_terms_version: "2026-08-26",
          p_privacy_version: "2026-08-26",
          p_risk_version: "2026-08-26",
        });
        if (submitError) throw submitError;
      }

      const reviewerClient = await signedInClient(reviewer.email, password);
      for (const buyer of [buyerA, buyerB]) {
        const { error: startReviewError } = await reviewerClient.rpc("admin_review_profile", {
          p_user_id: buyer.id,
          p_status: "under_review",
          p_note: "Controlled E2E profile review started",
        });
        if (startReviewError) throw startReviewError;
        const { error: approvalError } = await reviewerClient.rpc("admin_review_profile", {
          p_user_id: buyer.id,
          p_status: "approved",
          p_note: "Controlled E2E profile approved",
        });
        if (approvalError) throw approvalError;
      }

      const { data: requirements, error: requirementsError } = await service
        .from("document_requirements")
        .select("id")
        .eq("active", true)
        .eq("required", true)
        .order("sort_order");
      if (requirementsError || !requirements?.length) {
        throw requirementsError ?? new Error("No required Production document checklist was available.");
      }
      const fixturePdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
      for (const buyer of [buyerA, buyerB]) {
        for (const requirement of requirements) {
          const filename = `mortgagemates-e2e-lifecycle-${requirement.id}-${runToken}.pdf`;
          const storagePath = `${buyer.id}/${requirement.id}/${randomUUID()}-${filename}`;
          const { error: storageError } = await service.storage
            .from("buyer-documents")
            .upload(storagePath, fixturePdf, { contentType: "application/pdf", upsert: false });
          if (storageError) throw storageError;
          storagePaths.push(storagePath);
          const { data: document, error: documentError } = await service
            .from("buyer_documents")
            .insert({
              user_id: buyer.id,
              requirement_id: requirement.id,
              storage_path: storagePath,
              original_filename: filename,
              mime_type: "application/pdf",
              size_bytes: fixturePdf.length,
            })
            .select("id")
            .single();
          if (documentError || !document) {
            throw documentError ?? new Error("A controlled lifecycle document could not be created.");
          }
          documentIds.push(document.id);
          const { error: reviewStartError } = await reviewerClient.rpc("admin_review_document", {
            p_document_id: document.id,
            p_status: "under_review",
            p_note: "Controlled E2E document review started",
          });
          if (reviewStartError) throw reviewStartError;
          const { error: reviewAcceptError } = await reviewerClient.rpc("admin_review_document", {
            p_document_id: document.id,
            p_status: "accepted",
            p_note: "Controlled E2E document accepted",
          });
          if (reviewAcceptError) throw reviewAcceptError;
        }
      }

      const { data: readyProfiles, error: readyError } = await service
        .from("profiles")
        .select("id, matching_status")
        .in("id", [buyerA.id, buyerB.id]);
      if (readyError) throw readyError;
      expect(readyProfiles).toHaveLength(2);
      expect(readyProfiles?.every((profile) => profile.matching_status === "ready")).toBe(true);

      const contextA = await authenticatedContext(browser, buyerA.email, password);
      contexts.push(contextA);
      const contextB = await authenticatedContext(browser, buyerB.email, password);
      contexts.push(contextB);
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();
      const browserErrors: string[] = [];
      monitorPage(pageA, "buyer-a", browserErrors);
      monitorPage(pageB, "buyer-b", browserErrors);

      await pageA.goto("/portal", { waitUntil: "networkidle" });
      await expect(pageA.getByRole("button", { name: "Find my AI match" })).toBeVisible();
      await pageA.getByRole("button", { name: "Find my AI match" }).click();
      await expect(pageA.getByText("One person worth considering", { exact: true })).toBeVisible({ timeout: 45_000 });
      await expect(pageA.getByText(/Lifecycle B, 30–34/)).toBeVisible();

      const { data: proposedMatch, error: matchError } = await service
        .from("matches")
        .select("id, status, source, overall_score, user_a, user_b")
        .or(`and(user_a.eq.${buyerA.id},user_b.eq.${buyerB.id}),and(user_a.eq.${buyerB.id},user_b.eq.${buyerA.id})`)
        .eq("status", "proposed")
        .single();
      if (matchError || !proposedMatch) {
        throw matchError ?? new Error("The controlled AI proposal was not persisted.");
      }
      matchIds.push(proposedMatch.id);
      expect(proposedMatch.source).toBe("ai");
      expect(proposedMatch.overall_score).toBeGreaterThanOrEqual(70);

      await pageB.goto("/portal", { waitUntil: "networkidle" });
      await expect(pageB.getByText("One person worth considering", { exact: true })).toBeVisible();
      await expect(pageB.getByText(/Lifecycle A, 30–34/)).toBeVisible();

      await pageA.getByRole("button", { name: /I’m interested/ }).click();
      await expect(pageA.getByText("Interest recorded privately", { exact: true })).toBeVisible();
      await pageB.getByRole("button", { name: /I’m interested/ }).click();
      await expect(pageB.getByText("Pilot simulation", { exact: true })).toBeVisible();
      await pageA.reload({ waitUntil: "networkidle" });
      await expect(pageA.getByText("Pilot simulation", { exact: true })).toBeVisible();

      await completeMockGates(pageA, false);
      await completeMockGates(pageB, true);
      await expect(pageB.getByText("Contact details are unlocked", { exact: true })).toBeVisible();
      await expect(pageB.getByText(buyerA.email, { exact: true })).toBeVisible();
      await pageA.reload({ waitUntil: "networkidle" });
      await expect(pageA.getByText("Contact details are unlocked", { exact: true })).toBeVisible();
      await expect(pageA.getByText(buyerB.email, { exact: true })).toBeVisible();

      const [{ data: finalMatch, error: finalMatchError }, { data: introduction, error: introductionError }] = await Promise.all([
        service.from("matches").select("status").eq("id", proposedMatch.id).single(),
        service.from("introductions").select("status, identity_a_status, identity_b_status, payment_a_status, payment_b_status, contact_unlocked_at").eq("match_id", proposedMatch.id).single(),
      ]);
      if (finalMatchError || !finalMatch) throw finalMatchError ?? new Error("Final match state was not available.");
      if (introductionError || !introduction) throw introductionError ?? new Error("Final introduction state was not available.");
      expect(finalMatch.status).toBe("unlocked");
      expect(introduction).toMatchObject({
        status: "unlocked",
        identity_a_status: "verified",
        identity_b_status: "verified",
        payment_a_status: "paid",
        payment_b_status: "paid",
      });
      expect(introduction.contact_unlocked_at).toBeTruthy();

      const { count: mockGateEvents, error: mockAuditError } = await service
        .from("audit_events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", "mock_gate_completed")
        .eq("subject_id", proposedMatch.id);
      if (mockAuditError) throw mockAuditError;
      expect(mockGateEvents).toBe(4);
      expect(browserErrors, browserErrors.join("\n")).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
      await cleanupControlledLifecycle(service, controlledUsers, documentIds, storagePaths, matchIds);
    }
  });
});

async function createControlledUser(
  service: SupabaseClient,
  email: string,
  firstName: string,
  password: string,
): Promise<ControlledUser> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName },
  });
  if (error || !data.user) throw error ?? new Error("A controlled lifecycle account could not be created.");
  return { id: data.user.id, email, firstName };
}

async function prepareBuyerProfile(
  service: SupabaseClient,
  buyer: ControlledUser,
  targetLocation: string,
) {
  const [{ error: profileError }, { error: preferenceError }, { error: contactError }] = await Promise.all([
    service.from("profiles").update({
      first_name: buyer.firstName,
      age_band: "30–34",
      occupation_sector: "Controlled E2E testing",
      onboarding_step: 6,
      last_active_at: new Date().toISOString(),
    }).eq("id", buyer.id),
    service.from("buyer_preferences").update({
      first_time_buyer: true,
      irish_resident: true,
      owner_occupier: true,
      open_to_unrelated_cobuyer: true,
      buying_as_pair_only: true,
      purchase_timeline: "6–12 months",
      income_range: "€60,000–€74,999",
      deposit_range: "€50,000–€74,999",
      borrowing_range: "€260,000–€319,999",
      monthly_housing_budget_range: "€1,400–€1,699",
      target_locations: [targetLocation],
      property_types: ["Townhouse"],
      must_haves: ["Sustainable monthly costs", "Reliable transport"],
      household_preferences: {
        noise: "Balanced",
        workFromHome: "2–3 days",
        guests: "Occasional",
        pets: "Open to discussing",
      },
      future_plans: { controlledFixture: true },
      ownership_expectations: {
        horizon: "5–7 years",
        shares: "Equal ownership",
        earlyExit: "Independent valuation and agreed notice",
        missedPayments: "Emergency buffer then legal process",
      },
      bio: "Controlled lifecycle profile used only for Production end-to-end verification.",
    }).eq("user_id", buyer.id),
    service.from("contact_preferences").update({
      email: buyer.email,
      phone: null,
      preferred_channel: "email",
    }).eq("user_id", buyer.id),
  ]);
  if (profileError || preferenceError || contactError) {
    throw profileError ?? preferenceError ?? contactError;
  }
}

async function signedInClient(email: string, password: string) {
  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function authenticatedContext(browser: Browser, email: string, password: string) {
  let jar: Array<{
    name: string;
    value: string;
    options?: { httpOnly?: boolean; sameSite?: string | boolean };
  }> = [];
  const client = createBrowserClient(supabaseUrl!, publishableKey!, {
    cookies: {
      getAll: () => jar,
      setAll: (updates) => {
        for (const update of updates) {
          jar = jar.filter((item) => item.name !== update.name);
          if (update.value) jar.push(update);
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const context = await browser.newContext({ baseURL: baseUrl! });
  await context.addCookies(jar.map((cookie) => {
    const sameSite = String(cookie.options?.sameSite ?? "lax").toLowerCase();
    return {
      name: cookie.name,
      value: cookie.value,
      url: baseUrl!,
      httpOnly: Boolean(cookie.options?.httpOnly),
      secure: true,
      sameSite: sameSite === "strict" ? "Strict" as const : sameSite === "none" ? "None" as const : "Lax" as const,
    };
  }));
  return context;
}

function monitorPage(page: Page, label: string, errors: string[]) {
  page.on("pageerror", (error) => errors.push(`${label} pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label} console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    const isCancelledNextPrefetch = failure === "net::ERR_ABORTED" && new URL(request.url()).searchParams.has("_rsc");
    if (!isCancelledNextPrefetch) errors.push(`${label} requestfailed: ${request.method()} ${request.url()} ${failure}`);
  });
}

async function completeMockGates(page: Page, unlocksContact: boolean) {
  await page.getByRole("button", { name: "Simulate identity step" }).click();
  await page.waitForURL(/\/portal\?mock=identity-complete$/);
  await expect(page.getByRole("button", { name: "Identity gate complete" })).toBeVisible();
  await page.getByRole("button", { name: "Simulate payment step" }).click();
  await page.waitForURL(/\/portal\?mock=payment-complete$/);
  if (unlocksContact) {
    await expect(page.getByText("Contact details are unlocked", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Payment gate complete" })).toBeVisible();
  }
}

async function cleanupControlledLifecycle(
  service: SupabaseClient,
  users: ControlledUser[],
  knownDocumentIds: string[],
  knownStoragePaths: string[],
  knownMatchIds: string[],
) {
  const buyerIds = users.filter((user) => !user.email.includes("+lifecycle-reviewer-")).map((user) => user.id);
  const userIds = users.map((user) => user.id);
  let matchIds = [...knownMatchIds];
  if (buyerIds.length) {
    const participantFilter = buyerIds.flatMap((id) => [`user_a.eq.${id}`, `user_b.eq.${id}`]).join(",");
    const { data: matches } = await service.from("matches").select("id").or(participantFilter);
    matchIds = [...new Set([...matchIds, ...(matches ?? []).map((match) => match.id)])];
  }
  if (buyerIds.length) await service.from("ai_matching_runs").delete().in("requested_by", buyerIds);
  if (matchIds.length) await service.from("matches").delete().in("id", matchIds);

  let documentIds = [...knownDocumentIds];
  let storagePaths = [...knownStoragePaths];
  if (buyerIds.length) {
    const { data: documents } = await service
      .from("buyer_documents")
      .select("id, storage_path")
      .in("user_id", buyerIds)
      .like("original_filename", "mortgagemates-e2e-lifecycle-%");
    documentIds = [...new Set([...documentIds, ...(documents ?? []).map((document) => document.id)])];
    storagePaths = [...new Set([...storagePaths, ...(documents ?? []).map((document) => document.storage_path)])];
  }
  if (storagePaths.length) await service.storage.from("buyer-documents").remove(storagePaths);
  if (documentIds.length) await service.from("buyer_documents").delete().in("id", documentIds);

  const subjectIds = [...new Set([...userIds, ...documentIds, ...matchIds])];
  if (userIds.length) await service.from("audit_events").delete().in("actor_id", userIds);
  if (subjectIds.length) await service.from("audit_events").delete().in("subject_id", subjectIds);
  for (const user of [...users].reverse()) await service.auth.admin.deleteUser(user.id);
}
