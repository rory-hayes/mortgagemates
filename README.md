# MortgageMates

Ireland-first co-buyer matching and preparation MVP for two unrelated owner-occupier first-time buyers.

## What is implemented

- Public marketing, eligibility, safety, pricing, privacy, terms, complaints, and accessibility pages
- A clearly labelled sample portal covering matching, document readiness, alignment, and admin operations
- Supabase email authentication and protected member routes
- Six-step matching profile using financial ranges rather than exact figures
- One active, admin-reviewed introduction per member with double opt-in
- Private Supabase Storage document vault with a readiness checklist, review states, expiry fields, pair-level status, and consent records for professional handoff
- Post-mutual-interest card-only Stripe Checkout (€49), with Link disabled, plus Stripe Identity route/webhook adapters
- Alignment workbook with private-first answers and explicit sharing
- Admin queues for profile and document review, matching, safety reports, and professional handoffs
- Explicit versioned terms, privacy, and risk consent before profile submission
- Idempotent Stripe sessions with an atomic, retryable webhook event ledger
- An explicit server-only mock gate mode for protected MVP testing; the portal labels it clearly and records separate mock audit events

## Evidence boundaries

The sample portal uses fictional data. A green build proves the code compiles; it does not prove a payment, identity check, broker handoff, solicitor engagement, mortgage approval, or real customer demand. Stripe routes require valid environment-specific credentials and a matching signed webhook destination. Setting the server-only `MORTGAGEMATES_INTRODUCTION_GATE_MODE=mock` exercises the unlock flow without Stripe; it never means that an identity was verified or a payment was collected.

## Hosted verification only

Browser and end-to-end checks target a public HTTPS Vercel deployment. The default Playwright target is `https://mortgagemates.vercel.app`; override it only with another public HTTPS preview through `PLAYWRIGHT_BASE_URL`.

For a deployment protected by Vercel, provide an approved `VERCEL_AUTOMATION_BYPASS_SECRET` or one-time `PLAYWRIGHT_ACCESS_URL` through the test environment. The suite verifies the final response origin and MortgageMates content, so Vercel's login page cannot be mistaken for a passing application check.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

## Environment variables

See `.env.example`. Browser-safe Supabase values use `NEXT_PUBLIC_`; the Supabase secret and all Stripe secrets are server-only.

## Supabase

The linked project is `MortgageMates` (`idbsdqiukcjmpugsqkfw`). The schema is additive: the original MVP migration is followed by production-readiness, function-permission, and review-workflow lockdown migrations.

The `buyer-documents` bucket is private. Object paths begin with the authenticated user ID, and another buyer never receives a storage policy permitting access. Pair readiness is returned through a restricted database function that exposes counts and status only.

## Operational setup before a paid pilot

Before a paid public pilot:

1. Confirm environment-specific `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` values in Vercel.
2. Confirm the Stripe webhook endpoint at `/api/stripe/webhook` receives Checkout completion and Identity verification events.
3. Sign up the operator account, then promote that profile to `admin` directly in Supabase.
4. Complete legal review of privacy, terms, payment/refund wording, complaints, data retention, DPIA, and professional-partner arrangements.
5. Complete accessibility and security testing with realistic but non-production documents before inviting pilot users.
