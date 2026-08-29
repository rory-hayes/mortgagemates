import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
const supabaseUrl = process.env.E2E_SUPABASE_URL;
const publishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;
const adminKey = process.env.E2E_SUPABASE_ADMIN_KEY;
const buyerEmail = process.env.E2E_BUYER_EMAIL;
const enabled = Boolean(baseUrl && supabaseUrl && publishableKey && adminKey && buyerEmail);

const controlledDocumentIds = new Set<string>();
const controlledShareIds = new Set<string>();
let controlledUserId = "";
let controlledBuyerEmail = "";
let controlledAdminUserId = "";
const controlledPassword = `MortgageMates-${randomUUID()}-aA1!`;

test.describe("controlled authenticated buyer journey", () => {
  test.skip(!enabled, "Controlled Supabase E2E credentials are required.");
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }, testInfo) => {
    const atIndex = buyerEmail!.lastIndexOf("@");
    const localPart = buyerEmail!.slice(0, atIndex);
    const domain = buyerEmail!.slice(atIndex + 1);
    const projectSuffix = testInfo.project.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
    controlledBuyerEmail = `${localPart}+${projectSuffix}@${domain}`;

    const admin = createClient(supabaseUrl!, adminKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;
    let controlledUser = users.users.find(
      (user) => user.email?.toLowerCase() === controlledBuyerEmail.toLowerCase(),
    );
    if (!controlledUser) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: controlledBuyerEmail,
        password: controlledPassword,
        email_confirm: true,
        user_metadata: { first_name: "Investor" },
      });
      if (createError || !created.user) {
        throw createError ?? new Error("Controlled buyer account could not be created.");
      }
      controlledUser = created.user;
    } else {
      const { error: updateError } = await admin.auth.admin.updateUserById(controlledUser.id, {
        password: controlledPassword,
        email_confirm: true,
      });
      if (updateError) throw updateError;
    }
    controlledUserId = controlledUser.id;

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
    const { error } = await client.auth.signInWithPassword({
      email: controlledBuyerEmail,
      password: controlledPassword,
    });
    if (error) throw error;

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
  });

  test.afterAll(async () => {
    if (!enabled || !controlledUserId) return;
    const admin = createClient(supabaseUrl!, adminKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: controlledShares } = await admin
      .from("document_shares")
      .select("id")
      .eq("user_id", controlledUserId)
      .like("provider_name", "MortgageMates E2E%");
    for (const share of controlledShares ?? []) controlledShareIds.add(share.id);
    if (controlledShareIds.size) {
      const ids = [...controlledShareIds];
      await admin.from("audit_events").delete().eq("subject_type", "document_share").in("subject_id", ids);
      await admin.from("document_shares").delete().eq("user_id", controlledUserId).in("id", ids);
    }
    const { data: controlledDocuments } = await admin
      .from("buyer_documents")
      .select("id, storage_path")
      .eq("user_id", controlledUserId)
      .like("original_filename", "mortgagemates-e2e-%");
    for (const document of controlledDocuments ?? []) controlledDocumentIds.add(document.id);
    if (controlledDocumentIds.size) {
      const ids = [...controlledDocumentIds];
      const paths = (controlledDocuments ?? []).map((document) => document.storage_path);
      if (paths.length) await admin.storage.from("buyer-documents").remove(paths);
      await admin.from("audit_events").delete().eq("subject_type", "buyer_document").in("subject_id", ids);
      await admin.from("buyer_documents").delete().eq("user_id", controlledUserId).in("id", ids);
    }
    if (controlledAdminUserId) {
      await admin.auth.admin.deleteUser(controlledAdminUserId);
    }
  });

  test("authenticated routes render without browser or request failures", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      const isCancelledNextPrefetch =
        request.failure()?.errorText === "net::ERR_ABORTED" &&
        new URL(request.url()).searchParams.has("_rsc");
      if (!isCancelledNextPrefetch) {
        errors.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
      }
    });

    const routes = [
      ["/portal", "Member dashboard"],
      ["/portal/onboarding", "Profile progress"],
      ["/portal/documents", "Private document vault"],
      ["/portal/alignment", /Alignment workbook|The workbook opens after mutual interest/],
      ["/portal/settings", "Member settings"],
    ] as const;
    for (const [route, marker] of routes) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}$`));
      await expect(page.getByText(marker, { exact: true }).first()).toBeVisible();
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("document controls and readiness-gated professional handoff round-trip", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Mutation coverage runs once on desktop.");
    test.setTimeout(60_000);
    await page.goto("/portal/documents", { waitUntil: "networkidle" });
    const handoffButton = page.getByRole("button", { name: "Prepare professional handoff" });
    await expect(handoffButton, "Handoff must remain blocked until every required document is accepted.").toBeDisabled();

    const uploadRow = page.locator("div.grid.items-center.rounded-xl").filter({
      has: page.getByRole("button", { name: "Upload", exact: true }),
    }).first();
    await expect(uploadRow, "A controlled buyer must have a missing document slot.").toBeVisible();
    const requirementLabel = (await uploadRow.locator("p.font-semibold").first().innerText()).trim();
    const requirementRow = page.locator("div.grid.items-center.rounded-xl").filter({ hasText: requirementLabel });
    const filename = `mortgagemates-e2e-${Date.now()}.pdf`;
    await uploadRow.locator('input[type="file"]').setInputFiles({
      name: filename,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n"),
    });
    await expect(page.getByText(`${requirementLabel} uploaded privately.`, { exact: true })).toBeVisible();
    await expect(requirementRow.getByText(filename, { exact: true })).toBeVisible();

    const admin = createClient(supabaseUrl!, adminKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: document, error: documentError } = await admin
      .from("buyer_documents")
      .select("id")
      .eq("user_id", controlledUserId)
      .eq("original_filename", filename)
      .single();
    if (documentError || !document) throw documentError ?? new Error("Controlled upload was not persisted.");
    controlledDocumentIds.add(document.id);

    await requirementRow.getByRole("button", { name: `Remove ${requirementLabel}` }).click();
    await expect(page.getByText("Document removed.", { exact: true })).toBeVisible();
    await expect(requirementRow.getByRole("button", { name: "Upload", exact: true })).toBeVisible();

    const { data: requiredRequirements, error: requirementsError } = await admin
      .from("document_requirements")
      .select("id")
      .eq("active", true)
      .eq("required", true)
      .order("sort_order");
    if (requirementsError || !requiredRequirements?.length) {
      throw requirementsError ?? new Error("No required document checklist was available.");
    }
    const controlledAdminEmail = controlledBuyerEmail.replace("@", "+admin@");
    const { data: authUsers, error: authUsersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (authUsersError) throw authUsersError;
    let controlledAdminUser = authUsers.users.find(
      (user) => user.email?.toLowerCase() === controlledAdminEmail.toLowerCase(),
    );
    if (!controlledAdminUser) {
      const { data: createdAdmin, error: createAdminError } = await admin.auth.admin.createUser({
        email: controlledAdminEmail,
        password: controlledPassword,
        email_confirm: true,
        user_metadata: { first_name: "E2E Reviewer" },
      });
      if (createAdminError || !createdAdmin.user) {
        throw createAdminError ?? new Error("Controlled admin reviewer could not be created.");
      }
      controlledAdminUser = createdAdmin.user;
    } else {
      const { error: updateAdminError } = await admin.auth.admin.updateUserById(controlledAdminUser.id, {
        password: controlledPassword,
        email_confirm: true,
      });
      if (updateAdminError) throw updateAdminError;
    }
    controlledAdminUserId = controlledAdminUser.id;
    const { error: promoteError } = await admin
      .from("profiles")
      .update({ role: "admin", first_name: "E2E Reviewer" })
      .eq("id", controlledAdminUserId);
    if (promoteError) throw promoteError;
    const reviewerClient = createClient(supabaseUrl!, publishableKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: reviewerSignInError } = await reviewerClient.auth.signInWithPassword({
      email: controlledAdminEmail,
      password: controlledPassword,
    });
    if (reviewerSignInError) throw reviewerSignInError;

    const acceptedPdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
    const acceptedAt = Date.now();
    for (const requirement of requiredRequirements) {
      const acceptedFilename = `mortgagemates-e2e-${requirement.id}-${acceptedAt}.pdf`;
      const storagePath = `${controlledUserId}/${requirement.id}/${randomUUID()}-${acceptedFilename}`;
      const { error: storageError } = await admin.storage
        .from("buyer-documents")
        .upload(storagePath, acceptedPdf, { contentType: "application/pdf", upsert: false });
      if (storageError) throw storageError;
      const { data: acceptedDocument, error: acceptedError } = await admin
        .from("buyer_documents")
        .insert({
          user_id: controlledUserId,
          requirement_id: requirement.id,
          storage_path: storagePath,
          original_filename: acceptedFilename,
          mime_type: "application/pdf",
          size_bytes: acceptedPdf.length,
        })
        .select("id")
        .single();
      if (acceptedError || !acceptedDocument) {
        await admin.storage.from("buyer-documents").remove([storagePath]);
        throw acceptedError ?? new Error("A controlled accepted document could not be created.");
      }
      controlledDocumentIds.add(acceptedDocument.id);
      const { error: underReviewError } = await reviewerClient.rpc("admin_review_document", {
        p_document_id: acceptedDocument.id,
        p_status: "under_review",
        p_note: "Controlled E2E review started",
      });
      if (underReviewError) throw underReviewError;
      const { error: acceptReviewError } = await reviewerClient.rpc("admin_review_document", {
        p_document_id: acceptedDocument.id,
        p_status: "accepted",
        p_note: "Controlled E2E review accepted",
      });
      if (acceptReviewError) throw acceptReviewError;
    }

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("100%", { exact: true })).toBeVisible();
    await expect(handoffButton, "Handoff should unlock only after every required document is accepted.").toBeEnabled();

    const providerName = `MortgageMates E2E Broker ${Date.now()}`;
    await handoffButton.click();
    const dialog = page.getByRole("dialog", { name: "Consent to a professional handoff" });
    await dialog.getByLabel("Firm or professional name").fill(providerName);
    await dialog.getByRole("button", { name: "Record consent" }).click();
    await expect(page.getByText("Consent recorded. The pilot team will verify the handoff details.", { exact: true })).toBeVisible();
    await expect(page.getByText(providerName, { exact: true })).toBeVisible();

    const { data: share, error: shareError } = await admin
      .from("document_shares")
      .select("id")
      .eq("user_id", controlledUserId)
      .eq("provider_name", providerName)
      .single();
    if (shareError || !share) throw shareError ?? new Error("Controlled handoff consent was not persisted.");
    controlledShareIds.add(share.id);

    const shareCard = page.getByText(providerName, { exact: true }).locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
    await shareCard.getByRole("button", { name: "Revoke consent" }).click();
    await expect(page.getByText("Handoff consent revoked.", { exact: true })).toBeVisible();
    await expect(shareCard.getByText("revoked", { exact: true })).toBeVisible();
  });
});
