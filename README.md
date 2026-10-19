# PrezzStore

A Next.js creator marketplace for digital products, customizable shops and monthly memberships. Deployed using Vercel and backed by the shared **zuzify** Supabase project.

## Isolation from existing apps

- Supabase project: zuzify, ref wfqudstuncdldsvxqveu
- Tables: prezzstore_stores, prezzstore_products, prezzstore_orders, prezzstore_donations
- Storage: prezzstore_assets (public image covers), prezzstore_deliveries (private downloadable files)
- Tables use RLS to restrict seller changes and buyer purchase histories; webhook writes are server-only.
- Authentication uses the shared Supabase Auth users, not a separate identity pool.

The schema from supabase/migrations/001_prezzstore.sql was applied to the shared project. Do not run it again unless you are migrating a different environment.

## Hosting setup

Deploy GitHub repo taithedev/PrezzStore to Vercel (Next.js preset, default root). Configure:

- NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY: publishable key
- SUPABASE_SERVICE_ROLE_KEY: server-only backend key, never put it in NEXT_PUBLIC
- NEXT_PUBLIC_SITE_URL: HTTPS base URL of the live app
- STRIPE_SECRET_KEY: restricted **Stripe sandbox** key during development
- STRIPE_WEBHOOK_SECRET: signing secret for /api/stripe/webhook (required before checkout is enabled)
- PREZZSTORE_PLATFORM_FEE_BPS: optional, 1000 by default for 10% seller-sale commission; set to 1000 in Vercel if a previous 800 override exists
- STRIPE_CONNECT_COUNTRY: us by default

Use Vercel sensitive environment variables for server secrets. No private keys belong in GitHub source.

In Supabase Auth settings, allow the Vercel domain plus /auth/callback and /auth/reset as redirect URLs. Configure an SMTP sender for production email delivery.

In Stripe sandbox, set the webhook destination to https://YOUR_DOMAIN/api/stripe/webhook. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed, and charge.refunded. Enable the Billing Portal for customers to manage subscriptions.

## Features

Marketplace, search, category filters, sorting, digital listings, file uploads, storefront themes and banner images, subscriptions, Stripe Connect seller onboarding, protected downloads, checkout, order history, billing portal, password recovery and account signup. Sellers upload listings to Supabase; their Stripe Checkout sessions are created dynamically and PrezzStore's default platform fee is 10% of the item price. Visitors can optionally support the platform at `/donate` using a separate Stripe payment; those contributions are NOT routed to marketplace sellers.

## Production readiness

Stripe live payments are NOT automatically enabled. Seller onboarding and payouts require eligibility and identity verification; for sellers under age 18, Stripe may require a parent or guardian as account representative. Before opening a public marketplace, implement and test moderation, malware scanning, seller reporting, webhook idempotency, refunds/chargeback processes, subscription lifecycle handling, tax setup and relevant legal policies. Never bypass age verification.

Run npm install, npm run typecheck, and npm run build to test locally. GitHub Actions performs these checks on pushes.


## Stripe sandbox readiness checklist

1. In the Stripe sandbox Dashboard, enable Connect for marketplace payments.
2. In Vercel > PrezzStore > Settings > Environment Variables, add the **restricted Stripe sandbox key** as `STRIPE_SECRET_KEY` (server-side only) and the private Supabase service-role key as `SUPABASE_SERVICE_ROLE_KEY`. Use sensitive variables. Do not put them in GitHub.
3. Deploy a valid HTTPS URL. Set `NEXT_PUBLIC_SITE_URL` to the exact deployed origin (for example, https://your-domain.example). Preview and production deployments should use their actual origins.
4. Create a Stripe webhook destination pointing at `https://YOUR-DOMAIN/api/stripe/webhook`. Copy the destination signing secret to Vercel as `STRIPE_WEBHOOK_SECRET`.
5. Send `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, and `charge.refunded` events to that endpoint.
6. Enable the Stripe Billing customer portal for membership subscription management in the sandbox Dashboard.
7. Create a test creator account, visit Creator studio > Payments, and complete Stripe sandbox onboarding. The dashboard will show status `active` only when Stripe reports that the seller can receive transfers.
8. With a **different** test buyer account, make a Stripe test purchase. Verify the signed webhook changes the database order to `paid` and only the buyer can download a privately stored file. Check subscription updates, cancellation, and failed payments in the sandbox.
9. Refunds/disputes require additional operations tooling and transfer reversal controls before offering live marketplace sales.

The app blocks Checkout until the restricted key, signing secret, and database service key are all configured. Vercel production rejects sandbox keys for paid checkout and requires both a live key and the explicit `PREZZSTORE_LIVE_PAYMENTS_ENABLED=true` switch. Nonproduction deployments can use sandbox keys for testing. Seller Connect onboarding may proceed with a live key before Checkout is enabled so eligible sellers can finish verification first. Do not set the live switch until eligibility, adult account ownership where required, seller risk controls, and webhook purchase testing are complete. Stripe may require a legal guardian to participate in account setup for sellers under 18. There is no workaround for identity verification.

## Troubleshooting

- **Stripe setup required** in Creator studio: Vercel has not been given all server-only credentials.
- **Seller payments aren't ready**: the connected account's Stripe transfers capability or payouts are not active; complete Stripe-hosted onboarding and revisit Payments for status.
- **Signed webhook failures**: confirm the event destination URL and its unique signing secret; don't reuse a CLI secret on Vercel.
- **Orders stay pending**: verify the webhook is subscribed and reachable; Checkout return URLs alone never mark an order paid.
- **Membership management unavailable**: enable Billing customer portal for the sandbox.
- **Vercel app not deployed**: import the GitHub repository into the intended Vercel team and grant deployment permissions; no billing credentials should be put in source files.

## October 2026 improvements

- The Creator Studio now reads the actual `prezzstore_stores` and `prezzstore_products` tables, fixing the missing-store dashboard.
- Listing creation and editing use authenticated Next.js API routes, validate prices, and respect Supabase row-level security. Sellers can save drafts, publish or unpublish listings, and edit titles and prices.
- Sales overview reads the seller's own order history, and private digital downloads are bound to that order's seller-owned storage prefix.
- Appearance Studio (`/appearance`) supports OLED black, graphite and high-contrast styles, snow and stars, compact density, intensity and reduced motion. Signed-in users' choices persist in `prezzstore_preferences`.
- These schema changes are additive and isolated from other apps in the shared Supabase project; see `supabase/migrations/002_prezzstore_preferences.sql`. This migration is already applied to zuzify.
- Server-side Stripe configuration accepts either `STRIPE_SECRET_KEY` or the Vercel integration name `PREZZSTORE_STRIPE_SECRET_KEY`. Live payments remain deliberately gated by `PREZZSTORE_LIVE_PAYMENTS_ENABLED=true` **only after eligibility and legal/operational verification**. Never expose a secret key to the browser.

### Payment configuration still required

The Vercel-managed Stripe integration installs `PREZZSTORE_STRIPE_SECRET_KEY`, but the `STRIPE_WEBHOOK_SECRET` signing key must be set separately. Until a signed webhook is configured, Checkout intentionally remains unavailable so purchases cannot be falsely marked paid. Test in Stripe sandbox with a verified eligible seller account and a separate buyer before considering live payments. If the account operator is under 18, Stripe may require an adult account representative; never bypass account or identity restrictions.

After deployment, visit `/dashboard`, `/appearance`, and `/orders` to validate your account, and run `npm run typecheck && npm test && npm run build` for code regression checks.

## Stripe Connect compatibility (Accounts v2 unavailable)

This deployment previously used the Accounts v2 API, but the connected sandbox returned
`accounts_v2_access_blocked`. The seller-account integration now uses the official
Accounts v1 controller-properties API (an Express-style Stripe-hosted onboarding flow):
`stripe.accounts.create`, `stripe.accountLinks.create`, and
`stripe.accounts.retrieve`. It checks both active `transfers` capability and
`payouts_enabled` before checkout is allowed. The v1 creation idempotency key is
scoped to the PrezzStore store UUID; seller identity still belongs to Stripe.

Stripe recommends Accounts v2 for new platforms, and Accounts v1 account creation
may require official support or an enabled compatibility feature. **Do not bypass
Stripe Connect platform registration, account verification, legal requirements,
or guardian requirements for underage sellers.** An eligible platform account
representative must complete Stripe's onboarding if the sandbox is restricted.
Official reference: https://docs.stripe.com/connect/migrate-to-controller-properties
and https://support.stripe.com/questions/fix-the-accounts-v1-is-no-longer-recommended-error-for-connect-integrations

The platform remains in sandbox/test mode, and production payments are not enabled.
A seller must initiate and complete the hosted Stripe identity process themselves
(or with the required legal guardian). Never create fake personal data to pass checks.


## 10% marketplace commission and optional support contributions

- Seller sales use existing destination-charge Checkout: 10% application fee (10.00% for recurring memberships), remainder routes to the seller's Connect account. Stripe payment/Connect costs, taxes, refunds and disputes are separate; do not assume the seller receives 90% net after those costs.
- This 10% commission does **not** add 10% on top of the buyer's listed price. There is no manual Stripe catalog management for creators; Checkout uses dynamic `price_data`.
- `PREZZSTORE_PLATFORM_FEE_BPS=1000` in the Vercel environment, especially if previously explicitly set to 800. Redeploy after changing environment variables.
- Apply `supabase/migrations/004_prezzstore_donations.sql` to the **zuzify** project. Only service-role API handlers access donation records; no public donor data or unverified totals.
- `/donate` offers voluntary $1–$500 contributions to **PrezzStore itself**. These are not tax-deductible charitable donations and are not a request to support individual creators.
- `POST /api/donate` validates the price server-side, creates a DB record, creates a one-time Stripe Checkout Session to the platform account (no `transfer_data` or `application_fee_amount`), and redirects. Signed `/api/stripe/webhook` events confirm payment, mark failed attempts, and handle full charge refunds.
- A donation success redirect is informational only: Stripe's signed webhook, not the browser redirect, marks a donation paid.
- Donate checkout requires `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and the existing restricted sandbox Stripe secret key. No live payments until adult-owned/eligible Stripe account setup and legal review.
- Stripe processing fees generally reduce the amount received by PrezzStore. Users should not be told all of a contribution reaches the marketplace.

## Order receipts and email

Buyers can open /orders and select Receipt for any paid, refunded or free order. Each server-rendered receipt checks Supabase authentication and order ownership before displaying purchase details. Use Print / save PDF in the browser. Free items also appear in order history.

For automatic transactional email, configure **both** RESEND_API_KEY and PREZZSTORE_RECEIPT_FROM (a sender on a verified domain) in Vercel. This sends one receipt after signed Stripe webhook confirmation and one for a free checkout, without sending user data to public pages. Mail delivery is tracked in the private prezzstore_order_receipt_emails table. Receipts deliberately do not claim tax-exempt/charitable status.

For Stripe-managed paid payment receipts, enable Settings -> Customer emails -> Successful payments in the **same Stripe account** used by your deployment and verify Checkout has customer email. Stripe and Resend may send separate emails if both are turned on: select the option you prefer. Do not paste API secrets into GitHub or browser code.

The email delivery integration is optional; if no verified Resend sender is configured, receipts remain accessible on screen but PrezzStore cannot directly send emails for free items. Set up a sender before promising automatic free-item emails.

## Account, studio collaborators and PrezzCreator+

- Authenticated header now exposes **My account** next to **My studio**. /account shows confirmed email, marketplace role, account links, connected studios and reward points.
- Studio > **Collaborators** allows an owner to add **already registered and email-confirmed** users by exact email, change their role and remove access. This is a direct assignment, not an emailed invitation.
- **Manager** can edit shop appearance, create/edit all shop listings and publish. **Reviewer** can approve a pending creator submission or request changes, but cannot edit products or the store. **Creator** can submit and edit only their own private products; edits remain unpublished until reviewed.
- Regular studios may assign up to **3 collaborators**; eligible PrezzCreator+ studios may assign up to **10**. Permission enforcement is server-side; an atomic Postgres function handles seat allocation. Owners have separate access and cannot be removed through the team page. When a store loses qualification, existing collaborators remain until explicitly removed; the lower seat limit applies to new assignments.
- `/creator-plus` documents the tier. Studio > PrezzCreator+ shows real rolling progress. To qualify, a store must be at least **14 days old**, have **2 published listings**, and **$50 in at least 3 paid, nonrefunded orders from 2 distinct buyers within the preceding 30 days**, and have no suspension. Free orders and refunds do not count. No paid subscription or activation key is required.
- Qualified stores receive **5%** platform commission (or the lower configured standard fee), a PrezzCreator+ label on their storefront and **10 collaborator seats**. Platform owners retain their existing ability to change the standard rate. Eligibility is recomputed server-side for new Checkouts; **existing subscription fees do not automatically change** when eligibility changes.
- Migrations `005_prezzstore_creator_plus_collaboration.sql` and `006_prezzstore_atomic_team_seats.sql` are applied to the shared **zuzify** project. Keep new PrezzStore SQL separate from other apps.
- This feature does not bypass Stripe Connect seller identity requirements or enable live payments.

### Profiles, shops, and listing options

The shop directory on the home and Discover pages includes every active studio, including studios with no published products. The official Zuzify shop appears first when its record exists. Every signed-in account can edit its public username, display name, bio, website, picture, and banner from My Account. Creator studios can separately set their shop name, picture, banner, description, and accent color. Product drafts may add an optional subtitle, tags, highlights, delivery details, and up to five gallery images. Uploaded images use the existing `prezzstore_assets` bucket and each account's own folder.

Apply `supabase/migrations/011_prezzstore_profiles_listing_options.sql` before deploying the corresponding code. For paid purchases, configure the Stripe webhook at `/api/stripe/webhook` with the signing secret in `STRIPE_WEBHOOK_SECRET`. Subscribe it to Checkout completion and asynchronous success/failure, expiration, subscription changes, invoice payment failure, and charge refunds handled by the route. Keep `PREZZSTORE_LIVE_PAYMENTS_ENABLED` disabled until the Stripe platform and seller accounts are eligible and the webhook has been tested.
