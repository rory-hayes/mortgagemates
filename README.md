# MortgageMates

Ireland-first co-buyer matching and preparation MVP for two unrelated owner-occupier first-time buyers.

## What is implemented

- Public marketing, eligibility, safety, pricing, privacy, terms, complaints, and accessibility pages
- A clearly labelled sample portal covering matching, document readiness, alignment, and admin operations
- Supabase email authentication and protected member routes
- Six-step matching profile using financial ranges rather than exact figures
- One active, admin-reviewed introduction per member with double opt-in
- Private Supabase Storage document vault with a readiness checklist, review states, expiry fields, pair-level status, and consent records for professional handoff
- Post-mutual-interest Stripe Checkout (€49) and Stripe Identity route/webhook adapters
- Alignment workbook with private-first answers and explicit sharing
- Admin match workspace, safety reports, analytics events, and audit tables

## Evidence boundaries

The sample portal uses fictional data. A green build proves the code compiles; it does not prove a payment, identity check, broker handoff, solicitor engagement, mortgage approval, or real customer demand. Stripe routes remain unavailable until valid Stripe credentials and a webhook are configured.

## Local development

```bash
pnpm install
vercel env pull .env.local --environment development
pnpm dev
```

Open the development URL printed by Next.js. The public product tour is at `/preview`.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Environment variables

See `.env.example`. Browser-safe Supabase values use `NEXT_PUBLIC_`; the Supabase secret and all Stripe secrets are server-only.

## Supabase

The linked project is `MortgageMates` (`idbsdqiukcjmpugsqkfw`). The schema is in `supabase/migrations/20260825190000_mortgagemates_mvp.sql`.

The `buyer-documents` bucket is private. Object paths begin with the authenticated user ID, and another buyer never receives a storage policy permitting access. Pair readiness is returned through a restricted database function that exposes counts and status only.

## Operational setup before a paid pilot

Before a paid public pilot:

1. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel.
2. Register the Stripe webhook endpoint at `/api/stripe/webhook` for Checkout completion and Identity verification events.
3. Sign up the operator account, then promote that profile to `admin` directly in Supabase.
4. Complete legal review of privacy, terms, payment/refund wording, complaints, data retention, DPIA, and professional-partner arrangements.
5. Complete accessibility and security testing with realistic but non-production documents before inviting pilot users.
